import { describe, expect, it } from 'vitest'
import { heldExposureByClass, heldExposureRows } from '~/utils/walletBook'

// REVIEW-6: /risk exposure from the account's own holdings.
const VOL = { fiat: 0.05, crypto: 0.82, stocks: 0.41, commodities: 0.35 }

describe('heldExposureRows / heldExposureByClass', () => {
  const positions = [
    { symbol: 'BTC', cls: 'crypto' as const, value: 4000 },
    { symbol: 'btc', cls: 'crypto' as const, value: 1000 }, // bot + portfolio legs merge
    { symbol: 'ETH', cls: 'crypto' as const, value: 3000 },
    { symbol: 'AAPL', cls: 'stocks' as const, value: 2000 },
    { symbol: '', cls: 'stocks' as const, value: 50 }, // no symbol: skipped
    { symbol: 'SOL', cls: 'crypto' as const, value: 0 }, // nothing held: skipped
  ]
  const rows = heldExposureRows(positions, 10000, VOL)

  it('rows ⊆ held assets, merged by symbol, weighted by the book total', () => {
    expect(rows.map(r => r.symbol).sort()).toEqual(['AAPL', 'BTC', 'ETH'])
    const btc = rows.find(r => r.symbol === 'BTC')!
    expect(btc.value).toBe(5000)
    expect(btc.weightPct).toBeCloseTo(50, 6)
    expect(btc.risk).toBeCloseTo(41, 6) // 50 % × 82 %
  })

  it('no row and no class above 100 %, even all-in crypto', () => {
    const allIn = heldExposureRows([{ symbol: 'BTC', cls: 'crypto', value: 100 }, { symbol: 'ETH', cls: 'crypto', value: 100 }, { symbol: 'SOL', cls: 'crypto', value: 100 }], 300, { crypto: 1.4 })
    for (const r of allIn) expect(r.risk).toBeLessThanOrEqual(100)
    const byClass = heldExposureByClass(allIn)
    expect(byClass).toHaveLength(1)
    expect(byClass[0]!.risk).toBeLessThanOrEqual(100)
    for (const c of heldExposureByClass(rows)) expect(c.risk).toBeLessThanOrEqual(100)
  })

  it('class row = Σ weight × class vol', () => {
    const crypto = heldExposureByClass(rows).find(c => c.cls === 'crypto')!
    expect(crypto.weightPct).toBeCloseTo(80, 6)
    expect(crypto.risk).toBeCloseTo(80 * 0.82, 6)
  })

  it('empty when nothing is held or the total is not positive', () => {
    expect(heldExposureRows([], 1000, VOL)).toEqual([])
    expect(heldExposureRows(positions, 0, VOL)).toEqual([])
  })
})
