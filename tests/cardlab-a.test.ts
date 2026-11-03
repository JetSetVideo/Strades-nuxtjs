import { describe, expect, it } from 'vitest'
import {
  cardLabADiverging, cardLabAHold, cardLabAModel, cardLabARisk, cardLabAStatus, cardLabAStyle, cardLabAWinCheck, cardLabAWindowKnown,
} from '~/utils/cardLabA'

const base = {
  name: 'Mean Reversion BTC', description: 'Buys BTC dips and sells rebounds.', creator_id: 'user_001', category: 'crypto',
  type: 'automated', status: 'active', risk_level: 'medium', target_assets: ['BTC'], indicators: ['RSI', 'SMA'],
  initial_capital: 10000, current_capital: 12000, total_return: 2000, total_return_percentage: 20, win_rate: 58,
  total_trades: 120, successful_trades: 70, average_trade_duration: '2d', max_drawdown: 12, sharpe_ratio: 1.2,
  backtest_period: { start: '2023-01-01', end: '2024-12-31' },
  performance_metrics: { annual_return: 18, volatility: 22, beta: 1, alpha: 0.5 },
  is_public: true, is_premium: false, price: 0, followers_count: 42, likes_count: 15, comments_count: 3,
  tags: ['btc', 'rsi', 'mean-reversion'], agent_id: 'avatar_user_001', created_at: '2023-01-01', last_run: '2026-05-30',
}

describe('cardLabA honesty', () => {
  it('prints the backtest window only when it is a real range (store fills start === end = today)', () => {
    expect(cardLabAWindowKnown({ start: '2023-01-01', end: '2024-12-31' })).toBe(true)
    expect(cardLabAWindowKnown({ start: '2026-11-02', end: '2026-11-02' })).toBe(false)
    expect(cardLabAWindowKnown(undefined)).toBe(false)
    const m = cardLabAModel({ ...base, backtest_period: { start: '2026-11-02', end: '2026-11-02' } })
    expect(m.ret.periodKnown).toBe(false)
    expect(m.ret.period).toBe('no backtest dates')
    expect(cardLabAModel(base).ret.period).toContain('2023')
  })

  it('maps catalog risk/status/automation words, no 1–10 default', () => {
    expect(cardLabARisk('high')).toMatchObject({ level: 3, label: 'HIGH' })
    expect(cardLabARisk(undefined)).toMatchObject({ level: 0, label: '—' })
    expect(cardLabAStatus('paused').label).toBe('PAUSED')
    expect(cardLabAModel({ ...base, type: 'semi_automated' }).automation.label).toBe('SEMI-AUTO')
  })

  it('reads followers/likes/comments from the catalog fields', () => {
    expect(cardLabAModel(base).social).toEqual({ followers: '42', likes: '15', comments: '3' })
  })

  it('flags a win rate that disagrees with wins/trades, and small samples', () => {
    expect(cardLabAWinCheck(65, 10, 16)).toMatch(/62\.5/)
    expect(cardLabAWinCheck(58, 70, 120)).toBeNull()
    expect(cardLabAModel({ ...base, total_trades: 16, successful_trades: 10 }).smallSample).toBe(true)
    expect(cardLabAModel(base).smallSample).toBe(false)
  })

  it('names the style from tags/text and never falls back to a catch-all', () => {
    expect(cardLabAStyle(base)).toBe('MEAN REVERSION')
    // "high intraday volatility" in a mean-reversion description must not make it a vol strategy
    expect(cardLabAStyle({ ...base, description: 'Buys BTC dips. Works best with high intraday volatility.' })).toBe('MEAN REVERSION')
    expect(cardLabAStyle({ name: 'ETH/SOL Pair Reversion', tags: ['pair', 'stat-arb'] })).toBe('PAIR TRADE · STAT-ARB')
    expect(cardLabAStyle({ name: 'SPX Vol Crush Friday', description: 'Sells weekly SPX vol', tags: ['options', 'volatility'] })).toBe('SHORT VOLATILITY')
    expect(cardLabAStyle({ name: 'Gold Momentum Overlay', tags: ['gold', 'macro'] })).toBe('MACRO MOMENTUM')
    expect(cardLabAStyle({ name: 'Earnings Drift TSLA', tags: ['earnings'] })).toBe('EVENT DRIFT · EARNINGS')
    expect(cardLabAStyle({ name: 'X', tags: ['foo'] })).toBeNull()
  })

  it('treats all-zero performance metrics as missing (store filler)', () => {
    const m = cardLabAModel({ ...base, performance_metrics: { annual_return: 0, volatility: 0, beta: 0, alpha: 0 } })
    expect(m.cells.find(c => c.key === 'vol')!.value).toBe('—')
  })

  it('diverging bar is centred on zero and clamps at the scale', () => {
    expect(cardLabADiverging(20, 25)).toMatchObject({ fill: 0.4, zero: 0.5, tone: 'up' })
    expect(cardLabADiverging(-50, 25)).toMatchObject({ fill: 0.5, tone: 'down' })
    expect(cardLabAHold('8h')).toBe('8 h')
    expect(cardLabAHold('')).toBe('—')
  })
})
