import { describe, expect, it } from 'vitest'
import { ancestors, beta, buildMarketTree, flattenTree, propagateShock, siblingWeights, toReturns, type LeafInput } from '~/utils/marketTree'

const leaves: LeafInput[] = [
  { id: 'btc', label: 'Bitcoin', classKey: 'cryptocurrency', sectorKey: 'crypto', cap: 300, ret: 0.02 },
  { id: 'eth', label: 'Ether', classKey: 'cryptocurrency', sectorKey: 'crypto', cap: 100, ret: -0.04 },
  { id: 'aapl', label: 'Apple', classKey: 'stock', sectorKey: 'technology', cap: 600, ret: 0.01 },
  { id: 'usd', label: 'Dollar', classKey: 'fiat_currency', sectorKey: 'forex', ret: 0 },
]

describe('siblingWeights', () => {
  it('is cap-weighted when every cap is known', () => {
    expect(siblingWeights([300, 100])).toEqual([0.75, 0.25])
  })
  it('falls back to equal weights when any cap is missing', () => {
    expect(siblingWeights([300, null])).toEqual([0.5, 0.5])
  })
})

describe('UP: children aggregate into parents', () => {
  const root = buildMarketTree(leaves)
  const crypto = root.children.find(c => c.id === 'class:cryptocurrency')!

  it('parent return is the weighted sum of child returns', () => {
    // 0.75 * 0.02 + 0.25 * -0.04 = 0.005
    expect(crypto.ret).toBeCloseTo(0.005, 12)
  })

  it('contributions sum to the parent return at every node', () => {
    for (const n of flattenTree(root)) {
      if (!n.children.length) continue
      const sum = n.children.reduce((s, c) => s + c.contribution, 0)
      expect(sum).toBeCloseTo(n.ret, 12)
    }
  })

  it('market return equals Σ global weight × leaf return', () => {
    const leafRows = flattenTree(root).filter(n => n.level === 'asset')
    const viaLeaves = leafRows.reduce((s, n) => s + n.globalWeight * n.ret, 0)
    expect(viaLeaves).toBeCloseTo(root.ret, 12)
    expect(leafRows.reduce((s, n) => s + n.globalWeight, 0)).toBeCloseTo(1, 12)
  })

  it('parent cap is the sum of child caps', () => {
    expect(crypto.cap).toBe(400)
  })
})

describe('DOWN: parents propagate into children', () => {
  it('expected + residual reconstruct the child return', () => {
    const root = buildMarketTree(leaves)
    for (const n of flattenTree(root)) {
      expect(n.expected + n.residual).toBeCloseTo(n.ret, 12)
    }
  })

  it('beta is assumed 1 without history', () => {
    const root = buildMarketTree(leaves)
    const btc = flattenTree(root).find(n => n.id === 'btc')!
    expect(btc.beta).toBe(1)
    expect(btc.betaAssumed).toBe(true)
  })

  it('beta is estimated from shared history', () => {
    const p = [0.01, -0.02, 0.03, -0.01, 0.02]
    expect(beta(p.map(x => 2 * x), p)).toBeCloseTo(2, 12)
    const root = buildMarketTree([
      { id: 'a', label: 'A', classKey: 'c', sectorKey: 's', cap: 1, ret: 0.02, history: p.map(x => 2 * x) },
      { id: 'b', label: 'B', classKey: 'c', sectorKey: 's', cap: 1, ret: 0.0, history: p.map(() => 0) },
    ])
    const a = flattenTree(root).find(n => n.id === 'a')!
    // sector history = 0.5*2p + 0.5*0 = p, so β_a = 2 exactly
    expect(a.betaAssumed).toBe(false)
    expect(a.beta).toBeCloseTo(2, 12)
  })

  it('shocks propagate down through betas', () => {
    const p = [0.01, -0.02, 0.03, -0.01, 0.02]
    const root = buildMarketTree([
      { id: 'a', label: 'A', classKey: 'c', sectorKey: 's', cap: 1, ret: 0, history: p.map(x => 2 * x) },
      { id: 'b', label: 'B', classKey: 'c', sectorKey: 's', cap: 1, ret: 0, history: p.map(() => 0) },
    ])
    const moves = propagateShock(root, 'sector:c/s', -0.1)
    expect(moves.get('a')).toBeCloseTo(-0.2, 12)
    expect(moves.get('b')).toBeCloseTo(0, 12)
  })
})

describe('helpers', () => {
  it('ancestors lists the stages from the top parent down', () => {
    const root = buildMarketTree(leaves)
    expect(ancestors(root, 'eth').map(n => n.level)).toEqual(['market', 'class', 'sector', 'asset'])
  })
  it('toReturns', () => {
    expect(toReturns([100, 110, 99])).toEqual([0.10000000000000009, -0.09999999999999998])
  })
})
