// Read-only: prints the job inputs and planned scenes. npx tsx scripts/scene-test/script.ts <pipelineId>
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient, getVideoScenes } from '../../src/server/pipeline/db'

const id = process.argv[2]
if (!id) throw new Error('usage: npx tsx scripts/scene-test/script.ts <pipelineId>')
const c = createServiceClient()
;(async () => {
  const p = await c.from('content_pipelines').select('job_id').eq('id', id).single()
  const j = await c.from('content_jobs').select('topic,category,scene_notes,video_duration_seconds,aspect_ratio,language').eq('id', p.data?.job_id).single()
  console.log('JOB', JSON.stringify(j.data, null, 1))
  for (const s of await getVideoScenes(c, id)) {
    console.log(`\nSCENE ${s.scene_number} (${s.target_duration_ms}ms)\n  visual: ${s.visual_description}\n  shot: ${s.shot_notes ?? ''}`)
  }
})()
