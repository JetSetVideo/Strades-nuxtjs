/**
 * GET /api/market/history?symbol=BTC&interval=1d&limit=60
 *
 * Real OHLC candles from Binance's public klines (no key) for the symbols in
 * the quotes route's PAIRS table. Anything else answers `{ candles: [] }` and
 * the client draws a simulated path, flagged as such. Cached 60 s per query.
 */
import { PAIRS } from './quotes.get'

const ALLOWED = new Set(['1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'])

type Kline = [number, string, string, string, string, ...unknown[]]

export default defineCachedEventHandler(async (event) => {
  const q = getQuery(event)
  const symbol = String(q.symbol ?? '').trim().toUpperCase()
  const interval = ALLOWED.has(String(q.interval)) ? String(q.interval) : '1h'
  const limit = Math.max(2, Math.min(500, Number(q.limit) || 60))
  const meta = PAIRS[symbol]
  if (!meta) return { symbol, interval, candles: [], source: 'none' }
  const rows = await $fetch<Kline[]>('https://api.binance.com/api/v3/klines', {
    query: { symbol: meta.pair, interval, limit }, timeout: 8000,
  }).catch(() => [] as Kline[])
  return {
    symbol,
    pair: meta.pair,
    ...(meta.proxy ? { proxy: meta.proxy } : {}),
    interval,
    source: rows.length ? 'binance' : 'none',
    candles: rows.map(r => ({ t: r[0], o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) || 0 })),
  }
}, {
  maxAge: 60,
  getKey: (event) => {
    const q = getQuery(event)
    return `history:${String(q.symbol ?? '').toUpperCase()}:${q.interval}:${q.limit}`
  },
})
