import { describe, expect, it } from 'vitest'
import { LIVE_PAIRS, createQuoteCache, liveSymbols, type LiveQuote } from '~/utils/quoteCache'
import {
  createSingleFlight, isFreshAt, pollDue, predictionPullDue, predictionPullSince,
} from '~/utils/requestGate'
import { LIST_PAGE, hiddenCount, listWindow, nextShown } from '~/utils/listWindow'
import { cancelSubtreeAnimations } from '~/utils/animations'

const q = (symbol: string, price = 1): LiveQuote => ({
  symbol, pair: LIVE_PAIRS[symbol]!.pair, price, change_24h_pct: 0, history: [],
})

/** A fake upstream with a controllable clock, call log and manual resolution. */
function harness() {
  let t = 1_000_000
  const calls: string[][] = []
  const waiting: Array<{ syms: string[]; resolve: (v: Record<string, LiveQuote>) => void; reject: (e: unknown) => void }> = []
  const cache = createQuoteCache({
    now: () => t,
    fetchQuotes: (syms) => {
      calls.push(syms)
      return new Promise((resolve, reject) => waiting.push({ syms, resolve, reject }))
    },
  })
  const answer = (price = 1) => {
    const w = waiting.shift()!
    w.resolve(Object.fromEntries(w.syms.map(s => [s, q(s, price)])))
  }
  const fail = () => waiting.shift()!.reject(new Error('down'))
  const flush = () => new Promise(r => setTimeout(r, 0))
  return { cache, calls, waiting, answer, fail, flush, advance: (ms: number) => { t += ms } }
}

describe('liveSymbols', () => {
  it('keeps only symbols with a live pair, upper-cased, de-duplicated and sorted', () => {
    expect(liveSymbols(['eth', 'BTC', ' btc ', 'AAPL', '', null, undefined, 'xau'])).toEqual(['BTC', 'ETH', 'XAU'])
  })
  it('caps the list', () => {
    expect(liveSymbols(Object.keys(LIVE_PAIRS), 3)).toHaveLength(3)
  })
})

describe('createQuoteCache', () => {
  it('waits for the first call, then serves from the per-symbol cache while fresh', async () => {
    const h = harness()
    const first = h.cache.get(['BTC', 'ETH'])
    h.answer(100)
    const r1 = await first
    expect(Object.keys(r1.quotes)).toEqual(['BTC', 'ETH'])
    expect(r1.refreshing).toEqual([])
    h.advance(10_000)
    // a different symbol list that is a subset hits the same entries: no upstream call
    const r2 = await h.cache.get(['ETH'])
    expect(r2.quotes.ETH?.price).toBe(100)
    expect(h.calls).toEqual([['BTC', 'ETH']])
  })

  it('serves stale quotes at once and refreshes them in the background (one call)', async () => {
    const h = harness()
    const p = h.cache.get(['BTC']); h.answer(100); await p
    h.advance(45_000) // stale: older than 30 s, younger than 5 min
    const r = await h.cache.get(['BTC'])
    expect(r.quotes.BTC?.price).toBe(100)
    expect(r.refreshing).toEqual(['BTC'])
    expect(h.calls).toHaveLength(2)
    // a second request during the refresh shares it
    await h.cache.get(['BTC'])
    expect(h.calls).toHaveLength(2)
    h.answer(200); await h.flush()
    const r3 = await h.cache.get(['BTC'])
    expect(r3.quotes.BTC?.price).toBe(200)
    expect(r3.refreshing).toEqual([])
  })

  it('never serves a quote older than the stale limit; waits for a new one', async () => {
    const h = harness()
    const p = h.cache.get(['SOL']); h.answer(10); await p
    h.advance(6 * 60_000)
    const pending = h.cache.get(['SOL'])
    expect(h.calls).toHaveLength(2)
    h.answer(11)
    expect((await pending).quotes.SOL?.price).toBe(11)
  })

  it('shares one in-flight upstream call between concurrent requests', async () => {
    const h = harness()
    const a = h.cache.get(['BTC', 'ETH'])
    const b = h.cache.get(['ETH', 'BTC'])
    const c = h.cache.get(['BTC', 'ETH', 'SOL']) // SOL is new: one extra call for SOL only
    expect(h.calls).toEqual([['BTC', 'ETH'], ['SOL']])
    h.answer(); h.answer()
    const [ra, rb, rc] = await Promise.all([a, b, c])
    expect(Object.keys(ra.quotes)).toEqual(['BTC', 'ETH'])
    expect(rb.quotes).toEqual(ra.quotes)
    expect(Object.keys(rc.quotes)).toEqual(['BTC', 'ETH', 'SOL'])
    expect(h.cache.stats()).toMatchObject({ upstreamCalls: 2, entries: 3, inflight: 0 })
  })

  it('leaves symbols absent when upstream fails, and retries on the next request', async () => {
    const h = harness()
    const p = h.cache.get(['BTC']); h.fail()
    const r = await p
    expect(r.quotes).toEqual({})
    expect(r.at).toBeNull()
    const p2 = h.cache.get(['BTC']); h.answer(5)
    expect((await p2).quotes.BTC?.price).toBe(5)
  })

  it('keeps serving stale data when the background refresh fails', async () => {
    const h = harness()
    const p = h.cache.get(['ETH']); h.answer(7); await p
    h.advance(40_000)
    await h.cache.get(['ETH'])
    h.fail(); await h.flush()
    const r = await h.cache.get(['ETH'])
    expect(r.quotes.ETH?.price).toBe(7)
  })

  it('reports the fetch time of the oldest quote served', async () => {
    const h = harness()
    const p1 = h.cache.get(['BTC']); h.answer(); await p1
    const t1 = (await h.cache.get(['BTC'])).at
    h.advance(20_000)
    const p2 = h.cache.get(['BTC', 'ETH']); h.answer(); const r = await p2
    expect(r.at).toBe(t1)
    expect(r.quotes.ETH?.at).not.toBe(t1)
  })

  it('ignores unknown symbols without calling upstream', async () => {
    const h = harness()
    const r = await h.cache.get(['AAPL', 'TSLA'])
    expect(r.quotes).toEqual({})
    expect(h.calls).toHaveLength(0)
  })
})

describe('isFreshAt', () => {
  it('is true only inside the window', () => {
    expect(isFreshAt(1000, 1000 + 29_999, 30_000)).toBe(true)
    expect(isFreshAt(1000, 1000 + 30_000, 30_000)).toBe(false)
    expect(isFreshAt(null, 5, 30_000)).toBe(false)
    expect(isFreshAt(undefined, 5, 30_000)).toBe(false)
    expect(isFreshAt(10_000, 5_000, 30_000)).toBe(false) // clock went back
  })
})

describe('createSingleFlight', () => {
  it('returns the same promise while a call runs, and frees the slot after', async () => {
    const sf = createSingleFlight<number>()
    let n = 0
    let release!: () => void
    const fn = () => new Promise<number>((r) => { n++; release = () => r(n) })
    const a = sf.run('k', fn)
    const b = sf.run('k', fn)
    expect(a).toBe(b)
    expect(sf.pending('k')).toBe(true)
    release()
    expect(await a).toBe(1)
    expect(sf.pending()).toBe(false)
    const c = sf.run('k', fn); release()
    expect(await c).toBe(2)
  })

  it('frees the slot after a failure', async () => {
    const sf = createSingleFlight<void>()
    await expect(sf.run('k', () => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(sf.pending('k')).toBe(false)
  })

  it('keeps different keys apart', () => {
    const sf = createSingleFlight<number>()
    const never = () => new Promise<number>(() => {})
    expect(sf.run('a', never)).not.toBe(sf.run('b', never))
  })
})

describe('pollDue', () => {
  const base = { lastAt: 1_000, now: 61_000, everyMs: 60_000, hidden: false }
  it('fires after the interval while visible', () => {
    expect(pollDue(base)).toBe(true)
    expect(pollDue({ ...base, now: 60_999 })).toBe(false)
  })
  it('never fires while hidden or busy', () => {
    expect(pollDue({ ...base, hidden: true })).toBe(false)
    expect(pollDue({ ...base, busy: true })).toBe(false)
  })
  it('fires when never loaded', () => {
    expect(pollDue({ ...base, lastAt: 0 })).toBe(true)
  })
})

describe('predictionPullDue / predictionPullSince', () => {
  const now = Date.UTC(2026, 10, 2, 12)
  const mark = { at: now - 60_000, uid: 'u1', count: 10 }
  const o = { mark, uid: 'u1', localCount: 10, now, everyMs: 5 * 60_000 }
  it('skips a pull made < 5 min ago for the same account with nothing lost locally', () => {
    expect(predictionPullDue(o)).toBe(false)
    expect(predictionPullDue({ ...o, localCount: 12 })).toBe(false) // new local calls are pushed, not pulled
  })
  it('pulls when never pulled, too old, another account, or local calls were lost', () => {
    expect(predictionPullDue({ ...o, mark: null })).toBe(true)
    expect(predictionPullDue({ ...o, now: mark.at + 5 * 60_000 })).toBe(true)
    expect(predictionPullDue({ ...o, uid: 'u2' })).toBe(true)
    expect(predictionPullDue({ ...o, localCount: 3 })).toBe(true)
    expect(predictionPullDue({ ...o, now: mark.at - 1 })).toBe(true) // clock went back
  })
  it('asks for rows changed since the last pull minus a skew margin, full pull otherwise', () => {
    expect(predictionPullSince(mark, 'u1')).toBe(new Date(mark.at - 60_000).toISOString())
    expect(predictionPullSince(mark, 'u2')).toBeNull()
    expect(predictionPullSince(null, 'u1')).toBeNull()
  })
})

describe('listWindow', () => {
  const rows = Array.from({ length: 120 }, (_, i) => i)
  it('renders the first page, then grows by one page, never past the end', () => {
    expect(listWindow(rows, LIST_PAGE)).toHaveLength(50)
    expect(nextShown(50, 120)).toBe(100)
    expect(nextShown(100, 120)).toBe(120)
    expect(hiddenCount(100, 120)).toBe(20)
    expect(hiddenCount(120, 120)).toBe(0)
    expect(listWindow(rows, 500)).toHaveLength(120)
    expect(listWindow(rows, -3)).toEqual([])
  })
})

describe('cancelSubtreeAnimations', () => {
  it('cancels every animation under the element, subtree included', () => {
    const cancelled: string[] = []
    let opts: unknown
    const el = {
      getAnimations: (o?: { subtree?: boolean }) => {
        opts = o
        return ['spin', 'shimmer'].map(n => ({ cancel: () => { cancelled.push(n) } }))
      },
    }
    expect(cancelSubtreeAnimations(el)).toBe(2)
    expect(cancelled).toEqual(['spin', 'shimmer'])
    expect(opts).toEqual({ subtree: true })
  })
  it('is a no-op without an element or without the Web Animations API', () => {
    expect(cancelSubtreeAnimations(null)).toBe(0)
    expect(cancelSubtreeAnimations({})).toBe(0)
    expect(cancelSubtreeAnimations({ getAnimations: () => { throw new Error('detached') } })).toBe(0)
  })
  it('keeps going when one animation throws on cancel', () => {
    const el = { getAnimations: () => [{ cancel: () => { throw new Error('x') } }, { cancel: () => {} }] }
    expect(cancelSubtreeAnimations(el)).toBe(1)
  })
})
