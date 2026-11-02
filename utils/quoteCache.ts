/**
 * Live-quote cache for GET /api/market/quotes (server/api/market/quotes.get.ts).
 *
 * Pure: the upstream call is injected, so the cache logic is unit-tested without Binance.
 *  - One entry PER SYMBOL (not per query string): /prices asking for 11 symbols and the nav
 *    asking for 3 share the same entries.
 *  - Fresh (< freshMs, 30 s): served as is.
 *  - Stale (freshMs ≤ age < staleMs, 5 min): served at once, refreshed in the background.
 *  - Missing or older than staleMs: the request waits for one upstream call.
 *  - At most ONE upstream call in flight per symbol: concurrent requests share it.
 *  - Upstream failure: the symbol is simply absent (the client keeps its bundled price and
 *    says so); a quote older than staleMs is never served as live.
 */

/** Symbols Binance quotes faithfully. Shared by the quotes/history routes and the assets store. */
export const LIVE_PAIRS: Record<string, { pair: string; proxy?: string }> = {
  BTC: { pair: 'BTCUSDT' }, ETH: { pair: 'ETHUSDT' }, SOL: { pair: 'SOLUSDT' },
  BNB: { pair: 'BNBUSDT' }, XRP: { pair: 'XRPUSDT' }, ADA: { pair: 'ADAUSDT' },
  DOGE: { pair: 'DOGEUSDT' }, AVAX: { pair: 'AVAXUSDT' }, LINK: { pair: 'LINKUSDT' },
  EUR: { pair: 'EURUSDT', proxy: 'EUR/USDT' },
  XAU: { pair: 'PAXGUSDT', proxy: 'PAXG (gold-backed token)' },
}

export interface LiveQuote {
  symbol: string
  pair: string
  price: number
  change_24h_pct: number
  /** hourly simple returns, oldest first */
  history: number[]
  proxy?: string
  /** when this quote was fetched upstream (ISO) */
  at?: string
}

export const QUOTE_FRESH_MS = 30_000
export const QUOTE_STALE_MS = 5 * 60_000

/** Upper-cased, de-duplicated, sorted symbols that have a live pair (max `max`). */
export function liveSymbols(symbols: Iterable<string | null | undefined>, max = 25): string[] {
  const out = new Set<string>()
  for (const raw of symbols) {
    const s = String(raw ?? '').trim().toUpperCase()
    if (s && s in LIVE_PAIRS) out.add(s)
  }
  return [...out].sort().slice(0, max)
}

export interface QuoteCacheOptions {
  /** One upstream call for these symbols; returns the quotes it found (missing = absent). */
  fetchQuotes: (symbols: string[]) => Promise<Record<string, LiveQuote>>
  freshMs?: number
  staleMs?: number
  now?: () => number
}

export interface QuoteCacheResult {
  quotes: Record<string, LiveQuote>
  /** fetch time of the OLDEST quote served (ISO), null when none */
  at: string | null
  /** symbols served stale while a background refresh runs */
  refreshing: string[]
}

export function createQuoteCache(opts: QuoteCacheOptions) {
  const freshMs = opts.freshMs ?? QUOTE_FRESH_MS
  const staleMs = opts.staleMs ?? QUOTE_STALE_MS
  const now = opts.now ?? Date.now
  const entries = new Map<string, { quote: LiveQuote; at: number }>()
  const inflight = new Map<string, Promise<void>>()
  let upstreamCalls = 0

  function fetchSet(symbols: string[]): Promise<void> {
    upstreamCalls++
    const p: Promise<void> = opts.fetchQuotes(symbols)
      .then((got) => {
        const t = now()
        const iso = new Date(t).toISOString()
        for (const s of symbols) {
          const q = got[s]
          if (q) entries.set(s, { quote: { ...q, at: iso }, at: t })
        }
      })
      .finally(() => {
        for (const s of symbols) if (inflight.get(s) === p) inflight.delete(s)
      })
    for (const s of symbols) inflight.set(s, p)
    return p
  }

  /** Promises covering `symbols`: shared in-flight ones plus at most one new upstream call. */
  function ensure(symbols: string[]): Promise<void>[] {
    const shared = new Set<Promise<void>>()
    const todo: string[] = []
    for (const s of symbols) {
      const p = inflight.get(s)
      if (p) shared.add(p)
      else todo.push(s)
    }
    if (todo.length) shared.add(fetchSet(todo))
    return [...shared]
  }

  async function get(requested: Iterable<string | null | undefined>): Promise<QuoteCacheResult> {
    const syms = liveSymbols(requested)
    const t = now()
    const must: string[] = []
    const revalidate: string[] = []
    for (const s of syms) {
      const e = entries.get(s)
      const age = e ? t - e.at : Infinity
      if (age >= staleMs) must.push(s)
      else if (age >= freshMs) revalidate.push(s)
    }
    if (must.length) {
      // The caller waits anyway: refresh the stale ones in the same upstream call.
      await Promise.allSettled(ensure([...must, ...revalidate]))
    } else if (revalidate.length) {
      for (const p of ensure(revalidate)) p.catch(() => { /* next request retries */ })
    }

    const t2 = now()
    const quotes: Record<string, LiveQuote> = {}
    let oldest = Infinity
    for (const s of syms) {
      const e = entries.get(s)
      if (!e || t2 - e.at >= staleMs) continue
      quotes[s] = e.quote
      oldest = Math.min(oldest, e.at)
    }
    return {
      quotes,
      at: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
      refreshing: must.length ? [] : revalidate,
    }
  }

  return {
    get,
    /** test / debug counters */
    stats: () => ({ upstreamCalls, entries: entries.size, inflight: new Set(inflight.values()).size }),
  }
}
