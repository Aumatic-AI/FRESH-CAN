// Single-shot test path (branch test/seedance-single-shot): KIE.ai Seedance 2.5
// TEXT-to-video, one 30-second clip with native audio.
//
// Verified against docs.kie.ai/market/bytedance/seedance-2-5 (2026-11-05):
//   model `bytedance/seedance-2-5`; input.prompt (max 20,480 chars);
//   duration integer 4-30; resolution '480p' | '720p' | '1080p';
//   aspect_ratio incl. '9:16' | '1:1' | '16:9'; generate_audio boolean
//   (default true); optional reference_image_urls (up to 30 images, jpeg/png/
//   webp, 300-6000px, <30MB each). Text-to-video needs no image.
//
// Resolution is deliberately PINNED to 480p for this test and is not
// configurable (no env override), to keep the 30s run cheap. This is separate
// from the production KieVideoGenerator (720p, Seedance 2.0), which is
// untouched. The poll logic mirrors KieVideoGenerator.poll; it is duplicated
// rather than imported so kie.ts stays unmodified.
import { ProviderCallError, type VideoJobRef, type VideoPollResult } from './types'
import { kieSubmitLimiter } from '../lib/kieRateLimiter'

export const SINGLE_SHOT_RESOLUTION = '480p' as const
export const DEFAULT_SINGLE_SHOT_MODEL = 'bytedance/seedance-2-5'

export interface SingleShotGenerationInput {
  prompt: string
  aspectRatio: '9:16' | '1:1' | '16:9'
  durationSeconds: number
  /** Real brand photos (Seedance 2.5 multimodal reference mode, up to 30). Omitted/empty = pure text-to-video. */
  referenceImageUrls?: string[]
}

export interface SingleShotGenerator {
  submit(input: SingleShotGenerationInput): Promise<VideoJobRef>
  poll(jobRef: VideoJobRef): Promise<VideoPollResult>
}

export class KieSingleShotGenerator implements SingleShotGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_SINGLE_SHOT_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl: string = 'https://api.kie.ai',
  ) {}

  async submit(input: SingleShotGenerationInput): Promise<VideoJobRef> {
    await kieSubmitLimiter.acquire()
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        input: {
          prompt: input.prompt,
          aspect_ratio: input.aspectRatio,
          resolution: SINGLE_SHOT_RESOLUTION,
          duration: input.durationSeconds,
          // Native audio is the whole point: no ElevenLabs, no FFmpeg mux.
          generate_audio: true,
          // Reference-image mode: sent ONLY when images are supplied. The docs make it exclusive with
          // first/last-frame mode, which this adapter never uses.
          ...(input.referenceImageUrls && input.referenceImageUrls.length > 0
            ? { reference_image_urls: input.referenceImageUrls }
            : {}),
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('kie', res.status, detail)
    }
    const data = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } }
    const taskId = data.data?.taskId
    if (data.code !== 200 || !taskId) {
      throw new ProviderCallError('kie', res.status, data.msg ?? 'response had no data.taskId')
    }
    return { providerRef: taskId }
  }

  async poll(jobRef: VideoJobRef): Promise<VideoPollResult> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(jobRef.providerRef)}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('kie', res.status, detail)
    }

    const data = (await res.json()) as {
      code?: number
      msg?: string
      data?: { state?: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'; resultJson?: string; failMsg?: string }
    }
    // KIE reports poll errors as HTTP 200 with the error in the body.
    if (data.code !== undefined && data.code !== 200) {
      const detail = `KIE.ai poll returned code ${data.code}: ${data.msg ?? 'no message'}`
      if (data.code === 404 || data.code === 422) return { status: 'failed', detail }
      throw new ProviderCallError('kie', null, detail)
    }

    const inner = data.data
    if (inner?.state === 'success') {
      let resultUrls: string[] | undefined
      try {
        resultUrls = inner.resultJson ? (JSON.parse(inner.resultJson) as { resultUrls?: string[] }).resultUrls : undefined
      } catch {
        // fall through to the "missing" failure below
      }
      const fileUrl = resultUrls?.[0]
      if (!fileUrl) return { status: 'failed', detail: 'state=success but resultJson had no resultUrls[0]' }
      return { status: 'ready', fileUrl }
    }
    if (inner?.state === 'fail') return { status: 'failed', detail: inner.failMsg ?? 'unknown KIE.ai failure' }
    return { status: 'pending' }
  }
}

/** Zero-cost stand-in for KIE_FAKE_MODE: no real KIE call is made. */
export class FakeSingleShotGenerator implements SingleShotGenerator {
  private static counter = 0
  constructor(private readonly fileUrl: string) {}

  async submit(): Promise<VideoJobRef> {
    return { providerRef: `fake-single-shot-${++FakeSingleShotGenerator.counter}` }
  }

  async poll(): Promise<VideoPollResult> {
    return { status: 'ready', fileUrl: this.fileUrl }
  }
}
