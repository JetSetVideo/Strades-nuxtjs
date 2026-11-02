import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePaperStore } from '~/stores/paper'

describe('paper store — owner, capital and marks', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stamps the given owner and capital; defaults are "guest" and a labelled $10k (never 100k)', () => {
    const paper = usePaperStore()
    const mine = paper.placeOrder({ asset_id: 'bitcoin', asset_symbol: 'BTC', side: 'buy', wallet_pct: 10, simulated_price: 80000, user_id: 'u_7', capital_usd: 25000 })
    expect(mine).toMatchObject({ user_id: 'u_7', notional_value: 2500, capital_usd: 25000, capital_source: 'paper_wallet', mark_price: null })
    const anon = paper.placeOrder({ asset_id: 'bitcoin', asset_symbol: 'BTC', side: 'buy', wallet_pct: 10, simulated_price: 80000 })
    expect(anon).toMatchObject({ user_id: 'guest', notional_value: 1000, capital_source: 'default' })
    expect(paper.trades.some(t => t.user_id === 'user_001')).toBe(false)
  })

  it('marks to the injected live price; no price → unmarked (UI shows —)', () => {
    const paper = usePaperStore()
    const t = paper.placeOrder({ asset_id: 'bitcoin', asset_symbol: 'BTC', side: 'buy', wallet_pct: 10, simulated_price: 80000, capital_usd: 10000 })
    paper.markToMarket(() => 88000)
    expect(t.mark_price).toBe(88000)
    expect(t.hypothetical_pnl_pct).toBeCloseTo(10, 10)
    expect(t.hypothetical_pnl_value).toBeCloseTo(100, 10)
    paper.markToMarket(() => null)
    expect(t.mark_price).toBeNull()
    expect(t.hypothetical_pnl_value).toBe(0)
  })

  it('closing without any price leaves the realized P&L unknown, with a price it is exact', () => {
    const paper = usePaperStore()
    const a = paper.placeOrder({ asset_id: 'x', asset_symbol: 'XYZ', side: 'buy', wallet_pct: 10, simulated_price: 50, capital_usd: 1000 })
    paper.closeTrade(a.id) // no live quote for XYZ in an empty assets store
    expect(a.status).toBe('closed')
    expect(a.realized_pnl_value).toBeUndefined()
    const b = paper.placeOrder({ asset_id: 'x', asset_symbol: 'XYZ', side: 'sell', wallet_pct: 10, simulated_price: 50, capital_usd: 1000 })
    paper.closeTrade(b.id, 45)
    expect(b.realized_pnl_pct).toBeCloseTo(10, 10)
    expect(b.realized_pnl_value).toBeCloseTo(10, 10)
  })
})
