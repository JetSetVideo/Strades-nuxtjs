import { defineStore } from 'pinia'

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

/** Backend portfolio shape from GET /api/portfolio/ */
export interface PortfolioAsset {
  id: string
  symbol: string
  name: string
  current_price: number
  icon_url?: string | null
}

export interface PortfolioHolding {
  asset: PortfolioAsset
  quantity: number
  average_buy_price: number
  current_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface PortfolioTransaction {
  id: number
  type: 'buy' | 'sell'
  asset_id: string
  asset_symbol: string
  quantity: number
  price: number
  total_value: number
  fee: number
  timestamp: string
  status: string
}

export interface Portfolio {
  id: number
  name: string
  cash_balance: number
  currency: string
  total_value: number
  total_invested: number
  holdings: PortfolioHolding[]
  transactions: PortfolioTransaction[]
  created_at?: string
  updated_at?: string
}

export interface WalletState {
  wallets: Wallet[]
  walletHistory: Record<string, Record<string, unknown>>
  /** Live backend portfolio (API-first); null when unauthenticated / demo JSON only. */
  portfolio: Portfolio | null
  portfolioLoading: boolean
  portfolioError: string | null
  hydrated: boolean
  loading: boolean
  error: Error | null
}

export const useWalletStore = defineStore('wallet', {
  state: (): WalletState => ({
    wallets: [],
    walletHistory: {},
    portfolio: null,
    portfolioLoading: false,
    portfolioError: null,
    hydrated: false,
    loading: false,
    error: null
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
    },

    getWalletHistory: (state) => (walletId: string) => {
      return state.walletHistory[walletId] || {}
    },

    getWalletHistoryAtDate: (state) => (walletId: string, date: string) => {
      const history = state.walletHistory[walletId]
      return history?.[date] || null
    }
  },

  actions: {
    async fetchWallets() {
      try {
        this.loading = true
        const [walletsData, historyData] = await Promise.all([
          $fetch<Wallet[]>('/data/core/wallets.json'),
          $fetch<Record<string, Record<string, unknown>>>('/data/core/wallet_history.json')
        ])
        this.wallets = walletsData
        this.walletHistory = historyData
        this.hydrated = true
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch wallets:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * API-first portfolio fetch. Falls back to synthesizing a Portfolio
     * from the default JSON wallet when the backend is unavailable.
     */
    async fetchPortfolio() {
      const { accessToken, isAuthenticated } = useAuth()
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase as string

      this.portfolioLoading = true
      this.portfolioError = null

      if (isAuthenticated.value && accessToken.value) {
        try {
          const { $api } = useNuxtApp()
          const data = await ($api as typeof $fetch)<Portfolio>('/api/portfolio/')
          this.portfolio = data
          this.portfolioLoading = false
          return data
        } catch (err: unknown) {
          const detail = (err as { data?: { detail?: string }; message?: string })?.data?.detail
            || (err as { message?: string })?.message
            || 'Failed to load portfolio.'
          console.warn('[wallet] portfolio API failed, falling back to JSON wallets:', detail)
          this.portfolioError = detail
        }
      }

      // JSON fallback — synthesize Portfolio from default wallet
      if (!this.hydrated) {
        await this.fetchWallets()
      }
      const defaultWallet = this.wallets.find(w => w.is_default) || this.wallets[0]
      if (defaultWallet) {
        this.portfolio = {
          id: 0,
          name: defaultWallet.name,
          cash_balance: defaultWallet.available_balance,
          currency: defaultWallet.currency,
          total_value: defaultWallet.total_value,
          total_invested: defaultWallet.invested_amount,
          holdings: defaultWallet.assets.map(a => ({
            asset: {
              id: a.asset_id,
              symbol: a.symbol,
              name: a.symbol,
              current_price: a.current_price,
            },
            quantity: a.amount,
            average_buy_price: a.average_price,
            current_value: a.current_value,
            unrealized_pnl: a.return_amount,
            unrealized_pnl_pct: a.return_percentage,
          })),
          transactions: defaultWallet.transactions.map((t, i) => ({
            id: i,
            type: t.type,
            asset_id: t.asset_id,
            asset_symbol: t.asset_symbol,
            quantity: t.amount,
            price: t.price,
            total_value: t.total_value,
            fee: t.fee,
            timestamp: t.timestamp,
            status: t.status,
          })),
        }
      }
      this.portfolioLoading = false
      return this.portfolio
    },

    async initializeStore() {
      if (this.hydrated) return
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
        this.updateWalletBalances(walletId)
      }
    },

    updateWalletBalances(walletId: string) {
      const wallet = this.wallets.find(w => w.id === walletId)
      if (!wallet) return

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

        const totalValue = wallet.assets.reduce((sum, a) => sum + a.current_value, 0)
        wallet.assets.forEach(a => {
          a.allocation_percentage = (a.current_value / totalValue) * 100
        })

        this.updateWalletBalances(walletId)
      }
    }
  }
})
