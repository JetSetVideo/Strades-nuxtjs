import { ref } from 'vue'

export interface StrategyComposable {
  id?: string
  name: string
  description: string
  creator: string
  creationDate: string
  lastModifiedDate: string
  isRunning?: boolean
  status?: 'active' | 'paused' | 'stopped'
  dataSources: string[]
  users: string[]
  period: { start: Date | null; end: Date | null }
  blocks: any[]
  riskRating?: number
  complexityRating?: string
  numberOfTrades?: number
  trades?: any[]
  monthlyGain?: number
  monthlyDrawdown?: number
  totalProfit?: number
  winRate?: number
  averageTradeDuration?: number
}

export function useStrategies() {
  const strategies = ref<Strategy[]>([])

  async function fetchStrategies() {
    // Import all JSON files from the data/strategies folder
    const strategyFiles = import.meta.glob('/data/strategies/*.json')

    const strategyPromises = []
    for (const path in strategyFiles) {
      strategyPromises.push(strategyFiles[path]())
    }

    const strategyModules = await Promise.all(strategyPromises)
    strategies.value = strategyModules.map((module, index) => ({
      id: `strategy${index + 1}`,
      ...module.default
    }))
  }

  async function createStrategy(strategyData: Partial<Strategy>) {
    const newStrategy: Strategy = {
      id: `strategy${strategies.value.length + 1}`,
      name: strategyData.name || '',
      description: strategyData.description || '',
      creator: 'Current User', // In a real app, this would come from auth
      creationDate: new Date().toISOString().split('T')[0],
      lastModifiedDate: new Date().toISOString().split('T')[0],
      isRunning: false,
      status: 'stopped',
      dataSources: strategyData.dataSources || [],
      users: strategyData.users || [],
      period: strategyData.period || { start: null, end: null },
      blocks: strategyData.blocks || [],
      riskRating: strategyData.riskRating || 0,
      complexityRating: strategyData.complexityRating || '0/10',
      // Initialize performance metrics
      numberOfTrades: 0,
      trades: [],
      monthlyGain: 0,
      monthlyDrawdown: 0,
      totalProfit: 0,
      winRate: 0,
      averageTradeDuration: 0,
    }

    // In development mode, add to local state
    strategies.value.push(newStrategy)

    // In production, this would save to database
    console.log('Created strategy:', newStrategy)

    return newStrategy
  }

  async function updateStrategy(id: string, updates: Partial<Strategy>) {
    const index = strategies.value.findIndex(s => s.id === id)
    if (index !== -1) {
      strategies.value[index] = {
        ...strategies.value[index],
        ...updates,
        lastModifiedDate: new Date().toISOString().split('T')[0]
      }
    }
  }

  async function deleteStrategy(id: string) {
    strategies.value = strategies.value.filter(s => s.id !== id)
  }

  async function toggleStrategyStatus(id: string) {
    const strategy = strategies.value.find(s => s.id === id)
    if (strategy) {
      const newStatus = strategy.status === 'active' ? 'paused' : 'active'
      await updateStrategy(id, {
        status: newStatus,
        isRunning: newStatus === 'active'
      })
    }
  }

  return {
    strategies,
    fetchStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleStrategyStatus,
  }
}