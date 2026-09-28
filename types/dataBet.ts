/**
 * The Arena — the "crypto prototype": users post data (their own claim, or a
 * pick against a real tracked asset) and the community wagers free credits
 * on it. Nothing here touches real money; `credits` are a house play-currency
 * (see stores/credits.ts) and every position is explicitly a paper trade.
 */

export type ChallengeKind = 'market' | 'custom'
export type ChallengeStatus = 'open' | 'resolved_yes' | 'resolved_no' | 'void'
export type BetSide = 'yes' | 'no'

export interface DataChallenge {
  id: string
  author_id: string
  kind: ChallengeKind
  title: string
  /** For 'custom': the author's own claim/data, in their words. For 'market': auto-filled summary. */
  description: string
  created_at: string
  resolves_at: string
  status: ChallengeStatus

  // --- 'market' kind: settled automatically against the live synthetic feed ---
  asset_id?: string
  asset_symbol?: string
  comparator?: 'above' | 'below'
  target_price?: number
  resolution_price?: number

  // --- 'custom' kind: settled by a majority vote of the bettors themselves ---
  votes_yes?: string[] // user ids
  votes_no?: string[]  // user ids

  /** Pari-mutuel pools in free credits. */
  pool_yes: number
  pool_no: number
}

export interface DataBet {
  id: string
  challenge_id: string
  user_id: string
  side: BetSide
  /** Free credits staked — clamped to [MIN_STAKE, MAX_STAKE] at placement time. */
  stake: number
  placed_at: string
  settled: boolean
  /** Stake back + share of the losing pool, or 0 on a loss. Undefined until settlement. */
  payout?: number
}

export const MIN_STAKE = 1
export const MAX_STAKE = 500

/**
 * Clamp a raw stake request to the legal range and to what the bettor can
 * actually afford. Returns 0 (meaning: bet refused) when the bettor's balance
 * can't cover even the minimum stake — never lets a stake exceed `balance`.
 */
export function clampStake(raw: number, balance: number): number {
  const affordable = Math.max(0, Math.min(MAX_STAKE, balance))
  if (affordable < MIN_STAKE) return 0
  return Math.round(Math.max(MIN_STAKE, Math.min(affordable, raw || 0)))
}

/**
 * Pari-mutuel settlement for one bet: winners split the losing pool pro-rata
 * by stake and get their own stake back; losers get 0; a void market refunds
 * the full stake. Pure so it can be exhaustively unit-tested — this is the
 * one function standing between the house and paying out credits it doesn't
 * have, so every branch must be bounded and never divide by zero.
 *
 * Invariant this must uphold across a whole challenge: sum(payouts) <=
 * pool_yes + pool_no (the house never manufactures credits from nothing).
 */
export function computeParimutuelPayout(args: {
  stake: number
  side: BetSide
  /** null => market voided, everyone refunded */
  winSide: BetSide | null
  pool_yes: number
  pool_no: number
}): number {
  const { stake, side, winSide, pool_yes, pool_no } = args
  if (stake <= 0) return 0
  if (winSide === null) return stake // void — full refund
  if (side !== winSide) return 0 // lost the bet
  const winPool = winSide === 'yes' ? pool_yes : pool_no
  const losePool = winSide === 'yes' ? pool_no : pool_yes
  if (winPool <= 0) return stake // degenerate: no recorded stake on the winning side, refund only
  return stake + (stake / winPool) * losePool
}
