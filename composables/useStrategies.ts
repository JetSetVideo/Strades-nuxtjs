import { ref } from 'vue'

export type StrategySummary = {
  id: string
  name: string
  description: string
  creator: string
  creationDate: string
  status: 'active' | 'paused' | 'stopped'
  category: string
  tags: string[]
  numberOfTrades: number
  monthlyGain: number
  monthlyDrawdown: number
  winRate: number
  totalProfit: number
  averageTradeDuration: number
  targetAssets: string[]
  trades?: Array<{ asset: string }>
}

export type StrategyCode = {
  id: string
  name: string
  assets: { entry: string; exit: string }
  period: { start: string; end: string }
  frequency: string
  conditions: any[]
  profiles: string[]
  parameters: Record<string, any>
  rights: { owners: string[]; editors: string[]; viewers: string[]; is_public: boolean }
}

export type StrategyRating = {
  risk: number
  complexity: string
  computationalCost: number
}

export type StrategyHistoryRow = { date: string; pnl: number; equity: number; tradesCount: number }
export type TradeRow = { date: string; asset: string; side: string; quantity: number; entry: number; exit: number; pnl: number }

export function useStrategies() {
  const strategies = ref<StrategySummary[]>([])
  const detailsCache = ref<Record<string, {
    code: StrategyCode
    rating: StrategyRating
    history: StrategyHistoryRow[]
    trades: TradeRow[]
  }>>({})

  async function fetchStrategies() {
    try {
      const data = await $fetch<StrategySummary[]>('/data/strategies/index.json')
      strategies.value = data
    } catch (error) {
      console.error('Failed to fetch strategies index:', error)
      strategies.value = []
    }
  }

  function parseCsv<T extends Record<string, any>>(csv: string, numberKeys: string[]): T[] {
    const lines = csv.trim().split(/\r?\n/)
    if (lines.length <= 1) return []
    if (!lines[0]) return []
    const headers = lines[0].split(',')
    return lines.slice(1).filter((ln) => ln.trim().length > 0).map(line => {
      const parts = line.split(',')
      const row: Record<string, any> = {}
      headers.forEach((h, i) => {
        const key = h
        const value: string = (i < parts.length ? parts[i] : '') as string
        row[key] = numberKeys.includes(key) ? Number(value) : value
      })
      return row as T
    })
  }

  async function fetchStrategyDetail(id: string) {
    if (detailsCache.value[id]) return detailsCache.value[id]
    try {
      const [code, rating, historyCsv, tradesCsv] = await Promise.all([
        $fetch<StrategyCode>(`/data/strategies/codes/${id}.json`),
        $fetch<StrategyRating>(`/data/strategies/ratings/${id}.json`).catch(() => ({ risk: 0, complexity: '0/10', computationalCost: 0 })),
        $fetch<string>(`/data/strategies/history/${id}-pnl.csv`, { responseType: 'text' as any }).catch(() => ''),
        $fetch<string>(`/data/strategies/trades/${id}.csv`, { responseType: 'text' as any }).catch(() => '')
      ])

      const history = historyCsv ? parseCsv<StrategyHistoryRow>(historyCsv, ['pnl', 'equity', 'tradesCount']) : []
      const trades = tradesCsv ? parseCsv<TradeRow>(tradesCsv, ['quantity', 'entry', 'exit', 'pnl']) : []

      const details = { code, rating, history, trades }
      detailsCache.value[id] = details
      return details
    } catch (error) {
      console.error('Failed to fetch strategy detail:', id, error)
      throw error
    }
  }

  async function createStrategy(summaryLike: Partial<StrategySummary> & { code?: Partial<StrategyCode> }) {
    const newId = `strategy_${Date.now()}`
    const safeName: string = (summaryLike.name ?? 'New Strategy') as string
    const safeDescription: string = (summaryLike.description ?? '') as string
    const safeCreator: string = String(summaryLike.creator ?? 'current_user')
    const safeCategory: string = (summaryLike.category ?? 'technical') as string
    const safeTags: string[] = Array.isArray(summaryLike.tags) ? (summaryLike.tags as string[]) : []
    const safeTargets: string[] = Array.isArray(summaryLike.targetAssets) ? (summaryLike.targetAssets as string[]) : []
    const safeCreationDate: string = String(new Date().toISOString().split('T')[0])
    const newSummary: StrategySummary = {
      id: newId,
      name: safeName,
      description: safeDescription,
      creator: safeCreator,
      creationDate: safeCreationDate,
      status: 'stopped',
      category: safeCategory,
      tags: safeTags,
      numberOfTrades: 0,
      monthlyGain: 0,
      monthlyDrawdown: 0,
      winRate: 0,
      totalProfit: 0,
      averageTradeDuration: 0,
      targetAssets: safeTargets
    }
    strategies.value.push(newSummary)

    // cache code if provided
    if (summaryLike.code) {
      const defaultCode: StrategyCode = {
        id: newId,
        name: newSummary.name,
        assets: { entry: 'BTC-USD', exit: 'USD' },
        period: { start: newSummary.creationDate, end: newSummary.creationDate },
        frequency: '1D',
        conditions: [],
        profiles: [],
        parameters: {},
        rights: { owners: ['current_user'], editors: [], viewers: [], is_public: false }
      }
      detailsCache.value[newId] = {
        code: { ...defaultCode, ...summaryLike.code, id: newId, name: newSummary.name },
        rating: { risk: 0, complexity: '0/10', computationalCost: 0 },
        history: [],
        trades: []
      }
    }
    return newSummary
  }

  async function updateStrategy(id: string, updates: Partial<StrategySummary>) {
    const index = strategies.value.findIndex(s => s.id === id)
    if (index !== -1) {
      const base = strategies.value[index] as StrategySummary
      const safe: StrategySummary = {
        ...base,
        id: base.id,
        name: (updates.name ?? base.name) as string,
        description: (updates.description ?? base.description) as string,
        creator: (updates.creator ?? base.creator) as string,
        creationDate: (updates.creationDate ?? base.creationDate) as string,
        status: (updates.status ?? base.status) as StrategySummary['status'],
        category: (updates.category ?? base.category) as string,
        tags: (updates.tags ?? base.tags) as string[],
        numberOfTrades: Number(updates.numberOfTrades ?? base.numberOfTrades),
        monthlyGain: Number(updates.monthlyGain ?? base.monthlyGain),
        monthlyDrawdown: Number(updates.monthlyDrawdown ?? base.monthlyDrawdown),
        winRate: Number(updates.winRate ?? base.winRate),
        totalProfit: Number(updates.totalProfit ?? base.totalProfit),
        averageTradeDuration: Number(updates.averageTradeDuration ?? base.averageTradeDuration),
        targetAssets: (updates.targetAssets ?? base.targetAssets) as string[],
        trades: (updates.trades ?? base.trades) as Array<{ asset: string }>
      }
      strategies.value[index] = safe
    }
  }

  async function deleteStrategy(id: string) {
    strategies.value = strategies.value.filter(s => s.id !== id)
    delete detailsCache.value[id]
  }

  async function toggleStrategyStatus(id: string) {
    const strategy = strategies.value.find(s => s.id === id)
    if (strategy) {
      const newStatus = strategy.status === 'active' ? 'paused' : 'active'
      await updateStrategy(id, { status: newStatus })
    }
  }

  async function backtestStrategy(id: string) {
    // demo: simulate delay and create toy history if absent
    await new Promise(resolve => setTimeout(resolve, 3000))
    if (!detailsCache.value[id]) return
    if (detailsCache.value[id]?.history.length === 0) {
      const base = 10000
      const history: StrategyHistoryRow[] = Array.from({ length: 30 }).map((_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
        pnl: i * 50,
        equity: base + i * 50,
        tradesCount: i
      }))
      detailsCache.value[id].history = history
      // Also update summary metrics
      const s = strategies.value.find(s => s.id === id)
      const last = history[history.length - 1]
      if (s && last) {
        s.totalProfit = last.pnl
        s.numberOfTrades = last.tradesCount
        s.monthlyGain = 5.0
        s.monthlyDrawdown = -2.0
        s.winRate = 65.0
        s.averageTradeDuration = 2.0
      }
      detailsCache.value[id].rating = { risk: 5, complexity: '3/10', computationalCost: 200 }
    }
  }

  async function generateComplementary(id: string) {
    const cached = detailsCache.value[id]
    const base = cached ? cached : await fetchStrategyDetail(id)
    const complementCode: StrategyCode = {
      ...base.code,
      id: '',
      name: base.code.name + ' - Complement',
      assets: { entry: base.code.assets.exit || 'USD', exit: base.code.assets.entry },
      conditions: base.code.conditions.map(c => ({ ...c, operator: c.operator === '>' ? '<=' : c.operator }))
    }
    const summary = await createStrategy({
      name: complementCode.name,
      description: 'Complementary strategy generated from ' + base.code.name,
      creator: 'current_user',
      category: 'technical',
      targetAssets: [complementCode.assets.entry],
      code: complementCode
    })
    return summary
  }

  async function generateOpposite(id: string) {
    const cached = detailsCache.value[id]
    const base = cached ? cached : await fetchStrategyDetail(id)
    const oppositeCode: StrategyCode = {
      ...base.code,
      id: '',
      name: base.code.name + ' - Opposite',
      conditions: base.code.conditions.map(c => ({
        ...c,
        operator: c.operator === '>' ? '<' : c.operator === '<' ? '>' : c.operator
      }))
    }
    const summary = await createStrategy({
      name: oppositeCode.name,
      description: 'Opposite strategy generated from ' + base.code.name,
      creator: 'current_user',
      category: 'technical',
      targetAssets: [oppositeCode.assets.entry],
      code: oppositeCode
    })
    return summary
  }

  async function deployStrategy(id: string) {
    await updateStrategy(id, { status: 'active' })
  }

  async function backtestAndDeploy(id: string) {
    await backtestStrategy(id)
    await updateStrategy(id, { status: 'active' })
  }

  return {
    strategies,
    fetchStrategies,
    fetchStrategyDetail,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleStrategyStatus,
    backtestStrategy,
    deployStrategy,
    backtestAndDeploy,
    generateComplementary,
    generateOpposite
  }
}