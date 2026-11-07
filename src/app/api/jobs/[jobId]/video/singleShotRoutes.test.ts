// Route-level tests for the single-shot video lifecycle (approve, resume, track retry). Supabase is an
// in-memory fake and Inngest is a spy: nothing here touches the network, the real DB or a paid API.
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }))
const sent = vi.hoisted(() => ({ events: [] as { id?: string; name: string; data: Row }[] }))

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: async (e: unknown) => {
      for (const ev of Array.isArray(e) ? e : [e]) sent.events.push(ev as never)
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => builder(t) }),
}))

function builder(table: string) {
  const rows = () => (store.tables[table] ??= [])
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' = 'select'
  let patch: Row | Row[] = {}
  let ignoreDuplicates = false
  const matches = () => rows().filter((r) => filters.every((f) => f(r)))
  const run = () => {
    if (op === 'update') {
      const hit = matches()
      hit.forEach((r) => Object.assign(r, patch))
      return hit
    }
    if (op === 'insert' || op === 'upsert') {
      const added: Row[] = []
      for (const p of Array.isArray(patch) ? patch : [patch]) {
        const dup = op === 'upsert' && rows().some((r) => r.content_pipeline_id === p.content_pipeline_id && r.language === p.language)
        if (dup && ignoreDuplicates) continue
        const row = { id: `${table}-${rows().length + 1}`, ...p }
        rows().push(row)
        added.push(row)
      }
      return added
    }
    return matches()
  }
  const api: Record<string, unknown> = {}
  api.select = () => api
  api.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), api)
  api.in = (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api)
  api.not = () => api
  api.update = (v: Row) => ((op = 'update'), (patch = v), api)
  api.insert = (v: Row | Row[]) => ((op = 'insert'), (patch = v), api)
  api.upsert = (v: Row[], o?: { ignoreDuplicates?: boolean }) => ((op = 'upsert'), (patch = v), (ignoreDuplicates = !!o?.ignoreDuplicates), api)
  api.maybeSingle = async () => ({ data: run()[0] ?? null, error: null })
  api.single = async () => {
    const r = run()[0]
    return r ? { data: r, error: null } : { data: null, error: { message: 'not found' } }
  }
  api.then = (res: (r: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data: run(), error: null }).then(res, rej)
  return api
}

import { POST as approve } from './approve/route'
import { POST as resume } from './resume/route'
import { POST as retryTrack } from './tracks/[lang]/retry/route'
import { CANCELLED_MESSAGE } from '@/server/pipeline/steps/singleShot/runState'

const JOB = 'job-1'
const PIPE = 'pipe-1'
const ctx = { params: Promise.resolve({ jobId: JOB }) }
const req = () => new Request('http://x') as never

function seed(opts: {
  languages: 'EN' | 'FR' | 'BOTH'
  pipeline: Row
  tracks?: Row[]
}) {
  store.tables = {
    content_jobs: [{ id: JOB, language: opts.languages, status: 'generating' }],
    content_pipelines: [{ id: PIPE, job_id: JOB, content_type: 'video', current_generation: 1, last_error: null, ...opts.pipeline }],
    content_drafts: [
      {
        content_pipeline_id: PIPE,
        draft_data: {
          single_shot: {
            prompt: 'p', audio_mode: 'narration', container_shown: 'none', spoken_lines: [{ speaker: 'narrator', text: 'hi' }],
            languages: opts.languages, french_lines: ['salut'],
          },
        },
      },
    ],
    content_language_tracks: (opts.tracks ?? []).map((t, i) => ({ id: `t${i + 1}`, content_pipeline_id: PIPE, last_error: null, ...t })),
  }
  sent.events = []
}

const pipeline = () => store.tables.content_pipelines[0]
const names = () => sent.events.map((e) => e.name)

beforeEach(() => {
  store.tables = {}
  sent.events = []
})

describe('POST /video/approve (single-shot)', () => {
  it('approves a draft once: claims the pipeline, creates one track per language, sends one render event', async () => {
    seed({ languages: 'BOTH', pipeline: { status: 'draft_ready' } })
    const res = await approve(req(), ctx)
    expect(res.status).toBe(200)
    expect(pipeline().status).toBe('approved')
    expect(store.tables.content_language_tracks.map((t) => t.language).sort()).toEqual(['EN', 'FR'])
    expect(names()).toEqual(['content/single-shot.render'])
  })

  it('a duplicate approval reuses the same event id (Inngest dedups it) and adds no tracks', async () => {
    seed({ languages: 'BOTH', pipeline: { status: 'draft_ready' } })
    await approve(req(), ctx)
    await approve(req(), ctx)
    expect(sent.events).toHaveLength(2)
    expect(sent.events[0].id).toBe(sent.events[1].id)
    expect(store.tables.content_language_tracks).toHaveLength(2)
  })

  it('never sends the legacy scene events', async () => {
    seed({ languages: 'EN', pipeline: { status: 'draft_ready' } })
    await approve(req(), ctx)
    expect(names().some((n) => n.startsWith('content/video.'))).toBe(false)
  })

  it('refuses a failed or cancelled video (409) and sends nothing', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed', last_error: CANCELLED_MESSAGE } })
    expect((await approve(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })

  it('does not start a render for a finished video', async () => {
    seed({ languages: 'EN', pipeline: { status: 'ready' }, tracks: [{ language: 'EN', status: 'ready' }] })
    const res = await approve(req(), ctx)
    expect(res.status).toBe(200)
    expect(sent.events).toHaveLength(0)
  })

  it('refuses while the draft is still being written', async () => {
    seed({ languages: 'EN', pipeline: { status: 'drafting' } })
    expect((await approve(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })
})

describe('POST /video/resume (single-shot)', () => {
  it.each(['EN', 'FR', 'BOTH'] as const)('%s: a failed render restarts through the single-shot render event only', async (languages) => {
    seed({
      languages,
      pipeline: { status: 'failed', last_error: 'Seedance failed: boom' },
      tracks: languages === 'BOTH' ? [{ language: 'EN', status: 'failed' }, { language: 'FR', status: 'failed' }] : [{ language: languages, status: 'failed' }],
    })
    const res = await resume(req(), ctx)
    expect(res.status).toBe(200)
    expect(pipeline().status).toBe('approved')
    expect(pipeline().last_error).toBeNull()
    expect(names()).toEqual(['content/single-shot.render'])
    expect(store.tables.content_language_tracks.every((t) => t.status === 'created')).toBe(true)
  })

  it('the restart event id differs from the approval id, so Inngest cannot swallow it', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed', last_error: 'x', updated_at: 'T1' }, tracks: [{ language: 'EN', status: 'failed' }] })
    await resume(req(), ctx)
    expect(sent.events[0].id).not.toBe(`${PIPE}:single-shot.render`)
    expect(sent.events[0].id).toContain('restart-')
  })

  it('BOTH with the English clip ready retries only the French track', async () => {
    seed({
      languages: 'BOTH',
      pipeline: { status: 'failed', last_error: 'French failed' },
      tracks: [{ language: 'EN', status: 'ready' }, { language: 'FR', status: 'failed' }],
    })
    const res = await resume(req(), ctx)
    expect(res.status).toBe(200)
    expect(names()).toEqual(['content/single-shot.track.fr'])
    const [en, fr] = store.tables.content_language_tracks
    expect(en.status).toBe('ready')
    expect(fr.status).toBe('created')
  })

  it('refuses a cancelled video (409) without sending anything', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed', last_error: CANCELLED_MESSAGE }, tracks: [{ language: 'EN', status: 'failed' }] })
    expect((await resume(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })

  it('refuses a running video: resuming must not create a second paid generation', async () => {
    seed({ languages: 'EN', pipeline: { status: 'generating' }, tracks: [{ language: 'EN', status: 'generating' }] })
    expect((await resume(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })

  it('refuses a finished video', async () => {
    seed({ languages: 'EN', pipeline: { status: 'ready' }, tracks: [{ language: 'EN', status: 'ready' }] })
    expect((await resume(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })

  it('does not restart a failed pipeline whose clip already rendered', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed', last_error: 'late' }, tracks: [{ language: 'EN', status: 'ready' }] })
    expect((await resume(req(), ctx)).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })
})

describe('POST /video/tracks/[lang]/retry (single-shot)', () => {
  const call = (lang: string) => retryTrack(req(), { params: Promise.resolve({ jobId: JOB, lang }) })

  it('rejects an unknown language', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed' }, tracks: [{ language: 'EN', status: 'failed' }] })
    expect((await call('DE')).status).toBe(400)
  })

  it('BOTH: retrying French reruns only the French track', async () => {
    seed({
      languages: 'BOTH',
      pipeline: { status: 'failed', last_error: 'French failed' },
      tracks: [{ language: 'EN', status: 'ready' }, { language: 'FR', status: 'failed' }],
    })
    expect((await call('FR')).status).toBe(200)
    expect(names()).toEqual(['content/single-shot.track.fr'])
  })

  it('EN: retrying the shared clip restarts the render, never the legacy track event', async () => {
    seed({ languages: 'EN', pipeline: { status: 'failed', last_error: 'Seedance failed' }, tracks: [{ language: 'EN', status: 'failed' }] })
    expect((await call('EN')).status).toBe(200)
    expect(names()).toEqual(['content/single-shot.render'])
  })

  it('FR-only: retrying French restarts the shared render', async () => {
    seed({ languages: 'FR', pipeline: { status: 'failed', last_error: 'Seedance failed' }, tracks: [{ language: 'FR', status: 'failed' }] })
    expect((await call('FR')).status).toBe(200)
    expect(names()).toEqual(['content/single-shot.render'])
  })

  it('cancelled video: neither the French nor the English retry runs (409, nothing sent)', async () => {
    seed({
      languages: 'BOTH',
      pipeline: { status: 'failed', last_error: CANCELLED_MESSAGE },
      tracks: [
        { language: 'EN', status: 'failed', last_error: CANCELLED_MESSAGE },
        { language: 'FR', status: 'failed', last_error: CANCELLED_MESSAGE },
      ],
    })
    expect((await call('FR')).status).toBe(409)
    expect((await call('EN')).status).toBe(409)
    expect(sent.events).toHaveLength(0)
    expect(pipeline().status).toBe('failed')
  })

  it('a track that has not failed cannot be retried', async () => {
    seed({ languages: 'EN', pipeline: { status: 'generating' }, tracks: [{ language: 'EN', status: 'generating' }] })
    expect((await call('EN')).status).toBe(409)
    expect(sent.events).toHaveLength(0)
  })
})
