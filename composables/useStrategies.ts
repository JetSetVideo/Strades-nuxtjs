/**
 * useStrategies — thin facade over the Pinia strategies store.
 * All strategy data lives in stores/strategies.ts; this composable
 * exposes a summary-shaped reactive list for legacy page consumers.
 */
import { computed } from 'vue'
import {
  useStrategiesStore,
  strategyToSummary,
} from '~/stores/strategies'

export function useStrategies() {
  const store = useStrategiesStore()

  const strategies = computed({
    get: () => store.strategySummaries,
    set: () => {
      /* read-only view; mutations go through store actions */
    },
  })

  return {
    strategies,
    fetchStrategies: () => store.fetchStrategies(),
    fetchStrategyDetail: (id: string) => store.fetchStrategyDetail(id),
    createStrategy: store.createStrategy.bind(store),
    updateStrategy: (id: string, updates: Record<string, unknown>) => store.updateStrategy(id, updates),
    deleteStrategy: (id: string) => store.deleteStrategy(id),
    toggleStrategyStatus: (id: string) => store.toggleStrategyStatus(id),
    backtestStrategy: (id: string) => store.backtestStrategy(id),
    deployStrategy: (id: string) => store.deployStrategy(id),
    backtestAndDeploy: (id: string) => store.backtestAndDeploy(id),
    generateComplementary: (id: string) => store.generateComplementary(id),
    generateOpposite: (id: string) => store.generateOpposite(id),
    getStrategyById: (id: string) => {
      const s = store.getStrategyById(id)
      return s ? strategyToSummary(s) : undefined
    },
  }
}
