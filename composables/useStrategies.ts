import { ref } from 'vue'

export function useStrategies() {
  const strategies = ref([])

  async function fetchStrategies() {
    // Import all JSON files from the data/strategies folder
    const strategyFiles = import.meta.glob('@/data/strategies/*.json')

    const strategyPromises = []
    for (const path in strategyFiles) {
      strategyPromises.push(strategyFiles[path]())
    }

    const strategyModules = await Promise.all(strategyPromises)
    strategies.value = strategyModules.map(module => module.default)
  }

  return {
    strategies,
    fetchStrategies,
  }
}