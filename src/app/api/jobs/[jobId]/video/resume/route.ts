import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

const CANCELLED_MESSAGE = 'Cancelled by user'
const SHARED_FAILURE_PREFIX = 'Shared pipeline failed:'

// Resumes a video whose SHARED pipeline (character ref + per-scene
// image/clip generation) failed after approval — the counterpart to
// tracks/[lang]/retry, which only covers a single language track. Without
// this a provider hiccup on one scene strands a job that has already paid
// for the script, character ref and every other scene's visuals, with no
// way to finish it from the dashboard.
//
// Nothing already paid for is redone: the character ref and every scene
// asset at status 'ready' are skipped by their own run functions
// (generateSceneVisual.ts checks hasSucceededStep/asset status before any
// submit), so only the assets that actually failed are resubmitted.
//
// What this resets, and why:
//  - failed visual assets' attempt_number back to 1: their retry budget
//    (MAX_ATTEMPTS.kie) was spent on the failure being recovered from, so
//    resuming without this would give the scene exactly one more try and
//    hard-fail again on the next hiccup. pipeline_steps keeps its earlier
//    rows (no unique constraint on attempt_number), so history is intact.
//  - the pipeline back to 'generating' (CAS on 'failed', so a double click
//    or a concurrent run can't double-fire).
//  - tracks that markPipelineFailed cascaded to 'failed' ("Shared pipeline
//    failed: …") back to 'waiting_on_shared' — same reset as the track
//    retry route, safe because every stage short-circuits on its own
//    already-succeeded step. A track that failed on its OWN error is left
//    for its own Retry button.
//  - the job back to 'generating' if it was 'failed' (see the track retry
//    route for why nothing else ever moves it back).
//
// Events: a fresh content/video.approve (the function exits unless the
// pipeline is 'approved'/'generating') AND a fresh track.render per
// unfinished track — the original render runs exit as soon as they see the
// pipeline 'failed', so without these nothing would render the tracks after
// the visuals finish. Ids carry updated_at (fresh on every successful CAS)
// so Inngest's 24h id dedup can't swallow a second resume.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = getSupabase()

  const { data: pipeline, error: pErr } = await supabase
    .from('content_pipelines')
    .select('*')
    .eq('job_id', jobId)
    .eq('content_type', 'video')
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!pipeline) return NextResponse.json({ error: 'No video pipeline for this job' }, { status: 404 })

  if (pipeline.status !== 'failed') {
    return NextResponse.json(
      { error: `Pipeline is '${pipeline.status}', can only resume a 'failed' pipeline` },
      { status: 409 },
    )
  }
  if (pipeline.last_error === CANCELLED_MESSAGE) {
    return NextResponse.json({ error: 'This video was cancelled by the user, not failed' }, { status: 409 })
  }

  const { data: tracks, error: tErr } = await supabase
    .from('content_language_tracks')
    .select('*')
    .eq('content_pipeline_id', pipeline.id)
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (!tracks || tracks.length === 0) {
    // No tracks means the script stage failed before approval — there is no
    // production to resume.
    return NextResponse.json({ error: 'Video was never approved, nothing to resume' }, { status: 409 })
  }

  const { error: aErr } = await supabase
    .from('content_visual_assets')
    .update({ attempt_number: 1, updated_at: new Date().toISOString() })
    .eq('content_pipeline_id', pipeline.id)
    .eq('generation', pipeline.current_generation)
    .eq('status', 'failed')
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  const { data: resumed, error: uErr } = await supabase
    .from('content_pipelines')
    .update({ status: 'generating', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', pipeline.id)
    .eq('status', 'failed')
    .select()
    .maybeSingle()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  if (!resumed) {
    return NextResponse.json({ error: 'Pipeline status changed concurrently, resume not applied' }, { status: 409 })
  }

  const renderTrackIds: string[] = []
  for (const track of tracks) {
    if (track.status === 'failed' && typeof track.last_error === 'string' && track.last_error.startsWith(SHARED_FAILURE_PREFIX)) {
      const { data: reset } = await supabase
        .from('content_language_tracks')
        .update({
          status: 'waiting_on_shared',
          retry_count: 0,
          last_error: null,
          current_step: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', track.id)
        .eq('status', 'failed')
        .select('id')
        .maybeSingle()
      if (reset) renderTrackIds.push(track.id)
    } else if (track.status !== 'failed' && track.status !== 'ready') {
      renderTrackIds.push(track.id)
    }
  }

  await supabase
    .from('content_jobs')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'failed')

  const suffix = `resume-${resumed.updated_at}`
  await inngest.send({
    id: `${pipeline.id}:video.approve:${suffix}`,
    name: 'content/video.approve',
    data: { pipelineId: pipeline.id, jobId },
  })
  if (renderTrackIds.length > 0) {
    await inngest.send(
      renderTrackIds.map((trackId) => ({
        id: `${trackId}:video.track.render:${suffix}`,
        name: 'content/video.track.render' as const,
        data: { trackId, pipelineId: pipeline.id, jobId },
      })),
    )
  }

  return NextResponse.json({ pipeline: resumed, tracksResumed: renderTrackIds.length })
}
