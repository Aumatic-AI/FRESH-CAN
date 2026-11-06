import { pinJobCredentials } from '@/server/pipeline/credentials'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { env } from '@/server/pipeline/env'

// Same pattern as blog/image's generate routes: prefer the service-role key
// — the pipeline tables have RLS actually enforced.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

const UNIQUE_VIOLATION = '23505'

// Unlike blog/image's generate routes, this one creates ONLY the
// content_pipelines row — no content_language_tracks yet. Video gates all
// language-specific work behind POST /video/approve (ARCHITECTURE.MD §6.4:
// the script must be reviewed and locked before any expensive per-scene
// generation is requested), so "how many languages were requested" isn't
// known or relevant until that call. The worker (generateScript) picks this
// pipeline up once created and writes the master script + scene plan.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = getSupabase()

  const { data: job, error: jobErr } = await supabase
    .from('content_jobs')
    .select('id')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Fix which API accounts this job runs on at job start. Best-effort: the
  // resolver also pins lazily on first credential use, so a failure here must
  // not block generation.
  await pinJobCredentials(jobId).catch(() => undefined)

  // Idempotency: a second call for the same job returns the existing
  // pipeline rather than erroring or creating a duplicate. Sends the Inngest
  // event again too (deterministic id, so Inngest dedupes a genuine repeat)
  // — self-heals a pipeline stuck at 'created' if the very first call
  // crashed after inserting the row but before the send below ever ran.
  const { data: existing } = await supabase
    .from('content_pipelines')
    .select('*')
    .eq('job_id', jobId)
    .eq('content_type', 'video')
    .maybeSingle()
  if (existing) {
    // A draft stage that failed for good (retries exhausted -> failJobOnRunFailure
    // marked the pipeline 'failed') could never be retried: the re-send below
    // uses a fixed event id that Inngest drops for 24h, and nothing else moves
    // a failed pipeline back. Restart it here: only when no video draft exists
    // yet (a failure after approval has its own /video/resume), via a CAS on
    // 'failed' so a double click can't double-fire, and with an event id that
    // carries the fresh updated_at so the dedup can't swallow it.
    if (existing.status === 'failed') {
      const { data: draft } = await supabase
        .from('content_drafts')
        .select('id')
        .eq('job_id', jobId)
        .eq('content_type', 'video')
        .limit(1)
        .maybeSingle()
      if (!draft) {
        const now = new Date().toISOString()
        const { data: reset } = await supabase
          .from('content_pipelines')
          .update({ status: 'created', last_error: null, current_step: null, updated_at: now })
          .eq('id', existing.id)
          .eq('status', 'failed')
          .select()
          .maybeSingle()
        if (reset) {
          await supabase
            .from('content_jobs')
            .update({ status: 'pending', updated_at: now })
            .eq('id', jobId)
            .eq('status', 'failed')
          await sendVideoGenerateEvent(existing.id as string, jobId, now)
          return NextResponse.json({ pipeline: reset, created: false, restarted: true })
        }
      }
    }
    await sendVideoGenerateEvent(existing.id as string, jobId)
    return NextResponse.json({ pipeline: existing, created: false })
  }

  const { data: pipeline, error: pErr } = await supabase
    .from('content_pipelines')
    .insert({ job_id: jobId, content_type: 'video' })
    .select()
    .single()

  if (pErr) {
    if (pErr.code === UNIQUE_VIOLATION) {
      const { data: raced } = await supabase
        .from('content_pipelines')
        .select('*')
        .eq('job_id', jobId)
        .eq('content_type', 'video')
        .maybeSingle()
      if (raced) {
        await sendVideoGenerateEvent(raced.id as string, jobId)
        return NextResponse.json({ pipeline: raced, created: false })
      }
    }
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  await sendVideoGenerateEvent(pipeline.id, jobId)

  return NextResponse.json({ pipeline, created: true })
}

// Deterministic event id (not random) so a duplicate send for the same
// pipeline — a client retry, or the self-heal call above — is deduped by
// Inngest instead of starting a second concurrent run. Belt-and-suspenders
// alongside video.ts's own concurrency limit and claimPipeline's CAS.
async function sendVideoGenerateEvent(pipelineId: string, jobId: string, restartedAt?: string): Promise<void> {
  const idSuffix = restartedAt ? `:${restartedAt}` : ''
  // TEST-ONLY (branch test/seedance-single-shot): with ENABLE_SINGLE_SHOT_TEST
  // on, run the single-shot Seedance 2.5 flow instead of the scene pipeline.
  // Flag off (the default) is exactly the original behaviour.
  if (env.ENABLE_SINGLE_SHOT_TEST) {
    await inngest.send({
      id: `${pipelineId}:single-shot.generate${idSuffix}`,
      name: 'content/single-shot.generate',
      data: { pipelineId, jobId },
    })
    return
  }
  await inngest.send({
    id: `${pipelineId}:video.generate${idSuffix}`,
    name: 'content/video.generate',
    data: { pipelineId, jobId },
  })
}
