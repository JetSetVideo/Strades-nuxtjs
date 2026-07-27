import { defineStore } from 'pinia'

export interface PreFetchState {
  latestNewsCoords: { lat: number; lng: number }
  /** Cached JSON bodies keyed by route name — Structure.md predictive prefetch. */
  prefetchedData: Record<string, { timestamp: number; loading: boolean; bodies: Record<string, unknown> }>
}

const ROUTE_DATA_MAP: Record<string, string[]> = {
  wallet: ['/data/core/wallets.json', '/data/core/wallet_history.json'],
  news: ['/news.json', '/data/social/posts.json'],
  prices: ['/core/assets.json'],
  strategies: ['/data/strategies/index.json', '/data/core/strategies.json'],
  chat: ['/data/chat/conversations.json', '/data/core/users.json'],
  agents: ['/data/agents/avatars.json', '/data/agents/marketplace.json'],
}

export const usePrefetchStore = defineStore('prefetch', {
  state: (): PreFetchState => ({
    latestNewsCoords: { lat: 40.7128, lng: -74.0060 },
    prefetchedData: {},
  }),
  getters: {
    getPrefetched: (state) => (routeName: string, url: string) => {
      return state.prefetchedData[routeName]?.bodies[url]
    },
  },
  actions: {
    async prefetchRoute(routeName: string) {
      if (this.prefetchedData[routeName]?.bodies
        && Object.keys(this.prefetchedData[routeName].bodies).length > 0) {
        return
      }
      const urls = ROUTE_DATA_MAP[routeName]
      if (!urls) return

      this.prefetchedData[routeName] = {
        timestamp: Date.now(),
        loading: true,
        bodies: {},
      }

      const entries = await Promise.all(
        urls.map(async (url) => {
          try {
            const body = await $fetch(url)
            return [url, body] as const
          } catch {
            return [url, null] as const
          }
        })
      )

      const bodies: Record<string, unknown> = {}
      for (const [url, body] of entries) {
        if (body !== null) bodies[url] = body
      }

      this.prefetchedData[routeName] = {
        timestamp: Date.now(),
        loading: false,
        bodies,
      }
    },
    updateLatestNewsCoords(lat: number, lng: number) {
      this.latestNewsCoords = { lat, lng }
    },
  },
})
