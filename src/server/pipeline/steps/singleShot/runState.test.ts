import { describe, it, expect } from 'vitest'
import {
  CANCELLED_MESSAGE,
  draftKindOf,
  isPipelineStopped,
  isTaskStuck,
  nextTimeoutCount,
  planSingleShotRecovery,
  shouldReuseSubmittedTask,
} from './runState'

const base = { lastError: null, languages: 'EN' as const, clipReady: false, frenchTrackStatus: null }

describe('planSingleShotRecovery', () => {
  it('restarts the render when the shared render failed and no clip exists (EN, FR-only and BOTH)', () => {
    for (const languages of ['EN', 'FR', 'BOTH'] as const) {
      expect(planSingleShotRecovery({ ...base, languages, pipelineStatus: 'failed' })).toEqual({ action: 'restart_render' })
    }
  })
  it('never resumes a video the user cancelled', () => {
    const plan = planSingleShotRecovery({ ...base, pipelineStatus: 'failed', lastError: CANCELLED_MESSAGE })
    expect(plan).toMatchObject({ action: 'none' })
  })
  it('retries only the French track of a BOTH job whose English clip is already ready', () => {
    expect(
      planSingleShotRecovery({ ...base, languages: 'BOTH', pipelineStatus: 'generating', clipReady: true, frenchTrackStatus: 'failed' }),
    ).toEqual({ action: 'retry_french_track' })
    // pipeline also failed: still only the French track, never a second paid render
    expect(
      planSingleShotRecovery({ ...base, languages: 'BOTH', pipelineStatus: 'failed', clipReady: true, frenchTrackStatus: 'failed' }),
    ).toEqual({ action: 'retry_french_track' })
  })
  it('does nothing for a running, finished or already-rendered video (no duplicate paid generation)', () => {
    expect(planSingleShotRecovery({ ...base, pipelineStatus: 'generating' })).toMatchObject({ action: 'none' })
    expect(planSingleShotRecovery({ ...base, pipelineStatus: 'approved' })).toMatchObject({ action: 'none' })
    expect(planSingleShotRecovery({ ...base, pipelineStatus: 'ready', clipReady: true })).toMatchObject({ action: 'none' })
    expect(planSingleShotRecovery({ ...base, pipelineStatus: 'failed', clipReady: true })).toMatchObject({ action: 'none' })
  })
})

describe('shouldReuseSubmittedTask', () => {
  it('reuses a live or unknown-state task, never one KIE reported as failed', () => {
    expect(shouldReuseSubmittedTask('task-1', null)).toBe(true)
    expect(shouldReuseSubmittedTask('task-2', 'task-1')).toBe(true) // an older failure, newer task is live
    expect(shouldReuseSubmittedTask('task-1', 'task-1')).toBe(false)
    expect(shouldReuseSubmittedTask(null, null)).toBe(false)
  })
})

describe('run state helpers', () => {
  it('stops only on a failed (or cancelled) pipeline', () => {
    expect(isPipelineStopped('failed')).toBe(true)
    for (const s of ['approved', 'generating', 'ready', null, undefined]) expect(isPipelineStopped(s)).toBe(false)
  })
  it('tells single-shot, legacy and missing drafts apart', () => {
    expect(draftKindOf(null)).toBe('none')
    expect(draftKindOf({ draft_data: { script: 'x', scenes: [] } })).toBe('legacy')
    expect(draftKindOf({ draft_data: null })).toBe('legacy')
  })
})

describe('timeout counting', () => {
  it('counts per task and restarts for a different task', () => {
    expect(nextTimeoutCount('a', null)).toBe(1)
    expect(nextTimeoutCount('a', { providerRef: 'a', count: 1 })).toBe(2)
    expect(nextTimeoutCount('b', { providerRef: 'a', count: 4 })).toBe(1)
    expect(nextTimeoutCount('a', { providerRef: 'a' })).toBe(1)
  })
  it('treats a task as stuck from the second timeout', () => {
    expect(isTaskStuck(1)).toBe(false)
    expect(isTaskStuck(2)).toBe(true)
  })
})
