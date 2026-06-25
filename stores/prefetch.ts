import { defineStore } from 'pinia'

export interface PreFetchState {
  latestNewsCoords: { lat: number, lng: number }
  prefetchedData: Record<string, any>
}

const ROUTE_DATA_MAP: Record<string, string[]> = {
  wallet: ['/data/core/wallets.json', '/data/core/wallet_history.json'],
  news: ['/news.json', '/data/social/posts.json'],
  prices: ['/core/assets.json'],
  strategies: ['/data/strategies/index.json'],
  chat: ['/data/chat/conversations.json', '/data/core/users.json'],
  agents: ['/data/agents/avatars.json', '/data/agents/marketplace.json'],
}

export const usePrefetchStore = defineStore('prefetch', {
  state: (): PreFetchState => ({
    latestNewsCoords: { lat: 40.7128, lng: -74.0060 }, // Default NYC
    prefetchedData: {}
  }),
  actions: {
    async prefetchRoute(routeName: string) {
      if (this.prefetchedData[routeName]) return
      const urls = ROUTE_DATA_MAP[routeName]
      if (!urls) return
      this.prefetchedData[routeName] = { timestamp: Date.now(), loading: true }
      await Promise.all(urls.map(url => fetch(url).catch(() => null)))
      this.prefetchedData[routeName].loading = false
    },
    updateLatestNewsCoords(lat: number, lng: number) {
      this.latestNewsCoords = { lat, lng }
    }
  }
})
