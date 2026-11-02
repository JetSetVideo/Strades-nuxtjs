import { describe, expect, it } from 'vitest'
import {
  NO_EQUITY_HISTORY,
  SHARPE_PENDING_NOTE,
  equityPath,
  equityStats,
  holdingTodayPct,
  isPending,
  maxDrawdownPct,
  pendingFigure,
  riskProfile,
  sharePaths,
} from '~/utils/walletBook'

// Wave 2 "portfolio honesty": nothing on /wallet may be invented.
describe('walletBook honest figures', () => {
  it('draws the equity path as a straight line from the stored period start to today', () => {
    const path = equityPath('wallet_001::30d', 5, 1100, 10)
    // start = 1100 / 1.10 = 1000, four equal steps of 25
    const expected = [1000, 1025, 1050, 1075, 1100]
    expect(path).toHaveLength(5)
    path.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9))
  })

  it('gives the same path for any seed key (no randomness left)', () => {
    expect(equityPath('a', 30, 5000, -4)).toEqual(equityPath('b', 30, 5000, -4))
  })

  it('survives a -100% (or worse) stored change without dividing by zero', () => {
    const path = equityPath('x', 3, 50, -100)
    expect(path.every(Number.isFinite)).toBe(true)
    expect(path.at(-1)).toBe(50)
  })

  it('keeps the share columns flat at today\'s mix (composition history is not recorded)', () => {
    const grid = sharePaths([{ id: 'a', share: 1 }, { id: 'b', share: 3 }], 4, 'seed')
    expect(grid).toHaveLength(4)
    for (const column of grid) {
      expect(column[0]).toBeCloseTo(0.25)
      expect(column[1]).toBeCloseTo(0.75)
    }
  })

  it('formats a pending figure as an em dash through toFixed', () => {
    const p = pendingFigure('why')
    expect(p.toFixed(1)).toBe('—')
    expect(`${p}`).toBe('—')
    expect(isPending(p)).toBe(true)
    expect(isPending(0)).toBe(false)
    expect(isPending(null)).toBe(false)
  })

  it('reports Best / Worst / Max DD as pending when no equity series is recorded', () => {
    const stats = equityStats(equityPath('w', 30, 1000, 5), false)
    expect(isPending(stats.best)).toBe(true)
    expect(isPending(stats.worst)).toBe(true)
    expect(isPending(stats.maxDrawdown)).toBe(true)
    expect((stats.maxDrawdown as { note: string }).note).toBe(NO_EQUITY_HISTORY)
  })

  it('computes Best / Worst / Max DD on a recorded series (golden values)', () => {
    // 100 → 110 (+10%) → 99 (−10%) → 121 (+22.22%) ; peak 110 → trough 99 = −10%
    const stats = equityStats([100, 110, 99, 121], true)
    expect(stats.best).toBeCloseTo(22.2222, 3)
    expect(stats.worst).toBeCloseTo(-10, 6)
    expect(stats.maxDrawdown).toBeCloseTo(-10, 6)
  })

  it('measures max drawdown peak-to-trough in %', () => {
    expect(maxDrawdownPct([100, 120, 90, 130, 65])).toBeCloseTo(-50, 6)
    expect(maxDrawdownPct([1, 2, 3])).toBe(0)
    expect(maxDrawdownPct([])).toBe(0)
  })

  it('no longer reports a Sharpe from five overlapping horizons', () => {
    const risk = riskProfile(
      [{ symbol: 'BTC', allocation_percentage: 100, return_percentage: 5 }],
      { '1d': { change_percentage: 1 }, '7d': { change_percentage: 7.45 }, '30d': { change_percentage: 17.25 }, '90d': { change_percentage: 21.8 }, '1y': { change_percentage: 14.32 } },
    )
    // board-finance R2 reproduced 1.68 from these inputs; it must now be pending.
    expect(isPending(risk.sharpe)).toBe(true)
    expect(risk.sharpe.toFixed(1)).toBe('—')
    expect(risk.sharpeNote).toBe(SHARPE_PENDING_NOTE)
  })

  it('takes holdings Today % only from live quotes, never from the asset id', () => {
    const quotes: Record<string, { symbol: string; change_24h_pct?: number; live?: { at: string } | null }> = {
      BTC: { symbol: 'BTC', change_24h_pct: -2.5, live: { at: '2026-11-02T12:00:00Z' } },
      ETH: { symbol: 'ETH', change_24h_pct: 3.1 }, // no live stamp → unknown
      AAPL: { symbol: 'AAPL', live: { at: '2026-11-02T12:00:00Z' } }, // no change → unknown
    }
    const map = holdingTodayPct(
      [
        { asset_id: 'bitcoin', symbol: 'btc' },
        { asset_id: 'ethereum', symbol: 'ETH' },
        { asset_id: 'apple', symbol: 'AAPL' },
        { asset_id: 'tesla', symbol: 'TSLA' },
      ],
      symbol => quotes[symbol],
    )
    expect(map).toEqual({ bitcoin: -2.5 })
  })
})
