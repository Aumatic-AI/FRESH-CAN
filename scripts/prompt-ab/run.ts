// Prompt A/B harness for video scene stills. Regenerates the same scene(s) of an
// existing video pipeline under several prompt variants, N samples each, scores
// every image with a fixed vision rubric, and prints a pass-rate table, so a
// prompt change (shorter fixed text, new wording) is judged on counts instead
// of single images. Spends KIE credits (variants x scenes x samples images) and
// one OpenAI vision call per image; the pipeline's own rows are never written.
//   npx tsx scripts/prompt-ab/run.ts <pipeline_id> [--scenes=3,4] [--samples=2] [--variants=full,compact,compact_shape] [--out=dir] [--confirm-spend]
// Dry run by default: prints the prompts' sizes and the number of paid calls, and exits. Nothing is spent
// unless --confirm-spend is passed (only after the cost has been confirmed with whoever owns the credits).
// Rubric: truck pass = cab + wheels visible, container clearly longer than tall,
// no wordmark on the rear face, no door/opening on the side or front. Person pass
// = expected number of people, physically complete bodies, none cropped by the
// frame edge, no extra/duplicate person. Scenes without the truck skip truck checks.
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createServiceClient, getVideoScenes, getVisualAssets, getVideoPlanDraftData } from '../../src/server/pipeline/db'
import { BRAND_PROFILE, composeSceneImagePrompt } from '../../src/server/pipeline/prompts/index'
import { extractSceneLayer2Fields, extractVisualState, normalizeCastBible, normalizeLook } from '../../src/server/pipeline/steps/video/generateScript'
import { NanoBananaImageGenerator } from '../../src/server/pipeline/adapters/nanoBanana'

dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const pipelineId = args.find((a) => !a.startsWith('--'))
const opt = (name: string, def: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def
if (!pipelineId) throw new Error('usage: npx tsx scripts/prompt-ab/run.ts <pipeline_id> [--scenes=3,4] [--samples=2] [--variants=...] [--out=dir]')
const sceneNumbers = opt('scenes', '3,4').split(',').map(Number)
const samples = Number(opt('samples', '2'))
const variantNames = opt('variants', 'full,compact,compact_shape').split(',')
const outDir = opt('out', path.join('scripts/prompt-ab/out', pipelineId.slice(0, 8)))
fs.mkdirSync(outDir, { recursive: true })

const VARIANTS: Record<string, { compactFixedText?: boolean; unitProportions?: boolean }> = {
  full: {},
  compact: { compactFixedText: true },
  compact_shape: { compactFixedText: true, unitProportions: true },
}

const RUBRIC =
  'You are scoring an AI-generated photo against a strict checklist. Answer ONLY with JSON: ' +
  '{"truck_visible":bool,"truck_has_cab":bool,"wheels_visible":bool,"container_clearly_longer_than_tall":bool,' +
  '"wordmark_on_rear_face":bool,"door_or_opening_on_side_or_front":bool,"people_count":number,' +
  '"person_body_physically_complete":bool,"person_cropped_by_frame_edge":bool,"extra_or_duplicate_person":bool,"notes":string}. ' +
  'The truck is a white-cab box truck with a maroon cargo container. "wordmark_on_rear_face": a Fresh-CAN wordmark on the ' +
  'face that has the glass double door. "door_or_opening_on_side_or_front": a door, hatch or window on the long side panel ' +
  'or the front face (the glass door on the REAR face is normal). "person_body_physically_complete": every visible person has ' +
  'a coherent body (no missing legs, merged limbs or torso ending at an object); a person framed from the waist up by choice ' +
  'counts as complete. Be strict and literal.'

async function score(imageUrl: string): Promise<Record<string, any>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RUBRIC },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: imageUrl } }] },
      ],
    }),
  })
  const body = await res.json()
  return JSON.parse(body.choices[0].message.content)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Network calls here (KIE, OpenAI, image download) occasionally time out; one
// failure must not kill the whole run, so each is retried and a job that still
// fails is skipped (reported at the end) instead of throwing.
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await sleep(3000 * (i + 1))
    }
  }
  throw last
}

/** Runs the tasks with at most `limit` in flight. */
async function pool(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) await tasks[next++]()
    }),
  )
}

async function main() {
  const client = createServiceClient()
  const scenes = await getVideoScenes(client, pipelineId!)
  const assets = await getVisualAssets(client, pipelineId!, scenes[0].generation)
  const characterRefUrl = assets.find((a) => a.asset_type === 'character_ref')!.file_url!
  const planData = await getVideoPlanDraftData(client, pipelineId!)
  const plan = { look: normalizeLook(planData?.look), castBible: normalizeCastBible(planData?.cast_bible) }
  const gen = new NanoBananaImageGenerator(process.env.KIE_API_KEY!)
  const imageCount = sceneNumbers.length * variantNames.length * samples
  const spend = args.includes('--confirm-spend')
  if (!spend) {
    console.log(
      `\nDRY RUN — would generate ${imageCount} KIE images (8 credits each = ${imageCount * 8} credits) and make ` +
        `${imageCount} gpt-4o vision calls. Nothing was spent. Re-run with --confirm-spend to proceed.`,
    )
  }

  type Row = { variant: string; scene: number; sample: number; chars: number; url: string; truckPass: boolean | null; personPass: boolean; score: Record<string, any> }
  const rows: Row[] = []
  const jobs: Array<() => Promise<void>> = []
  const failed: string[] = []

  for (const n of sceneNumbers) {
    const scene = scenes.find((s) => s.scene_number === n)!
    const l2 = extractSceneLayer2Fields(scene.narration_intent)
    const prev = scenes.find((s) => s.scene_number === n - 1)
    const castIds = new Set(l2.cast_present ?? [])
    const expectedPeople = castIds.size
    for (const v of variantNames) {
      const composed = composeSceneImagePrompt(BRAND_PROFILE, {
        aspectRatio: '9:16', pipelineId: pipelineId!, sceneNumber: n, visualDescription: scene.visual_description, shotNotes: scene.shot_notes,
        characterRefUrl, previousVisualState: prev ? extractVisualState(prev.narration_intent) : undefined, unitPresence: l2.unit_presence,
        unitView: l2.setting === 'interior' ? undefined : l2.unit_view, appPresence: l2.app_on_screen, setting: l2.setting, containsFood: l2.contains_food,
        cast: plan.castBible?.filter((c) => castIds.has(c.id)), look: plan.look, ...VARIANTS[v],
      })
      console.log(`scene ${n} ${v}: ${composed.prompt.length} chars`)
      fs.writeFileSync(path.join(outDir, `prompt_s${n}_${v}.txt`), composed.prompt)
      for (let k = 0; k < (spend ? samples : 0); k++) {
        jobs.push(async () => {
          const label = `s${n}_${v}_${k + 1}`
          try {
            const ref = await withRetry(() => gen.submit({ prompt: composed.prompt, referenceImageUrl: composed.referenceImageUrl, aspectRatio: '9:16' } as any))
            fs.appendFileSync(path.join(outDir, 'task_ids.log'), `${label} ${ref.providerRef}\n`)
            for (let t = 0; t < 80; t++) {
              await sleep(6000)
              const r: any = await withRetry(() => gen.poll(ref))
              if (r.status === 'failed') throw new Error('KIE task failed')
              if (r.status !== 'ready') continue
              const sc = await withRetry(() => score(r.fileUrl))
              const img = await withRetry(async () => Buffer.from(await (await fetch(r.fileUrl)).arrayBuffer()))
              fs.writeFileSync(path.join(outDir, `${label}.jpg`), img)
              const truckExpected = l2.unit_presence !== 'none' && l2.setting !== 'interior'
              const truckPass = truckExpected
                ? !!sc.truck_visible && !!sc.truck_has_cab && !!sc.wheels_visible && !!sc.container_clearly_longer_than_tall && !sc.wordmark_on_rear_face && !sc.door_or_opening_on_side_or_front
                : null
              const personPass = sc.people_count === expectedPeople && !!sc.person_body_physically_complete && !sc.person_cropped_by_frame_edge && !sc.extra_or_duplicate_person
              rows.push({ variant: v, scene: n, sample: k + 1, chars: composed.prompt.length, url: r.fileUrl, truckPass, personPass, score: sc })
              fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(rows, null, 1))
              return
            }
            throw new Error('timed out waiting for KIE')
          } catch (e) {
            failed.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
          }
        })
      }
    }
  }
  if (!spend) return
  await pool(jobs, 4)
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(rows, null, 1))

  console.log('\nvariant         avg chars  truck pass   person pass')
  for (const v of variantNames) {
    const r = rows.filter((x) => x.variant === v)
    const tr = r.filter((x) => x.truckPass !== null)
    const pct = (a: number, b: number) => (b ? `${a}/${b}` : '-')
    console.log(
      `${v.padEnd(15)} ${String(Math.round(r.reduce((s, x) => s + x.chars, 0) / Math.max(1, r.length))).padStart(9)}  ` +
        `${pct(tr.filter((x) => x.truckPass).length, tr.length).padStart(10)}   ${pct(r.filter((x) => x.personPass).length, r.length)}`,
    )
  }
  if (failed.length) console.log(`\n${failed.length} job(s) failed and are not counted:\n  ${failed.join('\n  ')}`)
  console.log(`\nimages, prompts and results.json saved in ${outDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
