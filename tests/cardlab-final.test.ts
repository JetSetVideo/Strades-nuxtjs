/**
 * Card lab FINAL (lane combine): the production card's view model must be honest with `strategy` alone (Carousel
 * summary rows) and with the full catalog record; store fillers never become data; every honesty flag fires on the
 * sample that really contradicts itself and nowhere else.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cardLabFinalImpliedMonths, cardLabFinalObject,
  cardLabFinalConditions, cardLabFinalHoldText, cardLabFinalImpliedAnnual, cardLabFinalModel, cardLabFinalNum,
  cardLabFinalSharpeGap,
} from '~/utils/cardLabFinal'

const catalog = JSON.parse(readFileSync('public/data/core/strategies.json', 'utf8')) as Array<Record<string, any>>
const byId = Object.fromEntries(catalog.map(s => [s.id, s]))

/** Same shape as stores/strategies.ts strategyToSummary (what Carousel passes), built from a raw catalog row. */
function summary(s: Record<string, any>, sample = true) {
  return {
    sample, id: s.id, name: s.name, description: s.description, category: s.category, risk_level: s.risk_level,
    status: s.status, creator_id: s.creator_id, creator: s.creator || s.creator_id, creationDate: String(s.created_at).slice(0, 10),
    target_assets: s.target_assets, targetAssets: s.target_assets, total_return_percentage: s.total_return_percentage,
    monthlyGain: s.total_return_percentage, monthlyDrawdown: s.max_drawdown, win_rate: s.win_rate, winRate: s.win_rate,
    is_premium: s.is_premium, price: s.price, tags: s.tags, numberOfTrades: s.total_trades, totalProfit: s.total_return,
    sharpeRatio: s.sharpe_ratio, averageTradeDuration: Number(s.average_trade_duration) || 0,
  }
}

describe('cardLabFinalModel — full catalog record', () => {
  it('reads the five samples without defaults', () => {
    const m = cardLabFinalModel(summary(byId.strategy_001), byId.strategy_001)
    expect(m.sample).toBe(true)
    expect(m.style.key).toBe('reversion')
    expect(m.status.key).toBe('active')
    expect(m.automation.key).toBe('auto')
    expect(m.risk.key).toBe('medium')
    expect(m.assets).toEqual(['BTC'])
    expect(m.indicators).toEqual(['RSI', 'SMA'])
    expect(m.ret).toBe(20)
    expect(m.dd).toBe(12)
    expect(m.win).toMatchObject({ wins: 70, losses: 50, total: 120 })
    expect(m.holdRaw).toBe('2 d')
    expect(m.holdBucket).toBe('swing')
    expect(m.window).toMatchObject({ known: true, months: 24 })
    expect(m.rule.entry[0]).toMatchObject({ side: 'buy' })
    expect(m.rule.exit).toMatchObject({ side: 'sell' })
    expect(m.followers).toBe(42)
  })

  it.each([
    ['strategy_001', 'reversion'], ['strategy_002', 'pair'], ['strategy_003', 'vol'], ['strategy_004', 'momentum'], ['strategy_005', 'event'],
  ])('%s style glyph → %s', (id, key) => {
    expect(cardLabFinalModel(summary(byId[id]), byId[id]).style.key).toBe(key)
  })

  it('pair rule has two legs and a shared trigger; no exit stated', () => {
    const m = cardLabFinalModel(summary(byId.strategy_002), byId.strategy_002)
    expect(m.rule.pair).toBe(true)
    expect(m.rule.entry.map(l => l.side)).toEqual(['buy', 'sell'])
    expect(m.rule.pairCondition).toMatch(/2σ/)
    expect(m.rule.exit).toBeNull()
  })

  it('honesty flags fire exactly where the record contradicts itself', () => {
    const keys = (id: string) => cardLabFinalModel(summary(byId[id]), byId[id]).flags.map(f => f.key).sort()
    expect(keys('strategy_001')).toEqual(['annual', 'sharpe-gap'])        // 18 %/yr vs 9.5 % implied; Sharpe 1.20 > 18/22
    expect(keys('strategy_002')).toEqual(['beta-pair'])                    // 1.96 ≈ 28/14; but β 0.40 on a long/short pair
    expect(keys('strategy_003')).toEqual(['sample', 'sharpe-sign', 'win-loss']) // +0.42 vs −1.2 %/yr, n = 18, 72 % won but −1.5 %
    expect(keys('strategy_004')).toEqual(['sample', 'sharpe-gap', 'win']) // 10/16 = 62.5 % vs 65 %
    expect(keys('strategy_005')).toEqual(['sample', 'sharpe-gap'])        // needs an 18.8 % risk-free rate (43 % won: no win-loss)
    const win = cardLabFinalModel(summary(byId.strategy_004), byId.strategy_004).flags.find(f => f.key === 'win')!
    expect(win.long).toContain('10 of 16')
    const exp = (id: string) => cardLabFinalModel(summary(byId[id]), byId[id]).experimental
    expect(['strategy_001', 'strategy_002', 'strategy_003', 'strategy_004', 'strategy_005'].map(exp)).toEqual([false, false, true, false, true])
  })

  it('drops the store fillers: today→today window, all-zero performance metrics', () => {
    const today = new Date().toISOString().slice(0, 10)
    const f = { ...byId.strategy_002, backtest_period: { start: today, end: today }, performance_metrics: { annual_return: 0, volatility: 0, beta: 0, alpha: 0 } }
    const m = cardLabFinalModel(summary(f), f)
    expect(m.window.known).toBe(false)
    expect(m.perf).toEqual({ annual: null, vol: null, beta: null, alpha: null })
  })
})

describe('cardLabFinalModel — strategy (summary) only, as Carousel passes it', () => {
  it('shows what the summary has and nothing invented', () => {
    const m = cardLabFinalModel(summary(byId.strategy_004))
    expect(m.ret).toBe(4.1)
    expect(m.dd).toBe(2.1)
    expect(m.trades).toBe(16)
    expect(m.sharpeValue).toBe(1.74)
    expect(m.win).toMatchObject({ wins: null, frac: 0.65 })    // no counts → stated rate, no W/L
    expect(m.indicators).toEqual([])
    expect(m.holdRaw).toBeNull()                                  // averageTradeDuration is Number('12d') = 0 in the summary
    expect(m.automation.key).toBe('none')
    expect(m.followers).toBeNull()                                // never "👥 0"
    expect(m.capStart).toBeNull()
    expect(m.window.known).toBe(false)
    expect(m.flags.map(f => f.key)).toEqual(['sample'])
  })

  it('a new own strategy with zero trades shows no metrics at all (no +0.0 %, no Sharpe 0.00)', () => {
    const own = {
      sample: false, id: 'srv_1', name: 'My RSI idea', description: '', category: 'technical', risk_level: 'medium', status: 'stopped',
      creator: 'current_user', targetAssets: ['BTC'], total_return_percentage: 0, monthlyDrawdown: 0, win_rate: 0,
      numberOfTrades: 0, totalProfit: 0, sharpeRatio: 0, tags: [],
    }
    const m = cardLabFinalModel(own, null, { conditions: [{ indicator: 'RSI', operator: '<', value: 30, timeframe: '1D' }], dataSources: ['RSI'] })
    expect(m.sample).toBe(false)
    expect(m.hasRecord).toBe(false)
    expect([m.ret, m.dd, m.trades, m.sharpeValue, m.win, m.retUsd]).toEqual([null, null, null, null, null, null])
    expect(m.flags).toEqual([])
    expect(m.conditions).toEqual(['RSI < 30 · 1D'])
    expect(m.indicators).toEqual(['RSI'])
  })
})

describe('v2 additions (critics R1)', () => {
  it('prints the record win rate, flags the counts; implied record length; words not glyphs in flags', () => {
    const m4 = cardLabFinalModel(summary(byId.strategy_004), byId.strategy_004)
    expect(m4.winShown).toBe(65)
    expect(m4.flags.find(f => f.key === 'win')!.short).toBe('counts give 62.5%')
    const m2 = cardLabFinalModel(summary(byId.strategy_002), byId.strategy_002)
    expect(Math.round(m2.impliedMonths!)).toBe(3)
    expect(cardLabFinalModel(summary(byId.strategy_001), byId.strategy_001).impliedMonths).toBeNull() // window known
    expect(cardLabFinalImpliedMonths(-9.6, -22)).toBeCloseTo(4.87, 1)  // judge W3-3: 4.9 months
    expect(cardLabFinalImpliedMonths(7.1, -3)).toBeNull()
    for (const id of Object.keys(byId)) {
      for (const f of cardLabFinalModel(summary(byId[id]), byId[id]).flags) expect(f.short).not.toMatch(/[≠÷≈]/)
    }
    expect(cardLabFinalModel(summary(byId.strategy_003), byId.strategy_003).flags.find(f => f.key === 'sharpe-sign')!.short).toBe('Sharpe 0.42 yet annual −1.2%')
    expect(readFileSync('components/CardLab/Final.vue', 'utf8')).not.toMatch(/≈ \{\{/)
    {
    }
  })
  it('short rule objects', () => {
    expect(cardLabFinalObject('Buys BTC dips', 'Buys')).toBe('BTC dips')
    expect(cardLabFinalObject('long the laggard', 'long')).toBe('the laggard')
    expect(cardLabFinalObject('Sells weekly SPX vol on Fri close', 'Sells')).toBe('weekly SPX vol')
    expect(cardLabFinalObject('buys back at Mon open', 'buys')).toBe('back at Mon open')
    expect(cardLabFinalObject('Buys TSLA 3 days before earnings', 'Buys')).toBe('TSLA')
  })
})

describe('helpers', () => {
  it('numbers, holds, implied annual, Sharpe gap', () => {
    expect(cardLabFinalNum(undefined, '', 'x', '12', 3)).toBe(12)
    expect(cardLabFinalNum(null, true)).toBeNull()
    expect(cardLabFinalHoldText('8h')).toBe('8 h')
    expect(cardLabFinalHoldText('0')).toBeNull()
    expect(cardLabFinalHoldText('')).toBeNull()
    expect(cardLabFinalImpliedAnnual(20, 24)).toBeCloseTo(9.54, 1)
    expect(cardLabFinalSharpeGap(1.96, 28, 14)).toBeNull()
    expect(cardLabFinalSharpeGap(1.2, 18, 22)).toBeCloseTo(-8.4, 5)
    expect(cardLabFinalSharpeGap(0.42, -1.2, 38)).toBeNull() // sign case is flagged separately
    expect(cardLabFinalConditions(null)).toEqual([])
  })
})

describe('Final.vue — production contract', () => {
  const src = readFileSync('components/CardLab/Final.vue', 'utf8')
  it('has the Card/Strategy.vue API and no dishonest labels', () => {
    expect(src).toMatch(/select: \[\]; copy: \[\]; share: \[\]; view: \[\]; toggle: \[\]; delete: \[\]/)
    expect(src).toMatch(/selected\?: boolean/)
    expect(src).toContain('Use as template')
    expect(src).toContain('✎ Edit')
    expect(src).toContain('<ChatShareTo')
    expect(src).toContain('aria-expanded')
    expect(src).not.toMatch(/monthlyGain|monthlyDrawdown|subscriberCount|riskScore \?\?|equity_preview|StrategyWealthFlow/)
  })
})
