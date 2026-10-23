import { describe, it, expect } from 'vitest'
import {
  HOUR, makeScales, simPriceAt, simCandles, stitchCandles, predictionRange, priceDomain,
  niceTicks, timeTicks, pickInterval, candlesFromHourlyCloses, closesFromReturns, priceAtTime,
  fmtAxisPrice, horizonFor, hourlySigma, snapTarget, type Candle,
} from '~/utils/assetChart'

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0)

describe('makeScales — a prediction is drawn where it was placed', () => {
  it('round-trips time and price through x / y', () => {
    const s = makeScales(NOW - 48 * HOUR, NOW + 24 * HOUR, 80_000, 90_000, { left: 4, top: 10, width: 300, height: 180 })
    for (const [t, p] of [[NOW + 6 * HOUR, 84_321], [NOW + 23 * HOUR, 89_999], [NOW - 10 * HOUR, 80_001]] as const) {
      expect(s.tAt(s.x(t))).toBeCloseTo(t, -1)
      expect(s.pAt(s.y(p))).toBeCloseTo(p, 6)
    }
  })

  it('puts a future target right of "now" and a higher price higher up', () => {
    const s = makeScales(NOW - 48 * HOUR, NOW + 24 * HOUR, 100, 200, { left: 0, top: 0, width: 300, height: 100 })
    expect(s.x(NOW + HOUR)).toBeGreaterThan(s.x(NOW))
    expect(s.y(180)).toBeLessThan(s.y(120))
    // now sits at 2/3 of the width when the future is one third of the window
    expect(s.x(NOW)).toBeCloseTo(200, 6)
  })
})

describe('simulated path', () => {
  const spec = { key: 'TEST', volIndex: 0.5, current: 100, change24hPct: 4 }

  it('is deterministic, ends at the current price and agrees with the 24h move', () => {
    expect(simPriceAt(spec, 0)).toBeCloseTo(100, 9)
    expect(simPriceAt(spec, 24)).toBeCloseTo(100 / 1.04, 9)
    expect(simPriceAt(spec, 300)).toBe(simPriceAt({ ...spec }, 300))
  })

  it('keeps bets inside 0–1', () => {
    const bet = { key: 'BET', volIndex: 1, current: 0.97, kind: 'probability' as const }
    for (let h = 0; h < 2000; h += 37) {
      const p = simPriceAt(bet, h)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('makes aligned candles with consistent OHLC, last one closing now', () => {
    const c = simCandles(spec, NOW, NOW - 48 * HOUR, 2)
    expect(c.length).toBeGreaterThanOrEqual(24)
    for (const k of c) {
      expect(k.h).toBeGreaterThanOrEqual(Math.max(k.o, k.c) - 1e-9)
      expect(k.l).toBeLessThanOrEqual(Math.min(k.o, k.c) + 1e-9)
      expect(k.t % (2 * HOUR)).toBe(0)
    }
    expect(c[c.length - 1]!.c).toBeCloseTo(100, 9)
  })
})

describe('real candles', () => {
  it('rebuilds hourly closes from returns and groups them', () => {
    const closes = closesFromReturns(110, [0.1, 0])
    expect(closes.map(v => +v.toFixed(6))).toEqual([100, 110, 110])
    const c = candlesFromHourlyCloses([100, 102, 101, 103, 104], NOW, 2)
    expect(c[c.length - 1]!.c).toBe(104)
    expect(Math.max(...c.map(x => x.h))).toBe(104)
  })

  it('continues short real history with a joined simulated path', () => {
    const real: Candle[] = [
      { t: NOW - 4 * HOUR, o: 50, h: 51, l: 49, c: 50.5 },
      { t: NOW - 2 * HOUR, o: 50.5, h: 52, l: 50, c: 51 },
    ]
    const out = stitchCandles(real, { key: 'X', volIndex: 0.3, current: 51 }, NOW, NOW - 24 * HOUR, 2)
    expect(out[out.length - 1]).toEqual(real[1])
    const firstReal = out.findIndex(c => !c.sim)
    expect(firstReal).toBeGreaterThan(0)
    expect(out[firstReal - 1]!.c).toBeCloseTo(real[0]!.o, 9) // no jump at the join
  })

  it('reads the price at a time from candles', () => {
    const c: Candle[] = [{ t: 0, o: 1, h: 2, l: 1, c: 2 }, { t: 10, o: 2, h: 3, l: 2, c: 3 }]
    expect(priceAtTime(c, 5, 9)).toBe(2)
    expect(priceAtTime(c, 12, 9)).toBe(9)
    expect(priceAtTime(c, -1, 9)).toBeNull()
  })
})

describe('predictionRange — from the past moves of the same length', () => {
  it('covers at least the largest rise and fall seen over the horizon (+25 %)', () => {
    // within 1 h: biggest rise 100→120 = +20 %, biggest fall 120→90 = -25 %
    const c: Candle[] = [
      { t: 0, o: 100, h: 100, l: 100, c: 100 },
      { t: HOUR, o: 120, h: 120, l: 120, c: 120 },
      { t: 2 * HOUR, o: 120, h: 120, l: 120, c: 120 },
      { t: 3 * HOUR, o: 90, h: 90, l: 90, c: 90 },
    ]
    const r = predictionRange(c, 1, 100)
    expect(r.rise).toBeGreaterThanOrEqual(0.2 * 1.25 - 1e-9)
    expect(r.fall).toBeGreaterThanOrEqual(0.25 * 1.25 - 1e-9)
  })

  it('a quiet past never caps the range below 3 sigma of the expected move', () => {
    const flat: Candle[] = Array.from({ length: 48 }, (_, i) => ({ t: i * HOUR, o: 100, h: 100.01, l: 99.99, c: 100 }))
    const r = predictionRange(flat, 168, 100, 'money', { volIndex: 0.6 })
    const expected = 3 * hourlySigma(0.6) * Math.sqrt(168)
    expect(r.rise).toBeCloseTo(expected, 9)
    expect(r.max).toBeCloseTo(100 * (1 + expected), 6)
  })

  it('widens when boosted (pointer pushed against the edge)', () => {
    const flat: Candle[] = Array.from({ length: 10 }, (_, i) => ({ t: i * HOUR, o: 50, h: 50, l: 50, c: 50 }))
    const a = predictionRange(flat, 24, 50, 'money', { volIndex: 0.3 })
    const b = predictionRange(flat, 24, 50, 'money', { volIndex: 0.3, boost: 1 })
    expect(b.rise).toBeCloseTo(a.rise * 2, 9)
  })

  it('never offers a range of zero, and keeps bets in 0–1', () => {
    const flat: Candle[] = [{ t: 0, o: 10, h: 10, l: 10, c: 10 }, { t: HOUR, o: 10, h: 10, l: 10, c: 10 }]
    const r = predictionRange(flat, 24, 10)
    expect(r.max).toBeGreaterThan(10)
    expect(r.min).toBeLessThan(10)
    const b = predictionRange([{ t: 0, o: 0.9, h: 0.99, l: 0.5, c: 0.95 }], 24, 0.95, 'probability')
    expect(b.max).toBeLessThanOrEqual(1)
    expect(b.min).toBeGreaterThanOrEqual(0)
  })
})

describe('axes', () => {
  it('nice price ticks are round and inside the domain', () => {
    const t = niceTicks(81_234, 84_987, 4)
    expect(t.length).toBeGreaterThanOrEqual(3)
    for (const v of t) { expect(v).toBeGreaterThanOrEqual(81_234); expect(v).toBeLessThanOrEqual(84_987); expect(v % 500).toBe(0) }
  })

  it('time ticks fall inside the window', () => {
    for (const span of [24, 72, 24 * 30, 24 * 400]) {
      const ticks = timeTicks(NOW - span * HOUR, NOW, 4, 'en-GB')
      expect(ticks.length).toBeGreaterThan(0)
      for (const k of ticks) { expect(k.t).toBeGreaterThanOrEqual(NOW - span * HOUR); expect(k.t).toBeLessThanOrEqual(NOW); expect(k.label).not.toBe('') }
    }
  })

  it('price domain is padded and never negative for money', () => {
    const [lo, hi] = priceDomain([0.1, 0.2])
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeGreaterThan(0.2)
  })

  it('formats axis prices compactly', () => {
    expect(fmtAxisPrice(82_758.56)).toBe('82.8k')
    expect(fmtAxisPrice(1.1186)).toBe('1.12')
    expect(fmtAxisPrice(0.2548)).toBe('0.2548')
    expect(fmtAxisPrice(0.329, 'probability')).toBe('33%')
  })

  it('picks candle intervals and horizons', () => {
    expect(pickInterval(48, 48).id).toBe('1h')
    expect(pickInterval(24 * 14, 48).id).toBe('8h')
    expect(pickInterval(24 * 730, 48).id).toBe('1M')
    expect(horizonFor(30).id).toBe('1W')
    expect(horizonFor(24).id).toBe('1D')
  })
})

describe('snapTarget — hitting exactly 1 week / 1 month', () => {
  const end = NOW + 168 * HOUR
  it('snaps to exactly one horizon ahead near a mark', () => {
    expect(snapTarget(NOW + 167.2 * HOUR, NOW, end, 2 * HOUR)).toEqual({ t: NOW + 168 * HOUR, exact: expect.objectContaining({ id: '1W' }) })
    expect(snapTarget(NOW + 25 * HOUR, NOW, end, 2 * HOUR).t).toBe(NOW + 24 * HOUR)
  })
  it('leaves other times alone', () => {
    expect(snapTarget(NOW + 100 * HOUR, NOW, end, 2 * HOUR)).toEqual({ t: NOW + 100 * HOUR, exact: null })
  })
})
