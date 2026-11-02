import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fromPlugsPayload, MAX_PLUGS, plugSyncNote, plugsErrorOf, samePlugs, toPlugsPayload } from '~/utils/plugsSync'
import { useOpinionsStore, type PlugsApi } from '~/stores/opinions'

describe('plug payload mapping', () => {
  it('keeps valid ids once, clamps weight to 0–1, defaults enabled, maps mode', () => {
    const body = toPlugsPayload([
      { agent_id: 'avatar_001', weight: 3, enabled: true },
      { agent_id: 'avatar_001', weight: 0.1 },
      { agent_id: '<script>', weight: 0.5 },
      { agent_id: 'avatar_pro_momentum', weight: -1, enabled: false },
      { agent_id: 'jev:v2', weight: Number.NaN },
    ], 'auto')
    expect(body).toEqual({
      mode: 'auto',
      plugs: [
        { agent_id: 'avatar_001', weight: 1, enabled: true },
        { agent_id: 'avatar_pro_momentum', weight: 0, enabled: false },
        { agent_id: 'jev:v2', weight: 0.5, enabled: true },
      ],
    })
    expect(toPlugsPayload([], 'yolo').mode).toBe('advisory')
  })

  it('caps at the server limit', () => {
    const many = Array.from({ length: MAX_PLUGS + 7 }, (_, i) => ({ agent_id: `a${i}`, weight: 0.5, enabled: true }))
    expect(toPlugsPayload(many, 'advisory').plugs).toHaveLength(MAX_PLUGS)
  })

  it('reads a server answer, and refuses anything that is not one (never "saved" on an error body)', () => {
    expect(fromPlugsPayload({ plugs: [{ agent_id: 'avatar_001', weight: 0.6, enabled: true }], mode: 'auto' }))
      .toEqual({ plugs: [{ agent_id: 'avatar_001', weight: 0.6, enabled: true }], mode: 'auto' })
    expect(fromPlugsPayload({ plugs: [] })).toEqual({ plugs: [], mode: 'advisory' })
    expect(fromPlugsPayload({ detail: 'mode must be advisory or auto' })).toBeNull()
    expect(fromPlugsPayload({ plugs: [], mode: 'yolo' })).toBeNull()
    expect(fromPlugsPayload('<html>')).toBeNull()
    expect(fromPlugsPayload(null)).toBeNull()
  })

  it('compares plug lists', () => {
    const a = toPlugsPayload([{ agent_id: 'x', weight: 0.5, enabled: true }], 'advisory')
    expect(samePlugs(a, toPlugsPayload([{ agent_id: 'x', weight: 0.5 }], 'advisory'))).toBe(true)
    expect(samePlugs(a, toPlugsPayload([{ agent_id: 'x', weight: 0.55 }], 'advisory'))).toBe(false)
    expect(samePlugs(a, toPlugsPayload([{ agent_id: 'x', weight: 0.5 }], 'auto'))).toBe(false)
  })

  it('says what is going on, and the server reason on failure', () => {
    expect(plugSyncNote('saved')).toBe('')
    expect(plugSyncNote('signed-out')).toMatch(/Sign in to keep them/)
    expect(plugSyncNote('error', 'boom')).toBe('boom')
    expect(plugsErrorOf({ data: { detail: 'bad id' } }, 'Not saved.')).toBe('Not saved. (bad id)')
    expect(plugsErrorOf(new Error('x'), 'Not saved.')).toBe('Not saved.')
  })
})

describe('opinions store — plugs persist to the account', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function fakeApi(server: { plugs: unknown[]; mode: string }, failPut = false) {
    const calls: Array<{ url: string; method: string; body?: any }> = []
    const api: PlugsApi = async (url, opts) => {
      calls.push({ url, method: opts?.method ?? 'GET', body: opts?.body })
      if (opts?.method === 'PUT') {
        if (failPut) throw Object.assign(new Error('400'), { data: { detail: 'nope' } })
        const b = opts.body as { plugs: unknown[]; mode: string }
        server.plugs = b.plugs; server.mode = b.mode
      }
      return { plugs: server.plugs, mode: server.mode }
    }
    return { api, calls }
  }

  it('signed out: local only, no request', async () => {
    const s = useOpinionsStore()
    const { api, calls } = fakeApi({ plugs: [], mode: 'advisory' })
    await s.connect({ signedIn: false, api })
    s.plug('avatar_001')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(0)
    expect(s.sync).toBe('signed-out')
    expect(s.activeCount).toBe(1)
  })

  it('loads the saved list, then saves one debounced PUT after plug + weight changes', async () => {
    const server = { plugs: [{ agent_id: 'avatar_001', weight: 0.6, enabled: true }], mode: 'advisory' }
    const { api, calls } = fakeApi(server)
    const s = useOpinionsStore()
    s.plug('personal_local', 0.6) // a pre-sign-in local default is replaced by the saved list
    await s.connect({ signedIn: true, userId: 'u1', api })
    expect(s.plugs.map(p => p.agent_id)).toEqual(['avatar_001'])
    expect(s.sync).toBe('saved')

    s.plug('avatar_pro_momentum')
    s.setWeight('avatar_pro_momentum', 0.8)
    expect(s.sync).toBe('saving')
    await vi.advanceTimersByTimeAsync(599)
    expect(calls.filter(c => c.method === 'PUT')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    const puts = calls.filter(c => c.method === 'PUT')
    expect(puts).toHaveLength(1)
    expect(puts[0]!.body).toEqual({ mode: 'advisory', plugs: [
      { agent_id: 'avatar_001', weight: 0.6, enabled: true },
      { agent_id: 'avatar_pro_momentum', weight: 0.8, enabled: true },
    ] })
    expect(s.sync).toBe('saved')

    // "reload": a fresh store reads what was saved
    setActivePinia(createPinia())
    const again = useOpinionsStore()
    await again.connect({ signedIn: true, userId: 'u1', api })
    expect(again.activeCount).toBe(2)
  })

  it('a failed save shows the error and reverts to the last saved state', async () => {
    const { api } = fakeApi({ plugs: [{ agent_id: 'avatar_001', weight: 0.5, enabled: true }], mode: 'advisory' }, true)
    const s = useOpinionsStore()
    await s.connect({ signedIn: true, userId: 'u2', api })
    s.plug('avatar_pro_momentum')
    s.setMode('auto')
    await vi.advanceTimersByTimeAsync(600)
    expect(s.sync).toBe('error')
    expect(s.syncError).toMatch(/undone.*nope/)
    expect(s.plugs.map(p => p.agent_id)).toEqual(['avatar_001'])
    expect(s.mode).toBe('advisory')
  })

  it('a failed load never saves over the server list', async () => {
    const calls: string[] = []
    const api: PlugsApi = async (_url, opts) => { calls.push(opts?.method ?? 'GET'); throw new Error('offline') }
    const s = useOpinionsStore()
    await s.connect({ signedIn: true, userId: 'u3', api })
    expect(s.sync).toBe('error')
    s.plug('avatar_001')
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toEqual(['GET'])
  })
})
