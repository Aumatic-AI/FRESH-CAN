import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

type WebhookType =
  | 'image_post'
  | 'image_questions'
  | 'video'
  | 'blog'
  | 'social'
  | 'video_approve'
  | 'video_approve_both'
  | 'image_approve'
  | 'blog_approve'
const WEBHOOK_URLS: Record<WebhookType, string | undefined> = {
  image_post:      process.env.N8N_IMAGE_WEBHOOK,
  image_questions: process.env.N8N_IMAGE_QUESTIONS_WEBHOOK,
  video:           process.env.N8N_VIDEO_WEBHOOK,
  blog:            process.env.N8N_BLOG_WEBHOOK,
  social:          process.env.N8N_SOCIAL_WEBHOOK,
  video_approve:   process.env.N8N_VIDEO_APPROVE_WEBHOOK,
  video_approve_both: process.env.N8N_VIDEO_APPROVE_BOTH_WEBHOOK,
  image_approve:   process.env.N8N_IMAGE_APPROVE_WEBHOOK,
  blog_approve:    process.env.N8N_BLOG_APPROVE_WEBHOOK,
}

export async function POST(req: NextRequest) {
  let body: { type: WebhookType; payload: Record<string, unknown> }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, payload } = body

  if (!type || !payload) {
    return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 })
  }

  const url = WEBHOOK_URLS[type]
  if (!url) {
    return NextResponse.json(
      { error: `No webhook URL configured for type: ${type}` },
      { status: 500 },
    )
  }

  const reqHeaders = {
    'Content-Type': 'application/json',
    'x-n8n-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
  }
  const bodyStr = JSON.stringify(payload)

  const GENERATION_TYPES: WebhookType[] = ['video', 'blog', 'image_post', 'social', 'video_approve', 'video_approve_both', 'image_approve', 'blog_approve']

  try {
    // No timeout for generation types — wait until n8n responds however long it takes.
    // image_questions also gets no artificial timeout override beyond the default,
    // since it's a quick text-only call, but it is NOT in GENERATION_TYPES because
    // (unlike image_post/video/blog) the frontend needs to read its response body
    // right away instead of treating it as fire-and-forget.
    const n8nRes = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: bodyStr,
      ...(GENERATION_TYPES.includes(type) ? {} : { signal: AbortSignal.timeout(15000) }),
    })

    // For blog: n8n returns the draft content directly in the response body.
    // Parse it and save to content_drafts + mark job draft_ready.
    if (type === 'blog') {
      const jobId = (payload as Record<string, unknown>).job_id as string | undefined
      if (n8nRes.ok && jobId) {
        try {
          const raw = await n8nRes.text()
          let blogData: Record<string, unknown> = {}
          try { blogData = JSON.parse(raw) } catch { blogData = { content: raw } }

          // If n8n returns an array, take the first item
          if (Array.isArray(blogData)) blogData = (blogData[0] as Record<string, unknown>) ?? {}

          const db = getSupabase()
const draftLanguage = ((payload as Record<string, unknown>).language as string) || 'EN'
await db.from('content_drafts').upsert(
  { job_id: jobId, content_type: 'blog', language: draftLanguage, draft_data: blogData, status: 'draft_ready', is_approved: false, updated_at: new Date().toISOString() },
  { onConflict: 'job_id,content_type,language' },
)
          await db.from('content_jobs')
            .update({ status: 'draft_ready', updated_at: new Date().toISOString() })
            .eq('id', jobId)
        } catch (saveErr) {
          console.error('[n8n-trigger] blog draft save error:', saveErr)
        }
      } else if (!n8nRes.ok) {
        const text = await n8nRes.text().catch(() => '')
        console.log(`[n8n-trigger] blog returned ${n8nRes.status}: ${text}`)
      }
      return NextResponse.json({ success: true })
    }

    // image_questions: unlike the other types, this one is NOT fire-and-forget
    // — n8n responds immediately with the actual question list, which the
    // frontend needs right away to render the Q&A step.
    if (type === 'image_questions') {
      if (!n8nRes.ok) {
        const text = await n8nRes.text().catch(() => '')
        return NextResponse.json({ error: `n8n returned ${n8nRes.status}: ${text}` }, { status: 502 })
      }
      const data = await n8nRes.json().catch(() => null)
      if (!data) {
        return NextResponse.json({ error: 'Invalid response from n8n' }, { status: 502 })
      }
      return NextResponse.json(data)
    }

    // For other generation webhooks (video, image_post), result comes via
    // /api/webhooks/n8n-callback — ignore n8n's HTTP status here.
    if (GENERATION_TYPES.includes(type)) {
      if (!n8nRes.ok) {
        const text = await n8nRes.text().catch(() => '')
        console.log(`[n8n-trigger] ${type} returned ${n8nRes.status} (workflow may still complete): ${text}`)
      }
      return NextResponse.json({ success: true })
    }

    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => '')
      console.error(`[n8n-trigger] ${type} returned ${n8nRes.status}: ${text}`)
      return NextResponse.json({ error: `n8n returned ${n8nRes.status}` }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[n8n-trigger] ${type}:`, message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
