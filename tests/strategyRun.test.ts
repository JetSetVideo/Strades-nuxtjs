import { describe, expect, it } from 'vitest'
import {
  assumptionsLine, backtestFailureText, botFillsView, botStatusText, nextActionTs, strategyTopStats, tagSampleStrategies,
} from '~/utils/strategyRun'
import { mulberry32 } from '~/composables/useSeededRandom'

describe('strategyTopStats — header numbers never invent a 0.00 %', () => {
  it('a new strategy with no backtest shows — and a pending chip', () => {
    const t = strategyTopStats({ total_trades: 0, total_return_percentage: 0, current_capital: 10000 }, null)
    expect(t).toMatchObject({ returnPct: null, capital: null, winRate: null, sharpe: null, source: 'pending' })
  })

  it('a failed backtest keeps — and carries the server error into the chip note', () => {
    const t = strategyTopStats({ total_trades: 0 }, null, 'No market data: no market data for USDUSDT.')
    expect(t.source).toBe('pending')
    expect(t.note).toMatch(/USDUSDT/)
  })

  it('a real-price backtest fills the header, chipped simulated, with no invented Sharpe', () => {
    const t = strategyTopStats({ total_trades: 0 }, { equity: 10500, metrics: { return_pct: 5, win_rate: 60, trades: 4 }, window: { bars: 365 } })
    expect(t).toMatchObject({ returnPct: 5, capital: 10500, winRate: 60, sharpe: null, source: 'simulated' })
    expect(t.note).toMatch(/365 bars/)
  })

  it('a saved summary (equity 0, no trades) does not show $0 capital or a win rate', () => {
    const t = strategyTopStats({}, { equity: 0, metrics: { return_pct: -1.2, win_rate: null, trades: 0 } })
    expect(t).toMatchObject({ returnPct: -1.2, capital: null, winRate: null })
  })

  it('a sample strategy keeps its catalog numbers, chipped sample', () => {
    const t = strategyTopStats({ sample: true, total_return_percentage: 12, win_rate: 55, current_capital: 11200, sharpe_ratio: 1.1 }, null)
    expect(t).toMatchObject({ returnPct: 12, winRate: 55, source: 'sample' })
  })
})

describe('backtestFailureText', () => {
  it('turns status codes into an action', () => {
    expect(backtestFailureText(503, 'no market data for USDUSDT: 400')).toMatch(/^No market data: no market data for USDUSDT/)
    expect(backtestFailureText(401, '')).toMatch(/Sign in/)
    expect(backtestFailureText(404, 'Not found.')).toMatch(/not saved on the server/)
    expect(backtestFailureText(400, 'condition 1 cannot be executed: x')).toMatch(/refused/)
    expect(backtestFailureText(500, 'Request failed')).toMatch(/Try again/)
    expect(backtestFailureText(500, 'boom')).toBe('boom')
  })
})

describe('assumptionsLine', () => {
  it('prints the backend primary values as one line', () => {
    expect(assumptionsLine({ capital_usd: 10000, fee_bps: 10, slippage_bps: 5, source: 'settings/primary' }))
      .toBe('Assumes $10,000 · fee 10 bps · slippage 5 bps · from Settings')
  })
  it('handles missing pieces and missing assumptions', () => {
    expect(assumptionsLine(undefined)).toBeNull()
    expect(assumptionsLine({})).toBeNull()
    expect(assumptionsLine({ capital_usd: '2500.4', fee_bps: 0 })).toBe('Assumes $2,500 · fee 0 bps')
    expect(assumptionsLine({ capital_usd: 1000, source: 'platform default' })).toBe('Assumes $1,000 · platform default')
  })
})

describe('tagSampleStrategies', () => {
  it('tags catalog rows without dropping any', () => {
    const rows = tagSampleStrategies([{ id: 'a' }, { id: 'b' }])
    expect(rows).toEqual([{ id: 'a', sample: true }, { id: 'b', sample: true }])
  })
})

describe('bots — never LIVE, never an impossible fill', () => {
  const live: Record<string, number> = { BTC: 77971 }
  const priceOf = (a: string) => live[a] ?? null

  it('draws fills within ±2 % of the real price; a DCA bot only buys', () => {
    const v = botFillsView({ botId: 'bot_001', botName: 'BTC DCA Daily', count: 30, assets: ['BTC'], priceOf, rand: mulberry32(7), now: 1_700_000_000_000 })
    expect(v.hidden).toBe(false)
    expect(v.fills).toHaveLength(12)
    for (const f of v.fills) {
      expect(f.side).toBe('buy')
      expect(f.price).toBeGreaterThan(77971 * 0.98)
      expect(f.price).toBeLessThan(77971 * 1.02)
      expect(Number.isFinite(f.size) && f.size > 0).toBe(true)
    }
  })

  it('hides the fill table when no target asset has a live price', () => {
    const v = botFillsView({ botId: 'b', botName: 'Momentum', count: 5, assets: ['AAPL'], priceOf, rand: mulberry32(1) })
    expect(v).toMatchObject({ fills: [], hidden: true })
    expect(v.reason).toMatch(/No live price/)
  })

  it('labels a catalog bot simulated and keeps server statuses', () => {
    expect(botStatusText('live', false)).toBe('running (simulated)')
    expect(botStatusText('paused', false)).toBe('paused (simulated)')
    expect(botStatusText('live', true)).toBe('live')
  })

  it('a next action in the past is unknown, not "now"', () => {
    expect(nextActionTs('2026-05-29T10:00:00Z', Date.parse('2026-11-02T00:00:00Z'))).toBeNull()
    expect(nextActionTs('2026-12-01T00:00:00Z', Date.parse('2026-11-02T00:00:00Z'))).toBe(Date.parse('2026-12-01T00:00:00Z'))
    expect(nextActionTs(null)).toBeNull()
  })
})
