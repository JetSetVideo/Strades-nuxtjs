/** Canonical agent / avatar types — 5-axis PersonalityMatrix is canonical. */

import type { AllocationPie } from './allocation'

export type AgentKind = 'personal' | 'public' | 'forked' | 'private'
export type AgentStatus = 'idle' | 'training' | 'live' | 'paused' | 'error'
export type AssetClass = 'fiat' | 'crypto' | 'stocks' | 'commodities'

/**
 * generative: opinion emerges from a personality-driven reasoning style (the
 * "famous" archetypes) — opinion_vector is authored by personality_matrix.
 * classifier: opinion emerges from a calibrated statistical classifier over
 * market features (e.g. Jev) — no personality authoring, only regime_probs.
 */
export type AgentModelType = 'generative' | 'classifier'

export type MarketRegime = 'bull' | 'bear' | 'chop' | 'crisis'

/** Probability simplex over regimes — must sum to 1 (see clampRegimeProbs). */
export type RegimeProbabilities = Record<MarketRegime, number>

export interface ClassifierState {
  regime_probs: RegimeProbabilities
  predicted_regime: MarketRegime
  /** 1 - Brier score against realized regime outcomes; reliability, not confidence-by-vibe. */
  calibration: number
  /** Relative importance the classifier assigns each input feature; sums to 1. */
  feature_weights: Record<string, number>
  /** Rolling confusion matrix counts, regime x predicted-regime, for the marketplace "accuracy" read-out. */
  confusion: Record<MarketRegime, Record<MarketRegime, number>>
}

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
  model_type: AgentModelType
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
  /** Present only when model_type === 'classifier'. */
  classifier_state?: ClassifierState
}

const REGIMES: MarketRegime[] = ['bull', 'bear', 'chop', 'crisis']

/** Normalizes a partial regime-probability record into a valid simplex (sums to 1, all >= 0). */
export function clampRegimeProbs(probs: Partial<RegimeProbabilities>): RegimeProbabilities {
  const floored: RegimeProbabilities = {
    bull: Math.max(0, probs.bull ?? 0),
    bear: Math.max(0, probs.bear ?? 0),
    chop: Math.max(0, probs.chop ?? 0),
    crisis: Math.max(0, probs.crisis ?? 0)
  }
  const total = REGIMES.reduce((s, r) => s + floored[r], 0)
  if (total <= 0) return { bull: 0.25, bear: 0.25, chop: 0.25, crisis: 0.25 }
  return {
    bull: floored.bull / total,
    bear: floored.bear / total,
    chop: floored.chop / total,
    crisis: floored.crisis / total
  }
}

export function argmaxRegime(probs: RegimeProbabilities): MarketRegime {
  return REGIMES.reduce((best, r) => (probs[r] > probs[best] ? r : best), 'chop' as MarketRegime)
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
