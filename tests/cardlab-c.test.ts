import { describe, it, expect } from 'vitest'
import {
  cardLabCRule, cardLabCSegments, cardLabCDuration, cardLabCWindow, cardLabCWinLoss, cardLabCAutomation, cardLabCRisk,
} from '../utils/cardLabC'

describe('cardLabCRule — the description read as entry / exit', () => {
  it('BTC dips: buy entry, sell exit, context kept verbatim', () => {
    const r = cardLabCRule('Buys BTC dips and sells rebounds. Works best in low-trending markets with high intraday volatility.')
    expect(r.entry.map(c => [c.side, c.action])).toEqual([['buy', 'Buys BTC dips']])
    expect(r.exit?.side).toBe('sell')
    expect(r.exit?.action).toBe('Sells rebounds')
    expect(r.context).toEqual(['Works best in low-trending markets with high intraday volatility.'])
    expect(r.pair).toBe(false)
  })

  it('pair trade: two entry legs, shared trigger, no invented exit', () => {
    const r = cardLabCRule('Stat-arb pair trade — long the laggard, short the leader when the spread widens beyond 2σ.')
    expect(r.pair).toBe(true)
    expect(r.lead).toBe('Stat-arb pair trade')
    expect(r.entry.map(c => [c.side, c.action])).toEqual([['buy', 'Long the laggard'], ['sell', 'Short the leader']])
    expect(r.pairCondition).toBe('the spread widens beyond 2σ')
    expect(r.exit).toBeNull()
  })

  it('vol selling: sell entry, buy-back exit with its own condition', () => {
    const r = cardLabCRule("Sells weekly SPX vol on Fri close, buys back at Mon open if VIX doesn't gap > 10%.")
    expect(r.entry[0]).toMatchObject({ side: 'sell', action: 'Sells weekly SPX vol on Fri close', condition: null })
    expect(r.exit).toMatchObject({ side: 'buy', action: 'Buys back at Mon open', keyword: 'if', condition: "VIX doesn't gap > 10%" })
  })

  it('entry with a condition and no exit: exit stays null (not stated)', () => {
    const r = cardLabCRule('Buys TSLA 3 days before earnings if IV-rank > 60 and analyst-revision skew is positive.')
    expect(r.entry[0]).toMatchObject({ side: 'buy', action: 'Buys TSLA 3 days before earnings', keyword: 'if' })
    expect(r.entry[0]!.condition).toBe('IV-rank > 60 and analyst-revision skew is positive')
    expect(r.exit).toBeNull()
  })

  it('"adds exposure" is a buy; non-verb words (long-term, low-trending) are not actions', () => {
    const r = cardLabCRule('Adds gold exposure when DXY rolls over and real yields turn negative. Risk-off hedge.')
    expect(r.entry[0]).toMatchObject({ side: 'buy', action: 'Adds gold exposure', keyword: 'when', condition: 'DXY rolls over and real yields turn negative' })
    expect(r.context).toEqual(['Risk-off hedge.'])
    expect(cardLabCRule('A long-term short-term blend.').entry).toEqual([])
  })

  it('no description → no rule, nothing invented', () => {
    expect(cardLabCRule('')).toEqual({ lead: null, entry: [], exit: null, pair: false, pairCondition: null, context: [] })
    expect(cardLabCRule(undefined).entry).toEqual([])
  })
})

describe('cardLabCSegments', () => {
  it('marks tickers and thresholds', () => {
    const segs = cardLabCSegments("Buys back at Mon open if VIX doesn't gap > 10%", ['SPX', 'VIX'])
    expect(segs.filter(s => s.kind === 'ticker').map(s => s.text)).toEqual(['VIX'])
    expect(segs.filter(s => s.kind === 'num').map(s => s.text)).toEqual(['> 10%'])
    expect(segs.map(s => s.text).join('')).toBe("Buys back at Mon open if VIX doesn't gap > 10%")
  })
  it('keeps hyphenated words whole', () => {
    const segs = cardLabCSegments('IV-rank > 60 and 3 days before', [])
    expect(segs.filter(s => s.kind === 'num').map(s => s.text)).toEqual(['> 60', '3 days'])
  })
})

describe('evidence labels', () => {
  it('cardLabCDuration', () => {
    expect(cardLabCDuration('2d')).toBe('2 days')
    expect(cardLabCDuration('8h')).toBe('8 hours')
    expect(cardLabCDuration('1d')).toBe('1 day')
    expect(cardLabCDuration('0')).toBeNull()
    expect(cardLabCDuration('')).toBeNull()
  })
  it('cardLabCWindow rejects the store placeholder start = end', () => {
    expect(cardLabCWindow({ start: '2023-01-01', end: '2024-12-31' })).toEqual({ known: true, start: '2023-01-01', end: '2024-12-31', months: 24 })
    expect(cardLabCWindow({ start: '2026-11-02', end: '2026-11-02' }).known).toBe(false)
    expect(cardLabCWindow(undefined).known).toBe(false)
  })
  it('cardLabCWinLoss flags a win rate that disagrees with its counts', () => {
    expect(cardLabCWinLoss(58, 120, 70)).toMatchObject({ wins: 70, losses: 50, total: 120, consistent: true })
    const g = cardLabCWinLoss(65, 16, 10)
    expect(g.consistent).toBe(false)
    expect(g.countedPct).toBeCloseTo(62.5)
    expect(cardLabCWinLoss(null, 0, 0)).toMatchObject({ pct: null, total: null, wins: null, consistent: true })
  })
  it('automation and risk never default', () => {
    expect(cardLabCAutomation('semi_automated').label).toBe('Semi-automated')
    expect(cardLabCAutomation(undefined).id).toBe('unknown')
    expect(cardLabCRisk('high').filled).toBe(3)
    expect(cardLabCRisk(undefined)).toEqual({ id: 'unset', label: 'Not set', filled: 0 })
  })
})

describe('cardLabCStyle — from name and tags only', () => {
  it('names the archetype of each sample', async () => {
    const { cardLabCStyle } = await import('../utils/cardLabC')
    expect(cardLabCStyle('Mean Reversion BTC', ['btc', 'rsi', 'mean-reversion'], 'buy')).toEqual(['Mean reversion'])
    expect(cardLabCStyle('ETH/SOL Pair Reversion', ['pair', 'stat-arb', 'crypto'], 'buy')).toEqual(['Mean reversion', 'Pair trade', 'Stat-arb'])
    expect(cardLabCStyle('SPX Vol Crush Friday', ['options', 'volatility', 'weekly'], 'sell')).toEqual(['Short volatility', 'Options'])
    expect(cardLabCStyle('Gold Momentum Overlay', ['gold', 'macro', 'hedge'], 'buy')).toEqual(['Momentum', 'Macro', 'Hedge'])
    expect(cardLabCStyle('Earnings Drift TSLA', ['earnings', 'single-name'], 'buy')).toEqual(['Earnings event', 'Drift'])
    expect(cardLabCStyle('Untitled', [], null)).toEqual([])
  })
})
