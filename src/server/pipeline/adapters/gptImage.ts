import {
  ProviderCallError,
  type ImageGenerator,
  type ImageGenerationInput,
  type ImageJobRef,
  type ImagePollResult,
} from './types'
import { kieSubmitLimiter } from '../lib/kieRateLimiter'

/**
 * KIE.ai GPT Image 2.5 (docs.kie.ai/market/gpt/gpt-image-2-5-*). Same
 * jobs/createTask + jobs/recordInfo endpoints as NanoBananaImageGenerator,
 * but KIE exposes separate model ids for text-to-image and image-to-image, and
 * the reference-image param is `input_urls` (not nano-banana's `image_input`).
 *
 * Two variants exist: `sunburst` (quality-optimised, the default here) and
 * `flare` (speed-optimised). Pass the variant to switch.
 *
 * Aspect ratios: 1:1, 9:16 and 16:9 (everything video uses) are all in the
 * documented enum. 4:5 (the old nano-banana default for blog/image_post) is
 * NOT in the documented enum, so callers that never set aspectRatio get 3:4.
 * 1K–4K resolution is selectable; 1K is the default (6 credits vs 10 at 2K).
 */
export type GptImageVariant = 'sunburst' | 'flare'
export type GptImageResolution = '1K' | '2K' | '4K'

export class GptImageGenerator implements ImageGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly variant: GptImageVariant = 'sunburst',
    private readonly resolution: GptImageResolution = '1K',
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl: string = 'https://api.kie.ai',
  ) {}

  async submit(input: ImageGenerationInput): Promise<ImageJobRef> {
    const refs = [input.referenceImageUrl, ...(input.extraReferenceImageUrls ?? [])].filter(
      (url): url is string => !!url,
    )
    const mode = refs.length > 0 ? 'image-to-image' : 'text-to-image'
    await kieSubmitLimiter.acquire()
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: `gpt-image-2-5-${this.variant}-${mode}`,
        input: {
          prompt: input.prompt,
          aspect_ratio: input.aspectRatio ?? '3:4',
          resolution: this.resolution,
          ...(refs.length > 0 ? { input_urls: refs.slice(0, 16) } : {}),
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('kie-gpt-image', res.status, detail)
    }

    const data = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } }
    const taskId = data.data?.taskId
    if (data.code !== 200 || !taskId) {
      throw new ProviderCallError('kie-gpt-image', res.status, data.msg ?? 'response had no data.taskId')
    }

    return { providerRef: taskId }
  }

  async poll(jobRef: ImageJobRef): Promise<ImagePollResult> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(jobRef.providerRef)}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    )

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('kie-gpt-image', res.status, detail)
    }

    const data = (await res.json()) as {
      data?: { state?: string; resultJson?: string; failMsg?: string | null; errorMessage?: string | null }
    }
    const inner = data.data
    const state = inner?.state

    if (state === 'success') {
      let fileUrl: string | undefined
      try {
        const parsed = inner?.resultJson ? (JSON.parse(inner.resultJson) as { resultUrls?: string[] }) : undefined
        fileUrl = parsed?.resultUrls?.[0]
      } catch {
        // fall through — treated as failed below
      }
      if (!fileUrl) {
        return { status: 'failed', detail: 'state=success but resultJson had no resultUrls[0]' }
      }
      return { status: 'ready', fileUrl }
    }
    if (state === 'fail' || state === 'failed') {
      return {
        status: 'failed',
        detail: inner?.failMsg ?? inner?.errorMessage ?? 'unknown KIE.ai (gpt-image-2.5) failure',
      }
    }
    return { status: 'pending' }
  }
}
