// One-time helper: regenerates ONLY the hero + inline images of an existing
// blog job whose KIE temp URLs have expired, storing them permanently via the
// real pipeline step (runGenerateVisualImage), then rewrites the job's old
// image URLs everywhere. The post's text is never touched. interpret_intent /
// outline / reference_copy are read from their cached step output, so no
// OpenAI spend is expected; the KIE balance is printed before and after.
// Dry run by default; --apply deletes the two dead asset rows (+ their
// succeeded step rows) and spends KIE credits.
//   npx tsx scripts/regenerate-blog-images.ts <job_id> [--only=hero|inline] [--apply]
import { createServiceClient, getLastSucceededStepOutputAnyGeneration, getVisualAssets, type PipelineRow } from '../src/server/pipeline/db'
import { interpretIntent } from '../src/server/pipeline/steps/shared/interpretIntent'
import { generateReferenceCopy, type OutlineSection } from '../src/server/pipeline/steps/blog/generateReferenceCopy'
import { runGenerateVisualImage } from '../src/server/pipeline/steps/blog/generateVisualImage'
import { SupabaseVideoStorageUploader } from '../src/server/pipeline/adapters/storage'
import { OpenAIScriptGenerator } from '../src/server/pipeline/adapters/openai'
import { NanoBananaImageGenerator } from '../src/server/pipeline/adapters/nanoBanana'
import { BRAND_PROFILE, composeHeroPrompt, composeInlinePrompt, type ImageStyle, type UnitPresence } from '../src/server/pipeline/prompts/index'
import { parseAdCopy, deriveHeadline } from '../src/server/pipeline/lib/adCopy'
import { getApiKey } from '../src/server/pipeline/credentials'
import { rewriteJobUrls } from './lib/rewriteJobUrls'

const MAX_ATTEMPT_LOOPS = 6
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Mirrors the (non-exported) helpers in src/inngest/functions/blog.ts.
function mapUnitRelevanceToPresence(value: 'central' | 'incidental' | 'none'): UnitPresence {
  if (value === 'central') return 'featured'
  if (value === 'incidental') return 'background'
  return 'none'
}
function parseOutlineSections(output: unknown, fallbackTitle: string): { title: string; sections: OutlineSection[] } {
  const obj = output as { title?: unknown; sections?: unknown } | null
  const title = typeof obj?.title === 'string' && obj.title.trim() ? obj.title.trim() : fallbackTitle
  const sections: OutlineSection[] = []
  for (const s of Array.isArray(obj?.sections) ? obj.sections : []) {
    const heading = (s as Record<string, unknown> | null)?.heading
    const summary = (s as Record<string, unknown> | null)?.summary
    if (typeof heading === 'string' && heading.trim() && typeof summary === 'string') {
      sections.push({ heading: heading.trim(), summary: summary.trim() })
    }
  }
  return { title, sections }
}

async function kieBalance(apiKey: string): Promise<number | null> {
  const res = await fetch('https://api.kie.ai/api/v1/chat/credit', { headers: { Authorization: `Bearer ${apiKey}` } })
  const body = (await res.json()) as { code: number; data: number | null }
  return body.code === 200 && typeof body.data === 'number' ? body.data : null
}

async function main() {
  const jobId = process.argv[2]
  const apply = process.argv.includes('--apply')
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  if (onlyArg && onlyArg !== 'hero' && onlyArg !== 'inline') {
    console.error('--only must be hero or inline')
    process.exit(1)
  }
  const wanted = (assetType: string) => !onlyArg || assetType === `${onlyArg}_image`
  if (!jobId || jobId.startsWith('--')) {
    console.error('Usage: npx tsx scripts/regenerate-blog-images.ts <job_id> [--only=hero|inline] [--apply]')
    process.exit(1)
  }
  const client = createServiceClient()

  const { data: job, error: jErr } = await client
    .from('content_jobs').select('topic, category, target_audience, scene_notes, image_style').eq('id', jobId).single()
  if (jErr || !job) throw new Error(`job not found: ${jErr?.message}`)
  const { data: pipeline, error: pErr } = await client
    .from('content_pipelines').select('*').eq('job_id', jobId).eq('content_type', 'blog').single()
  if (pErr || !pipeline) throw new Error(`blog pipeline not found: ${pErr?.message}`)
  const p = pipeline as PipelineRow
  const generation = p.current_generation
  const scope = { contentPipelineId: p.id }

  const scriptGenerator = new OpenAIScriptGenerator(await getApiKey('openai', { jobId }))
  const kieKey = await getApiKey('kie', { jobId })

  // Same prompt derivation as blog.ts's 'generating' block (all cached).
  const creativeBrief = await interpretIntent(client, scope, generation, scriptGenerator, BRAND_PROFILE, {
    contentType: 'blog', topic: job.topic, category: job.category,
    targetAudience: job.target_audience, sceneNotes: job.scene_notes,
  })
  const outlineOutput = await getLastSucceededStepOutputAnyGeneration(client, scope, 'generate_outline')
  const { headline, subtitle } = parseAdCopy(outlineOutput, deriveHeadline(job.topic), job.category)
  const { title, sections } = parseOutlineSections(outlineOutput, job.topic)
  const referenceCopy = await generateReferenceCopy(client, scope, generation, scriptGenerator, BRAND_PROFILE, { title, sections })
  const blogImageJob = {
    pipelineId: p.id, topic: job.topic, category: job.category,
    imageStyle: (job.image_style === 'infographic' ? 'infographic' : 'photo') as ImageStyle,
    headline, subtitle, sceneNotes: job.scene_notes,
    unitPresence: mapUnitRelevanceToPresence(creativeBrief.unitRelevance.value), referenceCopy,
  }
  const hero = composeHeroPrompt(BRAND_PROFILE, blogImageJob)
  const inline = composeInlinePrompt(BRAND_PROFILE, blogImageJob)

  const assets = (await getVisualAssets(client, p.id, generation)).filter((a) => (a.asset_type === 'hero_image' || a.asset_type === 'inline_image') && wanted(a.asset_type))
  const oldUrls = new Map(assets.map((a) => [a.asset_type, a.file_url as string]))
  console.log(`Job: ${job.topic}\nPipeline ${p.id} gen ${generation} (${p.status})`)
  console.log(`\n--- hero prompt ---\n${hero.prompt}\n(reference image: ${hero.referenceImageUrl ?? 'none'})`)
  console.log(`\n--- inline prompt ---\n${inline.prompt}\n(reference image: ${inline.referenceImageUrl ?? 'none'})`)
  for (const a of assets) {
    const alive = a.file_url ? (await fetch(a.file_url, { method: 'HEAD' })).ok : false
    console.log(`\nexisting ${a.asset_type}: ${a.file_url} (${alive ? 'STILL LIVE - use backfill script instead' : 'dead'})`)
  }
  console.log(`\nKIE balance now: ${await kieBalance(kieKey)}`)

  if (!apply) {
    console.log(`\nDry run. --apply would delete the ${assets.length} content_visual_assets row(s) and the succeeded generate_hero_image/generate_inline_image step rows for generation ${generation}, generate ${assets.length} image(s) via KIE, upload to freshcan-videos, then rewrite old URLs in generated_content / content_drafts / pipeline_steps.`)
    return
  }

  const before = await kieBalance(kieKey)
  await client.from('content_visual_assets').delete().in('id', assets.map((a) => a.id))
  await client.from('pipeline_steps').delete().eq('content_pipeline_id', p.id).eq('generation', generation)
    .in('step_name', assets.map((a) => (a.asset_type === 'hero_image' ? 'generate_hero_image' : 'generate_inline_image')))

  const uploader = new SupabaseVideoStorageUploader(client)
  const generator = new NanoBananaImageGenerator(kieKey)
  const jobs = [['hero_image', hero] as const, ['inline_image', inline] as const].filter(([t]) => wanted(t))
  for (const [assetType, composed] of jobs) {
    for (let i = 0; i < MAX_ATTEMPT_LOOPS; i++) {
      await runGenerateVisualImage(client, p, assetType, composed.prompt, generator, uploader, 5000, composed.referenceImageUrl)
      const row = (await getVisualAssets(client, p.id, generation)).find((a) => a.asset_type === assetType)
      if (row?.status === 'ready') break
      await sleep(5000)
    }
  }

  const fresh = (await getVisualAssets(client, p.id, generation)).filter((a) => wanted(a.asset_type))
  const urlMap = new Map<string, string>()
  for (const a of fresh) {
    const old = oldUrls.get(a.asset_type)
    if (a.status !== 'ready' || !a.file_url) { console.error(`FAILED: ${a.asset_type} is ${a.status}`); process.exitCode = 1; continue }
    console.log(`${a.asset_type}: ${a.file_url}`)
    if (old) urlMap.set(old, a.file_url)
  }
  const changes = await rewriteJobUrls(client, jobId, [p.id], urlMap, true)
  const after = await kieBalance(kieKey)
  console.log(`\nDone: ${changes} row(s) rewritten. KIE credits before ${before} -> after ${after} (spent ${before != null && after != null ? before - after : '?'})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
