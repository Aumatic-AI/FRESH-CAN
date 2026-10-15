// Read-only status of a scene-test run: npx tsx scripts/scene-test/check.ts <pipelineId>
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient } from '../../src/server/pipeline/db'

const id = process.argv[2]
if (!id) throw new Error('usage: npx tsx scripts/scene-test/check.ts <pipelineId>')
const c = createServiceClient()
;(async () => {
  const p = await c.from('content_pipelines').select('id,job_id,status,current_generation,last_error,updated_at').eq('id', id).single()
  const a = await c.from('content_visual_assets').select('asset_type,status,video_scene_id,attempt_number,file_url').eq('content_pipeline_id', id)
  const st = await c.from('pipeline_steps').select('step_name,status,attempt_number,error_message,created_at').eq('content_pipeline_id', id).order('created_at')
  console.log(JSON.stringify({ steps: st.data ?? st.error?.message, pipeline: p.data ?? p.error?.message, assets: a.data ?? a.error?.message }, null, 1))
})()
