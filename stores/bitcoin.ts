import { defineStore } from 'pinia'

export interface BitcoinPriceData {
  close: number
  date: string
  high: number
  low: number
  open: number
  openInt: number
  volume: number
}

export const useBitcoinStore = defineStore('bitcoinStore', {
  state: () => ({
    bitcoinPrices: [] as BitcoinPriceData[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getLatestPrice: (state) => {
      return state.bitcoinPrices[state.bitcoinPrices.length - 1];
    },

    getPriceByDate: (state) => (date: string) => {
      return state.bitcoinPrices.find(price => price.date === date);
    },

    getPricesInRange: (state) => (startDate: string, endDate: string) => {
      return state.bitcoinPrices.filter(price =>
        price.date >= startDate && price.date <= endDate
      );
    }
  },

  actions: {
    async fetchBitcoinPrices() {
      try {
        this.loading = true
        const bitcoinData = await $fetch<BitcoinPriceData[]>('/Bitcoin.json')
        this.bitcoinPrices = bitcoinData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch bitcoin prices:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchBitcoinPrices()
    }
  }
})