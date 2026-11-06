// Single-shot test path (branch test/seedance-single-shot): one 30s Seedance
// 2.5 text-to-video clip with native audio. Started by the EXISTING
// POST /api/jobs/[jobId]/video/generate route when ENABLE_SINGLE_SHOT_TEST is
// on; with the flag off this function is never triggered.
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
  markPipelineFailed,
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
import {
  finalizeSingleShot,
  pollSingleShot,
  submitSingleShot,
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

    // 'created' -> 'drafting'; a retry finds it already 'drafting' and carries on.
    await step.run('claim', () => claimPipeline(client, pipelineId, 'created', 'drafting', { current_step: 'single_shot_prompt' }))

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
        .select('current_generation')
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
      if (!enhanced) throw new Error(`No single-shot draft found for pipeline ${pipelineId}`)
      return { generation: pipeline.current_generation as number, enhanced }
    })
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

    const providerRef = await step.run('submit', async () =>
      submitSingleShot(client, pipelineId, job.generation, await singleShotGenerator(jobId), {
        prompt: enhanced.prompt,
        aspectRatio: job.aspectRatio,
        durationSeconds: SINGLE_SHOT_DURATION_SECONDS,
        referenceImageUrls: enhanced.referenceImageUrls,
      }),
    )

    for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
      const result = await step.run(`poll-${i}`, async () => pollSingleShot(await singleShotGenerator(jobId), providerRef))

      if (result.status === 'failed') {
        await step.run('mark-failed', () => markPipelineFailed(client, pipelineId, `Seedance failed: ${result.detail}`))
        return { status: 'failed', detail: result.detail }
      }
      if (result.status === 'ready') {
        const fileUrl = await step.run('finalize', async () =>
          finalizeSingleShot(client, new SupabaseVideoStorageUploader(client), {
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
        )
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

    await step.run('mark-timeout', () =>
      markPipelineFailed(client, pipelineId, 'Seedance render did not finish within 30 minutes'),
    )
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
          const transcription = new AssemblyAITranscriptionService(await getApiKey('assemblyai', { jobId }))
          const r = await transcription.poll({ providerRef: timing.ref })
          if (r.status === 'ready') return { done: true as const, words: parseTimedWords(r.timingData) }
          if (r.status === 'failed') return { done: true as const, words: [] }
          return { done: false as const }
        })
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

    const result = await step.run('render-french', async () =>
      renderFrenchTrack(
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
      ),
    )
    return { status: 'ready', ...result }
  },
)
