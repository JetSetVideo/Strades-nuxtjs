/**
 * marketTree — the price hierarchy and the equations that link its stages.
 *
 *   Market ─┬─ Asset class (stock, cryptocurrency, …)
 *           │    └─ Sector (asset.category)
 *           │         └─ Asset (leaf, carries the observed price + return)
 *
 * UP — children → parent (aggregation)
 *   weight         w_i   = cap_i / Σ_j cap_j            (equal 1/n when caps are missing)
 *   parent return  r_P   = Σ_i w_i · r_i
 *   contribution   c_i   = w_i · r_i                     so Σ_i c_i = r_P exactly
 *   global weight  W_i   = Π w along the path to the root, and r_Market = Σ_leaves W_i · r_i
 *   parent cap     cap_P = Σ_i cap_i
 *
 * DOWN — parent → children (propagation)
 *   beta           β_i   = Cov(r_i, r_P) / Var(r_P)      over a shared return history;
 *                                                       β_i = 1 (assumed) when there is none
 *   expected move  E_i   = β_i · r_P                     the part of the child's move its parent explains
 *   residual       ε_i   = r_i − E_i                     the child's own (idiosyncratic) move
 *   shock          Δp_i  = p_i · β_i · s                 child price impact of a parent shock s
 *
 * Returns are fractions (0.012 = +1.2%). Everything here is pure and
 * framework-free so it is unit-tested directly (tests/marketTree.test.ts).
 */

export type TreeLevel = 'market' | 'class' | 'sector' | 'asset'

export interface LeafInput {
  id: string
  label: string
  classKey: string
  sectorKey: string
  /** Market cap in USD; missing/0 → equal weighting among siblings. */
  cap?: number | null
  /** Period return as a fraction. */
  ret: number
  price?: number
  /** Optional return history (same length/alignment across leaves) for beta. */
  history?: number[]
}

export interface MarketNode {
  id: string
  label: string
  level: TreeLevel
  depth: number
  parentId: string | null
  children: MarketNode[]
  cap: number
  weight: number        // w_i within parent (root: 1)
  globalWeight: number  // W_i within market
  ret: number           // r (leaf: observed; parent: Σ w r)
  contribution: number  // c_i = w_i r_i (root: r)
  beta: number          // β_i to parent (root: 1)
  betaAssumed: boolean
  expected: number      // E_i = β_i r_P
  residual: number      // ε_i = r_i − E_i
  price?: number
  history?: number[]    // aggregated return history (parent = Σ w h)
}

export const CLASS_LABELS: Record<string, string> = {
  stock: 'Stocks',
  cryptocurrency: 'Crypto',
  fiat_currency: 'Forex',
  commodity: 'Commodities',
}

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/** w_i = cap_i / Σ cap; equal weights if any sibling lacks a cap (mixing would bias toward the known ones). */
export function siblingWeights(caps: (number | null | undefined)[]): number[] {
  const n = caps.length
  if (n === 0) return []
  const known = caps.every(c => typeof c === 'number' && c > 0)
  if (!known) return caps.map(() => 1 / n)
  const total = (caps as number[]).reduce((s, c) => s + c, 0)
  return (caps as number[]).map(c => c / total)
}

/** β = Cov(x, y) / Var(y). Null when there is not enough variance to say. */
export function beta(child: number[], parent: number[]): number | null {
  const n = Math.min(child.length, parent.length)
  if (n < 3) return null
  let mx = 0, my = 0
  for (let i = 0; i < n; i++) { mx += child[i]!; my += parent[i]! }
  mx /= n; my /= n
  let cov = 0, vy = 0
  for (let i = 0; i < n; i++) {
    const dx = child[i]! - mx, dy = parent[i]! - my
    cov += dx * dy
    vy += dy ** 2
  }
  return vy > 1e-18 ? cov / vy : null
}

/** Simple returns r_t = p_t / p_{t−1} − 1. */
export function toReturns(prices: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!, cur = prices[i]!
    if (prev > 0) out.push(cur / prev - 1)
  }
  return out
}

function node(id: string, label: string, level: TreeLevel, depth: number, parentId: string | null): MarketNode {
  return {
    id, label, level, depth, parentId, children: [], cap: 0, weight: 1, globalWeight: 1,
    ret: 0, contribution: 0, beta: 1, betaAssumed: true, expected: 0, residual: 0,
  }
}

/** UP pass: post-order, computes weights, caps, returns and contributions. */
function aggregateUp(n: MarketNode): void {
  if (n.children.length === 0) return
  n.children.forEach(aggregateUp)
  const caps = n.children.map(c => (c.cap > 0 ? c.cap : null))
  const w = siblingWeights(caps)
  n.cap = n.children.reduce((s, c) => s + (c.cap || 0), 0)
  n.ret = 0
  n.children.forEach((c, i) => {
    c.weight = w[i] ?? 0
    c.contribution = c.weight * c.ret
    n.ret += c.contribution
  })
  // Parent history = weighted sum of children histories, when every child has one of equal length.
  const hs = n.children.map(c => c.history)
  const len = hs[0]?.length ?? 0
  if (len > 0 && hs.every(h => h && h.length === len)) {
    n.history = Array.from({ length: len }, (_, t) => n.children.reduce((s, c, i) => s + (w[i] ?? 0) * (c.history![t] ?? 0), 0))
  }
}

/** DOWN pass: pre-order, computes global weight, beta, expected move and residual. */
function propagateDown(n: MarketNode, parent: MarketNode | null): void {
  if (parent) {
    n.globalWeight = parent.globalWeight * n.weight
    const b = n.history && parent.history ? beta(n.history, parent.history) : null
    n.beta = b ?? 1
    n.betaAssumed = b === null
    n.expected = n.beta * parent.ret
    n.residual = n.ret - n.expected
  } else {
    n.globalWeight = 1
    n.contribution = n.ret
    n.expected = n.ret
    n.residual = 0
  }
  n.children.forEach(c => propagateDown(c, n))
}

export function buildMarketTree(leaves: LeafInput[]): MarketNode {
  const root = node('market', 'Market', 'market', 0, null)
  const classes = new Map<string, MarketNode>()
  const sectors = new Map<string, MarketNode>()

  for (const leaf of leaves) {
    let cls = classes.get(leaf.classKey)
    if (!cls) {
      cls = node(`class:${leaf.classKey}`, CLASS_LABELS[leaf.classKey] ?? titleCase(leaf.classKey), 'class', 1, root.id)
      classes.set(leaf.classKey, cls)
      root.children.push(cls)
    }
    const sKey = `${leaf.classKey}/${leaf.sectorKey}`
    let sec = sectors.get(sKey)
    if (!sec) {
      sec = node(`sector:${sKey}`, titleCase(leaf.sectorKey), 'sector', 2, cls.id)
      sectors.set(sKey, sec)
      cls.children.push(sec)
    }
    const a = node(leaf.id, leaf.label, 'asset', 3, sec.id)
    a.cap = leaf.cap && leaf.cap > 0 ? leaf.cap : 0
    a.ret = Number.isFinite(leaf.ret) ? leaf.ret : 0
    a.price = leaf.price
    a.history = leaf.history
    sec.children.push(a)
  }

  aggregateUp(root)
  propagateDown(root, null)
  return root
}

/** Depth-first rows for a table, children sorted by |contribution| (biggest drivers first). */
export function flattenTree(root: MarketNode, isOpen: (id: string) => boolean = () => true): MarketNode[] {
  const out: MarketNode[] = []
  const walk = (n: MarketNode) => {
    out.push(n)
    if (n.children.length && isOpen(n.id)) {
      ;[...n.children].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).forEach(walk)
    }
  }
  walk(root)
  return out
}

/** Path from the root to a node id (the "stages" above it). */
export function ancestors(root: MarketNode, id: string): MarketNode[] {
  const path: MarketNode[] = []
  const find = (n: MarketNode): boolean => {
    path.push(n)
    if (n.id === id) return true
    for (const c of n.children) if (find(c)) return true
    path.pop()
    return false
  }
  return find(root) ? path : []
}

/**
 * DOWN: apply a hypothetical shock s (fraction) at node `id` and propagate it
 * to every descendant through the betas: s_child = β_child · s_parent.
 * Returns the implied move per descendant id (including the node itself).
 */
export function propagateShock(root: MarketNode, id: string, shock: number): Map<string, number> {
  const out = new Map<string, number>()
  const start = ancestors(root, id).at(-1)
  if (!start) return out
  const walk = (n: MarketNode, s: number) => {
    out.set(n.id, s)
    n.children.forEach(c => walk(c, c.beta * s))
  }
  walk(start, shock)
  return out
}
