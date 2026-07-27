import { defineStore } from 'pinia'
import { usePriceCache } from '~/composables/usePriceCache'
import type { Asset, AssetRelationship } from '~/types/asset'

export type { Asset, AssetRelationship } from '~/types/asset'

export const useAssetsStore = defineStore('assets', {
  state: () => ({
    assets: [] as Asset[],
    assetRelationships: [] as AssetRelationship[],
    loading: false,        // true only when there is zero data (first cold load)
    isRefreshing: false,   // true during background refresh (data already shown)
    fromCache: false,      // true when current data was served from localStorage
    error: null as Error | null,
    lastUpdated: null as Date | null
  }),

  getters: {
    getAssetById: (state) => (id: string) => {
      return state.assets.find(asset => asset.id === id)
    },

    getAssetBySymbol: (state) => (symbol: string) => {
      return state.assets.find(asset => asset.symbol === symbol)
    },

    getAssetsByType: (state) => (type: string) => {
      return state.assets.filter(asset => asset.type === type)
    },

    getAssetsByCategory: (state) => (category: string) => {
      return state.assets.filter(asset => asset.category === category)
    },

    getRelatedAssets: (state) => (assetId: string) => {
      return state.assetRelationships
        .filter(rel => rel.asset_id === assetId)
        .map(rel => ({
          ...rel,
          relatedAsset: state.assets.find(asset => asset.id === rel.related_asset_id)
        }))
    },

    getAssetsByProximityLevel: (state) => (level: number) => {
      return state.assets.filter(asset => asset.proximity_level === level)
    }
  },

  actions: {
    /** Fetch fresh data from network; update cache and store. */
    async fetchAssets() {
      const priceCache = usePriceCache()
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase as string
      const { accessToken } = useAuth()

      try {
        // Prefer shared $api (Bearer + 401 refresh) when available
        const { $api } = useNuxtApp()
        const raw = await ($api as typeof $fetch)<{ count: number; results: Asset[] } | Asset[]>(
          '/api/assets/'
        )
        const assets: Asset[] = Array.isArray(raw)
          ? raw
          : (raw as { results?: Asset[] }).results ?? []
        this.assets = assets
        this.fromCache = false
        this.lastUpdated = new Date()
        priceCache.saveAssets(assets)
        return
      } catch {
        // Fall through — try raw $fetch then local JSON
      }

      try {
        const raw = await $fetch<{ count: number; results: Asset[] } | Asset[]>(
          `${apiBase}/api/assets/`,
          {
            headers: accessToken.value
              ? { Authorization: `Bearer ${accessToken.value}` }
              : undefined,
          }
        )
        const assets: Asset[] = Array.isArray(raw)
          ? raw
          : (raw as { results?: Asset[] }).results ?? []
        this.assets = assets
        this.fromCache = false
        this.lastUpdated = new Date()
        priceCache.saveAssets(assets)
        return
      } catch {
        // Fall through to local JSON fallback
      }

      try {
        const assetsData = await $fetch<Asset[]>('/core/assets.json')
        this.assets = assetsData
        this.fromCache = false
        this.lastUpdated = new Date()
        priceCache.saveAssets(assetsData)
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch assets:', error)
      }
    },

    /**
     * Boot strategy:
     *  1. Serve stale-or-fresh cache immediately (zero-latency to user)
     *  2. Kick off background refresh; set isRefreshing so UI shows overlay
     *  3. On completion, swap in fresh data silently
     */
    async initializeStore() {
      const priceCache = usePriceCache()

      // ── Step 1: load from cache (ignoring TTL — stale-while-revalidate) ──
      const cached = priceCache.peekAssets<Asset[]>()
      if (cached && cached.data.length > 0) {
        this.assets = cached.data
        this.fromCache = true
        this.loading = false
      } else {
        // Truly no data yet — show skeleton
        this.loading = true
      }

      // ── Step 2: background refresh ────────────────────────────────────────
      this.isRefreshing = true
      await Promise.all([
        this.fetchAssets(),
        this.fetchAssetRelationships(),
      ])
      this.loading = false
      this.isRefreshing = false
    },

    updateAssetPrice(assetId: string, newPrice: number) {
      const asset = this.assets.find(a => a.id === assetId)
      if (asset) {
        asset.current_price = newPrice
        asset.updated_at = new Date().toISOString()
      }
    },

    async fetchAssetRelationships() {
      try {
        const data = await $fetch<AssetRelationship[]>('/data/relationships/asset_relationships.json')
        this.assetRelationships = data
      } catch {
        // Silently ignore — relationships are optional
      }
    },

    getAssetPriceHistory(assetId: string) {
      return []
    }
  }
}) 