/**
 * Bet-asset helpers — the prices page's fifth asset class.
 *
 * Prediction-market contracts arrive from the backend as `type: "bet"` (see
 * types/asset.ts). They are *not* tradeable instruments like the other four
 * classes: each one is a question with a resolution deadline, sourced from an
 * upstream venue (Kalshi, Polymarket). This module is the single source of
 * truth for (a) recognising a bet, (b) its distinct colour, and (c) the
 * time-horizon filter that hides bets resolving too far in the future.
 *
 * Colour is deliberately NOT one of the shared assetClass palette
 * (gold / orange / blue / purple / green) — a bet must never read as a
 * commodity or an equity.
 */

export const BET_TYPE = 'bet'

/**
 * Hot pink — distinct from every assetClass accent:
 *   precious_metals #f4c145 · commodities #ff9f45 · fiat #4fa8ff ·
 *   crypto #b48aff · stocks #00e58a
 */
export const BET_COLOR = '#ff4d9d'

export interface BetLike {
  type?: string | null
  expires_at?: string | null
  subject?: string | null
  source?: string | null
}

export function isBetAsset(a: { type?: string | null } | null | undefined): boolean {
  return !!a && String(a.type ?? '').toLowerCase() === BET_TYPE
}

export const BET_SOURCE_LABELS: Record<string, string> = {
  kalshi: 'Kalshi',
  polymarket: 'Polymarket',
}

export function betSourceLabel(source: string | null | undefined): string {
  const key = String(source ?? '').toLowerCase()
  if (!key) return ''
  return BET_SOURCE_LABELS[key] ?? key
}

// ── Time-horizon filter ──────────────────────────────────────────────────────

export type BetHorizon = '7d' | '30d' | '90d' | '1y' | 'all'

export interface HorizonOption {
  id: BetHorizon
  label: string
  /** window length in ms; Infinity for "all" */
  ms: number
}

const DAY = 86_400_000

export const BET_HORIZONS: HorizonOption[] = [
  { id: '7d', label: '7d', ms: 7 * DAY },
  { id: '30d', label: '30d', ms: 30 * DAY },
  { id: '90d', label: '90d', ms: 90 * DAY },
  { id: '1y', label: '1y', ms: 365 * DAY },
  { id: 'all', label: 'All', ms: Infinity },
]

/**
 * Default horizon: 30 days. The brief asks the page to *default to excluding
 * far-future bets*, so a fresh visit shows only near-dated markets and the
 * user must opt in to the long tail.
 */
export const DEFAULT_BET_HORIZON: BetHorizon = '30d'

export function horizonMs(horizon: BetHorizon): number {
  return BET_HORIZONS.find(o => o.id === horizon)?.ms ?? Infinity
}

/** Resolution time in ms, or null when the field is missing/unparseable. */
export function betExpiryMs(a: BetLike): number | null {
  if (!a.expires_at) return null
  const t = Date.parse(a.expires_at)
  return Number.isFinite(t) ? t : null
}

/**
 * A bet passes the horizon when it resolves within the window. Honest edges:
 *  • no/unparseable expiry → kept (it isn't "beyond" any horizon);
 *  • already-past expiry   → kept (it isn't in the future at all);
 *  • horizon 'all'         → everything passes.
 */
export function withinHorizon(a: BetLike, horizon: BetHorizon, now: number): boolean {
  if (horizon === 'all') return true
  const exp = betExpiryMs(a)
  if (exp === null) return true
  if (exp <= now) return true
  return exp - now <= horizonMs(horizon)
}

/**
 * Apply the horizon filter. It ONLY ever removes bet rows — every non-bet
 * asset is returned untouched, which is what keeps this control a bet-only
 * affair rather than a second global filter.
 */
export function applyHorizonFilter<T extends BetLike>(
  list: T[],
  horizon: BetHorizon,
  now: number,
): T[] {
  if (horizon === 'all') return list
  return list.filter(a => (isBetAsset(a) ? withinHorizon(a, horizon, now) : true))
}

/** Short count of bets a horizon would hide, for an honest UI label. */
export function countHiddenByHorizon<T extends BetLike>(
  list: T[],
  horizon: BetHorizon,
  now: number,
): number {
  return list.filter(isBetAsset).length - applyHorizonFilter(list, horizon, now).filter(isBetAsset).length
}

// ── Tri-state horizon buckets ────────────────────────────────────────────────
// The chips are disjoint windows, so highlighting 7d and 30d lists both
// windows, and excluding a third window removes only that window.
// Default excludes everything past 30 days — the same cut the single
// horizon used to make — until the user clears those chips.

export const HORIZON_BUCKETS = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: '1y', label: '1y' },
  { id: 'later', label: 'Later' },
] as const

export type HorizonBucket = (typeof HORIZON_BUCKETS)[number]['id']

export function defaultHorizonStates(): Record<string, 'neutral' | 'include' | 'exclude'> {
  return { '90d': 'exclude', '1y': 'exclude', later: 'exclude' }
}

/** Future bets land in one bucket. Past bets and bets with no expiry do not. */
export function betHorizonBucket(a: BetLike, now: number): HorizonBucket | null {
  if (!isBetAsset(a)) return null
  const exp = betExpiryMs(a)
  if (exp === null || exp <= now) return null
  const delta = exp - now
  if (delta <= 7 * DAY) return '7d'
  if (delta <= 30 * DAY) return '30d'
  if (delta <= 90 * DAY) return '90d'
  if (delta <= 365 * DAY) return '1y'
  return 'later'
}

export function applyHorizonStates<T extends BetLike>(
  list: T[],
  states: Record<string, 'neutral' | 'include' | 'exclude' | undefined>,
  now: number,
): T[] {
  const includes = Object.entries(states).filter(([, s]) => s === 'include').map(([k]) => k)
  return list.filter(a => {
    const bucket = betHorizonBucket(a, now)
    if (!bucket) return true
    if (states[bucket] === 'exclude') return false
    if (includes.length && !includes.includes(bucket)) return false
    return true
  })
}

export function countHiddenByHorizonStates<T extends BetLike>(
  list: T[],
  states: Record<string, 'neutral' | 'include' | 'exclude' | undefined>,
  now: number,
): number {
  const bets = list.filter(isBetAsset)
  return bets.length - applyHorizonStates(bets, states, now).length
}
