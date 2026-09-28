import { describe, expect, it } from 'vitest'
import { clampRegimeProbs, argmaxRegime, type RegimeProbabilities } from '~/types/agent'
import { mulberry32, cyrb53 } from '~/composables/useSeededRandom'

const REGIMES = ['bull', 'bear', 'chop', 'crisis'] as const
const sum = (p: RegimeProbabilities) => p.bull + p.bear + p.chop + p.crisis

describe('clampRegimeProbs — Jev must always emit a valid probability simplex', () => {
  it('normalizes an already-valid distribution to itself', () => {
    const p = clampRegimeProbs({ bull: 0.4, bear: 0.2, chop: 0.3, crisis: 0.1 })
    expect(sum(p)).toBeCloseTo(1, 10)
    expect(p.bull).toBeCloseTo(0.4, 10)
  })

  it('normalizes an unnormalized (raw score) input to sum to 1', () => {
    const p = clampRegimeProbs({ bull: 4, bear: 2, chop: 3, crisis: 1 })
    expect(sum(p)).toBeCloseTo(1, 10)
    expect(p.bull).toBeCloseTo(0.4, 10)
  })

  it('floors negative inputs to 0 before normalizing', () => {
    const p = clampRegimeProbs({ bull: -5, bear: 5, chop: 0, crisis: 0 })
    expect(p.bull).toBe(0)
    expect(p.bear).toBeCloseTo(1, 10)
    expect(sum(p)).toBeCloseTo(1, 10)
  })

  it('falls back to a uniform simplex when every input is zero or missing', () => {
    const p = clampRegimeProbs({})
    expect(sum(p)).toBeCloseTo(1, 10)
    for (const r of REGIMES) expect(p[r]).toBeCloseTo(0.25, 10)
  })

  it('falls back to uniform when all inputs are negative (total <= 0)', () => {
    const p = clampRegimeProbs({ bull: -1, bear: -2, chop: -3, crisis: -4 })
    for (const r of REGIMES) expect(p[r]).toBeCloseTo(0.25, 10)
  })

  it('handles one dominant regime at the extreme (near-1.0 concentration)', () => {
    const p = clampRegimeProbs({ bull: 1e9, bear: 1, chop: 1, crisis: 1 })
    expect(p.bull).toBeGreaterThan(0.999)
    expect(sum(p)).toBeCloseTo(1, 6)
  })
})

describe('argmaxRegime', () => {
  it('picks the single highest-probability regime', () => {
    expect(argmaxRegime({ bull: 0.1, bear: 0.6, chop: 0.2, crisis: 0.1 })).toBe('bear')
  })

  it('resolves an exact tie deterministically (first regime in fixed scan order wins)', () => {
    const tie = argmaxRegime({ bull: 0.25, bear: 0.25, chop: 0.25, crisis: 0.25 })
    expect(REGIMES).toContain(tie)
    // Same input must always resolve to the same regime — determinism matters for a
    // "confidence" read-out the UI displays, not just for this test.
    expect(argmaxRegime({ bull: 0.25, bear: 0.25, chop: 0.25, crisis: 0.25 })).toBe(tie)
  })
})

describe('Classifier multi-run simulation — random feature scores always yield a valid, stable prediction', () => {
  const SEEDS = [7, 99, 2026, 555]

  for (const seed of SEEDS) {
    it(`stays within bounds across 500 random ticks (seed ${seed})`, () => {
      const rand = mulberry32(cyrb53(`jev-sim-${seed}`))
      for (let i = 0; i < 500; i++) {
        // Simulate raw, unnormalized feature-derived scores, including edge cases:
        // occasional zeros and occasional huge spikes (volatility shocks).
        const raw = {
          bull: rand() < 0.05 ? 0 : rand() * (rand() < 0.02 ? 1000 : 1),
          bear: rand() < 0.05 ? 0 : rand() * (rand() < 0.02 ? 1000 : 1),
          chop: rand() < 0.05 ? 0 : rand(),
          crisis: rand() < 0.05 ? 0 : rand()
        }
        const probs = clampRegimeProbs(raw)
        expect(sum(probs)).toBeCloseTo(1, 6)
        for (const r of REGIMES) {
          expect(probs[r]).toBeGreaterThanOrEqual(0)
          expect(probs[r]).toBeLessThanOrEqual(1)
        }
        const predicted = argmaxRegime(probs)
        expect(REGIMES).toContain(predicted)
        // The argmax must always be the regime with the (weakly) largest mass.
        expect(probs[predicted]).toBeGreaterThanOrEqual(Math.max(...REGIMES.map(r => probs[r])) - 1e-12)
      }
    })
  }
})
