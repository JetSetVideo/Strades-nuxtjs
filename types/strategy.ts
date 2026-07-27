/** Canonical strategy domain types — single source of truth. */

export interface StrategyCondition {
  indicator: string
  condition: string
  value: string | number | boolean
  timeframe: string
}

export interface StrategyPerformanceMetrics {
  annual_return: number
  volatility: number
  beta: number
  alpha: number
}

export interface Strategy {
  id: string
  name: string
  description: string
  creator_id: string
  category: string
  type: 'automated' | 'manual'
  status: 'active' | 'paused' | 'stopped' | 'backtesting'
  risk_level: 'low' | 'medium' | 'high'
  target_assets: string[]
  indicators: string[]
  entry_conditions: StrategyCondition[]
  exit_conditions: StrategyCondition[]
  initial_capital: number
  current_capital: number
  total_return: number
  total_return_percentage: number
  win_rate: number
  total_trades: number
  successful_trades: number
  average_trade_duration: string
  max_drawdown: number
  sharpe_ratio: number
  backtest_period: {
    start: string
    end: string
  }
  performance_metrics: StrategyPerformanceMetrics
  is_public: boolean
  is_premium: boolean
  price: number
  followers_count: number
  likes_count: number
  comments_count: number
  tags: string[]
  created_at: string
  updated_at: string
  last_run: string
  /** Optional code payload for visualizer / CodeView */
  code?: Record<string, unknown> | string
  monthlyGain?: number
  creator?: string
}

export interface StrategyAsset {
  id: string
  strategy_id: string
  asset_id: string
  allocation_percentage: number
  weight: number
  entry_rules: StrategyCondition[]
  exit_rules: StrategyCondition[]
  stop_loss_percentage: number
  take_profit_percentage: number
  max_position_size: number
  is_active: boolean
  performance_contribution: number
  created_at: string
  updated_at: string
}

/** Lightweight list row used by marketplace / carousel UIs. */
export interface StrategySummary {
  id: string
  name: string
  description: string
  category: string
  risk_level: 'low' | 'medium' | 'high'
  status: Strategy['status']
  creator_id?: string
  creator?: string
  target_assets?: string[]
  total_return_percentage?: number
  monthlyGain?: number
  win_rate?: number
  is_premium?: boolean
  price?: number
  tags?: string[]
}
