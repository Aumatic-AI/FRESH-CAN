import { describe, expect, it, vi } from 'vitest'
import { FakeSingleShotGenerator, KieSingleShotGenerator, SINGLE_SHOT_RESOLUTION } from './kieSingleShot'

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body, text: async () => '' })
}

describe('KieSingleShotGenerator (Seedance 2.5 text-to-video, docs.kie.ai/market/bytedance/seedance-2-5)', () => {
  it('submit() sends the 2.5 model, 480p, native audio, 30s, and no image field', async () => {
    const fetchImpl = okFetch({ code: 200, data: { taskId: 'task_1' } })
    const gen = new KieSingleShotGenerator('key', 'bytedance/seedance-2-5', fetchImpl as unknown as typeof fetch)
    const ref = await gen.submit({ prompt: 'a prompt', aspectRatio: '9:16', durationSeconds: 30 })
    expect(ref.providerRef).toBe('task_1')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.kie.ai/api/v1/jobs/createTask')
    expect(JSON.parse(init.body)).toEqual({
      model: 'bytedance/seedance-2-5',
      input: { prompt: 'a prompt', aspect_ratio: '9:16', resolution: '480p', duration: 30, generate_audio: true },
    })
  })

  it('sends reference_image_urls only when images are supplied', async () => {
    const fetchImpl = okFetch({ code: 200, data: { taskId: 't' } })
    const gen = new KieSingleShotGenerator('k', undefined, fetchImpl as unknown as typeof fetch)
    await gen.submit({ prompt: 'p', aspectRatio: '9:16', durationSeconds: 30, referenceImageUrls: ['https://x/a.png', 'https://x/b.png'] })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).input.reference_image_urls).toEqual(['https://x/a.png', 'https://x/b.png'])
    await gen.submit({ prompt: 'p', aspectRatio: '9:16', durationSeconds: 30, referenceImageUrls: [] })
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).input).not.toHaveProperty('reference_image_urls')
    await gen.submit({ prompt: 'p', aspectRatio: '9:16', durationSeconds: 30 })
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).input).not.toHaveProperty('reference_image_urls')
  })

  it('pins resolution to 480p', () => {
    expect(SINGLE_SHOT_RESOLUTION).toBe('480p')
  })

  it('submit() throws when KIE returns no taskId', async () => {
    const gen = new KieSingleShotGenerator('k', undefined, okFetch({ code: 500, msg: 'nope' }) as unknown as typeof fetch)
    await expect(gen.submit({ prompt: 'p', aspectRatio: '9:16', durationSeconds: 30 })).rejects.toThrow(/nope/)
  })

  it('poll() maps success, fail, pending and a lost task', async () => {
    const mk = (body: unknown) => new KieSingleShotGenerator('k', undefined, okFetch(body) as unknown as typeof fetch)
    const ref = { providerRef: 't' }
    expect(await mk({ code: 200, data: { state: 'success', resultJson: '{"resultUrls":["https://x/v.mp4"]}' } }).poll(ref)).toEqual({
      status: 'ready',
      fileUrl: 'https://x/v.mp4',
    })
    expect(await mk({ code: 200, data: { state: 'fail', failMsg: 'bad' } }).poll(ref)).toEqual({ status: 'failed', detail: 'bad' })
    expect(await mk({ code: 200, data: { state: 'generating' } }).poll(ref)).toEqual({ status: 'pending' })
    expect((await mk({ code: 422, msg: 'gone' }).poll(ref)).status).toBe('failed')
  })
})

describe('FakeSingleShotGenerator', () => {
  it('returns the given file immediately without a network call', async () => {
    const gen = new FakeSingleShotGenerator('https://x/fake.mp4')
    const ref = await gen.submit()
    expect(ref.providerRef).toMatch(/^fake-single-shot-/)
    expect(await gen.poll()).toEqual({ status: 'ready', fileUrl: 'https://x/fake.mp4' })
  })
})
