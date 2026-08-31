import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  upsertDraftFromCallback,
  upsertGeneratedContent,
  upsertPlatformLog,
  updateJobStatus,
  getSocialPostsForJob,
  updateSocialPostStatus,
} from '@/services/contentService'
import type { N8nCallback, N8nVideoComplete } from '@/types/content'

// Fix #17 — verify shared secret sent by n8n
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret) return true // skip check if not configured (dev mode)
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  // Fix #17 — reject unauthenticated callers
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawBody: unknown

  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── New format: video-approve workflow completion ─────────────────────────────
  // Shape: { success, status: 'completed', job_id, video: { url, duration_sec, ... } }
  const maybeComplete = rawBody as Record<string, unknown>
  if (maybeComplete.status === 'completed' && maybeComplete.video) {
    const vc = rawBody as N8nVideoComplete

    if (!vc.job_id || !vc.video?.url) {
      return NextResponse.json(
        { error: 'video_complete requires job_id and video.url' },
        { status: 400 },
      )
    }

    try {
      await upsertGeneratedContent(
        vc.job_id,
        'video',
        vc.video.url,
        undefined,
        {
          duration_sec:  vc.video.duration_sec,
          total_scenes:  vc.video.total_scenes,
          language:      vc.video.language,
          script_type:   vc.video.script_type,
          display:       vc.display,
          completed_at:  vc.completed_at,
        },
      )
      await updateJobStatus(vc.job_id, 'ready')
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[n8n-callback] video_complete error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // ── Legacy format: { job_id, content_type, event, data } ─────────────────────
  const body = rawBody as N8nCallback
  const { job_id, content_type, event, data } = body

  if (!job_id || !content_type || !event) {
    return NextResponse.json(
      { error: 'Missing required fields: job_id, content_type, event' },
      { status: 400 },
    )
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('content_jobs')
    .select('id, status')
    .eq('id', job_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  try {
    if (event === 'draft_ready') {
      // Fix #1 — validate data shape before destructuring
      if (!data || typeof (data as Record<string, unknown>).draft_data !== 'object') {
        return NextResponse.json(
          { error: 'draft_ready event requires data.draft_data object' },
          { status: 400 },
        )
      }
      const { draft_data } = data as { draft_data: Record<string, unknown> }
      await upsertDraftFromCallback(job_id, content_type, draft_data)
      await updateJobStatus(job_id, 'draft_ready')

    } else if (event === 'generation_complete') {
      // Fix #1 — validate required fields
      const genData = data as Record<string, unknown> | undefined
      if (!genData?.file_url || typeof genData.file_url !== 'string') {
        return NextResponse.json(
          { error: 'generation_complete event requires data.file_url string' },
          { status: 400 },
        )
      }

      await upsertGeneratedContent(
        job_id,
        content_type,
        genData.file_url as string,
        typeof genData.thumbnail_url === 'string' ? genData.thumbnail_url : undefined,
        (genData.output_data as Record<string, unknown>) ?? {},
      )

      // Fix #3 — capture and log the error from jobFull query
      const { data: jobFull, error: jobFullError } = await supabase
        .from('content_jobs')
        .select('content_types')
        .eq('id', job_id)
        .single()

      if (jobFullError) {
        console.error('[n8n-callback] failed to fetch content_types for job', job_id, jobFullError.message)
      }

      const { count: readyCount, error: countError } = await supabase
        .from('generated_content')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job_id)

      if (countError) {
        console.error('[n8n-callback] failed to count generated_content for job', job_id, countError.message)
      }

      // Fix #2 — require content_types.length > 0 to prevent 0 >= 0 = true
      const requestedCount = (jobFull?.content_types as string[] | undefined)?.length ?? 0
      const allReady =
        !jobFullError &&
        !countError &&
        requestedCount > 0 &&
        readyCount !== null &&
        readyCount >= requestedCount

      if (allReady) {
        await updateJobStatus(job_id, 'ready')
      }

    } else if (event === 'post_complete') {
      // Fix #1 — validate required fields
      const postData = data as Record<string, unknown> | undefined
      if (!postData?.platform || typeof postData.platform !== 'string') {
        return NextResponse.json(
          { error: 'post_complete event requires data.platform string' },
          { status: 400 },
        )
      }

      const socialPosts = await getSocialPostsForJob(job_id)
      const matchingPost = socialPosts.find((p) => p.content_type === content_type)

        if (matchingPost) {
    await supabase.from('social_platform_logs').insert({
      social_post_id: matchingPost.id,
      job_id: job_id,
      platform: postData.platform,
      status: 'posted',
      platform_post_id: typeof postData.platform_post_id === 'string' ? postData.platform_post_id : null,
      post_url: typeof postData.post_url === 'string' ? postData.post_url : null,
      posted_at: new Date().toISOString(),
    })
    await updateSocialPostStatus(matchingPost.id, 'posted')
  }

    } else {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[n8n-callback] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
