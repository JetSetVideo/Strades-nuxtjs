import type { PredictMarket } from '~/server/api/predict/markets.get'
import type { BotStatus } from '~/composables/useTradingApi'

/**
 * Fill the market title/subtitle and position for prediction bots whose status only
 * carries a flat market_ticker/side (engine K2 before the market/position block).
 */
const cache = new Map<string, PredictMarket>()

export function usePredictMarkets() {
  async function enrich(bots: BotStatus[]): Promise<BotStatus[]> {
    const missing = [...new Set(bots.filter(b => b.kind === 'prediction' && b.market_ticker && !b.market?.title && !cache.has(b.market_ticker)).map(b => b.market_ticker!))]
    if (missing.length) {
      try {
        const r = await $fetch<{ markets: PredictMarket[] }>('/api/predict/markets', { query: { tickers: missing.join(','), limit: 200 } })
        for (const m of r.markets) cache.set(m.ticker, m)
      } catch { /* titles are cosmetic: fall back to the ticker */ }
    }
    return bots.map(b => {
      if (b.kind !== 'prediction') return b
      const m = b.market_ticker ? cache.get(b.market_ticker) : undefined
      const op = (b.open_positions ?? [])[0]
      // A restored bot can come back with an empty market (state saved before persistence existed): say so.
      const title = b.market?.title || m?.title || b.market_ticker || 'Kalshi bot (market lost in a restart)'
      return {
        ...b,
        market: { ticker: b.market?.ticker ?? b.market_ticker ?? '', title, subtitle: b.market?.subtitle || m?.subtitle, side: b.market?.side ?? b.side },
        position: (b.position && (b.position.contracts || b.position.avg_cents !== null)) ? b.position : (op ? { contracts: Math.round(op.qty), avg_cents: Math.round(op.avg_price * 100), mark_cents: op.mark != null ? Math.round(op.mark * 100) : null } : null),
      }
    })
  }
  return { enrich }
}
