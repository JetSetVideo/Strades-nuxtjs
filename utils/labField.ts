/**
 * Laboratory bench maths.
 *
 * The map reuses the same personality and performance numbers the nav globe
 * already reads. A pair of agents is one of four operators:
 * - together: money moves the same way and the personalities sit close
 * - against: money moves the opposite way
 * - junction: personalities meet, money has not chosen a side
 * - apart: far in personality, little shared result
 */
import type { Agent } from '~/types/agent'

export const LAB_AXES = [
  { id: 'risk', label: 'Risk' },
  { id: 'patience', label: 'Patience' },
  { id: 'contrarian', label: 'Contrarian' },
  { id: 'aggression', label: 'Aggression' },
  { id: 'reaction_speed', label: 'Speed' },
  { id: 'live_pnl', label: 'Live PnL' },
  { id: 'sharpe', label: 'Sharpe' },
  { id: 'compute', label: 'Compute' },
] as const

export type LabAxis = (typeof LAB_AXES)[number]['id']
export type Operator = 'together' | 'against' | 'apart' | 'junction'
export type WealthCondition = 'calm' | 'shock' | 'trend' | 'chop'

export interface FieldPoint {
  id: string
  name: string
  role: string
  x: number
  y: number
}

export interface Relation {
  a: string
  b: string
  op: Operator
  /** Pearson correlation of the 30-day curves. −1 opposite, +1 the same path. */
  financial: number
  /** 1 − personality distance. 1 means the same five axes. */
  compute: number
}

export interface WealthBead {
  x: number
  y: number
  r: number
  tone: 'up' | 'down' | 'neutral'
}

const PERSONALITY = ['risk', 'aggression', 'reaction_speed', 'patience', 'contrarian'] as const

function hash01(id: string, salt: number): number {
  let h = salt >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

/** 0 when two personalities match, 1 when every axis is at opposite ends. */
export function personalityDistance(a: Agent, b: Agent): number {
  let sum = 0
  for (const key of PERSONALITY) {
    const d = a.personality_matrix[key] - b.personality_matrix[key]
    sum += d * d
  }
  return Math.sqrt(sum / PERSONALITY.length)
}

/** Pearson correlation. A flat series, or fewer than three points, is 0. */
export function seriesCorrelation(left: readonly number[], right: readonly number[]): number {
  const n = Math.min(left.length, right.length)
  if (n < 3) return 0
  let sumL = 0
  let sumR = 0
  for (let i = 0; i < n; i++) {
    sumL += left[i]!
    sumR += right[i]!
  }
  const meanL = sumL / n
  const meanR = sumR / n
  let num = 0
  let devL = 0
  let devR = 0
  for (let i = 0; i < n; i++) {
    const xl = left[i]! - meanL
    const xr = right[i]! - meanR
    num += xl * xr
    devL += xl * xl
    devR += xr * xr
  }
  if (devL <= 1e-9 || devR <= 1e-9) return 0
  return num / Math.sqrt(devL * devR)
}

export function classifyOperator(financial: number, distance: number): Operator {
  if (financial <= -0.3) return 'against'
  if (financial >= 0.45 && distance < 0.5) return 'together'
  if (distance < 0.38 && financial < 0.45) return 'junction'
  if (distance >= 0.55) return 'apart'
  if (financial >= 0.45) return 'together'
  return 'junction'
}

/** One axis, in the units the agent already stores. Compute is 1 − training loss. */
export function axisValue(agent: Agent, axis: LabAxis): number {
  if (axis === 'live_pnl') return agent.performance.live_pnl_pct
  if (axis === 'sharpe') return agent.performance.sharpe
  if (axis === 'compute') return 1 - Math.max(0, Math.min(1, agent.training_state.loss_ema))
  return agent.personality_matrix[axis]
}

/** Min–max both axes across the set so the bench fills the frame. A tie sits in the middle. */
export function projectAgents(agents: readonly Agent[], xAxis: LabAxis, yAxis: LabAxis): FieldPoint[] {
  if (!agents.length) return []
  const xs = agents.map(agent => axisValue(agent, xAxis))
  const ys = agents.map(agent => axisValue(agent, yAxis))
  const loX = Math.min(...xs)
  const hiX = Math.max(...xs)
  const loY = Math.min(...ys)
  const hiY = Math.max(...ys)
  const dx = hiX - loX
  const dy = hiY - loY
  return agents.map((agent, i) => {
    const nx = dx < 1e-9 ? 0.5 : (xs[i]! - loX) / dx
    const ny = dy < 1e-9 ? 0.5 : (ys[i]! - loY) / dy
    const jx = (hash01(agent.id, 1) - 0.5) * 0.03
    const jy = (hash01(agent.id, 2) - 0.5) * 0.03
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role || 'catalog',
      x: Math.max(0, Math.min(1, nx + jx)),
      y: Math.max(0, Math.min(1, ny + jy)),
    }
  })
}

export function pairRelation(a: Agent, b: Agent): Relation {
  const financial = seriesCorrelation(a.performance.last_30d_curve, b.performance.last_30d_curve)
  const distance = personalityDistance(a, b)
  return {
    a: a.id,
    b: b.id,
    op: classifyOperator(financial, distance),
    financial,
    compute: 1 - distance,
  }
}

export function allRelations(agents: readonly Agent[]): Relation[] {
  const out: Relation[] = []
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) out.push(pairRelation(agents[i]!, agents[j]!))
  }
  return out
}

const RANK: Record<Operator, number> = { against: 0, together: 1, junction: 2, apart: 3 }

/**
 * A share of each operator, strongest money-link first inside the bucket.
 * Filling from "against" alone would hide together, junction, and apart.
 */
export function pickRelations(relations: readonly Relation[], limit = 36): Relation[] {
  const buckets: Record<Operator, Relation[]> = { against: [], together: [], junction: [], apart: [] }
  for (const row of relations) buckets[row.op].push(row)
  const order: Operator[] = ['against', 'together', 'junction', 'apart']
  for (const key of order) {
    buckets[key].sort((p, q) => Math.abs(q.financial) - Math.abs(p.financial) || RANK[p.op] - RANK[q.op])
  }
  const present = order.filter(key => buckets[key].length)
  const per = Math.max(1, Math.ceil(limit / Math.max(1, present.length)))
  const out: Relation[] = []
  for (const key of present) out.push(...buckets[key].slice(0, per))
  return out.slice(0, Math.max(0, limit))
}

export function operatorCounts(relations: readonly Relation[]): Record<Operator, number> {
  const counts: Record<Operator, number> = { together: 0, against: 0, apart: 0, junction: 0 }
  for (const relation of relations) counts[relation.op]++
  return counts
}

function asPercent(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0
  return n <= 1 ? n * 100 : n
}

/** Which wealth picture a strategy card should open on. */
export function wealthCondition(input: {
  risk_level?: string
  riskScore?: number
  total_return_percentage?: number
  monthlyGain?: number
  sharpe_ratio?: number
  sharpeRatio?: number
  win_rate?: number
  winRate?: number
}): WealthCondition {
  const ret = input.total_return_percentage ?? input.monthlyGain ?? 0
  const sharpe = input.sharpe_ratio ?? input.sharpeRatio ?? 0
  const win = asPercent(input.win_rate ?? input.winRate)
  const highRisk = input.risk_level === 'high' || (input.riskScore ?? 0) >= 7
  if (highRisk && ret < 0) return 'shock'
  if (sharpe < 0.4 && win > 40 && win < 60) return 'chop'
  if (ret > 8) return 'trend'
  return 'calm'
}

function bead(x: number, y: number, r: number, tone: WealthBead['tone']): WealthBead {
  return {
    x: Math.max(0.04, Math.min(0.96, x)),
    y: Math.max(0.08, Math.min(0.92, y)),
    r,
    tone,
  }
}

/** Beads of capital under one market condition. `phase` is 0…1 and loops. */
export function wealthBeads(condition: WealthCondition, phase = 0): WealthBead[] {
  const p = ((phase % 1) + 1) % 1
  const beads: WealthBead[] = []
  const n = 11
  for (let i = 0; i < n; i++) {
    const u = (i + p) / n
    if (condition === 'calm') {
      beads.push(bead(u, 0.58 + 0.06 * Math.sin(u * 8), 1.5, 'neutral'))
    } else if (condition === 'trend') {
      beads.push(bead(u, 0.78 - u * 0.5, 1.3 + u * 1.4, 'up'))
    } else if (condition === 'shock') {
      const ang = u * Math.PI * 2
      const spread = 0.15 + p * 0.32
      beads.push(bead(0.5 + Math.cos(ang) * spread, 0.5 + Math.sin(ang) * spread * 0.72, 1.7, i % 2 ? 'down' : 'up'))
    } else {
      beads.push(bead(u, 0.5 + 0.32 * Math.sin(u * 16 + p * 6), 1.45, Math.sin(u * 16 + p * 6) > 0 ? 'up' : 'down'))
    }
  }
  return beads
}
