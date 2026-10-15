// Read-only: language-track state + its steps. npx tsx scripts/scene-test/track.ts <pipelineId>
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient } from '../../src/server/pipeline/db'

const id = process.argv[2]
if (!id) throw new Error('usage: npx tsx scripts/scene-test/track.ts <pipelineId>')
const c = createServiceClient()
;(async () => {
  const t = await c.from('content_language_tracks').select('*').eq('content_pipeline_id', id)
  console.log(JSON.stringify(t.data ?? t.error?.message, null, 1))
  for (const tr of t.data ?? []) {
    const s = await c.from('pipeline_steps').select('step_name,status,attempt_number,error_message,created_at,updated_at').eq('content_language_track_id', tr.id).order('created_at')
    for (const x of s.data ?? []) console.log(String(x.created_at).slice(11, 19), x.step_name, x.status, 'a' + x.attempt_number, String(x.error_message ?? '').slice(0, 300))
  }
})()
