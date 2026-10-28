/**
 * How close a live price is to a level that was set earlier (a call, or an armed alert).
 *
 * `remaining` is the leftover gap divided by the gap at the moment the level was set.
 * The warning fires in the last 20% of that original gap (`remaining <= 0.2`), and only
 * while price is still short of the target and has moved toward it.
 *
 * `closeness` is `1 − √remaining`. The square root makes the score climb fastest inside
 * that last fifth, which is the band the notification and the price chip advertise.
 */

export const CLOSING_REMAINING = 0.2

/** Light orange above the live price (a ceiling), dark orange below it (a floor). */
export const LEVEL_COLOR = {
  limit: '#ffcc80',
  support: '#c2410c',
} as const

export const LEVEL_INK = {
  limit: '#3b2410',
  support: '#fff7ed',
} as const

export type LevelRole = keyof typeof LEVEL_COLOR

const HOUR = 3_600_000
/** Pace is noise until the level has been armed for a bit. A one-tick move must not invent an ETA. */
const MIN_PACE_MS = 15 * 60_000

export function levelRole(target: number, current: number): LevelRole {
  return target >= current ? 'limit' : 'support'
}

/** Above the live price leans yellow. Below it leans red. Both stay in the orange family. */
export function limitTone(target: number, current: number): { color: string; ink: string; role: LevelRole } {
  const role = levelRole(target, current)
  return role === 'limit'
    ? { role, color: '#ffe14a', ink: '#3b2a08' }
    : { role, color: '#ff5c3a', ink: '#fff7f4' }
}

export function sameAsset(stored: string, ...keys: string[]): boolean {
  const fold = (s: string) => s.trim().toLowerCase()
  const id = fold(stored || '')
  if (!id) return false
  return keys.some(k => k && fold(k) === id)
}

export interface PriceApproach {
  gap0: number
  /** |target − current| / |target − start|. 0 at the target, 1 at the start, above 1 if price moved away. */
  remaining: number
  /** Share of the signed gap closed. Negative when price moved away from the target. */
  covered: number
  /** 1 − √remaining while still short of the target. */
  closeness: number
  /** Fraction of the original gap closed per hour. */
  speedPerHour: number
  etaMs: number | null
  /** Inside the last 20% of the original gap, still short, and not moving away. */
  closing: boolean
  reached: boolean
  role: LevelRole
}

export function priceApproach(start: number, target: number, current: number, ageMs: number): PriceApproach {
  const role = levelRole(target, Number.isFinite(current) ? current : start)
  const gap0 = Math.abs(target - start)
  const finite = Number.isFinite(start) && Number.isFinite(target) && Number.isFinite(current)
  const tol = Math.max(1e-9, Math.abs(target) * 1e-6)
  if (!finite || !(gap0 > 0)) {
    const reached = finite && Math.abs(target - current) <= tol
    return {
      gap0: finite ? gap0 : 0, remaining: reached ? 0 : 1, covered: reached ? 1 : 0,
      closeness: reached ? 1 : 0, speedPerHour: 0, etaMs: null, closing: false, reached, role,
    }
  }
  const covered = (current - start) / (target - start)
  const remaining = Math.abs(target - current) / gap0
  const reached = covered >= 1 - 1e-9 || Math.abs(target - current) <= tol
  const hours = ageMs >= MIN_PACE_MS ? ageMs / HOUR : 0
  const speedPerHour = hours > 0 ? covered / hours : 0
  const closing = !reached && covered > 0 && remaining <= CLOSING_REMAINING + 1e-9
  const closeness = reached ? 1 : Math.max(0, 1 - Math.sqrt(Math.max(0, remaining)))
  const etaMs = !reached && speedPerHour > 1e-6 ? (remaining / speedPerHour) * HOUR : null
  return { gap0, remaining, covered, closeness, speedPerHour, etaMs, closing, reached, role }
}

/** Live prices keyed by asset id and by ticker, plus id → ticker. */
export function indexLivePrices(assets: { id?: string; symbol?: string; current_price?: number }[]): {
  prices: Record<string, number>
  symbols: Record<string, string>
} {
  const prices: Record<string, number> = {}
  const symbols: Record<string, string> = {}
  for (const a of assets) {
    const id = a.id != null ? String(a.id) : ''
    if (id && a.symbol) symbols[id] = a.symbol
    const px = Number(a.current_price)
    if (!(px > 0)) continue
    if (id) prices[id] = px
    if (a.symbol) {
      prices[a.symbol] = px
      prices[a.symbol.toUpperCase()] = px
      prices[a.symbol.toLowerCase()] = px
    }
  }
  return { prices, symbols }
}

export function lookupPrice(prices: Record<string, number> | undefined, ...keys: (string | undefined | null)[]): number | null {
  if (!prices) return null
  for (const k of keys) {
    if (!k) continue
    const v = prices[k] ?? prices[k.toUpperCase()] ?? prices[k.toLowerCase()]
    if (Number.isFinite(v) && v > 0) return v
  }
  return null
}
