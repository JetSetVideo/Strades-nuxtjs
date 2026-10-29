import { describe, expect, it } from 'vitest'
import {
  allRelations, axisValue, classifyOperator, operatorCounts, pairRelation,
  personalityDistance, pickRelations, projectAgents, seriesCorrelation,
  wealthBeads, wealthCondition,
} from '~/utils/labField'
import { deskAgents } from '~/utils/labRoster'

const desk = deskAgents()
const byRole = Object.fromEntries(desk.map(agent => [agent.role, agent]))

describe('laboratory desk', () => {
  it('ships twelve roles on the demo owner', () => {
    expect(desk).toHaveLength(12)
    expect(new Set(desk.map(agent => agent.role)).size).toBe(12)
    expect(desk.every(agent => agent.owner_id === 'user_001')).toBe(true)
  })
})

describe('series correlation and operators', () => {
  it('reads identical, opposite, and flat series', () => {
    expect(seriesCorrelation([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 6)
    expect(seriesCorrelation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 6)
    expect(seriesCorrelation([5, 5, 5, 5], [1, 2, 3, 4])).toBe(0)
  })

  it('places the desk pairs on the four operators', () => {
    expect(pairRelation(byRole.optimisation!, byRole.risk!).op).toBe('together')
    expect(pairRelation(byRole.trader!, byRole.security!).op).toBe('against')
    expect(pairRelation(byRole.designer!, byRole.experience!).op).toBe('junction')
    expect(pairRelation(byRole.archive!, byRole.execution!).op).toBe('apart')
  })

  it('classifies a collision before a distant pair', () => {
    expect(classifyOperator(-0.8, 0.1)).toBe('against')
    expect(classifyOperator(0.9, 0.1)).toBe('together')
    expect(classifyOperator(0.1, 0.1)).toBe('junction')
    expect(classifyOperator(0.1, 0.8)).toBe('apart')
  })

  it('keeps together pairs closer in personality than apart pairs', () => {
    const close = personalityDistance(byRole.optimisation!, byRole.risk!)
    const far = personalityDistance(byRole.archive!, byRole.execution!)
    expect(close).toBeLessThan(0.2)
    expect(far).toBeGreaterThan(0.55)
  })

  it('keeps a share of every operator in the drawing', () => {
    const picked = pickRelations(allRelations(desk), 12)
    const ops = new Set(picked.map(row => row.op))
    expect(ops.has('against')).toBe(true)
    expect(ops.has('together')).toBe(true)
    expect(ops.has('junction')).toBe(true)
    expect(ops.has('apart')).toBe(true)
    const counts = operatorCounts(allRelations(desk))
    expect(counts.together + counts.against + counts.apart + counts.junction).toBe(66)
  })
})

describe('field projection', () => {
  it('spreads the extremes and reads compute from training loss', () => {
    const points = projectAgents(
      [byRole.optimisation!, byRole.trader!],
      'patience',
      'risk',
    )
    const patient = points.find(point => point.role === 'optimisation')!
    const fast = points.find(point => point.role === 'trader')!
    expect(patient.x).toBeGreaterThan(fast.x)
    expect(fast.y).toBeGreaterThan(patient.y)
    expect(axisValue(byRole.data!, 'compute')).toBeCloseTo(0.96, 5)
  })
})

describe('wealth transfer', () => {
  it('keeps beads inside the frame for every condition', () => {
    for (const condition of ['calm', 'shock', 'trend', 'chop'] as const) {
      const beads = wealthBeads(condition, 0.4)
      expect(beads).toHaveLength(11)
      for (const bead of beads) {
        expect(bead.x).toBeGreaterThanOrEqual(0.04)
        expect(bead.x).toBeLessThanOrEqual(0.96)
        expect(bead.y).toBeGreaterThanOrEqual(0.08)
        expect(bead.y).toBeLessThanOrEqual(0.92)
      }
    }
  })

  it('picks the picture from the strategy that is already on the card', () => {
    expect(wealthCondition({ risk_level: 'high', total_return_percentage: -4 })).toBe('shock')
    expect(wealthCondition({ monthlyGain: 12, winRate: 60 })).toBe('trend')
    expect(wealthCondition({ sharpeRatio: 0.2, winRate: 50, monthlyGain: 1 })).toBe('chop')
    expect(wealthCondition({ monthlyGain: 2, winRate: 70, sharpeRatio: 1.2 })).toBe('calm')
  })
})
