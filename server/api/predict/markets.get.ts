/**
 * GET /api/predict/markets?q=&category=&limit=
 *
 * Kalshi open markets (public market data, no auth, read-only) for the Predict
 * page. Prices are normalised to CENTS (Kalshi now reports dollars as strings).
 * Multi-leg parlay markets (mve_*) and illiquid markets are dropped. Cached 60 s.
 * Bots never trade from here: execution and fills are the backend engine's job.
 */
export interface PredictMarket {
  ticker: string
  event_ticker: string
  title: string
  subtitle: string
  category: string
  yes_bid: number | null
  yes_ask: number | null
  no_bid: number | null
  no_ask: number | null
  last: number | null
  volume: number
  volume_24h: number
  close_time: string
  status: string
  url: string
}

type RawMarket = Record<string, unknown> & { ticker: string; close_time: string; status: string }
type RawEvent = { event_ticker: string; title: string; category?: string; markets?: RawMarket[] }

const cents = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

const fetchEvents = defineCachedFunction(async (): Promise<RawEvent[]> => {
  const out: RawEvent[] = []
  let cursor = ''
  for (let page = 0; page < 5; page++) {
    const r = await $fetch<{ events: RawEvent[]; cursor?: string }>('https://api.elections.kalshi.com/trade-api/v2/events', {
      query: { limit: 200, status: 'open', with_nested_markets: true, ...(cursor ? { cursor } : {}) }, timeout: 10000,
    })
    out.push(...r.events)
    if (!r.cursor) break
    cursor = r.cursor
  }
  return out
}, { maxAge: 60, name: 'kalshi-events' })

export default defineEventHandler(async (event) => {
  const tickers = String(getQuery(event).tickers ?? '').split(',').map(t => t.trim()).filter(Boolean)
  const q = String(getQuery(event).q ?? '').trim().toLowerCase()
  const category = String(getQuery(event).category ?? '').trim()
  const limit = Math.min(200, Math.max(1, Number(getQuery(event).limit ?? 60)))
  const events = await fetchEvents()
  const markets: PredictMarket[] = []
  for (const e of events) {
    for (const m of e.markets ?? []) {
      if (m.mve_collection_ticker) continue
      const volume = Number(m.volume_fp ?? 0)
      if (volume < 100) continue
      markets.push({
        ticker: m.ticker,
        event_ticker: e.event_ticker,
        title: e.title,
        subtitle: String(m.yes_sub_title ?? m.subtitle ?? ''),
        category: e.category ?? 'Other',
        yes_bid: cents(m.yes_bid_dollars), yes_ask: cents(m.yes_ask_dollars),
        no_bid: cents(m.no_bid_dollars), no_ask: cents(m.no_ask_dollars),
        last: cents(m.last_price_dollars),
        volume, volume_24h: Number(m.volume_24h_fp ?? 0),
        close_time: m.close_time, status: m.status,
        url: `https://kalshi.com/markets/${e.event_ticker.toLowerCase()}`,
      })
    }
  }
  const categories = [...new Set(markets.map(m => m.category))].sort()
  const filtered = markets
    .filter(m => !tickers.length || tickers.includes(m.ticker))
    .filter(m => !category || m.category === category)
    .filter(m => !q || `${m.title} ${m.subtitle} ${m.ticker}`.toLowerCase().includes(q))
    .sort((a, b) => b.volume_24h - a.volume_24h || b.volume - a.volume)
  return { source: 'kalshi', at: new Date().toISOString(), categories, total: filtered.length, markets: filtered.slice(0, limit) }
})
