import { defineStore } from 'pinia'

// Types for the new data structure
export interface Asset {
  id: string
  symbol: string
  name: string
  type: 'cryptocurrency' | 'fiat_currency' | 'stock'
  category: string
  description: string
  location: string
  industry: string
  market_cap?: number
  current_price: number
  currency: string
  similar_assets: string[]
  depends_on: string[]
  proximity_level: number
  tags: string[]
  icon_url: string
  website: string
  launch_date: string
  created_at: string
  updated_at: string
}

export interface AssetRelationship {
  id: string
  asset_id: string
  related_asset_id: string
  relationship_type: 'similar' | 'dependency' | 'competitor' | 'supplier' | 'paired'
  strength: number
  description: string
  correlation_coefficient: number
  created_at: string
  updated_at: string
}

export const useAssetsStore = defineStore('assets', {
  state: () => ({
    assets: [] as Asset[],
    assetRelationships: [] as AssetRelationship[],
    loading: false,
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
    async fetchAssets() {
      try {
        this.loading = true
        // Load from public directory
        const assetsData = await $fetch<Asset[]>('/core/assets.json')
        this.assets = assetsData
        this.lastUpdated = new Date()
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch assets:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchAssetRelationships() {
      try {
        const relationshipsData = await $fetch<AssetRelationship[]>('/relationships/asset_relationships.json')
        this.assetRelationships = relationshipsData
      } catch (error) {
        console.error('Failed to fetch asset relationships:', error)
      }
    },

    async initializeStore() {
      await Promise.all([
        this.fetchAssets(),
        this.fetchAssetRelationships()
      ])
    },

    updateAssetPrice(assetId: string, newPrice: number) {
      const asset = this.assets.find(a => a.id === assetId)
      if (asset) {
        asset.current_price = newPrice
        asset.updated_at = new Date().toISOString()
      }
    },

    getAssetPriceHistory(assetId: string) {
      // This would typically fetch from the prices folder
      // For now, return a placeholder
      return []
    }
  }
}) 