import { defineStore } from 'pinia'

// Types for wallet management
export interface Wallet {
  id: string
  user_id: string
  name: string
  description: string
  type: 'investment' | 'trading'
  currency: string
  total_value: number
  available_balance: number
  invested_amount: number
  total_return: number
  total_return_percentage: number
  daily_change: number
  daily_change_percentage: number
  assets: Array<{
    asset_id: string
    symbol: string
    amount: number
    average_price: number
    current_price: number
    current_value: number
    return_amount: number
    return_percentage: number
    allocation_percentage: number
  }>
  transactions: Array<{
    id: string
    type: 'buy' | 'sell'
    asset_id: string
    asset_symbol: string
    amount: number
    price: number
    total_value: number
    fee: number
    timestamp: string
    status: 'pending' | 'completed' | 'failed'
  }>
  performance_history: {
    '1d': { change: number; change_percentage: number }
    '7d': { change: number; change_percentage: number }
    '30d': { change: number; change_percentage: number }
    '90d': { change: number; change_percentage: number }
    '1y': { change: number; change_percentage: number }
  }
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export const useWalletsStore = defineStore('wallets', {
  state: () => ({
    wallets: [] as Wallet[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getWalletById: (state) => (id: string) => {
      return state.wallets.find(wallet => wallet.id === id)
    },

    getUserWallets: (state) => (userId: string) => {
      return state.wallets.filter(wallet => wallet.user_id === userId)
    },

    getDefaultWallet: (state) => (userId: string) => {
      return state.wallets.find(wallet => wallet.user_id === userId && wallet.is_default)
    },

    getWalletByType: (state) => (userId: string, type: 'investment' | 'trading') => {
      return state.wallets.filter(wallet => wallet.user_id === userId && wallet.type === type)
    },

    getTotalPortfolioValue: (state) => (userId: string) => {
      const userWallets = state.wallets.filter(wallet => wallet.user_id === userId)
      return userWallets.reduce((total, wallet) => total + wallet.total_value, 0)
    },

    getTopPerformingWallets: (state) => {
      return [...state.wallets]
        .filter(wallet => wallet.is_active)
        .sort((a, b) => b.total_return_percentage - a.total_return_percentage)
        .slice(0, 10)
    },

    getWalletPerformance: (state) => (walletId: string, period: '1d' | '7d' | '30d' | '90d' | '1y') => {
      const wallet = state.wallets.find(w => w.id === walletId)
      return wallet?.performance_history[period] || null
    }
  },

  actions: {
    async fetchWallets() {
      try {
        this.loading = true
        const walletsData = await $fetch<Wallet[]>('/data/core/wallets.json')
        this.wallets = walletsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch wallets:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchWallets()
    },

    createWallet(wallet: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>) {
      const newWallet: Wallet = {
        ...wallet,
        id: `wallet_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      this.wallets.push(newWallet)
      return newWallet
    },

    updateWallet(walletId: string, updates: Partial<Wallet>) {
      const wallet = this.wallets.find(w => w.id === walletId)
      if (wallet) {
        Object.assign(wallet, updates)
        wallet.updated_at = new Date().toISOString()
      }
    },

    deleteWallet(walletId: string) {
      const index = this.wallets.findIndex(w => w.id === walletId)
      if (index > -1) {
        this.wallets.splice(index, 1)
      }
    },

    addTransaction(walletId: string, transaction: Wallet['transactions'][0]) {
      const wallet = this.wallets.find(w => w.id === walletId)
      if (wallet) {
        wallet.transactions.unshift(transaction)
        // Update wallet balances based on transaction
        this.updateWalletBalances(walletId)
      }
    },

    updateWalletBalances(walletId: string) {
      const wallet = this.wallets.find(w => w.id === walletId)
      if (!wallet) return

      // Recalculate total value and returns
      let totalValue = 0
      let investedAmount = 0

      wallet.assets.forEach(asset => {
        totalValue += asset.current_value
        investedAmount += (asset.amount * asset.average_price)
      })

      wallet.total_value = totalValue
      wallet.invested_amount = investedAmount
      wallet.total_return = totalValue - investedAmount
      wallet.total_return_percentage = investedAmount > 0 ? (wallet.total_return / investedAmount) * 100 : 0

      wallet.updated_at = new Date().toISOString()
    },

    updateAssetPrice(walletId: string, assetId: string, newPrice: number) {
      const wallet = this.wallets.find(w => w.id === walletId)
      if (!wallet) return

      const asset = wallet.assets.find(a => a.asset_id === assetId)
      if (asset) {
        asset.current_price = newPrice
        asset.current_value = asset.amount * newPrice
        asset.return_amount = asset.current_value - (asset.amount * asset.average_price)
        asset.return_percentage = (asset.return_amount / (asset.amount * asset.average_price)) * 100

        // Update allocation percentages
        const totalValue = wallet.assets.reduce((sum, a) => sum + a.current_value, 0)
        wallet.assets.forEach(a => {
          a.allocation_percentage = (a.current_value / totalValue) * 100
        })

        this.updateWalletBalances(walletId)
      }
    }
  }
})
