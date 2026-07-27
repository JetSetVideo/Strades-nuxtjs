/** Canonical agent / avatar types — 5-axis PersonalityMatrix is canonical. */

import type { AllocationPie } from './allocation'

export type AgentKind = 'personal' | 'public' | 'forked' | 'private'
export type AgentStatus = 'idle' | 'training' | 'live' | 'paused' | 'error'
export type AssetClass = 'fiat' | 'crypto' | 'stocks' | 'commodities'

/** Full 5-axis personality used by agents / swarm. */
export interface PersonalityMatrix {
  risk: number
  aggression: number
  reaction_speed: number
  patience: number
  contrarian: number
}

/**
 * 4-axis prefs projection (no contrarian) — used by userPreferences store.
 * Prefer PersonalityMatrix everywhere else.
 */
export interface UserPersonalityMatrix {
  risk: number
  aggression: number
  reaction_speed: number
  patience: number
}

export interface OpinionVector extends AllocationPie {}

export interface TrainingState {
  version: number
  epochs: number
  last_trained_at: string
  samples_observed: number
  samples_since_last_train: number
  reward_ema_pnl: number
  loss_ema: number
  status: AgentStatus
}

export interface AgentPerformance {
  live_pnl_pct: number
  backtest_pnl_pct: number
  win_rate: number
  sharpe: number
  max_drawdown_pct: number
  trades_total: number
  last_30d_curve: number[]
}

export interface AgentLineage {
  parent_id: string | null
  forked_at: string | null
}

export interface AgentShareState {
  is_public: boolean
  price_credits: number
  license: 'private' | 'swarm-readonly' | 'open' | string
}

export interface Agent {
  id: string
  name: string
  owner_id: string
  kind: AgentKind
  avatar_url: string
  tagline: string
  specialization: AssetClass[]
  trading_style: string
  personality_matrix: PersonalityMatrix
  opinion_vector: OpinionVector
  confidence: number
  training_state: TrainingState
  performance: AgentPerformance
  lineage: AgentLineage
  share_state: AgentShareState
  created_at: string
}

export function toUserPersonalityMatrix(m: PersonalityMatrix): UserPersonalityMatrix {
  return {
    risk: m.risk,
    aggression: m.aggression,
    reaction_speed: m.reaction_speed,
    patience: m.patience,
  }
}

export function fromUserPersonalityMatrix(m: UserPersonalityMatrix, contrarian = 0.5): PersonalityMatrix {
  return {
    risk: m.risk,
    aggression: m.aggression,
    reaction_speed: m.reaction_speed,
    patience: m.patience,
    contrarian,
  }
}
