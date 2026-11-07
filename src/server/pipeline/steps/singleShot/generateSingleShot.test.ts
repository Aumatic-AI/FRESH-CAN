import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  hasSucceededStep: vi.fn(),
  getLastSucceededStepOutput: vi.fn(),
  recordStepAttempt: vi.fn(),
  upsertVideoGeneratedContent: vi.fn(),
  markJobReadyIfAllContentComplete: vi.fn(),
}))
vi.mock('../../db', async (orig) => ({ ...(await orig<typeof import('../../db')>()), ...db }))

import {
  SingleShotStoppedError,
  TASK_FAILED_STEP_NAME,
  SUBMIT_STEP_NAME,
  finalizeSingleShot,
  recordSingleShotTaskFailed,
  recordSingleShotTimeout,
  TASK_TIMEOUT_STEP_NAME,
  submitSingleShot,
} from './generateSingleShot'

type Resp = { data: unknown; error: null }
/** Chainable stand-in for the Supabase client: records every write, answers per `table.op`. */
function fakeClient(responses: Record<string, unknown>) {
  const calls: { table: string; op: string; value?: unknown }[] = []
  const from = (table: string) => {
    const state = { op: 'select', value: undefined as unknown }
    const answer = (): Resp => {
      calls.push({ table, op: state.op, value: state.value })
      return { data: responses[`${table}.${state.op}`] ?? null, error: null }
    }
    const api: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'limit', 'order']) api[m] = () => api
    api.update = (v: unknown) => ((state.op = 'update'), (state.value = v), api)
    api.delete = () => ((state.op = 'delete'), api)
    api.insert = (v: unknown) => ((state.op = 'insert'), (state.value = v), api)
    api.maybeSingle = async () => answer()
    api.single = async () => answer()
    api.then = (res: (r: Resp) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(answer()).then(res, rej)
    return api
  }
  return { client: { from } as never, calls }
}

const input = { prompt: 'p', aspectRatio: '9:16' as const, durationSeconds: 30, referenceImageUrls: [] }
const meta = {
  model: 'm', originalIdea: 'i', enhancedPrompt: 'p', hook: 'h', containerShown: 'none' as const, referenceImageUrls: [],
  audioMode: 'narration' as const, audioReason: '', speakers: [], spokenLines: [], aspectRatio: '9:16' as const, language: 'EN' as const,
}
const okFetch = (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })) as unknown as typeof fetch

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset())
  db.recordStepAttempt.mockResolvedValue(undefined)
  db.upsertVideoGeneratedContent.mockResolvedValue(undefined)
  db.markJobReadyIfAllContentComplete.mockResolvedValue(undefined)
})

describe('submitSingleShot: fresh task only when needed', () => {
  const generator = () => ({ submit: vi.fn(async () => ({ providerRef: 'new-task' })), poll: vi.fn() })

  it('submits once when nothing was submitted yet', async () => {
    db.hasSucceededStep.mockResolvedValue(false)
    const g = generator()
    expect(await submitSingleShot(fakeClient({}).client, 'p1', 1, g, input)).toBe('new-task')
    expect(g.submit).toHaveBeenCalledTimes(1)
  })
  it('reuses a live saved task: a retry or resume never pays twice', async () => {
    db.hasSucceededStep.mockResolvedValue(true)
    db.getLastSucceededStepOutput.mockImplementation(async (_c, _s, step) => (step === SUBMIT_STEP_NAME ? { providerRef: 'live' } : null))
    const g = generator()
    expect(await submitSingleShot(fakeClient({}).client, 'p1', 1, g, input)).toBe('live')
    expect(g.submit).not.toHaveBeenCalled()
  })
  it('submits a fresh task when KIE reported the saved one as failed', async () => {
    db.hasSucceededStep.mockResolvedValue(true)
    db.getLastSucceededStepOutput.mockImplementation(async (_c, _s, step) =>
      step === SUBMIT_STEP_NAME ? { providerRef: 'dead' } : { providerRef: 'dead' },
    )
    const g = generator()
    expect(await submitSingleShot(fakeClient({}).client, 'p1', 1, g, input)).toBe('new-task')
    expect(g.submit).toHaveBeenCalledTimes(1)
  })
  it('records a dead task under its own step name', async () => {
    await recordSingleShotTaskFailed(fakeClient({}).client, 'p1', 2, 'dead', 'boom')
    expect(db.recordStepAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ stepName: TASK_FAILED_STEP_NAME, generation: 2, outputSnapshot: { providerRef: 'dead', detail: 'boom' } }),
    )
  })
})

describe('finalizeSingleShot: a cancelled or failed run can never become ready', () => {
  const uploader = () => ({ uploadBuffer: vi.fn(async (p: string) => `https://cdn/${p}`) })
  const args = (over: object = {}) => ({
    pipelineId: 'p1', jobId: 'j1', generation: 1, kieFileUrl: 'https://kie/x.mp4', meta, fetchImpl: okFetch,
    watermark: async (b: Buffer) => b, ...over,
  })

  it('stops before downloading, uploading or writing anything when the pipeline already failed (cancelled)', async () => {
    const { client, calls } = fakeClient({ 'content_pipelines.select': { status: 'failed' } })
    const up = uploader()
    await expect(finalizeSingleShot(client, up as never, args())).rejects.toBeInstanceOf(SingleShotStoppedError)
    expect(up.uploadBuffer).not.toHaveBeenCalled()
    expect(db.upsertVideoGeneratedContent).not.toHaveBeenCalled()
    expect(calls.filter((c) => c.op !== 'select')).toEqual([])
  })

  it('undoes its own writes when a cancel lands between the pre-check and the final compare-and-swap', async () => {
    const { client, calls } = fakeClient({
      'content_pipelines.select': { status: 'generating' },
      'content_language_tracks.select': { id: 't1' },
      'content_pipelines.update': null, // CAS miss: pipeline is no longer running
    })
    await expect(finalizeSingleShot(client, uploader() as never, args())).rejects.toBeInstanceOf(SingleShotStoppedError)
    expect(calls.some((c) => c.table === 'generated_content' && c.op === 'delete')).toBe(true)
    const trackWrites = calls.filter((c) => c.table === 'content_language_tracks' && c.op === 'update')
    expect(trackWrites.some((c) => (c.value as { status?: string }).status === 'ready')).toBe(false)
    expect(trackWrites.some((c) => (c.value as { status?: string }).status === 'failed')).toBe(true)
    expect(db.markJobReadyIfAllContentComplete).not.toHaveBeenCalled()
  })

  it('finalizes a running pipeline: library row with both duration keys, track ready, job completion, no topic change', async () => {
    const { client, calls } = fakeClient({
      'content_pipelines.select': { status: 'generating' },
      'content_language_tracks.select': { id: 't1' },
      'content_pipelines.update': { id: 'p1' },
    })
    const url = await finalizeSingleShot(client, uploader() as never, args())
    expect(url).toBe('https://cdn/j1/single-shot-g1.mp4')
    const marker = calls.find((c) => c.table === 'generated_content' && c.op === 'update')!.value as { output_data: Record<string, unknown> }
    expect(marker.output_data).toMatchObject({ duration_sec: 30, duration_seconds: 30, single_shot: true, language: 'EN', model: 'm' })
    expect(calls.some((c) => c.table === 'content_language_tracks' && (c.value as { status?: string })?.status === 'ready')).toBe(true)
    expect(calls.some((c) => c.table === 'content_jobs' && c.op === 'update')).toBe(false)
    expect(db.markJobReadyIfAllContentComplete).toHaveBeenCalledTimes(1)
  })

  it('BOTH: the English clip leaves the pipeline status and the job open for the French track', async () => {
    const { client, calls } = fakeClient({
      'content_pipelines.select': { status: 'generating' },
      'content_language_tracks.select': { id: 't1' },
      'content_pipelines.update': { id: 'p1' },
    })
    await finalizeSingleShot(client, uploader() as never, args({ completesPipeline: false }))
    const pipelineUpdate = calls.find((c) => c.table === 'content_pipelines' && c.op === 'update')!.value as Record<string, unknown>
    expect(pipelineUpdate.status).toBeUndefined()
    expect(db.markJobReadyIfAllContentComplete).not.toHaveBeenCalled()
  })
})

describe('recordSingleShotTimeout: a task that keeps timing out is eventually replaced', () => {
  const steps = () => db.recordStepAttempt.mock.calls.map((c) => c[1].stepName)

  it('first timeout: keeps the task alive so a Resume can still collect a late render', async () => {
    db.getLastSucceededStepOutput.mockResolvedValue(null)
    expect(await recordSingleShotTimeout({} as never, 'p', 1, 'task-1')).toEqual({ count: 1, stuck: false })
    expect(steps()).toEqual([TASK_TIMEOUT_STEP_NAME])
  })

  it('second timeout of the same task: marks it dead so the next retry submits a fresh one', async () => {
    db.getLastSucceededStepOutput.mockResolvedValue({ providerRef: 'task-1', count: 1 })
    expect(await recordSingleShotTimeout({} as never, 'p', 1, 'task-1')).toEqual({ count: 2, stuck: true })
    expect(steps()).toEqual([TASK_TIMEOUT_STEP_NAME, TASK_FAILED_STEP_NAME])
  })

  it('a timeout of a different (fresh) task starts counting from one again', async () => {
    db.getLastSucceededStepOutput.mockResolvedValue({ providerRef: 'old-task', count: 5 })
    expect(await recordSingleShotTimeout({} as never, 'p', 1, 'new-task')).toEqual({ count: 1, stuck: false })
  })

  it('after the task is marked dead, the next submit creates a new KIE task', async () => {
    db.recordStepAttempt.mockResolvedValue(undefined)
    db.hasSucceededStep.mockResolvedValue(true)
    db.getLastSucceededStepOutput.mockImplementation(async (_c, _s, name: string) =>
      name === SUBMIT_STEP_NAME || name === TASK_FAILED_STEP_NAME ? { providerRef: 'task-1' } : null,
    )
    const gen = { submit: vi.fn(async () => ({ providerRef: 'task-2' })), poll: vi.fn() }
    expect(await submitSingleShot({} as never, 'p', 1, gen as never, input)).toBe('task-2')
    expect(gen.submit).toHaveBeenCalledTimes(1)
  })
})
