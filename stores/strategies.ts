import { defineStore } from 'pinia'

// Types for strategy management
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
  entry_conditions: Array<{
    indicator: string
    condition: string
    value: any
    timeframe: string
  }>
  exit_conditions: Array<{
    indicator: string
    condition: string
    value: any
    timeframe: string
  }>
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
  performance_metrics: {
    annual_return: number
    volatility: number
    beta: number
    alpha: number
  }
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
}

export interface StrategyAsset {
  id: string
  strategy_id: string
  asset_id: string
  allocation_percentage: number
  weight: number
  entry_rules: Array<{
    indicator: string
    condition: string
    value: any
    timeframe: string
  }>
  exit_rules: Array<{
    indicator: string
    condition: string
    value: any
    timeframe: string
  }>
  stop_loss_percentage: number
  take_profit_percentage: number
  max_position_size: number
  is_active: boolean
  performance_contribution: number
  created_at: string
  updated_at: string
}

export const useStrategiesStore = defineStore('strategies', {
  state: () => ({
    strategies: [] as Strategy[],
    strategyAssets: [] as StrategyAsset[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getStrategyById: (state) => (id: string) => {
      return state.strategies.find(strategy => strategy.id === id)
    },

    getStrategiesByCreator: (state) => (creatorId: string) => {
      return state.strategies.filter(strategy => strategy.creator_id === creatorId)
    },

    getStrategiesByCategory: (state) => (category: string) => {
      return state.strategies.filter(strategy => strategy.category === category)
    },

    getStrategiesByRiskLevel: (state) => (riskLevel: string) => {
      return state.strategies.filter(strategy => strategy.risk_level === riskLevel)
    },

    getPublicStrategies: (state) => {
      return state.strategies.filter(strategy => strategy.is_public)
    },

    getTopPerformingStrategies: (state) => {
      return [...state.strategies]
        .filter(strategy => strategy.status === 'active')
        .sort((a, b) => b.total_return_percentage - a.total_return_percentage)
        .slice(0, 10)
    },

    getStrategyAssets: (state) => (strategyId: string) => {
      return state.strategyAssets.filter(sa => sa.strategy_id === strategyId)
    },

    getMostFollowedStrategies: (state) => {
      return [...state.strategies]
        .sort((a, b) => b.followers_count - a.followers_count)
        .slice(0, 10)
    },

    /**
     * Up to 8 non-stopped strategies for the StrategyOrbitIcon widget.
     * Each dot is colored by the strategy's dominant asset class (category),
     * and dimmed if paused.
     */
    activeStrategiesForOrbit: (state) => {
      const CLASS_COLOR: Record<string, string> = {
        crypto:      '#F5A623',
        bitcoin:     '#F5A623',
        ethereum:    '#F5A623',
        stocks:      '#00ff88',
        stock:       '#00ff88',
        equity:      '#00ff88',
        fiat:        '#4A90E2',
        forex:       '#4A90E2',
        currency:    '#4A90E2',
        commodities: '#F8E71C',
        commodity:   '#F8E71C',
        gold:        '#F8E71C',
      }
      return state.strategies
        .filter(s => s.status !== 'stopped')
        .slice(0, 8)
        .map(s => ({
          id:     s.id,
          color:  CLASS_COLOR[s.category?.toLowerCase()] ?? '#aaaaaa',
          status: s.status,
          return_pct: s.total_return_percentage,
        }))
    },

    getRange: (state) => (key: keyof Strategy) => {
      if (state.strategies.length === 0) return { min: 0, max: 0 };
      
      const values = state.strategies.map(s => s[key]).filter(v => typeof v === 'number') as number[];
      if (values.length === 0) return { min: 0, max: 0 };

      return {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  },

  actions: {
    async fetchStrategies() {
      this.loading = true
      try {
        let strategiesData: Strategy[] = []
        try {
          strategiesData = await $fetch<Strategy[]>('/data/core/strategies.json')
        } catch {
          strategiesData = await $fetch<Strategy[]>('/data/strategies/index.json')
        }
        // Filter to only public when used by listings like Shop
        this.strategies = strategiesData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch strategies:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchStrategyAssets() {
      try {
        const strategyAssetsData = await $fetch<StrategyAsset[]>('/data/relationships/strategy_assets.json')
        this.strategyAssets = strategyAssetsData
      } catch (error) {
        console.error('Failed to fetch strategy assets:', error)
      }
    },

    async initializeStore() {
      await Promise.all([
        this.fetchStrategies(),
        this.fetchStrategyAssets()
      ])
    },

    createStrategy(strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'>) {
      const newStrategy: Strategy = {
        ...strategy,
        id: `strategy_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      this.strategies.push(newStrategy)
      return newStrategy
    },

    updateStrategy(strategyId: string, updates: Partial<Strategy>) {
      const strategy = this.strategies.find(s => s.id === strategyId)
      if (strategy) {
        Object.assign(strategy, updates)
        strategy.updated_at = new Date().toISOString()
      }
    },

    deleteStrategy(strategyId: string) {
      const index = this.strategies.findIndex(s => s.id === strategyId)
      if (index > -1) {
        this.strategies.splice(index, 1)
      }
    },

    addStrategyAsset(strategyAsset: StrategyAsset) {
      this.strategyAssets.push(strategyAsset)
    },

    updateStrategyAsset(assetId: string, updates: Partial<StrategyAsset>) {
      const strategyAsset = this.strategyAssets.find(sa => sa.id === assetId)
      if (strategyAsset) {
        Object.assign(strategyAsset, updates)
        strategyAsset.updated_at = new Date().toISOString()
      }
    },

    toggleStrategyStatus(strategyId: string) {
      const strategy = this.strategies.find(s => s.id === strategyId)
      if (strategy) {
        strategy.status = strategy.status === 'active' ? 'paused' : 'active'
        strategy.updated_at = new Date().toISOString()
      }
    }
  }
})
