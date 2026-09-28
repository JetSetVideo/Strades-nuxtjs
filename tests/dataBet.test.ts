import { describe, expect, it } from 'vitest'
import {
  clampStake,
  computeParimutuelPayout,
  MIN_STAKE,
  MAX_STAKE,
  type BetSide
} from '~/types/dataBet'
import { mulberry32, cyrb53 } from '~/composables/useSeededRandom'

describe('clampStake — min/max boundaries', () => {
  it('floors below MIN_STAKE up to the minimum', () => {
    expect(clampStake(0, 1000)).toBe(MIN_STAKE)
    expect(clampStake(0.4, 1000)).toBe(MIN_STAKE)
    expect(clampStake(-50, 1000)).toBe(MIN_STAKE)
  })

  it('caps above MAX_STAKE at the maximum when affordable', () => {
    expect(clampStake(MAX_STAKE + 10_000, 1_000_000)).toBe(MAX_STAKE)
  })

  it('never lets a stake exceed the bettor balance', () => {
    expect(clampStake(500, 50)).toBe(50)
    expect(clampStake(1, 50)).toBe(MIN_STAKE)
  })

  it('refuses the bet (returns 0) when balance is below the minimum stake', () => {
    expect(clampStake(10, 0)).toBe(0)
    expect(clampStake(10, 0.9)).toBe(0)
    expect(clampStake(10, -5)).toBe(0)
  })

  it('rounds to a whole number of credits', () => {
    expect(clampStake(10.6, 1000)).toBe(11)
    expect(Number.isInteger(clampStake(33.33, 1000))).toBe(true)
  })

  it('is idempotent at the exact boundary values', () => {
    expect(clampStake(MIN_STAKE, MIN_STAKE)).toBe(MIN_STAKE)
    expect(clampStake(MAX_STAKE, MAX_STAKE)).toBe(MAX_STAKE)
  })
})

describe('computeParimutuelPayout — the house never pays out more than it holds', () => {
  const base = { stake: 100, pool_yes: 300, pool_no: 200 }

  it('refunds the full stake on void, regardless of side', () => {
    expect(computeParimutuelPayout({ ...base, side: 'yes', winSide: null })).toBe(100)
    expect(computeParimutuelPayout({ ...base, side: 'no', winSide: null })).toBe(100)
  })

  it('pays 0 to the losing side', () => {
    expect(computeParimutuelPayout({ ...base, side: 'no', winSide: 'yes' })).toBe(0)
    expect(computeParimutuelPayout({ ...base, side: 'yes', winSide: 'no' })).toBe(0)
  })

  it('pays stake + pro-rata share of the losing pool to winners', () => {
    // This bettor is 100 of the 300 total YES stake (1/3) — should get 1/3 of the 200 NO pool.
    const payout = computeParimutuelPayout({ ...base, side: 'yes', winSide: 'yes' })
    expect(payout).toBeCloseTo(100 + (100 / 300) * 200, 6) // 166.667
  })

  it('handles the whole-pool case: a single bettor takes the entire opposing pool', () => {
    const payout = computeParimutuelPayout({ stake: 50, side: 'yes', winSide: 'yes', pool_yes: 50, pool_no: 400 })
    expect(payout).toBeCloseTo(450, 6)
  })

  it('degenerate case: winning pool recorded as 0 refunds stake instead of dividing by zero', () => {
    const payout = computeParimutuelPayout({ stake: 20, side: 'yes', winSide: 'yes', pool_yes: 0, pool_no: 500 })
    expect(payout).toBe(20)
    expect(Number.isFinite(payout)).toBe(true)
  })

  it('a zero or negative stake never produces a payout', () => {
    expect(computeParimutuelPayout({ ...base, stake: 0, side: 'yes', winSide: 'yes' })).toBe(0)
    expect(computeParimutuelPayout({ ...base, stake: -10, side: 'yes', winSide: 'yes' })).toBe(0)
  })
})

describe('Arena multi-run simulation — credit conservation under random betting activity', () => {
  /**
   * Simulates many independent challenges, each with a random number of
   * random-sized bets on a random side, then resolves each to a random
   * outcome (including void) and checks the core financial invariant:
   * total paid out to bettors never exceeds the total staked into the pool.
   * Runs the whole thing multiple times with different seeds so a single
   * lucky RNG draw can't hide a rounding leak.
   */
  const SEEDS = [1, 2, 3, 42, 12345]

  for (const seed of SEEDS) {
    it(`holds the conservation invariant for seed ${seed}`, () => {
      const rand = mulberry32(cyrb53(`arena-sim-${seed}`))
      const NUM_CHALLENGES = 200

      for (let c = 0; c < NUM_CHALLENGES; c++) {
        const numBets = 1 + Math.floor(rand() * 20)
        const bets: { stake: number; side: BetSide }[] = []
        let pool_yes = 0
        let pool_no = 0

        for (let i = 0; i < numBets; i++) {
          const side: BetSide = rand() < 0.5 ? 'yes' : 'no'
          const rawStake = rand() * 600 - 50 // occasionally negative/out-of-range, exercising the clamp
          const balance = Math.floor(rand() * 1000)
          const stake = clampStake(rawStake, balance)
          if (stake === 0) continue // bet refused — no credits ever leave this bettor
          bets.push({ stake, side })
          if (side === 'yes') pool_yes += stake
          else pool_no += stake
        }

        const outcomeRoll = rand()
        const winSide: BetSide | null = outcomeRoll < 0.45 ? 'yes' : outcomeRoll < 0.9 ? 'no' : null

        const totalPool = pool_yes + pool_no
        const totalPayout = bets.reduce(
          (sum, b) => sum + computeParimutuelPayout({ stake: b.stake, side: b.side, winSide, pool_yes, pool_no }),
          0
        )

        // Allow only floating-point epsilon slack — never a real surplus.
        expect(totalPayout).toBeLessThanOrEqual(totalPool + 1e-6)
        expect(totalPayout).toBeGreaterThanOrEqual(0)
      }
    })
  }
})
