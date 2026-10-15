import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseVideoStorageUploader } from './storage'

function clientWith(upload: ReturnType<typeof vi.fn>): SupabaseClient {
  return {
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
      }),
    },
  } as unknown as SupabaseClient
}

describe('SupabaseVideoStorageUploader.uploadBuffer', () => {
  it('retries a failed upload and succeeds without throwing', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'fetch failed' } })
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ error: null })
    const uploader = new SupabaseVideoStorageUploader(clientWith(upload), fetch, [0, 0])

    await expect(uploader.uploadBuffer('j/EN.mp4', Buffer.from('x'), 'video/mp4')).resolves.toBe('https://cdn/j/EN.mp4')
    expect(upload).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting its tries', async () => {
    const upload = vi.fn().mockResolvedValue({ error: { message: 'fetch failed' } })
    const uploader = new SupabaseVideoStorageUploader(clientWith(upload), fetch, [0, 0])

    await expect(uploader.uploadBuffer('j/EN.mp4', Buffer.from('x'), 'video/mp4')).rejects.toThrow(
      'failed to upload to freshcan-videos/j/EN.mp4: fetch failed',
    )
    expect(upload).toHaveBeenCalledTimes(3)
  })
})
