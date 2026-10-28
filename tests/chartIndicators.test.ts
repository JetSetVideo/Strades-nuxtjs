import { describe, expect, it } from 'vitest'
import {
  sma, ema, bollinger, rsi, macd, vwap, parseIndicators, clampView, zoomView, panView, visibleRange,
  priceScale, logTicks, toPercent, alignCloses, measureSpan, fullView,
} from '~/utils/chartIndicators'
import type { Candle } from '~/utils/assetChart'

const close = (vals: number[], v?: number[]): Candle[] => vals.map((c, i) => ({ t: i * 1000, o: c, h: c + 1, l: c - 1, c, v: v?.[i] }))

describe('moving averages', () => {
  it('sma warms up with nulls then averages', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })
  it('ema is seeded by the sma and reacts faster', () => {
    const e = ema([1, 2, 3, 4, 5, 6], 3)
    expect(e.slice(0, 2)).toEqual([null, null])
    expect(e[2]).toBe(2)
    expect(e[3]).toBeCloseTo(3, 9)          // 4*0.5 + 2*0.5
    expect(e[5]).toBeCloseTo(5, 9)
  })
  it('bollinger bands are symmetric around the sma and collapse on a flat series', () => {
    const b = bollinger([5, 5, 5, 5], 2, 2)
    expect(b.mid[3]).toBe(5)
    expect(b.upper[3]).toBe(5)
    const c = bollinger([1, 3, 1, 3], 2, 1)
    expect(c.upper[3]! - c.mid[3]!).toBeCloseTo(c.mid[3]! - c.lower[3]!, 9)
    expect(c.upper[3]).toBeCloseTo(3, 9)
  })
})

describe('oscillators', () => {
  it('rsi is 100 on a straight rise, 0 on a straight fall, 50 when flat', () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 3).at(-1)).toBe(100)
    expect(rsi([6, 5, 4, 3, 2, 1], 3).at(-1)).toBe(0)
    expect(rsi([2, 2, 2, 2, 2], 3).at(-1)).toBe(50)
    expect(rsi([1, 2], 3)).toEqual([null, null])
  })
  it('macd histogram = line − signal, null during warm-up', () => {
    const vals = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.3)
    const m = macd(vals)
    expect(m.line[24]).toBeNull()
    expect(m.line[25]).not.toBeNull()
    const i = 50
    expect(m.hist[i]).toBeCloseTo(m.line[i]! - m.signal[i]!, 9)
    expect(m.signal[25 + 7]).toBeNull()
    expect(m.signal[25 + 8]).not.toBeNull()
  })
  it('vwap needs volume', () => {
    expect(vwap(close([1, 2, 3]))).toEqual([null, null, null])
    const w = vwap(close([10, 20], [1, 3]))
    expect(w[1]).toBeCloseTo((10 * 1 + 20 * 3) / 4, 9)
  })
})

describe('indicator catalogue', () => {
  it('parses known ids only', () => {
    expect(parseIndicators('sma20,rsi14,evil,,macd')).toEqual(['sma20', 'rsi14', 'macd'])
    expect(parseIndicators(undefined)).toEqual([])
  })
})

describe('viewport', () => {
  it('zooms around the anchor and never below the minimum span', () => {
    const v = zoomView({ from: 0, to: 99 }, 0.5, 1, 100)
    expect(v.to).toBeCloseTo(99, 9)
    expect(v.to - v.from).toBeCloseTo(49.5, 9)
    const tiny = zoomView({ from: 40, to: 50 }, 0.01, 0.5, 100)
    expect(tiny.to - tiny.from).toBeGreaterThanOrEqual(12)
  })
  it('pans inside the data and keeps the span', () => {
    expect(panView({ from: 50, to: 99 }, -10, 100)).toEqual({ from: 50, to: 99 })
    expect(panView({ from: 50, to: 99 }, 10, 100)).toEqual({ from: 40, to: 89 })
    expect(panView({ from: 5, to: 54 }, 100, 100)).toEqual({ from: 0, to: 49 })
  })
  it('clamps and lists the indices to render', () => {
    expect(clampView({ from: -5, to: 500 }, 10)).toEqual({ from: 0, to: 9 })
    expect(fullView(0)).toEqual({ from: 0, to: 0 })
    expect(visibleRange({ from: 10.4, to: 20.6 }, 100)).toEqual([9, 22])
  })
})

describe('scales', () => {
  it('log scale is invertible and halves the distance per decade', () => {
    const s = priceScale(1, 100, 0, 200, true)
    expect(s.log).toBe(true)
    expect(s.y(10)).toBeCloseTo(100, 9)
    expect(s.p(s.y(37))).toBeCloseTo(37, 9)
    expect(priceScale(0, 100, 0, 200, true).log).toBe(false)
  })
  it('log ticks follow 1-2-5', () => {
    expect(logTicks(1, 100, 8)).toEqual([1, 2, 5, 10, 20, 50, 100])
    expect(logTicks(1, 100).length).toBeLessThanOrEqual(6)
    expect(logTicks(0, 10)).toEqual([])
  })
  it('percent mode and aligned comparison', () => {
    toPercent([100, 110, 90]).forEach((v, i) => expect(v).toBeCloseTo([0, 10, -10][i]!, 9))
    const other = close([5, 6, 7])
    expect(alignCloses([-1, 0, 1500, 9999], other)).toEqual([null, 5, 6, 7])
  })
  it('ruler', () => {
    expect(measureSpan({ t: 0, p: 100 }, { t: 3600_000 * 5, p: 110 }, 3600_000)).toEqual({ abs: 10, pct: 10.000000000000009, candles: 5, ms: 18_000_000 })
  })
})
