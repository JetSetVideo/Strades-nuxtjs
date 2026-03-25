import { defineStore } from 'pinia'

// ─── Sub-types ───────────────────────────────────────────────────────────────

export interface CalendarDay {
  day: number
  pnl_eur: number
  pnl_pct: number
  trades_total: number
  trades_won: number
  is_upcoming: boolean
}

export interface AiAvatar {
  id: string
  name: string
  avatar_url: string
  personality_matrix: { risk: number; aggression: number; reaction_speed: number }
  trading_style: string
  pnl_30d: number
  confidence_score: number      // 0-1 — drives node opacity in Builder
  execution_frequency: number   // 0-1 — drives heartbeat animation
  is_public: boolean
  followers: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  unlocked_date: string
  icon: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
}

export interface PsychologyProfile {
  mbti: string
  risk_score: number            // 0-1, drives --base-radius CSS var
  aggression_score: number      // 0-1
  discipline_score: number      // 0-1
  patience_index: number        // 0-1
  emotional_control_score: number // 0-10
  fomo_susceptibility: number   // 0-1
  revenge_trading_tendency: number // 0-1
  overconfidence_bias: number   // 0-1
  loss_aversion_index: number   // 0-1
  trading_style: string
  description: string
  strengths: string[]
  weaknesses: string[]
}

export interface PoliticalProfile {
  economic_ideology: number     // -1 (left) to +1 (right)
  fed_stance: number            // -1 (dovish) to +1 (hawkish)
  regulatory_stance: number     // -1 (anti-reg) to +1 (pro-reg)
  esg_sensitivity: number       // -1 (anti-ESG) to +1 (pro-ESG)
  crypto_libertarianism: number // 0-1
  globalism_index: number       // -1 (nationalist) to +1 (globalist)
  description: string
}

export interface InvestorProfile {
  type: string
  time_horizon: string
  preferred_markets: string[]
  sector_focus: string[]
  esg_score: number             // 0-10
  leverage_usage: 'none' | 'light' | 'moderate' | 'high'
  copy_trading_open: boolean
  description: string
}

export interface ExperienceLevel {
  level: number
  xp: number
  xp_next_level: number
  title: string
  badges: string[]
}

// ─── Main User type ───────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  avatar_url: string
  cover_url?: string
  bio: string
  date_of_birth: string
  country: string
  city: string
  timezone: string
  language: string
  is_owner?: boolean
  role: 'trader' | 'analyst' | 'admin'
  risk_tolerance: 'low' | 'moderate' | 'high' | 'very_high'
  trading_experience: 'beginner' | 'intermediate' | 'advanced'
  trading_style: 'scalper' | 'day_trader' | 'swing_trader' | 'position_trader'
  investment_goals: string[]
  preferred_assets: string[]
  total_portfolio_value: number
  account_balance: number
  total_invested: number
  total_returns: number
  total_return_percentage: number
  win_rate: number
  total_trades: number
  active_strategies_count: number
  followers_count: number
  following_count: number
  friends_count: number
  joined_date: string
  last_login: string
  is_active: boolean
  is_verified: boolean
  is_online: boolean
  two_factor_enabled: boolean
  performance_30d: number
  performance_7d: number
  performance_1d: number
  monthly_calendar: CalendarDay[]
  psychology_profile: PsychologyProfile
  political_profile: PoliticalProfile
  investor_profile: InvestorProfile
  ai_avatars: AiAvatar[]
  communities: string[]
  strategies_ids: string[]
  posts_ids: string[]
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
  achievements: Achievement[]
  experience: ExperienceLevel
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
          '/data/Users.json'
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
