import { defineStore } from 'pinia'

// Types for user management
export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  avatar_url: string
  bio: string
  date_of_birth: string
  country: string
  city: string
  timezone: string
  language: string
  risk_tolerance: 'low' | 'moderate' | 'high' | 'very_high'
  trading_experience: 'beginner' | 'intermediate' | 'advanced'
  investment_goals: string[]
  preferred_assets: string[]
  total_portfolio_value: number
  account_balance: number
  total_invested: number
  total_returns: number
  win_rate: number
  total_trades: number
  active_strategies_count: number
  friends_count: number
  joined_date: string
  last_login: string
  is_active: boolean
  is_verified: boolean
  two_factor_enabled: boolean
  notification_preferences: {
    email: boolean
    push: boolean
    sms: boolean
    trade_alerts: boolean
    price_alerts: boolean
  }
  privacy_settings: {
    profile_visibility: 'public' | 'friends_only' | 'private'
    portfolio_visibility: 'public' | 'friends_only' | 'private'
    trading_history_visibility: 'public' | 'friends_only' | 'private'
  }
  achievements: Array<{
    id: string
    name: string
    description: string
    unlocked_date: string
    icon: string
  }>
  created_at: string
  updated_at: string
}

export interface UserAsset {
  id: string
  user_id: string
  asset_id: string
  relationship_type: 'owned' | 'watchlisted' | 'favorite'
  quantity: number
  average_purchase_price: number
  current_value: number
  total_invested: number
  total_return: number
  return_percentage: number
  is_watchlisted: boolean
  is_favorite: boolean
  first_purchase_date: string
  last_transaction_date: string
  notes: string
  created_at: string
  updated_at: string
}

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    userAssets: [] as UserAsset[],
    currentUser: null as User | null,
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getUserById: (state) => (id: string) => {
      return state.users.find(user => user.id === id)
    },

    getUserByUsername: (state) => (username: string) => {
      return state.users.find(user => user.username === username)
    },

    getCurrentUserAssets: (state) => {
      if (!state.currentUser) return []
      return state.userAssets.filter(ua => ua.user_id === state.currentUser!.id)
    },

    getUserPortfolioValue: (state) => (userId: string) => {
      const userAssets = state.userAssets.filter(ua => ua.user_id === userId && ua.relationship_type === 'owned')
      return userAssets.reduce((total, asset) => total + asset.current_value, 0)
    },

    getTopTraders: (state) => {
      return [...state.users]
        .sort((a, b) => b.total_portfolio_value - a.total_portfolio_value)
        .slice(0, 10)
    },

    getUsersByRiskTolerance: (state) => (riskTolerance: string) => {
      return state.users.filter(user => user.risk_tolerance === riskTolerance)
    }
  },

  actions: {
    async fetchUsers() {
      try {
        this.loading = true
        let usersData: User[] = []
        try {
          // "Mock DB" path (preferred)
          usersData = await $fetch<User[]>('/data/user/users.json')
        } catch (e) {
          try {
            // Fallback to core users
            usersData = await $fetch<User[]>('/data/core/users.json')
          } catch (e2) {
            // Fallback to legacy Users.json (capitalized) at data root
            usersData = await $fetch<User[]>('/data/Users.json')
          }
        }
        this.users = usersData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch users:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchUserAssets() {
      try {
        const userAssetsData = await $fetch<UserAsset[]>('/data/relationships/user_assets.json')
        this.userAssets = userAssetsData
      } catch (error) {
        console.error('Failed to fetch user assets:', error)
      }
    },

    async setCurrentUser(userId: string) {
      const user = this.users.find(u => u.id === userId)
      if (user) {
        this.currentUser = user
        // Update last login
        user.last_login = new Date().toISOString()
      }
    },

    async initializeCurrentUser() {
      // Try to load session-like pointer (mock server behavior)
      try {
        const session = await $fetch<{ current_user_id?: string }>('/data/user/session.json')
        if (session?.current_user_id) {
          await this.setCurrentUser(session.current_user_id)
          return
        }
      } catch {
        // ignore and fallback below
      }

      if (!this.currentUser && this.users.length > 0) {
        await this.setCurrentUser(this.users[0].id)
      }
    },

    async initializeStore() {
      await Promise.all([
        this.fetchUsers(),
        this.fetchUserAssets()
      ])

      await this.initializeCurrentUser()
    },

    updateUserProfile(userId: string, updates: Partial<User>) {
      const user = this.users.find(u => u.id === userId)
      if (user) {
        Object.assign(user, updates)
        user.updated_at = new Date().toISOString()
      }
    },

    addUserAsset(userAsset: UserAsset) {
      this.userAssets.push(userAsset)
    },

    updateUserAsset(assetId: string, updates: Partial<UserAsset>) {
      const userAsset = this.userAssets.find(ua => ua.id === assetId)
      if (userAsset) {
        Object.assign(userAsset, updates)
        userAsset.updated_at = new Date().toISOString()
      }
    }
  }
})
