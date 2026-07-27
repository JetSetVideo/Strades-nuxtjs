import { defineStore } from 'pinia'
import type { PriceUpdate, Activity, NewsItem } from '~/types/asset'

export type { PriceUpdate, Activity, NewsItem } from '~/types/asset'

export const useAssetEventsStore = defineStore('assetEvents', {
  state: () => ({
    prices: {} as Record<string, { price: number; change24h: number }>,
    loading: false,
    error: null as Error | null,
    activities: [] as Activity[],
    news: [] as NewsItem[]
  }),

  actions: {
    updateAssetPrice(symbol: string, price: number, change24h: number) {
      this.prices[symbol] = { price, change24h }
    },

    handlePriceUpdate(update: PriceUpdate) {
      this.prices[update.symbol] = { price: update.price, change24h: update.change24h }
    },

    addActivity(activity: Activity) {
      this.activities.unshift(activity)
      // Keep only last 50 activities
      if (this.activities.length > 50) {
        this.activities = this.activities.slice(0, 50)
      }
    },

    addNews(newsItem: NewsItem) {
      this.news.unshift(newsItem)
      // Keep only last 20 news items
      if (this.news.length > 20) {
        this.news = this.news.slice(0, 20)
      }
    }
  }
})
