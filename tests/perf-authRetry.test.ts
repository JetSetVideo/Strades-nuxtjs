import { describe, expect, it, vi } from 'vitest'
import { withAuthRetry } from '~/utils/authRetry'

/** A fake fetch: answers from a script of results; an Error with `status` mimics an ofetch error. */
function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status }, statusCode: status })
}
function networkError() {
  return Object.assign(new Error('fetch failed'), { response: undefined })
}

function fakeFetch(script: Array<(token: string) => unknown>, tokenRef: { v: string }) {
  const calls: Array<{ url: string; token: string }> = []
  const fn = vi.fn(async (url: string) => {
    calls.push({ url, token: tokenRef.v })
    const step = script.shift()
    if (!step) throw new Error('unexpected call')
    return step(tokenRef.v)
  })
  return { fn, calls }
}

describe('withAuthRetry (plugins/api.ts $api)', () => {
  it('passes a success straight through, no refresh', async () => {
    const tok = { v: 'old' }
    const { fn } = fakeFetch([() => ({ ok: 1 })], tok)
    const refresh = vi.fn(async () => true)
    const api = withAuthRetry(fn, refresh)
    await expect(api('/api/v1/x/')).resolves.toEqual({ ok: 1 })
    expect(refresh).not.toHaveBeenCalled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('on 401: refreshes once, retries once with the new token, returns the RETRY result', async () => {
    const tok = { v: 'old' }
    const { fn, calls } = fakeFetch([
      () => { throw httpError(401) },
      t => ({ token: t }),
    ], tok)
    const refresh = vi.fn(async () => { tok.v = 'new'; return true })
    const api = withAuthRetry(fn, refresh)
    await expect(api('/api/v1/portfolio/', { method: 'GET' })).resolves.toEqual({ token: 'new' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls.map(c => c.token)).toEqual(['old', 'new'])
    expect(fn.mock.calls[1]).toEqual(['/api/v1/portfolio/', { method: 'GET' }]) // same request, same options
  })

  it('concurrent 401s share ONE refresh', async () => {
    const tok = { v: 'old' }
    let release!: (ok: boolean) => void
    const refresh = vi.fn(() => new Promise<boolean>((res) => { release = (ok) => { tok.v = 'new'; res(ok) } }))
    const fn = vi.fn(async (url: string) => {
      if (tok.v === 'old') throw httpError(401)
      return url
    })
    const api = withAuthRetry(fn, refresh)
    const all = Promise.all([api('/a/'), api('/b/'), api('/c/')])
    await new Promise(r => setTimeout(r, 0))
    release(true)
    await expect(all).resolves.toEqual(['/a/', '/b/', '/c/'])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledTimes(6)
  })

  it('retries at most once: a second 401 is thrown to the caller', async () => {
    const tok = { v: 'old' }
    const { fn } = fakeFetch([() => { throw httpError(401) }, () => { throw httpError(401) }], tok)
    const refresh = vi.fn(async () => true)
    const api = withAuthRetry(fn, refresh)
    await expect(api('/x/')).rejects.toMatchObject({ statusCode: 401 })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('a failed refresh re-throws the original 401 without a retry', async () => {
    const tok = { v: 'old' }
    const { fn } = fakeFetch([() => { throw httpError(401) }], tok)
    const api = withAuthRetry(fn, async () => false)
    await expect(api('/x/')).rejects.toMatchObject({ statusCode: 401 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a refresh that throws counts as failed (no unhandled rejection, original error kept)', async () => {
    const tok = { v: 'old' }
    const { fn } = fakeFetch([() => { throw httpError(401) }], tok)
    const api = withAuthRetry(fn, async () => { throw networkError() })
    await expect(api('/x/')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('a network error or a non-401 status never triggers a refresh (never signs out)', async () => {
    const tok = { v: 'old' }
    const refresh = vi.fn(async () => true)
    const { fn } = fakeFetch([() => { throw networkError() }, () => { throw httpError(500) }, () => { throw httpError(403) }], tok)
    const api = withAuthRetry(fn, refresh)
    await expect(api('/x/')).rejects.toThrow('fetch failed')
    await expect(api('/x/')).rejects.toMatchObject({ statusCode: 500 })
    await expect(api('/x/')).rejects.toMatchObject({ statusCode: 403 })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a later expiry refreshes again (the shared promise is per expiry, not forever)', async () => {
    const tok = { v: 't0' }
    let n = 0
    const refresh = vi.fn(async () => { tok.v = `t${++n}`; return true })
    const valid = new Set<string>()
    const fn = vi.fn(async () => { if (!valid.has(tok.v)) { valid.add(`t${n + 1}`); throw httpError(401) } return tok.v })
    const api = withAuthRetry(fn, refresh)
    await expect(api('/x/')).resolves.toBe('t1')
    valid.clear()
    await expect(api('/x/')).resolves.toBe('t2')
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('keeps the $Fetch surface (.raw / .native / .create)', () => {
    const base = Object.assign(async () => 1, { raw: () => 'raw', native: () => 'native', create: () => 'create' })
    const api = withAuthRetry(base, async () => true) as unknown as typeof base
    expect(api.raw()).toBe('raw')
    expect(api.native()).toBe('native')
    expect(api.create()).toBe('create')
  })
})
