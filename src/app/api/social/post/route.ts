import { NextRequest, NextResponse } from 'next/server'
import { upsertSocialPost } from '@/services/contentService'
import type { ContentType, PlatformType } from '@/types/content'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { job_id, content_type, caption, hashtags, platforms, file_url } = body as {
    job_id: string
    content_type: ContentType
    caption: string
    hashtags: string[]
    platforms: PlatformType[]
    file_url: string | null
  }

  if (!job_id || !content_type || !caption || !platforms?.length) {
    return NextResponse.json(
      { error: 'Missing required fields: job_id, content_type, caption, platforms' },
      { status: 400 },
    )
  }

  try {
    await upsertSocialPost(job_id, content_type, caption, hashtags ?? [], platforms)

    const webhookUrl = process.env.N8N_SOCIAL_WEBHOOK
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Social posting is not configured yet.' }, { status: 503 })
    }

    const secret = process.env.N8N_WEBHOOK_SECRET ?? ''
    let n8nResponse: Response
    try {
      n8nResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-n8n-secret': secret,
        },
        body: JSON.stringify({
          job_id,
          content_type,
          platforms,
          caption,
          hashtags: hashtags ?? [],
          file_url: file_url ?? null,
        }),
        signal: AbortSignal.timeout(15000),
      })
    } catch (fetchErr) {
      return NextResponse.json(
        { error: 'Could not reach the posting workflow. Nothing was posted.' },
        { status: 502 },
      )
    }

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text().catch(() => '')
      return NextResponse.json(
        { error: `Posting workflow responded with an error (${n8nResponse.status}): ${errText}` },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}