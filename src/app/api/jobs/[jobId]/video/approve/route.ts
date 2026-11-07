import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { readSingleShotDraft } from '@/server/pipeline/steps/singleShot/updateSingleShot'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

type VideoLanguage = 'EN' | 'FR'

// BOTH is a request-level concept only — resolved here into 1 or 2 discrete
// language tracks, exactly like blog/image's own resolveRequestedLanguages.
// The literal string 'BOTH' never reaches a track row, and there is no
// separate `video_approve_both` code path — a two-element array IS what
// BOTH means (ARCHITECTURE.MD §9/§11).
function resolveRequestedLanguages(jobLanguage: string, override?: unknown): VideoLanguage[] {
  if (Array.isArray(override)) {
    const valid = override.filter((l): l is VideoLanguage => l === 'EN' || l === 'FR')
    if (valid.length > 0) return Array.from(new Set(valid))
  }
  if (jobLanguage === 'BOTH') return ['EN', 'FR']
  if (jobLanguage === 'FR') return ['FR']
  return ['EN']
}

const UNIQUE_VIOLATION = '23505'

// Locks the master script (draft_ready -> approved) and creates one
// content_language_track row per requested language, all in this one call —
// unlike blog/image's /generate, which creates tracks immediately since
// those types have no pre-generation approval gate. This is the ONLY place
// video's language tracks get created.
//
// Video is on Inngest now (src/inngest/functions/video.ts) — this route
// sends content/video.approve (shared: generate_character_ref then
// generate_scene_visual) and one content/video.track.render per track it
// just created, rather than relying on a poll loop to discover the status
// change.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = getSupabase()

  const { data: job, error: jobErr } = await supabase
    .from('content_jobs')
    .select('id, language')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const { data: pipeline, error: pErr } = await supabase
    .from('content_pipelines')
    .select('*')
    .eq('job_id', jobId)
    .eq('content_type', 'video')
    .maybeSingle()

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }
  if (!pipeline) {
    return NextResponse.json({ error: 'No video pipeline for this job — call /video/generate first' }, { status: 404 })
  }

  // TEST-ONLY single-shot flow (branch test/seedance-single-shot): the draft holds one
  // Seedance prompt instead of a scene plan, there are no language tracks to create, and
  // approval sends the single render event. Scene-pipeline jobs never match this.
  const { data: ssDraft } = await supabase
    .from('content_drafts')
    .select('draft_data')
    .eq('content_pipeline_id', pipeline.id)
    .maybeSingle()
  const ssParsed = readSingleShotDraft(ssDraft?.draft_data)
  if (ssParsed) {
    if (pipeline.status === 'created' || pipeline.status === 'drafting') {
      return NextResponse.json({ error: `Script is not ready yet (pipeline status: ${pipeline.status})` }, { status: 409 })
    }
    let claimedPipeline = pipeline
    let created = false
    if (pipeline.status === 'draft_ready') {
      const { data: claimed, error: claimErr } = await supabase
        .from('content_pipelines')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', pipeline.id)
        .eq('status', 'draft_ready')
        .select()
        .maybeSingle()
      if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })
      if (claimed) {
        claimedPipeline = claimed
        created = true
      }
    }
    // One track per language (BOTH = EN + FR). Idempotent: a repeat approve inserts nothing new.
    // A repeat approval must never start a second paid render: only a pipeline that is (now) approved or
    // already generating may (re)send the render event, and the render function itself skips anything
    // that is not approved/generating. Failed/cancelled videos recover through /video/resume.
    if (pipeline.status === 'failed') {
      return NextResponse.json(
        { error: 'This video failed or was cancelled. Use Resume/Retry to run it again.' },
        { status: 409 },
      )
    }
    if (pipeline.status === 'ready') {
      const { data: doneTracks } = await supabase.from('content_language_tracks').select('*').eq('content_pipeline_id', pipeline.id)
      return NextResponse.json({ pipeline, tracks: doneTracks ?? [], created: false })
    }
    const trackLanguages = ssParsed.languages === 'BOTH' ? ['EN', 'FR'] : ssParsed.languages === 'FR' ? ['FR'] : ['EN']
    const { error: trackErr } = await supabase
      .from('content_language_tracks')
      .upsert(
        trackLanguages.map((language) => ({
          content_pipeline_id: pipeline.id,
          language,
          master_generation_used: pipeline.current_generation,
        })),
        { onConflict: 'content_pipeline_id,language', ignoreDuplicates: true },
      )
    if (trackErr) return NextResponse.json({ error: trackErr.message }, { status: 500 })
    const { data: ssTracks } = await supabase.from('content_language_tracks').select('*').eq('content_pipeline_id', pipeline.id)

    // Stable id: a repeat approve (or a lost race) is deduped by Inngest, never a second paid render.
    await inngest.send({
      id: `${pipeline.id}:single-shot.render`,
      name: 'content/single-shot.render',
      data: { pipelineId: pipeline.id, jobId },
    })
    return NextResponse.json({ pipeline: claimedPipeline, tracks: ssTracks ?? [], created })
  }

  // Idempotency: already approved (or further along) — return the existing
  // tracks instead of erroring, same pattern as blog/image's /generate.
  // Resends both events too (stable ids, so a genuine repeat is deduped by
  // Inngest) — self-heals if the original approval crashed after the CAS
  // claim/track insert below but before its own sends ran.
  if (pipeline.status !== 'draft_ready') {
    if (pipeline.status === 'created' || pipeline.status === 'drafting') {
      return NextResponse.json(
        { error: `Script is not ready yet (pipeline status: ${pipeline.status})` },
        { status: 409 },
      )
    }
    const { data: tracks } = await supabase
      .from('content_language_tracks')
      .select('*')
      .eq('content_pipeline_id', pipeline.id)
    await sendVideoApproveEvents(pipeline.id, jobId, tracks ?? [])
    return NextResponse.json({ pipeline, tracks: tracks ?? [], created: false })
  }

  let body: { requestedLanguages?: unknown } = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const requestedLanguages = resolveRequestedLanguages(job.language as string, body.requestedLanguages)

  // CAS claim — loses gracefully to a concurrent approve call instead of
  // double-approving or creating duplicate tracks.
  const { data: claimed, error: claimErr } = await supabase
    .from('content_pipelines')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', pipeline.id)
    .eq('status', 'draft_ready')
    .select()
    .maybeSingle()

  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 })
  }
  if (!claimed) {
    // Lost the race — another request already approved this pipeline.
    const { data: current } = await supabase.from('content_pipelines').select('*').eq('id', pipeline.id).single()
    const { data: tracks } = await supabase
      .from('content_language_tracks')
      .select('*')
      .eq('content_pipeline_id', pipeline.id)
    await sendVideoApproveEvents(pipeline.id, jobId, tracks ?? [])
    return NextResponse.json({ pipeline: current ?? pipeline, tracks: tracks ?? [], created: false })
  }

  const { data: tracks, error: tErr } = await supabase
    .from('content_language_tracks')
    .insert(
      requestedLanguages.map((language) => ({
        content_pipeline_id: claimed.id,
        language,
        master_generation_used: claimed.current_generation,
      })),
    )
    .select()

  if (tErr) {
    if (tErr.code === UNIQUE_VIOLATION) {
      const { data: racedTracks } = await supabase
        .from('content_language_tracks')
        .select('*')
        .eq('content_pipeline_id', claimed.id)
      await sendVideoApproveEvents(claimed.id, jobId, racedTracks ?? [])
      return NextResponse.json({ pipeline: claimed, tracks: racedTracks ?? [], created: false })
    }
    return NextResponse.json({ error: tErr.message }, { status: 500 })
  }

  await sendVideoApproveEvents(claimed.id, jobId, tracks ?? [])

  return NextResponse.json({ pipeline: claimed, tracks: tracks ?? [], created: true })
}

// Sends the shared visuals event once, plus one per-track render event —
// NOT chained (the shared visuals function sends nothing itself here,
// unlike blog/image's hand-off) since localize_script/synthesize_voice/
// transcribe_audio don't wait on shared visuals at all; only render does
// (gated internally in src/inngest/functions/video.ts). Stable ids (no
// generation suffix) so a duplicate call — including the idempotent/raced
// paths above — is deduped by Inngest rather than starting a second run;
// video/regenerate/route.ts sends its OWN generation-scoped ids for actual
// regenerations.
async function sendVideoApproveEvents(
  pipelineId: string,
  jobId: string,
  tracks: Array<{ id: string }>,
): Promise<void> {
  await inngest.send({
    id: `${pipelineId}:video.approve`,
    name: 'content/video.approve',
    data: { pipelineId, jobId },
  })
  if (tracks.length > 0) {
    await inngest.send(
      tracks.map((track) => ({
        id: `${track.id}:video.track.render`,
        name: 'content/video.track.render' as const,
        data: { trackId: track.id, pipelineId, jobId },
      })),
    )
  }
}
