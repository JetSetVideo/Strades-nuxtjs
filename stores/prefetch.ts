import { defineStore } from 'pinia'

export interface PreFetchState {
  latestNewsCoords: { lat: number, lng: number }
  prefetchedData: Record<string, any>
}

export const usePrefetchStore = defineStore('prefetch', {
  state: (): PreFetchState => ({
    latestNewsCoords: { lat: 40.7128, lng: -74.0060 }, // Default NYC
    prefetchedData: {}
  }),
  actions: {
    // Simulated hover intent
    async prefetchRoute(routeName: string) {
      if (this.prefetchedData[routeName]) return // Already cached
      
      // E.g., hover over wallet -> fetch wallet JSON
      // Simulate network request
      console.log(`Pre-fetching data for route: ${routeName}...`)
      this.prefetchedData[routeName] = { timestamp: Date.now() }
    },
    updateLatestNewsCoords(lat: number, lng: number) {
      this.latestNewsCoords = { lat, lng }
    }
  }
})
