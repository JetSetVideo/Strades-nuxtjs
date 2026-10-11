/**
 * GET /api/market/quotes?symbols=BTC,ETH,SOL,EUR,XAU
 *
 * Real 24h quotes + 48 hourly returns from Binance's public API (no key).
 * Non-crypto symbols are served only where Binance lists a faithful proxy
 * (EUR → EURUSDT, XAU → PAXGUSDT, gold-backed token) and are flagged `proxy`.
 * Everything else is simply absent; the client keeps its bundled price and
 * says so. Cached 30 s per symbol set, server-side.
 */
const PAIRS: Record<string, { pair: string; proxy?: string }> = {
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
}

type Ticker = { symbol: string; lastPrice: string; priceChangePercent: string }
type Kline = [number, string, string, string, string, ...unknown[]]

export default defineCachedEventHandler(async (event) => {
  const q = getQuery(event)
  const wanted = String(q.symbols ?? '')
    .split(',').map(s => s.trim().toUpperCase()).filter((s): s is keyof typeof PAIRS => s in PAIRS).slice(0, 25)
  if (!wanted.length) return { quotes: {}, source: 'binance', at: new Date().toISOString() }

  const api = 'https://api.binance.com/api/v3'
  const pairs = wanted.map(s => PAIRS[s]!.pair)
  const tickers = await $fetch<Ticker[]>(`${api}/ticker/24hr`, {
    query: { symbols: JSON.stringify(pairs) }, timeout: 8000,
  })
  const histories = await Promise.all(pairs.map(pair =>
    $fetch<Kline[]>(`${api}/klines`, { query: { symbol: pair, interval: '1h', limit: 49 }, timeout: 8000 })
      .then(rows => rows.map(r => Number(r[4])))
      .catch(() => [] as number[]),
  ))

  const quotes: Record<string, LiveQuote> = {}
  wanted.forEach((sym, i) => {
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
  return { quotes, source: 'binance', at: new Date().toISOString() }
}, {
  maxAge: 30,
  getKey: event => `quotes:${String(getQuery(event).symbols ?? '').toUpperCase()}`,
})
