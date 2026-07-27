import { defineStore } from 'pinia'
import type { Strategy, StrategyAsset, StrategySummary } from '~/types/strategy'

export type { Strategy, StrategyAsset, StrategySummary } from '~/types/strategy'

export interface StrategyCode {
  id: string
  name: string
  assets: { entry: string; exit: string }
  period: { start: string; end: string }
  frequency: string
  conditions: Array<Record<string, unknown> & { operator?: string }>
  profiles: string[]
  parameters: Record<string, unknown>
  rights: { owners: string[]; editors: string[]; viewers: string[]; is_public: boolean }
}

export interface StrategyRating {
  risk: number
  complexity: string
  computationalCost: number
}

export interface StrategyHistoryRow {
  date: string
  pnl: number
  equity: number
  tradesCount: number
}

export interface TradeRow {
  date: string
  asset: string
  side: string
  quantity: number
  entry: number
  exit: number
  pnl: number
}

export interface StrategyDetails {
  code: StrategyCode
  rating: StrategyRating
  history: StrategyHistoryRow[]
  trades: TradeRow[]
}

/** Normalize loose index.json rows into the canonical Strategy shape. */
function normalizeStrategy(raw: Record<string, unknown>): Strategy {
  const now = new Date().toISOString()
  const status = (raw.status as Strategy['status']) || 'stopped'
  const risk = (raw.risk_level as Strategy['risk_level'])
    || (typeof raw.riskScore === 'number'
      ? (raw.riskScore as number) >= 7 ? 'high' : (raw.riskScore as number) >= 4 ? 'medium' : 'low'
      : 'medium')

  return {
    id: String(raw.id ?? `strategy_${Date.now()}`),
    name: String(raw.name ?? 'Untitled'),
    description: String(raw.description ?? ''),
    creator_id: String(raw.creator_id ?? raw.creator ?? 'unknown'),
    category: String(raw.category ?? 'technical'),
    type: (raw.type as Strategy['type']) || 'automated',
    status: status === 'active' || status === 'paused' || status === 'stopped' || status === 'backtesting'
      ? status
      : 'stopped',
    risk_level: risk,
    target_assets: (raw.target_assets as string[])
      || (raw.targetAssets as string[])
      || [],
    indicators: (raw.indicators as string[]) || [],
    entry_conditions: (raw.entry_conditions as Strategy['entry_conditions']) || [],
    exit_conditions: (raw.exit_conditions as Strategy['exit_conditions']) || [],
    initial_capital: Number(raw.initial_capital ?? 10000),
    current_capital: Number(raw.current_capital ?? raw.initial_capital ?? 10000),
    total_return: Number(raw.total_return ?? raw.totalProfit ?? 0),
    total_return_percentage: Number(
      raw.total_return_percentage ?? raw.monthlyGain ?? 0
    ),
    win_rate: Number(raw.win_rate ?? raw.winRate ?? 0),
    total_trades: Number(raw.total_trades ?? raw.numberOfTrades ?? 0),
    successful_trades: Number(raw.successful_trades ?? 0),
    average_trade_duration: String(raw.average_trade_duration ?? raw.averageTradeDuration ?? '0'),
    max_drawdown: Number(raw.max_drawdown ?? raw.monthlyDrawdown ?? 0),
    sharpe_ratio: Number(raw.sharpe_ratio ?? raw.sharpeRatio ?? 0),
    backtest_period: (raw.backtest_period as Strategy['backtest_period']) || {
      start: String(raw.creationDate ?? now.slice(0, 10)),
      end: String(raw.creationDate ?? now.slice(0, 10)),
    },
    performance_metrics: (raw.performance_metrics as Strategy['performance_metrics']) || {
      annual_return: 0,
      volatility: 0,
      beta: 0,
      alpha: 0,
    },
    is_public: Boolean(raw.is_public ?? true),
    is_premium: Boolean(raw.is_premium ?? false),
    price: Number(raw.price ?? 0),
    followers_count: Number(raw.followers_count ?? raw.subscriberCount ?? 0),
    likes_count: Number(raw.likes_count ?? 0),
    comments_count: Number(raw.comments_count ?? 0),
    tags: (raw.tags as string[]) || [],
    created_at: String(raw.created_at ?? raw.creationDate ?? now),
    updated_at: String(raw.updated_at ?? now),
    last_run: String(raw.last_run ?? now),
    creator: raw.creator as string | undefined,
    monthlyGain: raw.monthlyGain as number | undefined,
  }
}

/** UI-friendly summary derived from canonical Strategy. */
export function strategyToSummary(s: Strategy): StrategySummary & {
  creationDate: string
  numberOfTrades: number
  monthlyGain: number
  monthlyDrawdown: number
  winRate: number
  totalProfit: number
  averageTradeDuration: number
  targetAssets: string[]
  creator: string
  trades?: Array<{ asset: string }>
} {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    risk_level: s.risk_level,
    status: s.status,
    creator_id: s.creator_id,
    creator: s.creator || s.creator_id,
    creationDate: s.created_at.slice(0, 10),
    target_assets: s.target_assets,
    targetAssets: s.target_assets,
    total_return_percentage: s.total_return_percentage,
    monthlyGain: s.monthlyGain ?? s.total_return_percentage,
    monthlyDrawdown: s.max_drawdown,
    win_rate: s.win_rate,
    winRate: s.win_rate,
    is_premium: s.is_premium,
    price: s.price,
    tags: s.tags,
    numberOfTrades: s.total_trades,
    totalProfit: s.total_return,
    averageTradeDuration: Number(s.average_trade_duration) || 0,
    trades: s.target_assets.map(asset => ({ asset })),
  }
}

function parseCsv<T extends Record<string, unknown>>(csv: string, numberKeys: string[]): T[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length <= 1 || !lines[0]) return []
  const headers = lines[0].split(',')
  return lines.slice(1).filter(ln => ln.trim().length > 0).map(line => {
    const parts = line.split(',')
    const row: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      const value = (i < parts.length ? parts[i] : '') as string
      row[h] = numberKeys.includes(h) ? Number(value) : value
    })
    return row as T
  })
}

export const useStrategiesStore = defineStore('strategies', {
  state: () => ({
    strategies: [] as Strategy[],
    strategyAssets: [] as StrategyAsset[],
    detailsCache: {} as Record<string, StrategyDetails>,
    loading: false,
    error: null as Error | null,
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

    /** Summaries for carousel / marketplace UIs that expect the index.json shape. */
    strategySummaries: (state) => state.strategies.map(strategyToSummary),

    activeStrategiesForOrbit: (state) => {
      const CLASS_COLOR: Record<string, string> = {
        crypto: '#F5A623',
        bitcoin: '#F5A623',
        ethereum: '#F5A623',
        stocks: '#00ff88',
        stock: '#00ff88',
        equity: '#00ff88',
        fiat: '#4A90E2',
        forex: '#4A90E2',
        currency: '#4A90E2',
        commodities: '#F8E71C',
        commodity: '#F8E71C',
        gold: '#F8E71C',
        technical: '#00aaff',
      }
      return state.strategies
        .filter(s => s.status !== 'stopped')
        .slice(0, 8)
        .map(s => ({
          id: s.id,
          color: CLASS_COLOR[s.category?.toLowerCase()] ?? '#aaaaaa',
          status: s.status,
          return_pct: s.total_return_percentage,
        }))
    },

    getRange: (state) => (key: keyof Strategy) => {
      if (state.strategies.length === 0) return { min: 0, max: 0 }
      const values = state.strategies.map(s => s[key]).filter(v => typeof v === 'number') as number[]
      if (values.length === 0) return { min: 0, max: 0 }
      return { min: Math.min(...values), max: Math.max(...values) }
    },
  },

  actions: {
    async fetchStrategies() {
      this.loading = true
      try {
        let raw: unknown[] = []
        try {
          raw = await $fetch<unknown[]>('/data/core/strategies.json')
        } catch {
          raw = await $fetch<unknown[]>('/data/strategies/index.json')
        }
        this.strategies = (raw as Record<string, unknown>[]).map(normalizeStrategy)
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
        this.fetchStrategyAssets(),
      ])
    },

    async fetchStrategyDetail(id: string): Promise<StrategyDetails> {
      if (this.detailsCache[id]) return this.detailsCache[id]
      try {
        const [code, rating, historyCsv, tradesCsv] = await Promise.all([
          $fetch<StrategyCode>(`/data/strategies/codes/${id}.json`),
          $fetch<StrategyRating>(`/data/strategies/ratings/${id}.json`).catch(
            () => ({ risk: 0, complexity: '0/10', computationalCost: 0 })
          ),
          $fetch<string>(`/data/strategies/history/${id}-pnl.csv`, {
            responseType: 'text',
          }).catch(() => ''),
          $fetch<string>(`/data/strategies/trades/${id}.csv`, {
            responseType: 'text',
          }).catch(() => ''),
        ])

        const history = historyCsv
          ? parseCsv<StrategyHistoryRow>(historyCsv, ['pnl', 'equity', 'tradesCount'])
          : []
        const trades = tradesCsv
          ? parseCsv<TradeRow>(tradesCsv, ['quantity', 'entry', 'exit', 'pnl'])
          : []

        const details = { code, rating, history, trades }
        this.detailsCache[id] = details
        return details
      } catch (error) {
        console.error('Failed to fetch strategy detail:', id, error)
        throw error
      }
    },

    createStrategy(input: Partial<Strategy> & { code?: Partial<StrategyCode>; creator?: string; targetAssets?: string[] }) {
      const now = new Date().toISOString()
      const newId = `strategy_${Date.now()}`
      const newStrategy = normalizeStrategy({
        ...input,
        id: newId,
        creator_id: input.creator_id ?? input.creator ?? 'current_user',
        target_assets: input.target_assets ?? input.targetAssets ?? [],
        status: input.status ?? 'stopped',
        created_at: now,
        updated_at: now,
      })
      this.strategies.push(newStrategy)

      if (input.code) {
        const defaultCode: StrategyCode = {
          id: newId,
          name: newStrategy.name,
          assets: { entry: 'BTC-USD', exit: 'USD' },
          period: { start: now.slice(0, 10), end: now.slice(0, 10) },
          frequency: '1D',
          conditions: [],
          profiles: [],
          parameters: {},
          rights: { owners: ['current_user'], editors: [], viewers: [], is_public: false },
        }
        this.detailsCache[newId] = {
          code: { ...defaultCode, ...input.code, id: newId, name: newStrategy.name },
          rating: { risk: 0, complexity: '0/10', computationalCost: 0 },
          history: [],
          trades: [],
        }
      }

      return strategyToSummary(newStrategy)
    },

    updateStrategy(strategyId: string, updates: Partial<Strategy> & Record<string, unknown>) {
      const strategy = this.strategies.find(s => s.id === strategyId)
      if (!strategy) return

      const mapped: Partial<Strategy> = { ...updates }
      if (updates.creator !== undefined) mapped.creator_id = String(updates.creator)
      if (updates.targetAssets !== undefined) mapped.target_assets = updates.targetAssets as string[]
      if (updates.monthlyGain !== undefined) {
        mapped.monthlyGain = Number(updates.monthlyGain)
        mapped.total_return_percentage = Number(updates.monthlyGain)
      }
      if (updates.winRate !== undefined) mapped.win_rate = Number(updates.winRate)
      if (updates.numberOfTrades !== undefined) mapped.total_trades = Number(updates.numberOfTrades)
      if (updates.totalProfit !== undefined) mapped.total_return = Number(updates.totalProfit)
      if (updates.monthlyDrawdown !== undefined) mapped.max_drawdown = Number(updates.monthlyDrawdown)
      if (updates.averageTradeDuration !== undefined) {
        mapped.average_trade_duration = String(updates.averageTradeDuration)
      }
      if (updates.creationDate !== undefined) {
        mapped.created_at = String(updates.creationDate)
      }

      Object.assign(strategy, mapped, { updated_at: new Date().toISOString() })
    },

    deleteStrategy(strategyId: string) {
      this.strategies = this.strategies.filter(s => s.id !== strategyId)
      delete this.detailsCache[strategyId]
    },

    toggleStrategyStatus(strategyId: string) {
      const strategy = this.strategies.find(s => s.id === strategyId)
      if (strategy) {
        strategy.status = strategy.status === 'active' ? 'paused' : 'active'
        strategy.updated_at = new Date().toISOString()
      }
    },

    async backtestStrategy(id: string) {
      await new Promise(resolve => setTimeout(resolve, 300))
      if (!this.detailsCache[id]) {
        try {
          await this.fetchStrategyDetail(id)
        } catch {
          this.detailsCache[id] = {
            code: {
              id,
              name: this.getStrategyById(id)?.name ?? id,
              assets: { entry: 'BTC', exit: 'USD' },
              period: { start: '2024-01-01', end: '2024-12-31' },
              frequency: '1D',
              conditions: [],
              profiles: [],
              parameters: {},
              rights: { owners: [], editors: [], viewers: [], is_public: true },
            },
            rating: { risk: 5, complexity: '3/10', computationalCost: 200 },
            history: [],
            trades: [],
          }
        }
      }
      const cached = this.detailsCache[id]
      if (!cached) return
      if (cached.history.length === 0) {
        const base = 10000
        cached.history = Array.from({ length: 30 }).map((_, i) => ({
          date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
          pnl: i * 50,
          equity: base + i * 50,
          tradesCount: i,
        }))
        const s = this.strategies.find(x => x.id === id)
        const last = cached.history[cached.history.length - 1]
        if (s && last) {
          s.total_return = last.pnl
          s.total_trades = last.tradesCount
          s.total_return_percentage = 5.0
          s.monthlyGain = 5.0
          s.max_drawdown = -2.0
          s.win_rate = 65.0
          s.average_trade_duration = '2'
        }
        cached.rating = { risk: 5, complexity: '3/10', computationalCost: 200 }
      }
    },

    async deployStrategy(id: string) {
      this.updateStrategy(id, { status: 'active' })
    },

    async backtestAndDeploy(id: string) {
      await this.backtestStrategy(id)
      await this.deployStrategy(id)
    },

    async generateComplementary(id: string) {
      const base = this.detailsCache[id] ?? await this.fetchStrategyDetail(id)
      const complementCode: StrategyCode = {
        ...base.code,
        id: '',
        name: base.code.name + ' - Complement',
        assets: { entry: base.code.assets.exit || 'USD', exit: base.code.assets.entry },
        conditions: base.code.conditions.map(c => ({
          ...c,
          operator: c.operator === '>' ? '<=' : c.operator,
        })),
      }
      return this.createStrategy({
        name: complementCode.name,
        description: 'Complementary strategy generated from ' + base.code.name,
        creator: 'current_user',
        category: 'technical',
        targetAssets: [complementCode.assets.entry],
        code: complementCode,
      })
    },

    async generateOpposite(id: string) {
      const base = this.detailsCache[id] ?? await this.fetchStrategyDetail(id)
      const oppositeCode: StrategyCode = {
        ...base.code,
        id: '',
        name: base.code.name + ' - Opposite',
        conditions: base.code.conditions.map(c => ({
          ...c,
          operator: c.operator === '>' ? '<' : c.operator === '<' ? '>' : c.operator,
        })),
      }
      return this.createStrategy({
        name: oppositeCode.name,
        description: 'Opposite strategy generated from ' + base.code.name,
        creator: 'current_user',
        category: 'technical',
        targetAssets: [oppositeCode.assets.entry],
        code: oppositeCode,
      })
    },

    createStrategyAsset(strategyAsset: Omit<StrategyAsset, 'id' | 'created_at' | 'updated_at'>) {
      const now = new Date().toISOString()
      const newAsset: StrategyAsset = {
        ...strategyAsset,
        id: `sa_${Date.now()}`,
        created_at: now,
        updated_at: now,
      }
      this.strategyAssets.push(newAsset)
      return newAsset
    },

    updateStrategyAsset(assetId: string, updates: Partial<StrategyAsset>) {
      const strategyAsset = this.strategyAssets.find(sa => sa.id === assetId)
      if (strategyAsset) {
        Object.assign(strategyAsset, updates)
        strategyAsset.updated_at = new Date().toISOString()
      }
    },
  },
})
