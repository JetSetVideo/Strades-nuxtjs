/**
 * Card lab variant B (glyph / visual encoding): every glyph must come from a real field of the catalog record.
 * Pins the style archetype of the 5 catalog samples, the time scale, the balance bars, W/L counts and the guards
 * against store defaults (today→today backtest window, all-zero performance metrics).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cardLabBAutomation, cardLabBBalance, cardLabBDurationHours, cardLabBHoldBucket, cardLabBHoldPos, cardLabBPerf,
  cardLabBPopularity, cardLabBRisk, cardLabBSharpe, cardLabBSmallSample, cardLabBStyle, cardLabBWindowKnown,
  cardLabBWinLoss, cardLabBWinRateMismatch,
} from '~/utils/cardLabB'

const catalog = JSON.parse(readFileSync('public/data/core/strategies.json', 'utf8')) as Array<Record<string, any>>
const byId = Object.fromEntries(catalog.map(s => [s.id, s]))

describe('cardLabBStyle — archetype glyph from tags, indicators, name', () => {
  it.each([
    ['strategy_001', 'reversion'],
    ['strategy_002', 'pair'],
    ['strategy_003', 'vol'],
    ['strategy_004', 'momentum'],
    ['strategy_005', 'event'],
  ])('%s → %s', (id, key) => {
    const s = byId[id]
    const st = cardLabBStyle(s)
    expect(st.key).toBe(key)
    expect(st.evidence.length).toBeGreaterThan(0)
  })
  it('names gold a macro momentum (tag macro) and falls back to Systematic without words', () => {
    expect(cardLabBStyle(byId.strategy_004).label).toBe('Macro momentum')
    expect(cardLabBStyle({ name: 'X', tags: [], indicators: ['VWAP'] })).toEqual({ key: 'systematic', label: 'Systematic', evidence: [] })
  })
})

describe('holding period time scale', () => {
  it('parses durations and never defaults', () => {
    expect(cardLabBDurationHours('8h')).toBe(8)
    expect(cardLabBDurationHours('2d')).toBe(48)
    expect(cardLabBDurationHours('12d')).toBe(288)
    expect(cardLabBDurationHours('1w')).toBe(168)
    expect(cardLabBDurationHours('0')).toBeNull()
    expect(cardLabBDurationHours('')).toBeNull()
  })
  it('places 1h at 0, 1mo at 1 and orders the samples', () => {
    expect(cardLabBHoldPos(1)).toBe(0)
    expect(cardLabBHoldPos(720)).toBe(1)
    expect(cardLabBHoldPos(null)).toBeNull()
    const pos = ['8h', '2d', '3d', '5d', '12d'].map(d => cardLabBHoldPos(cardLabBDurationHours(d))!)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(cardLabBHoldBucket(8)).toBe('intraday')
    expect(cardLabBHoldBucket(288)).toBe('position (weeks)')
  })
})

describe('balance, win/loss, Sharpe, risk', () => {
  it('draws return and drawdown on one shared scale', () => {
    const b = cardLabBBalance(20, 12)
    expect(b.scale).toBe(25)
    expect(b.ret).toBeCloseTo(0.8)
    expect(b.dd).toBeCloseTo(0.48)
    expect(b.ratio).toBeCloseTo(20 / 12)
    expect(cardLabBBalance(-9.6, 18.2).retSign).toBe(-1)
    expect(cardLabBBalance(40, 5).scale).toBe(40)
  })
  it('counts wins and losses from the trades, and exposes a stated win rate that disagrees', () => {
    const s = byId.strategy_004
    const wl = cardLabBWinLoss(s.total_trades, s.successful_trades, s.win_rate)!
    expect(wl).toMatchObject({ total: 16, wins: 10, losses: 6 })
    expect(cardLabBWinRateMismatch(s.win_rate, wl)).toBe(65)
    const b = byId.strategy_001
    expect(cardLabBWinRateMismatch(b.win_rate, cardLabBWinLoss(b.total_trades, b.successful_trades))).toBeNull()
    expect(cardLabBWinLoss(0, 0)).toBeNull()
    expect(cardLabBSmallSample(7)).toBe(true)
    expect(cardLabBSmallSample(120)).toBe(false)
  })
  it('bands Sharpe and maps the catalog risk level without a 5/10 default', () => {
    expect(cardLabBSharpe(-0.85).key).toBe('losing')
    expect(cardLabBSharpe(0.42).key).toBe('weak')
    expect(cardLabBSharpe(1.2).key).toBe('good')
    expect(cardLabBSharpe(2.4).key).toBe('strong')
    expect(cardLabBSharpe(null).pos).toBeNull()
    expect(cardLabBRisk('high').level).toBe(3)
    expect(cardLabBRisk(undefined)).toMatchObject({ level: 0, label: 'Not rated' })
    expect(cardLabBAutomation('semi_automated').label).toBe('Semi-automated')
  })
  it('popularity bar is a log scale to 1,000', () => {
    expect(cardLabBPopularity(0)).toBe(0)
    expect(cardLabBPopularity(999)).toBeCloseTo(1)
    expect(cardLabBPopularity(168)).toBeGreaterThan(cardLabBPopularity(42))
  })
})

describe('store-default guards', () => {
  it('a today→today backtest window is "not given"', () => {
    expect(cardLabBWindowKnown({ start: '2026-11-02', end: '2026-11-02' })).toBe(false)
    expect(cardLabBWindowKnown(undefined)).toBe(false)
    expect(cardLabBWindowKnown(byId.strategy_001.backtest_period)).toBe(true)
  })
  it('all-zero performance metrics are dropped, real ones kept', () => {
    expect(cardLabBPerf({ annual_return: 0, volatility: 0, beta: 0, alpha: 0 })).toEqual({})
    expect(cardLabBPerf(byId.strategy_002.performance_metrics)).toMatchObject({ annual_return: 28 })
  })
})
