/**
 * A call can be one point, or a path of points that only move forward in time.
 * The last point is the target. Earlier points are the legs. Dropping one
 * reconnects the neighbours, so the path stays a single call.
 */

export interface PathStop {
  t: number
  price: number
}

export type PathPattern = 'up' | 'down' | 'down-up' | 'up-down' | 'mixed'

export const PATTERN_COLOR: Record<PathPattern, string> = {
  up: '#00ff88',
  down: '#ff4444',
  'down-up': '#ff9a3c',
  'up-down': '#ffb020',
  mixed: '#ff8a2a',
}

export function userStops(p: { legs?: PathStop[] | null; targetTs?: number; predictedPrice: number; targetDate?: string }): PathStop[] {
  const endT = Number.isFinite(p.targetTs) ? p.targetTs! : Date.parse(p.targetDate ?? '')
  const legs = (p.legs ?? [])
    .filter(s => s && Number.isFinite(s.t) && Number.isFinite(s.price) && (!Number.isFinite(endT) || s.t < endT))
    .sort((a, b) => a.t - b.t)
  if (!Number.isFinite(endT) || !Number.isFinite(p.predictedPrice)) return legs
  return [...legs, { t: endT, price: p.predictedPrice }]
}

/** Append a point only when it is strictly later than the current end. */
export function extendStops(stops: PathStop[], next: PathStop, minGapMs = 0): PathStop[] | null {
  if (!Number.isFinite(next.t) || !Number.isFinite(next.price)) return null
  const last = stops[stops.length - 1]
  if (last && next.t <= last.t + Math.max(0, minGapMs)) return null
  return [...stops, { t: next.t, price: next.price }]
}

/** Remove one stop. The path reconnects. An empty result means the call is gone. */
export function dropStop(stops: PathStop[], index: number): PathStop[] {
  if (index < 0 || index >= stops.length) return stops
  return stops.filter((_, i) => i !== index)
}

/**
 * Direction changes along the path, starting from the price when the call was made.
 * One direction is up or down. One reversal is down-up or up-down. Anything longer is mixed.
 */
export function pathPattern(startPrice: number, stops: PathStop[]): PathPattern {
  const prices = [startPrice, ...stops.map(s => s.price)].filter(n => Number.isFinite(n))
  const dirs: Array<'up' | 'down'> = []
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i]! - prices[i - 1]!
    if (Math.abs(d) <= Math.max(1e-9, Math.abs(prices[i - 1]!) * 1e-6)) continue
    const dir: 'up' | 'down' = d > 0 ? 'up' : 'down'
    if (dirs[dirs.length - 1] !== dir) dirs.push(dir)
  }
  if (dirs.length <= 1) return dirs[0] ?? 'up'
  if (dirs.length === 2 && dirs[0] === 'down' && dirs[1] === 'up') return 'down-up'
  if (dirs.length === 2 && dirs[0] === 'up' && dirs[1] === 'down') return 'up-down'
  return 'mixed'
}

/** Split stops into the legs to store and the final target. */
export function splitStops(stops: PathStop[]): { legs: PathStop[]; end: PathStop } | null {
  if (!stops.length) return null
  const end = stops[stops.length - 1]!
  return { legs: stops.slice(0, -1), end }
}
