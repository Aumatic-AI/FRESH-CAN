// Single-shot video, the DEFAULT video flow: one 30s Seedance 2.5 text-to-video
// clip with native audio. Started by the EXISTING
// POST /api/jobs/[jobId]/video/generate route; ENABLE_SINGLE_SHOT=false falls
// back to the older scene-by-scene pipeline and this function is not triggered.
//
// Two stages, with the same approval gate as the scene pipeline:
//  1. content/single-shot.generate: enhance the user's idea into an ad-reel prompt
//     (OpenAI) and save it as the draft (content_drafts.draft_data.single_shot);
//     the pipeline stops at 'draft_ready' so the user can read and edit it.
//  2. content/single-shot.render, sent by POST /video/approve: submit the approved
//     prompt to KIE once -> poll (sleeping between polls, so no invocation stays open
//     for the render) -> store in freshcan-videos + generated_content -> job ready.
// No ElevenLabs, no AssemblyAI and no FFmpeg step.
import { inngest } from '../client'
import {
  createServiceClient,
  claimPipeline,
  upsertVideoScriptDraft,
  markJobDraftReadyIfPending,
} from '../../server/pipeline/db'
import { OpenAIScriptGenerator } from '../../server/pipeline/adapters/openai'
import { FakeKieVideoGenerator } from '../../server/pipeline/adapters/kieFake'
import {
  FakeSingleShotGenerator,
  KieSingleShotGenerator,
  type SingleShotGenerator,
} from '../../server/pipeline/adapters/kieSingleShot'
import { SupabaseVideoStorageUploader } from '../../server/pipeline/adapters/storage'
import { enhanceSingleShotPrompt } from '../../server/pipeline/steps/singleShot/enhancePrompt'
import { writeSingleShotNarration } from '../../server/pipeline/steps/singleShot/writeNarration'
import {
  finalizeSingleShot,
  pollSingleShot,
  submitSingleShot,
  SingleShotStoppedError,
  recordSingleShotTaskFailed,
  recordSingleShotTimeout,
} from '../../server/pipeline/steps/singleShot/generateSingleShot'
import {
  readSingleShotDraft,
  spokenScript,
  toSingleShotDraft,
} from '../../server/pipeline/steps/singleShot/updateSingleShot'
import { AssemblyAITranscriptionService } from '../../server/pipeline/adapters/assemblyai'
import { ElevenLabsVoiceSynthesizer } from '../../server/pipeline/adapters/elevenlabs'
import { videoStoragePublicUrl } from '../../server/pipeline/adapters/storage'
import { lineStartsFromTranscript, parseTimedWords, estimateLineStarts } from '../../server/pipeline/lib/lineTiming'
import { FakeVoiceSynthesizer, renderFrenchTrack } from '../../server/pipeline/steps/singleShot/frenchTrack'
import { adaptSingleShotFrench } from '../../server/pipeline/steps/singleShot/adaptFrench'
import type { SingleShotJobLanguage } from '../../server/pipeline/prompts/singleShot'
import { SINGLE_SHOT_DURATION_SECONDS } from '../../server/pipeline/prompts/singleShot'
import { BRAND_PROFILE } from '../../server/pipeline/prompts/index'
import { env } from '../../server/pipeline/env'
import { getApiKey } from '../../server/pipeline/credentials'
import { failJobOnRunFailure } from '../runFailure'
import {
  RUNNING_PIPELINE_STATUSES,
  failPipelineIfRunning,
  getDraftKind,
  getPipelineStatus,
  getTrackStatus,
  isPipelineStopped,
} from '../../server/pipeline/steps/singleShot/runState'

type AspectRatio = '9:16' | '1:1' | '16:9'

const POLL_INTERVAL = '20s'
// 90 polls x 20s = 30 minutes before giving up on a 30s render.
const MAX_POLL_ITERATIONS = 90

const client = createServiceClient()

function toJobLanguage(v: unknown): SingleShotJobLanguage {
  return v === 'FR' || v === 'BOTH' ? v : 'EN'
}

async function singleShotGenerator(jobId: string): Promise<SingleShotGenerator> {
  if (env.KIE_FAKE_MODE) {
    const fake = await new FakeKieVideoGenerator().poll({ providerRef: 'fake' })
    return new FakeSingleShotGenerator(fake.status === 'ready' ? fake.fileUrl : '')
  }
  return new KieSingleShotGenerator(await getApiKey('kie', { jobId }), env.SINGLE_SHOT_MODEL)
}

export const singleShotGenerate = inngest.createFunction(
  {
    id: 'single-shot-generate',
    triggers: [{ event: 'content/single-shot.generate' }],
    onFailure: failJobOnRunFailure,
    concurrency: { key: 'event.data.pipelineId', limit: 1 },
  },
  async ({ event, step }) => {
    const { pipelineId, jobId } = event.data as { pipelineId: string; jobId: string }

    const job = await step.run('fetch-job', async () => {
      const { data, error } = await client
        .from('content_jobs')
        .select('topic, category, target_audience, aspect_ratio, scene_notes, language')
        .eq('id', jobId)
        .single()
      if (error || !data) throw new Error(`Failed to load content_jobs row ${jobId}: ${error?.message ?? 'not found'}`)
      const pipeline = await client.from('content_pipelines').select('current_generation').eq('id', pipelineId).single()
      if (pipeline.error || !pipeline.data) throw new Error(`Failed to load content_pipelines row ${pipelineId}`)
      return {
        topic: (data.topic as string) ?? '',
        category: (data.category as string) ?? '',
        targetAudience: (data.target_audience as string) ?? '',
        aspectRatio: ((data.aspect_ratio as AspectRatio | null) ?? '9:16') as AspectRatio,
        idea: (data.scene_notes as string | null) ?? '',
        language: toJobLanguage(data.language),
        generation: pipeline.data.current_generation as number,
      }
    })

    // Never touch a pipeline that belongs to the legacy scene-by-scene flow.
    const kind = await step.run('check-draft-kind', () => getDraftKind(client, pipelineId))
    if (kind === 'legacy') return { status: 'skipped', reason: 'legacy pipeline' }

    // 'created' -> 'drafting'; a retry finds it already 'drafting' and carries on.
    await step.run('claim', () => claimPipeline(client, pipelineId, 'created', 'drafting', { current_step: 'single_shot_prompt' }))
    // Only a pipeline that is actually drafting may spend OpenAI calls (a duplicate event for a
    // failed, cancelled or finished pipeline must not).
    const draftingStatus = await step.run('check-drafting', () => getPipelineStatus(client, pipelineId))
    if (draftingStatus !== 'drafting') return { status: 'skipped', reason: `pipeline is ${draftingStatus}` }

    // The voiceover is written first, as one connected passage that covers every beat of the idea, and handed to
    // the video prompt as final copy. A dialogue idea or creator-written copy skips this and runs as before.
    const narration = await step.run('write-narration', async () =>
      writeSingleShotNarration(
        client,
        pipelineId,
        job.generation,
        new OpenAIScriptGenerator(await getApiKey('openai', { jobId })),
        BRAND_PROFILE,
        { idea: job.idea, topic: job.topic, language: job.language },
      ),
    )

    const enhanced = await step.run('enhance-prompt', async () =>
      enhanceSingleShotPrompt(
        client,
        pipelineId,
        job.generation,
        new OpenAIScriptGenerator(await getApiKey('openai', { jobId })),
        BRAND_PROFILE,
        {
          idea: job.idea,
          topic: job.topic,
          category: job.category,
          targetAudience: job.targetAudience,
          aspectRatio: job.aspectRatio,
          language: job.language,
          lockedNarration: narration.kind === 'lines' ? narration.lines : undefined,
        },
      ),
    )

    // BOTH: adapt the English narration into native French now, so it is approved with the rest of the draft.
    const frenchLines =
      job.language === 'BOTH'
        ? await step.run('adapt-french', async () =>
            adaptSingleShotFrench(
              new OpenAIScriptGenerator(await getApiKey('openai', { jobId })),
              BRAND_PROFILE,
              enhanced.spokenLines.map((l) => l.text),
            ),
          )
        : undefined

    // Save the draft and stop at the approval gate: nothing paid happens until the user approves.
    await step.run('save-draft', async () => {
      const draft = toSingleShotDraft(enhanced, job.aspectRatio, job.language, frenchLines)
      await upsertVideoScriptDraft(client, {
        jobId,
        language: job.language,
        contentPipelineId: pipelineId,
        draftData: {
          script: spokenScript(draft.spoken_lines),
          duration_seconds: SINGLE_SHOT_DURATION_SECONDS,
          single_shot: draft,
        },
      })
      await claimPipeline(client, pipelineId, 'drafting', 'draft_ready', { current_step: null })
      await markJobDraftReadyIfPending(client, jobId)
    })
    return { status: 'draft_ready' }
  },
)

export const singleShotRender = inngest.createFunction(
  {
    id: 'single-shot-render',
    triggers: [{ event: 'content/single-shot.render' }],
    onFailure: failJobOnRunFailure,
    concurrency: { key: 'event.data.pipelineId', limit: 1 },
  },
  async ({ event, step }) => {
    const { pipelineId, jobId } = event.data as { pipelineId: string; jobId: string }

    const ctx = await step.run('load-approved-draft', async () => {
      const { data: pipeline, error } = await client
        .from('content_pipelines')
        .select('current_generation, status')
        .eq('id', pipelineId)
        .single()
      if (error || !pipeline) throw new Error(`Failed to load content_pipelines row ${pipelineId}`)
      const { data: draft, error: dErr } = await client
        .from('content_drafts')
        .select('draft_data')
        .eq('content_pipeline_id', pipelineId)
        .maybeSingle()
      if (dErr) throw dErr
      const enhanced = readSingleShotDraft(draft?.draft_data)
      // Not a single-shot pipeline (legacy draft or none): leave it alone, never fail it.
      if (!enhanced) return null
      const clipLang = (enhanced.languages ?? 'EN') === 'FR' ? 'FR' : 'EN'
      const { data: clipTrack, error: cErr } = await client
        .from('content_language_tracks')
        .select('status')
        .eq('content_pipeline_id', pipelineId)
        .eq('language', clipLang)
        .maybeSingle()
      if (cErr) throw cErr
      return {
        generation: pipeline.current_generation as number,
        pipelineStatus: pipeline.status as string,
        clipReady: clipTrack?.status === 'ready',
        enhanced,
      }
    })
    if (!ctx) return { status: 'skipped', reason: 'not a single-shot draft' }
    // A duplicate or late event: only an approved/generating pipeline whose clip is not already
    // finished may render (a re-approval after finish, failure or cancel must not pay again).
    if (!(RUNNING_PIPELINE_STATUSES as readonly string[]).includes(ctx.pipelineStatus) || ctx.clipReady) {
      return { status: 'skipped', reason: ctx.clipReady ? 'clip already rendered' : `pipeline is ${ctx.pipelineStatus}` }
    }
    const { generation } = ctx
    const approved = ctx.enhanced
    const enhanced = {
      prompt: approved.prompt,
      hook: approved.hook,
      containerShown: approved.container_shown,
      referenceImageUrls: approved.reference_image_urls,
      audioMode: approved.audio_mode,
      audioReason: approved.audio_reason,
      speakers: approved.speakers,
      spokenLines: approved.spoken_lines,
      originalIdea: approved.original_idea,
    }
    const job = { aspectRatio: approved.aspect_ratio, generation }
    // EN and BOTH: this render is the English track (native Seedance audio). FR-only: Seedance speaks French itself.
    const languages = approved.languages ?? 'EN'
    const clipLanguage: 'EN' | 'FR' = languages === 'FR' ? 'FR' : 'EN'

    // 'approved' -> 'generating'; a retry finds it already 'generating' and carries on.
    await step.run('claim', () => claimPipeline(client, pipelineId, 'approved', 'generating', { current_step: 'single_shot' }))
    // Cancelled between approval and now: stop before the paid submit.
    const preSubmit = await step.run('check-before-submit', () => getPipelineStatus(client, pipelineId))
    if (preSubmit !== 'generating') return { status: 'stopped', reason: `pipeline is ${preSubmit}` }

    const providerRef = await step.run('submit', async () =>
      submitSingleShot(client, pipelineId, job.generation, await singleShotGenerator(jobId), {
        prompt: enhanced.prompt,
        aspectRatio: job.aspectRatio,
        durationSeconds: SINGLE_SHOT_DURATION_SECONDS,
        referenceImageUrls: enhanced.referenceImageUrls,
      }),
    )

    for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
      // Checks for a cancel BEFORE every KIE request, so a cancelled job stops polling at once.
      const result = await step.run(`poll-${i}`, async () => {
        if (isPipelineStopped(await getPipelineStatus(client, pipelineId))) return { status: 'stopped' as const }
        return pollSingleShot(await singleShotGenerator(jobId), providerRef)
      })

      if (result.status === 'stopped') return { status: 'stopped', reason: 'cancelled or failed while rendering' }
      if (result.status === 'failed') {
        await step.run('mark-failed', async () => {
          // The task is dead: record it so a retry submits a fresh one instead of re-polling it.
          await recordSingleShotTaskFailed(client, pipelineId, job.generation, providerRef, result.detail)
          await failPipelineIfRunning(client, pipelineId, `Seedance failed: ${result.detail}`)
        })
        return { status: 'failed', detail: result.detail }
      }
      if (result.status === 'ready') {
        const finalized = await step.run('finalize', async () => {
          try {
            return {
              stopped: false as const,
              fileUrl: await finalizeSingleShot(client, new SupabaseVideoStorageUploader(client), {
            pipelineId,
            jobId,
            generation: job.generation,
            kieFileUrl: result.fileUrl,
            meta: {
              model: env.KIE_FAKE_MODE ? 'fake' : env.SINGLE_SHOT_MODEL,
              originalIdea: enhanced.originalIdea,
              enhancedPrompt: enhanced.prompt,
              hook: enhanced.hook,
              containerShown: enhanced.containerShown,
              referenceImageUrls: enhanced.referenceImageUrls,
              audioMode: enhanced.audioMode,
              audioReason: enhanced.audioReason,
              speakers: enhanced.speakers,
              spokenLines: enhanced.spokenLines,
              aspectRatio: job.aspectRatio,
              language: clipLanguage,
            },
            // BOTH: the pipeline and job stay open until the French track is done.
            completesPipeline: languages !== 'BOTH',
          }),
            }
          } catch (err) {
            if (err instanceof SingleShotStoppedError) return { stopped: true as const, fileUrl: '' }
            throw err
          }
        })
        if (finalized.stopped) return { status: 'stopped', reason: 'cancelled while finalizing' }
        const fileUrl = finalized.fileUrl
        if (languages === 'BOTH') {
          const frTrackId = await step.run('find-french-track', async () => {
            const { data, error } = await client
              .from('content_language_tracks')
              .select('id')
              .eq('content_pipeline_id', pipelineId)
              .eq('language', 'FR')
              .single()
            if (error || !data) throw new Error(`No French track for pipeline ${pipelineId}`)
            return data.id as string
          })
          await step.sendEvent('send-french-track', {
            id: `${frTrackId}:single-shot.track.fr`,
            name: 'content/single-shot.track.fr',
            data: { pipelineId, jobId, trackId: frTrackId },
          })
        }
        return { status: 'ready', fileUrl }
      }
      await step.sleep(`poll-wait-${i}`, POLL_INTERVAL)
    }

    // The first timeout keeps the task: KIE may still finish it, so Resume polls the same task again for free.
    // A task that keeps timing out is marked dead, so the next retry submits a fresh one.
    await step.run('mark-timeout', async () => {
      const { stuck } = await recordSingleShotTimeout(client, pipelineId, job.generation, providerRef)
      await failPipelineIfRunning(
        client,
        pipelineId,
        stuck
          ? 'Seedance render timed out repeatedly; Retry will start a new render'
          : 'Seedance render did not finish within 30 minutes; Resume checks it again',
      )
    })
    return { status: 'failed', detail: 'timeout' }
  },
)

const FRENCH_POLL_INTERVAL = '10s'
const FRENCH_MAX_POLLS = 60

// BOTH: re-voices the finished English clip in French (see steps/singleShot/frenchTrack.ts). Runs on its
// own so a French failure never touches the English video, and retries independently.
export const singleShotFrenchTrack = inngest.createFunction(
  {
    id: 'single-shot-french-track',
    triggers: [{ event: 'content/single-shot.track.fr' }],
    onFailure: failJobOnRunFailure,
    concurrency: { key: 'event.data.trackId', limit: 1 },
  },
  async ({ event, step }) => {
    const { pipelineId, jobId, trackId } = event.data as { pipelineId: string; jobId: string; trackId: string }

    const ctx = await step.run('load-french-context', async () => {
      const { data: pipeline, error } = await client
        .from('content_pipelines')
        .select('current_generation')
        .eq('id', pipelineId)
        .single()
      if (error || !pipeline) throw new Error(`Failed to load content_pipelines row ${pipelineId}`)
      const generation = pipeline.current_generation as number
      const { data: draftRow, error: dErr } = await client
        .from('content_drafts')
        .select('draft_data')
        .eq('content_pipeline_id', pipelineId)
        .maybeSingle()
      if (dErr) throw dErr
      const draft = readSingleShotDraft(draftRow?.draft_data)
      if (!draft?.french_lines?.length) throw new Error(`No approved French lines for pipeline ${pipelineId}`)
      const { data: job, error: jErr } = await client.from('content_jobs').select('voice_id_fr').eq('id', jobId).single()
      if (jErr || !job) throw new Error(`Failed to load content_jobs row ${jobId}`)
      const { data: en, error: eErr } = await client
        .from('generated_content')
        .select('file_url')
        .eq('job_id', jobId)
        .eq('content_type', 'video')
        .eq('language', 'EN')
        .maybeSingle()
      if (eErr || !en?.file_url) throw new Error('The English video is not ready yet')
      return {
        generation,
        draft,
        voiceId: (job.voice_id_fr as string | null) ?? null,
        videoUrl: en.file_url as string,
        rawVideoUrl: videoStoragePublicUrl(client, `${jobId}/single-shot-g${generation}-raw.mp4`),
      }
    })

    // 'created' -> 'generating'; a retry finds it already 'generating' and carries on.
    await step.run('claim-french-track', async () => {
      const { error } = await client
        .from('content_language_tracks')
        .update({ status: 'generating', current_step: 'single_shot_french', updated_at: new Date().toISOString() })
        .eq('id', trackId)
        .in('status', ['created', 'waiting_on_shared', 'generating'])
      if (error) throw error
    })

    // A cancelled/failed pipeline or track stops here, before any AssemblyAI or ElevenLabs request.
    const runnable = async () =>
      !isPipelineStopped(await getPipelineStatus(client, pipelineId)) && (await getTrackStatus(client, trackId)) !== 'failed'
    if (!(await step.run('check-french-runnable', runnable))) return { status: 'stopped', reason: 'cancelled or failed' }

    const englishLines = ctx.draft.spoken_lines.map((l) => l.text)
    const frenchLines = ctx.draft.french_lines as string[]

    // When each English line starts in the real audio. Fake mode, or any trouble reading the transcript,
    // falls back to spreading the lines by length (recorded on the track).
    const timing = await step.run('time-lines', async () => {
      const totalMs = SINGLE_SHOT_DURATION_SECONDS * 1000
      if (env.KIE_FAKE_MODE) return { startMs: estimateLineStarts(englishLines, totalMs), source: 'estimate' as const }
      const transcription = new AssemblyAITranscriptionService(await getApiKey('assemblyai', { jobId }))
      const ref = await transcription.submit({ audioUrl: ctx.rawVideoUrl })
      return { ref: ref.providerRef }
    })

    let startMs: number[]
    let timingSource: 'transcript' | 'estimate'
    if ('ref' in timing) {
      let words = null as ReturnType<typeof parseTimedWords> | null
      for (let i = 0; i < FRENCH_MAX_POLLS && words === null; i++) {
        const polled = await step.run(`poll-transcript-${i}`, async () => {
          if (!(await runnable())) return { done: true as const, words: [], stopped: true as const }
          const transcription = new AssemblyAITranscriptionService(await getApiKey('assemblyai', { jobId }))
          const r = await transcription.poll({ providerRef: timing.ref })
          if (r.status === 'ready') return { done: true as const, words: parseTimedWords(r.timingData) }
          if (r.status === 'failed') return { done: true as const, words: [] }
          return { done: false as const }
        })
        if ('stopped' in polled) return { status: 'stopped', reason: 'cancelled or failed while timing' }
        if (polled.done) words = polled.words
        else await step.sleep(`poll-transcript-wait-${i}`, FRENCH_POLL_INTERVAL)
      }
      const matched = lineStartsFromTranscript(words ?? [], englishLines, SINGLE_SHOT_DURATION_SECONDS * 1000)
      startMs = matched.startMs
      timingSource = matched.source
    } else {
      startMs = timing.startMs
      timingSource = timing.source
    }

    // Last check before the paid ElevenLabs calls and the final mix.
    if (!(await step.run('check-before-render-french', runnable))) return { status: 'stopped', reason: 'cancelled or failed' }

    const result = await step.run('render-french', async () => {
      try {
        return await renderFrenchTrack(
        {
          client,
          voice: env.KIE_FAKE_MODE ? new FakeVoiceSynthesizer() : new ElevenLabsVoiceSynthesizer(await getApiKey('elevenlabs', { jobId })),
          uploader: new SupabaseVideoStorageUploader(client),
        },
        {
          jobId,
          pipelineId,
          generation: ctx.generation,
          trackId,
          voiceId: ctx.voiceId,
          frenchLines,
          englishLines,
          startMs,
          timingSource,
          videoUrl: ctx.videoUrl,
          rawVideoUrl: ctx.rawVideoUrl,
          aspectRatio: ctx.draft.aspect_ratio,
          hook: ctx.draft.hook,
          originalIdea: ctx.draft.original_idea,
          enhancedPrompt: ctx.draft.prompt,
          containerShown: ctx.draft.container_shown,
          referenceImageUrls: ctx.draft.reference_image_urls,
        },
        )
      } catch (err) {
        if (err instanceof SingleShotStoppedError) return { stopped: true as const }
        throw err
      }
    })
    if ('stopped' in result) return { status: 'stopped', reason: 'cancelled while finalizing' }
    return { status: 'ready', ...result }
  },
)
