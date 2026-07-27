/** Canonical user domain types — AuthUser (backend) + UserProfile (rich mock). */

export interface AuthUser {
  id: string
  email: string
  username: string | null
  first_name: string
  last_name: string
  display_name: string
  full_name: string
  avatar_url: string | null
  bio: string
  role: 'user' | 'premium' | 'admin'
  auth_provider: 'email' | 'google'
  email_verified: boolean
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

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
  confidence_score: number
  execution_frequency: number
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
  risk_score: number
  aggression_score: number
  discipline_score: number
  patience_index: number
  emotional_control_score: number
  fomo_susceptibility: number
  revenge_trading_tendency: number
  overconfidence_bias: number
  loss_aversion_index: number
  trading_style: string
  description: string
  strengths: string[]
  weaknesses: string[]
}

export interface PoliticalProfile {
  economic_ideology: number
  fed_stance: number
  regulatory_stance: number
  esg_sensitivity: number
  crypto_libertarianism: number
  globalism_index: number
  description: string
}

export interface InvestorProfile {
  type: string
  time_horizon: string
  preferred_markets: string[]
  sector_focus: string[]
  esg_score: number
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

/** Rich demo/profile user from public/data JSON. */
export interface UserProfile {
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
  friends?: string[]
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

/** @deprecated Use UserProfile — kept as alias for gradual migration. */
export type User = UserProfile

/** Map a backend AuthUser into a minimal UserProfile-compatible shape. */
export function authUserToProfile(auth: AuthUser): Partial<UserProfile> & { id: string; username: string } {
  return {
    id: auth.id,
    username: auth.username || auth.display_name || auth.email,
    email: auth.email,
    first_name: auth.first_name,
    last_name: auth.last_name,
    avatar_url: auth.avatar_url || '',
    bio: auth.bio || '',
    role: auth.role === 'admin' ? 'admin' : 'trader',
    created_at: auth.created_at,
    updated_at: auth.updated_at,
  }
}
