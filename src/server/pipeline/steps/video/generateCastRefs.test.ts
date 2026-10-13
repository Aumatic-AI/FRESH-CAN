import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImageGenerator } from '../../adapters/types'
import type { VideoStorageUploader } from '../../adapters/storage'
import type { PipelineRow } from '../../db'

const recordStepAttempt = vi.fn(async () => {})
vi.mock('../../db', () => ({
  isPipelineFailed: vi.fn(async () => false),
  recordStepAttempt: (...args: unknown[]) => recordStepAttempt(...(args as [])),
}))

const { runGenerateCastRef } = await import('./generateCastRefs')

const client = {
  storage: {
    from: () => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example.com/${path}` } }),
    }),
  },
} as unknown as SupabaseClient

const pipeline = { id: 'pipe-1', job_id: 'job-1', current_generation: 2 } as PipelineRow
const resident = { id: 'resident', appearance: 'Woman with a low black ponytail', wardrobe: 'olive-green jacket' }

function fakeGenerator(): ImageGenerator & { submit: ReturnType<typeof vi.fn> } {
  return {
    submit: vi.fn(async () => ({ providerRef: 'task-1' })),
    poll: vi.fn(async () => ({ status: 'ready' as const, fileUrl: 'https://kie.example.com/tmp.png' })),
  }
}

function fakeUploader(): VideoStorageUploader & { uploadFromUrl: ReturnType<typeof vi.fn> } {
  return {
    uploadBuffer: vi.fn(),
    uploadFromUrl: vi.fn(async (path: string) => `https://storage.example.com/${path}`),
  }
}

const headStatus = (ok: boolean) => vi.fn(async () => ({ ok })) as unknown as typeof fetch

describe('runGenerateCastRef', () => {
  beforeEach(() => recordStepAttempt.mockClear())

  it('generates a portrait and stores it at a generation-scoped path', async () => {
    const gen = fakeGenerator()
    const uploader = fakeUploader()
    const url = await runGenerateCastRef(client, pipeline, resident, gen, uploader, '9:16', headStatus(false))
    expect(url).toBe('https://storage.example.com/job-1/cast-ref-resident-g2.png')
    expect(gen.submit).toHaveBeenCalledTimes(1)
    expect(gen.submit.mock.calls[0][0].prompt).toContain('Woman with a low black ponytail')
    expect(uploader.uploadFromUrl).toHaveBeenCalledWith('job-1/cast-ref-resident-g2.png', 'https://kie.example.com/tmp.png')
  })

  it('reuses a portrait that already exists instead of paying for another one', async () => {
    const gen = fakeGenerator()
    const url = await runGenerateCastRef(client, pipeline, resident, gen, fakeUploader(), '9:16', headStatus(true))
    expect(url).toBe('https://storage.example.com/job-1/cast-ref-resident-g2.png')
    expect(gen.submit).not.toHaveBeenCalled()
  })

  it('fails open: a provider error returns null so scenes keep the text-only cast', async () => {
    const gen = fakeGenerator()
    gen.submit.mockRejectedValueOnce(new Error('KIE down'))
    const url = await runGenerateCastRef(client, pipeline, resident, gen, fakeUploader(), '9:16', headStatus(false))
    expect(url).toBeNull()
    expect(recordStepAttempt).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ stepName: 'generate_cast_ref:resident', status: 'failed_terminal' }),
    )
  })
})
