import { describe, it, expect, vi } from 'vitest'
import { GptImageGenerator } from './gptImage'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as Response

describe('GptImageGenerator (KIE gpt-image-2-5)', () => {
  it('uses text-to-image with no input_urls when there are no references', async () => {
    const f = vi.fn().mockResolvedValue(ok({ code: 200, data: { taskId: 't1' } }))
    const g = new GptImageGenerator('k', 'sunburst', '1K', f as unknown as typeof fetch)
    await g.submit({ prompt: 'p', aspectRatio: '9:16' })
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-image-2-5-sunburst-text-to-image')
    expect(body.input).toEqual({ prompt: 'p', aspect_ratio: '9:16', resolution: '1K' })
  })

  it('uses image-to-image with input_urls when references are given', async () => {
    const f = vi.fn().mockResolvedValue(ok({ code: 200, data: { taskId: 't1' } }))
    const g = new GptImageGenerator('k', 'flare', '1K', f as unknown as typeof fetch)
    await g.submit({ prompt: 'p', referenceImageUrl: 'a', extraReferenceImageUrls: ['b'], aspectRatio: '1:1' })
    const body = JSON.parse(f.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-image-2-5-flare-image-to-image')
    expect(body.input.input_urls).toEqual(['a', 'b'])
  })

  it('poll maps success to ready and fail to failed', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: { state: 'success', resultJson: '{"resultUrls":["u"]}' } }))
      .mockResolvedValueOnce(ok({ data: { state: 'fail', failMsg: 'bad' } }))
    const g = new GptImageGenerator('k', 'sunburst', '1K', f as unknown as typeof fetch)
    expect(await g.poll({ providerRef: 't' })).toEqual({ status: 'ready', fileUrl: 'u' })
    expect(await g.poll({ providerRef: 't' })).toEqual({ status: 'failed', detail: 'bad' })
  })
})
