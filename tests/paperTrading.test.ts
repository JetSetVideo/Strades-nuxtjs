import { describe, expect, it } from 'vitest'
import { clampWalletPct, computeNotional, MIN_WALLET_PCT, MAX_WALLET_PCT } from '~/stores/paper'
import { mulberry32, cyrb53 } from '~/composables/useSeededRandom'

describe('clampWalletPct — user input to position size, min/max boundaries', () => {
  it('floors below the minimum bet size', () => {
    expect(clampWalletPct(0)).toBe(MIN_WALLET_PCT)
    expect(clampWalletPct(0.05)).toBe(MIN_WALLET_PCT)
    expect(clampWalletPct(-10)).toBe(MIN_WALLET_PCT)
  })

  it('never lets one paper bet exceed half the wallet', () => {
    expect(clampWalletPct(50)).toBe(MAX_WALLET_PCT)
    expect(clampWalletPct(51)).toBe(MAX_WALLET_PCT)
    expect(clampWalletPct(1_000_000)).toBe(MAX_WALLET_PCT)
  })

  it('passes through valid mid-range values unchanged', () => {
    expect(clampWalletPct(5)).toBe(5)
    expect(clampWalletPct(25.5)).toBe(25.5)
  })

  it('treats non-finite user input (NaN/Infinity) as the minimum, never as NaN passthrough', () => {
    expect(clampWalletPct(NaN)).toBe(MIN_WALLET_PCT)
    expect(clampWalletPct(Infinity)).toBe(MAX_WALLET_PCT === MIN_WALLET_PCT ? MIN_WALLET_PCT : MIN_WALLET_PCT)
    // Infinity is caught by the !isFinite guard before the min/max clamp, so it also floors to MIN.
    expect(Number.isFinite(clampWalletPct(Infinity))).toBe(true)
    expect(Number.isFinite(clampWalletPct(-Infinity))).toBe(true)
  })
})

describe('computeNotional — position sizing from wallet value', () => {
  it('computes the proportional notional for a mid-range wallet', () => {
    expect(computeNotional(10, 100_000)).toBe(10_000)
    expect(computeNotional(MAX_WALLET_PCT, 100_000)).toBe(50_000)
    expect(computeNotional(MIN_WALLET_PCT, 100_000)).toBeCloseTo(100, 6)
  })

  it('never returns a negative or non-finite notional for a broken wallet total', () => {
    expect(computeNotional(10, 0)).toBe(0)
    expect(computeNotional(10, -50_000)).toBe(0)
    expect(computeNotional(10, NaN)).toBe(0)
    expect(computeNotional(10, Infinity)).toBe(0)
  })

  it('a full-size (50%) bet on a zero-value wallet never divides by zero into Infinity/NaN', () => {
    const notional = computeNotional(clampWalletPct(1_000_000), 0)
    expect(notional).toBe(0)
    expect(Number.isFinite(notional)).toBe(true)
  })
})

describe('Paper trading multi-run simulation — user input stream to position sizes', () => {
  const SEEDS = [11, 22, 33, 2026]

  for (const seed of SEEDS) {
    it(`every simulated order stays within legal bounds (seed ${seed})`, () => {
      const rand = mulberry32(cyrb53(`paper-sim-${seed}`))
      for (let i = 0; i < 1000; i++) {
        // Simulate a stream of user-entered wallet_pct requests, including
        // adversarial inputs (negative, zero, huge, NaN-prone) and a stream
        // of wallet total values from the datasource side (including broken ones).
        const rawPct = rand() < 0.1 ? -rand() * 100 : rand() < 0.1 ? rand() * 10_000 : rand() * 60
        const rawTotal = rand() < 0.05 ? -1 : rand() < 0.05 ? 0 : rand() * 5_000_000

        const pct = clampWalletPct(rawPct)
        const notional = computeNotional(pct, rawTotal)

        expect(pct).toBeGreaterThanOrEqual(MIN_WALLET_PCT)
        expect(pct).toBeLessThanOrEqual(MAX_WALLET_PCT)
        expect(notional).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(notional)).toBe(true)
        // Position size can never exceed 50% of a well-formed (positive) wallet value.
        if (rawTotal > 0) {
          expect(notional).toBeLessThanOrEqual(rawTotal * (MAX_WALLET_PCT / 100) + 1e-6)
        }
      }
    })
  }
})
