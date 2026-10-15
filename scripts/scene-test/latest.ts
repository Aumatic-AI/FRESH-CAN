// Read-only: lists the most recent video pipelines. npx tsx scripts/scene-test/latest.ts
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServiceClient } from '../../src/server/pipeline/db'

const c = createServiceClient()
;(async () => {
  const p = await c
    .from('content_pipelines')
    .select('id,job_id,status,current_generation,last_error,created_at,updated_at')
    .eq('content_type', 'video')
    .order('created_at', { ascending: false })
    .limit(3)
  console.log(JSON.stringify(p.data ?? p.error?.message, null, 1))
})()
