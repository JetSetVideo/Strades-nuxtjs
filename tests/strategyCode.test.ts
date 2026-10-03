import { describe, expect, it } from 'vitest'
import type { Strategy } from '~/types/strategy'
import { strategyToCodeView, strategyToStrategyCode } from '~/utils/strategyCode'

function catalogStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 'strategy_001',
    name: 'Mean Reversion BTC',
    description: 'Buys BTC dips and sells rebounds.',
    creator_id: 'user_001',
    category: 'crypto',
    type: 'automated',
    status: 'active',
    risk_level: 'medium',
    target_assets: ['BTC'],
    indicators: ['RSI', 'SMA'],
    entry_conditions: [],
    exit_conditions: [],
    initial_capital: 10000,
    current_capital: 12000,
    total_return: 2000,
    total_return_percentage: 20,
    win_rate: 58,
    total_trades: 120,
    successful_trades: 70,
    average_trade_duration: '2d',
    max_drawdown: 12,
    sharpe_ratio: 1.2,
    backtest_period: { start: '2023-01-01', end: '2024-12-31' },
    performance_metrics: { annual_return: 18, volatility: 22, beta: 1, alpha: 0.5 },
    is_public: true,
    is_premium: false,
    price: 0,
    followers_count: 42,
    likes_count: 15,
    comments_count: 3,
    tags: ['btc'],
    created_at: '2023-01-01',
    updated_at: '2024-12-31',
    last_run: '2026-05-30',
    agent_id: 'avatar_user_001',
    ...overrides,
  }
}

describe('canonical strategy code', () => {
  it('names the catalog strategy, not the legacy codes file', () => {
    const view = strategyToCodeView(catalogStrategy())
    expect(view.name).toBe('Mean Reversion BTC')
    expect(view.assetFrom).toBe('BTC')
    expect(view.assetTo).toBe('USD')
    expect(view.allocation).toBeNull()
    expect(view.frequency).toBe('1D')
    expect(view.period).toEqual({ start: '2023-01-01', end: '2024-12-31' })
    expect(view.dataSources).toEqual(['RSI', 'SMA'])
    expect(view.conditions.map(c => c.indicator)).toEqual(['RSI', 'SMA'])
    expect(view.profiles).toEqual(['avatar_user_001'])
  })

  it('keeps the catalog owner on the strategy code used by complements', () => {
    const code = strategyToStrategyCode(catalogStrategy())
    expect(code.name).toBe('Mean Reversion BTC')
    expect(code.rights.owners).toEqual(['user_001'])
    expect(code.assets).toEqual({ entry: 'BTC', exit: 'USD' })
  })

  it('uses the second target as the exit asset when the catalog lists a pair', () => {
    const view = strategyToCodeView(catalogStrategy({
      id: 'strategy_002',
      name: 'ETH/SOL Pair Reversion',
      target_assets: ['ETH', 'SOL'],
      indicators: ['Z-Score'],
      average_trade_duration: '8h',
    }))
    expect(view.assetFrom).toBe('ETH')
    expect(view.assetTo).toBe('SOL')
    expect(view.frequency).toBe('1h')
  })
})
