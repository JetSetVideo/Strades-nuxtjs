/**
 * GET /api/market/quotes?symbols=BTC,ETH,SOL,EUR,XAU
 *
 * Real 24h quotes + 48 hourly returns from Binance's public API (no key).
 * Non-crypto symbols are served only where Binance lists a faithful proxy
 * (EUR → EURUSDT, XAU → PAXGUSDT, gold-backed token) and are flagged `proxy`.
 * Everything else is simply absent; the client keeps its bundled price and
 * says so.
 *
 * Cache (utils/quoteCache.ts): per symbol, fresh 30 s, then served stale for up
 * to 5 min while one background call refreshes it; at most one upstream call in
 * flight per symbol. `at` is the fetch time of the OLDEST quote served, and each
 * quote carries its own `at`.
 */
import { LIVE_PAIRS, createQuoteCache, type LiveQuote } from '../../../utils/quoteCache'

/** Shared with ./history.get.ts. */
export const PAIRS = LIVE_PAIRS
export type { LiveQuote }

type Ticker = { symbol: string; lastPrice: string; priceChangePercent: string }
type Kline = [number, string, string, string, string, ...unknown[]]

const API = 'https://api.binance.com/api/v3'

async function fetchBinance(symbols: string[]): Promise<Record<string, LiveQuote>> {
  const pairs = symbols.map(s => PAIRS[s]!.pair)
  const [tickers, histories] = await Promise.all([
    $fetch<Ticker[]>(`${API}/ticker/24hr`, { query: { symbols: JSON.stringify(pairs) }, timeout: 8000 }),
    Promise.all(pairs.map(pair =>
      $fetch<Kline[]>(`${API}/klines`, { query: { symbol: pair, interval: '1h', limit: 49 }, timeout: 8000 })
        .then(rows => rows.map(r => Number(r[4])))
        .catch(() => [] as number[]),
    )),
  ])
  const quotes: Record<string, LiveQuote> = {}
  symbols.forEach((sym, i) => {
    const meta = PAIRS[sym]!
    const t = tickers.find(x => x.symbol === meta.pair)
    if (!t) return
    const closes = histories[i] ?? []
    quotes[sym] = {
      symbol: sym,
      pair: meta.pair,
      price: Number(t.lastPrice),
      change_24h_pct: Number(t.priceChangePercent),
      history: closes.slice(1).map((c, k) => { const prev = closes[k] ?? 0; return prev > 0 ? c / prev - 1 : 0 }),
      ...(meta.proxy ? { proxy: meta.proxy } : {}),
    }
  })
  return quotes
}

const cache = createQuoteCache({ fetchQuotes: fetchBinance })

export default defineEventHandler(async (event) => {
  const requested = String(getQuery(event).symbols ?? '').split(',')
  const { quotes, at, refreshing } = await cache.get(requested)
  return { quotes, source: 'binance', at: at ?? new Date().toISOString(), refreshing: refreshing.length }
})
