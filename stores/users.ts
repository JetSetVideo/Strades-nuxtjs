import { defineStore } from 'pinia'
import type {
  UserProfile,
  CalendarDay,
  AiAvatar,
  Achievement,
  PsychologyProfile,
  PoliticalProfile,
  InvestorProfile,
  ExperienceLevel,
} from '~/types/user'

export type {
  UserProfile as User,
  CalendarDay,
  AiAvatar,
  Achievement,
  PsychologyProfile,
  PoliticalProfile,
  InvestorProfile,
  ExperienceLevel,
} from '~/types/user'

export type User = UserProfile

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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    userAssets: [] as UserAsset[],
    currentUser: null as User | null,
    loading: false,
    error: null as string | null,
    /** Tracks in-flight requests to avoid duplicate fetches */
    _fetchPromise: null as Promise<void> | null
  }),

  getters: {
    getUserById: (state) => (id: string): User | undefined => {
      return state.users.find(u => u.id === id)
    },

    getUserByUsername: (state) => (username: string): User | undefined => {
      return state.users.find(u => u.username === username)
    },

    getCurrentUserAssets: (state): UserAsset[] => {
      if (!state.currentUser) return []
      return state.userAssets.filter(ua => ua.user_id === state.currentUser!.id)
    },

    getUserAssets: (state) => (userId: string): UserAsset[] => {
      return state.userAssets.filter(ua => ua.user_id === userId && ua.relationship_type === 'owned')
    },

    getUserPortfolioValue: (state) => (userId: string): number => {
      return state.userAssets
        .filter(ua => ua.user_id === userId && ua.relationship_type === 'owned')
        .reduce((t, a) => t + a.current_value, 0)
    },

    getTopTraders: (state): User[] => {
      return [...state.users]
        .sort((a, b) => b.total_portfolio_value - a.total_portfolio_value)
        .slice(0, 10)
    },

    getUsersByRiskTolerance: (state) => (risk: string): User[] => {
      return state.users.filter(u => u.risk_tolerance === risk)
    },

    /** Returns the CSS border-radius token driven by user risk profile (Design.md) */
    getRiskRadiusVar: () => (risk_score: number): string => {
      const px = Math.round(16 - risk_score * 16)
      return `${px}px`
    },

    /** Returns a hue shift based on political_profile.economic_ideology */
    getPoliticalHue: () => (ideology: number): string => {
      if (ideology > 0.3) return 'var(--political-right)'
      if (ideology < -0.3) return 'var(--political-left)'
      return 'var(--political-center)'
    }
  },

  actions: {
    async fetchUsers(): Promise<void> {
      if (this._fetchPromise) return this._fetchPromise
      this._fetchPromise = this._doFetchUsers()
      try {
        await this._fetchPromise
      } finally {
        this._fetchPromise = null
      }
    },

    async _doFetchUsers(): Promise<void> {
      try {
        this.loading = true
        this.error = null
        const sources = [
          '/data/user/users.json',
          '/data/core/users.json',
        ]
        let data: User[] | null = null
        for (const src of sources) {
          try {
            data = await $fetch<User[]>(src)
            break
          } catch {
            // try next source
          }
        }
        if (!data) throw new Error('Could not load users from any data source')
        this.users = data
      } catch (err) {
        this.error = (err as Error).message
        console.error('[UsersStore] fetchUsers failed:', err)
      } finally {
        this.loading = false
      }
    },

    async fetchUserAssets(): Promise<void> {
      try {
        const data = await $fetch<UserAsset[]>('/data/relationships/user_assets.json')
        this.userAssets = data
      } catch (err) {
        console.warn('[UsersStore] fetchUserAssets failed — continuing without assets:', err)
      }
    },

    async setCurrentUser(userId: string): Promise<void> {
      const user = this.users.find(u => u.id === userId)
      if (user) {
        this.currentUser = user
        user.last_login = new Date().toISOString()
      }
    },

    async initializeCurrentUser(): Promise<void> {
      try {
        const session = await $fetch<{ current_user_id?: string }>('/data/user/session.json')
        if (session?.current_user_id) {
          await this.setCurrentUser(session.current_user_id)
          return
        }
      } catch {
        // ignore — fallback below
      }
      if (!this.currentUser && this.users.length > 0) {
        await this.setCurrentUser(this.users[0].id)
      }
    },

    async initializeStore(): Promise<void> {
      await Promise.all([this.fetchUsers(), this.fetchUserAssets()])
      await this.initializeCurrentUser()
    },

    updateUserProfile(userId: string, updates: Partial<User>): void {
      const user = this.users.find(u => u.id === userId)
      if (user) {
        Object.assign(user, updates)
        user.updated_at = new Date().toISOString()
      }
    },

    addUserAsset(asset: UserAsset): void {
      this.userAssets.push(asset)
    },

    updateUserAsset(assetId: string, updates: Partial<UserAsset>): void {
      const ua = this.userAssets.find(a => a.id === assetId)
      if (ua) {
        Object.assign(ua, updates)
        ua.updated_at = new Date().toISOString()
      }
    }
  }
})
