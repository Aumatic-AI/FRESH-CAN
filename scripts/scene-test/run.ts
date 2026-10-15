// Runs the video pipeline up to and including ONE wave of scene-image
// generation, then stops: interpret-intent -> generate-script -> approve (no
// language tracks, so no voice/caption/render) -> character-ref -> cast refs
// -> a single scene-visuals wave. The video generator passed to that wave is a
// stub that throws, so no KIE clip is ever submitted. Creates a real
// content_jobs + content_pipelines row in Supabase (shows up on the dashboard).
//   npx tsx scripts/scene-test/run.ts [--confirm-spend]
// Dry run by default: prints the plan and the number of paid calls, spends nothing.
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import {
  createServiceClient,
  getVisualAssets,
  getVideoScenes,
  getVideoPlanDraftData,
  type PipelineRow,
} from '../../src/server/pipeline/db'
import { interpretIntent } from '../../src/server/pipeline/steps/shared/interpretIntent'
import { runGenerateScript, normalizeCastBible } from '../../src/server/pipeline/steps/video/generateScript'
import { runGenerateCharacterRef } from '../../src/server/pipeline/steps/video/generateCharacterRef'
import { runGenerateCastRef } from '../../src/server/pipeline/steps/video/generateCastRefs'
import { runGenerateSceneVisual } from '../../src/server/pipeline/steps/video/generateSceneVisual'
import { OpenAIScriptGenerator, OpenAIImageValidator } from '../../src/server/pipeline/adapters/openai'
import { GptImageGenerator } from '../../src/server/pipeline/adapters/gptImage'
import { SupabaseVideoStorageUploader } from '../../src/server/pipeline/adapters/storage'
import type { VideoGenerator, SceneClipScaler } from '../../src/server/pipeline/adapters/types'
import { BRAND_PROFILE, composeCharacterRefPrompt } from '../../src/server/pipeline/prompts/index'
import { getApiKey } from '../../src/server/pipeline/credentials'

const PROMPT =
  'A customer stops by the FreshCAN mobile grocery unit to pick up fresh vegetables for dinner. They browse the colorful produce, choose a few items, and leave happily as the evening sun shines over the neighborhood. A warm, realistic, cinematic Canadian lifestyle commercial with natural movements and beautiful lighting.'
const DURATION = 32
const ASPECT = '9:16' as const
const confirm = process.argv.includes('--confirm-spend')
// --resume=<pipelineId>: continue an existing run at the character-ref step (re-polls
// any in-flight KIE task instead of resubmitting; skips job/script creation).
const resumeId = process.argv.find((a) => a.startsWith('--resume='))?.split('=')[1]

if (!confirm) {
  console.log(`DRY RUN — 32s, ${ASPECT}. Paid calls if run with --confirm-spend:
  OpenAI: interpret-intent + script (2 calls), scene-image validation (1 per image attempt)
  KIE GPT Image 2.5: 1 character ref + up to 4 cast refs + ~6 scene images (2K, ~$0.05 each), plus any validator-triggered retries
  KIE video / ElevenLabs / AssemblyAI / render: 0 (stubbed or never started)`)
  process.exit(0)
}

const noVideo: VideoGenerator = {
  submit: async () => {
    throw new Error('scene-test: video generation is disabled')
  },
  poll: async () => {
    throw new Error('scene-test: video generation is disabled')
  },
}
const noScaler: SceneClipScaler = {
  submitScale: async () => {
    throw new Error('scene-test: clip scaling is disabled')
  },
  poll: async () => {
    throw new Error('scene-test: clip scaling is disabled')
  },
}

async function main() {
  const client = createServiceClient()
  let jobId = ''
  let pipelineId = ''
  const fetchPipeline = async () =>
    (await client.from('content_pipelines').select('*').eq('id', pipelineId).single()).data as PipelineRow
  if (resumeId) {
    pipelineId = resumeId
    jobId = (await fetchPipeline()).job_id as string
    console.log('resuming job', jobId, 'pipeline', pipelineId)
  }
  let openaiKey = ''
  let kieKey = ''
  if (!resumeId) {
    const { data: job, error: jErr } = await client
      .from('content_jobs')
      .insert({
        topic: 'FreshCAN evening produce pickup (scene test)',
        category: 'Customer Stories',
        target_audience: 'Canadian families',
        language: 'EN',
        content_types: ['video'],
        status: 'pending',
        script_type: 'SOLUTION',
        aspect_ratio: ASPECT,
        video_duration_seconds: DURATION,
        scene_notes: PROMPT,
      })
      .select()
      .single()
    if (jErr || !job) throw new Error(`job insert failed: ${jErr?.message}`)
    jobId = job.id as string
    const { data: pRow, error: pErr } = await client
      .from('content_pipelines')
      .insert({ job_id: jobId, content_type: 'video' })
      .select()
      .single()
    if (pErr || !pRow) throw new Error(`pipeline insert failed: ${pErr?.message}`)
    pipelineId = pRow.id as string
    console.log('job', jobId, 'pipeline', pipelineId)
    openaiKey = await getApiKey('openai', { jobId })

    const scriptGen = new OpenAIScriptGenerator(openaiKey)

    let pipeline = await fetchPipeline()
    const creativeBrief = await interpretIntent(
      client,
      { contentPipelineId: pipelineId },
      pipeline.current_generation,
      scriptGen,
      BRAND_PROFILE,
      { contentType: 'video', topic: job.topic, category: job.category, targetAudience: job.target_audience, sceneNotes: PROMPT },
    )
    const scriptInput = {
      topic: job.topic as string,
      category: job.category as string,
      targetAudience: job.target_audience as string,
      scriptType: 'SOLUTION' as const,
      jobLanguage: 'EN',
      durationSeconds: DURATION,
      sceneNotes: PROMPT,
      creativeBrief,
    }
    for (let i = 0; i < 3; i++) {
      await runGenerateScript(client, await fetchPipeline(), scriptInput, scriptGen)
      pipeline = await fetchPipeline()
      if (pipeline.status !== 'created' && pipeline.status !== 'drafting') break
      await new Promise((r) => setTimeout(r, 5000))
    }
    if (pipeline.status !== 'draft_ready') throw new Error(`script step ended in status ${pipeline.status}`)
    const scenes = await getVideoScenes(client, pipelineId)
    console.log(`script ready: ${scenes.length} scenes`)

    // Approve: same CAS as /video/approve, but no language tracks and no events.
    await client
      .from('content_pipelines')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', pipelineId)
      .eq('status', 'draft_ready')


  }
  openaiKey = openaiKey || (await getApiKey('openai', { jobId }))
  kieKey = await getApiKey('kie', { jobId })
  const imageGen = new GptImageGenerator(kieKey)
  const uploader = new SupabaseVideoStorageUploader(client)

  const refPrompt = composeCharacterRefPrompt(BRAND_PROFILE, { pipelineId })
  let characterRefUrl: string | null = null
  for (let i = 0; i < 3 && !characterRefUrl; i++) {
    await runGenerateCharacterRef(client, await fetchPipeline(), refPrompt.prompt, imageGen, uploader, 5000, refPrompt.referenceImageUrl, ASPECT)
    const assets = await getVisualAssets(client, pipelineId, (await fetchPipeline()).current_generation)
    const a = assets.find((x) => x.asset_type === 'character_ref' && !x.video_scene_id)
    if (a?.status === 'ready') characterRefUrl = a.file_url
    else if (!a || a.status !== 'pending') break
  }
  if (!characterRefUrl) throw new Error('character ref did not reach ready')
  console.log('character ref:', characterRefUrl)

  const plan = await getVideoPlanDraftData(client, pipelineId)
  const castRefUrls: Record<string, string> = {}
  for (const person of (normalizeCastBible(plan?.cast_bible) ?? []).slice(0, 4)) {
    const url = await runGenerateCastRef(client, await fetchPipeline(), person, imageGen, uploader, ASPECT)
    if (url) castRefUrls[person.id] = url
  }
  console.log('cast refs:', Object.keys(castRefUrls).length)

  // ONE wave only — the image wave. Video is stubbed to throw.
  await runGenerateSceneVisual(
    client, await fetchPipeline(), characterRefUrl, imageGen, noVideo, uploader, noScaler,
    5000, ASPECT, new OpenAIImageValidator(openaiKey), undefined, undefined, castRefUrls,
  )

  const final = await getVisualAssets(client, pipelineId, (await fetchPipeline()).current_generation)
  for (const s of await getVideoScenes(client, pipelineId)) {
    const img = final.find((x) => x.video_scene_id === s.id && x.asset_type !== 'character_ref' && x.file_url && /\.(png|jpe?g|webp)/i.test(x.file_url))
    console.log(`scene ${s.scene_number}:`, img?.status ?? 'none', img?.file_url ?? '')
  }
  console.log('STOPPED after scene images. job', jobId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
