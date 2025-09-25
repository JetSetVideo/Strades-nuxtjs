import { defineStore } from 'pinia'
import type { Asset } from '@/types'
import type { PriceUpdate, Activity, NewsItem } from '~/types'

export const useAssetEventsStore = defineStore('assetEvents', {
  state: () => ({
    assets: [] as Asset[],
    prices: {} as Record<string, { price: number; change24h: number }>,
    loading: false,
    error: null as Error | null,
    activities: [] as Activity[],
    news: [] as NewsItem[]
  }),
  
  actions: {
    async fetchAssets() {
      const { $api } = useNuxtApp()
      try {
        this.loading = true
        const response = await $api.get<Asset[]>('/assets')
        this.assets = response.data
      } catch (error) {
        this.error = error as Error
      } finally {
        this.loading = false
      }
    },

    updateAssetPrice(symbol: string, price: number, change24h: number) {
      this.prices[symbol] = { price, change24h }
      
      // Update the asset in the assets array if it exists
      const asset = this.assets.find((a: Asset) => a.symbol === symbol)
      if (asset) {
        asset.price = price
        asset.change24h = change24h
      }
    },

    handlePriceUpdate(update: PriceUpdate) {
      this.prices[update.symbol] = update.price
    },

    addActivity(activity: Activity) {
      this.activities.unshift(activity)
    },

    addNews(news: NewsItem) {
      this.news.unshift(news)
    }
  }
}) 