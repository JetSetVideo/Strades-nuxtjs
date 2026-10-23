/**
 * Bottom navigation — the pure maths behind the five living icons.
 *
 * Every number an icon draws comes from here, so the icons themselves are
 * presentational (props in, SVG out) and this file is unit-tested without a
 * browser. Inputs are the same store fields the panels read (see
 * composables/useNavPanels.ts); nothing here fetches, randomises or animates.
 *
 *   Prices  intradayCurve(history, now)  → cumulative % since 00:00 GMT
 *           sparkline(curve, w, h)        → SVG line + area + end point
 *   Wallet  walletRings(wallets, classOf) → outer ring = each wallet's share of
 *                                            the total, inner ring = asset types
 *           sharesToArcs / donutArcPath   → SVG ring segments
 *   Lab     agentSphere(agents)           → 3-D point per agent (placement from
 *                                            personality, size from activity)
 *   News    subsolarLongitude(now)        → where it is noon right now
 *           orthographic(lon, lat, …)     → globe projection for the land dots
 *   Chat    unreadFor / badgeLabel        → the number in the red dot
 */

export const TAU = Math.PI * 2

// ── Prices ──────────────────────────────────────────────────────────────

export interface IntradayCurve {
  /** Hours since 00:00 GMT for each point (0 … 24). */
  t: number[]
  /** Cumulative market move in percent at each point; t[0] → 0. */
  v: number[]
}

/**
 * Today's market curve from an hourly return history.
 *
 * `history` is the aggregated hourly return series of the live market
 * (stores/assets liveMarket.history; r_k = close_k / close_{k-1} − 1), whose
 * LAST entry is the hour that is still open. Today (GMT) therefore holds the
 * last `h + 1` returns, h = current UTC hour. The curve compounds them from 0
 * at midnight and ends at "now".
 */
export function intradayCurve(history: readonly number[] | null | undefined, now: Date): IntradayCurve | null {
  if (!history || history.length === 0) return null
  const h = now.getUTCHours()
  const frac = now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const n = Math.min(history.length, h + 1)
  const today = history.slice(history.length - n)
  const start = h + 1 - n                       // first hour we have data for
  const t: number[] = [start]
  const v: number[] = [0]
  let level = 1
  today.forEach((r, i) => {
    level *= 1 + (Number.isFinite(r) ? r : 0)
    t.push(i === n - 1 ? h + frac : start + i + 1)
    v.push((level - 1) * 100)
  })
  return { t, v }
}

/**
 * Market hourly returns when the live tree has no aggregate (it only builds one
 * when EVERY live leaf has a history; prediction markets have none). Blends the
 * leaves that do share the longest history, cap-weighted over those leaves when
 * every one has a cap, equal-weighted otherwise (the siblingWeights rule applied
 * flat, not per class level as marketTree does).
 */
export function blendHistory(leaves: ReadonlyArray<{ history?: readonly number[] | null; cap?: number | null }>): { history: number[]; count: number } | null {
  const len = Math.max(0, ...leaves.map(l => l.history?.length ?? 0))
  if (!len) return null
  const use = leaves.filter(l => l.history?.length === len)
  const capsKnown = use.every(l => typeof l.cap === 'number' && l.cap > 0)
  const capSum = capsKnown ? use.reduce((s, l) => s + (l.cap as number), 0) : 0
  const w = use.map(l => (capsKnown ? (l.cap as number) / capSum : 1 / use.length))
  const history = Array.from({ length: len }, (_, k) =>
    use.reduce((s, l, i) => s + w[i]! * (Number.isFinite(l.history![k]) ? l.history![k]! : 0), 0))
  return { history, count: use.length }
}

export interface Sparkline {
  line: string
  area: string
  zeroY: number
  end: [number, number]
  last: number
}

/**
 * SVG geometry for a curve over a fixed 24 h axis (so the line grows as the
 * day goes on). The value axis always contains 0 and spans at least
 * `minSpan` percent, so a flat day does not look like a crash.
 */
export function sparkline(curve: IntradayCurve, w: number, h: number, pad = 1.5, minSpan = 0.6, hours = 24): Sparkline {
  let lo = Math.min(0, ...curve.v)
  let hi = Math.max(0, ...curve.v)
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const x = (t: number) => pad + (Math.max(0, Math.min(hours, t)) / hours) * (w - 2 * pad)
  const y = (v: number) => pad + ((hi - v) / (hi - lo)) * (h - 2 * pad)
  const pts = curve.t.map((t, i) => [x(t), y(curve.v[i]!)] as [number, number])
  const f = (n: number) => n.toFixed(2)
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${f(px)} ${f(py)}`).join(' ')
  const zeroY = y(0)
  const first = pts[0]!
  const end = pts[pts.length - 1]!
  const area = `${line} L${f(end[0])} ${f(zeroY)} L${f(first[0])} ${f(zeroY)} Z`
  return { line, area, zeroY, end, last: curve.v[curve.v.length - 1] ?? 0 }
}

// ── Wallet ──────────────────────────────────────────────────────────────

export interface Share { key: string; label: string; value: number; share: number }

export interface WalletLike {
  id: string
  name: string
  total_value?: number | null
  available_balance?: number | null
  assets?: ReadonlyArray<{ asset_id?: string; symbol: string; current_value?: number | null }>
}

export interface WalletRings {
  /** Σ total_value — the same "TOTAL BALANCE" the wallet switcher prints. */
  total: number
  /** Outer ring: each wallet's share of the total. */
  wallets: Share[]
  /** Inner ring: asset types (+ cash) across every wallet, largest first. */
  classes: Share[]
}

const pos = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)

function toShares(entries: Array<[string, string, number]>): Share[] {
  const total = entries.reduce((s, [, , v]) => s + v, 0)
  if (total <= 0) return []
  return entries.filter(([, , v]) => v > 0).map(([key, label, value]) => ({ key, label, value, share: value / total }))
}

/**
 * Both wallet rings. `classOf` maps a held asset to its type key (the app's
 * asset-class taxonomy); uninvested cash is its own 'cash' slice.
 */
export function walletRings(wallets: readonly WalletLike[], classOf: (a: { asset_id?: string; symbol: string }) => string, classLabel: (key: string) => string = k => k): WalletRings {
  const total = wallets.reduce((s, w) => s + pos(w.total_value), 0)
  const byClass = new Map<string, number>()
  for (const w of wallets) {
    for (const a of w.assets ?? []) {
      const k = classOf(a)
      byClass.set(k, (byClass.get(k) ?? 0) + pos(a.current_value))
    }
    const cash = pos(w.available_balance)
    if (cash) byClass.set('cash', (byClass.get('cash') ?? 0) + cash)
  }
  const classes = toShares([...byClass].map(([k, v]) => [k, classLabel(k), v] as [string, string, number]))
    .sort((a, b) => b.value - a.value)
  return { total, wallets: toShares(wallets.map(w => [w.id, w.name, pos(w.total_value)])), classes }
}

export type Arc<S extends Share = Share> = S & { a0: number; a1: number }

/** Lay shares around a ring, clockwise from 12 o'clock, with a small gap between segments. */
export function sharesToArcs<S extends Share>(shares: readonly S[], gap = 0.06): Arc<S>[] {
  if (shares.length === 1) return [{ ...shares[0]!, a0: 0, a1: TAU }]
  let a = 0
  return shares.map(s => {
    const span = s.share * TAU
    const g = span > gap * 2 ? gap / 2 : 0
    const arc = { ...s, a0: a + g, a1: a + span - g }
    a += span
    return arc
  })
}

const polar = (cx: number, cy: number, r: number, a: number) =>
  `${(cx + r * Math.sin(a)).toFixed(3)} ${(cy - r * Math.cos(a)).toFixed(3)}`

/** Ring segment (annulus sector) path; angles in radians, 0 = 12 o'clock, clockwise. A full turn draws a closed ring. */
export function donutArcPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const span = a1 - a0
  if (span >= TAU - 1e-6) {
    const ring = (r: number, sweep: 0 | 1) =>
      `M${polar(cx, cy, r, 0)} A${r} ${r} 0 1 ${sweep} ${polar(cx, cy, r, Math.PI)} A${r} ${r} 0 1 ${sweep} ${polar(cx, cy, r, 0)} Z`
    return rInner > 0 ? `${ring(rOuter, 1)} ${ring(rInner, 0)}` : ring(rOuter, 1)
  }
  const large = span > Math.PI ? 1 : 0
  const outer = `M${polar(cx, cy, rOuter, a0)} A${rOuter} ${rOuter} 0 ${large} 1 ${polar(cx, cy, rOuter, a1)}`
  if (rInner <= 0) return `${outer} L${cx} ${cy} Z`
  return `${outer} L${polar(cx, cy, rInner, a1)} A${rInner} ${rInner} 0 ${large} 0 ${polar(cx, cy, rInner, a0)} Z`
}

// ── Lab ─────────────────────────────────────────────────────────────────

export type AgentRunState = 'running' | 'waiting' | 'error'

export interface AgentLike {
  id: string
  name?: string
  status?: string | null
  risk?: number | null
  patience?: number | null
  contrarian?: number | null
  trades?: number | null
}

export interface SpherePoint {
  id: string
  name: string
  state: AgentRunState
  /** Unit-sphere position: x right, y up, z toward the viewer at rotation 0. */
  x: number
  y: number
  z: number
  /** Relative dot size 0.55 … 1 (activity: √trades over the busiest agent). */
  size: number
  lat: number
  lon: number
}

/** live / training agents are working; paused / idle wait; error is its own state. */
export function runState(status: string | null | undefined): AgentRunState {
  if (status === 'live' || status === 'training') return 'running'
  if (status === 'error') return 'error'
  return 'waiting'
}

const clamp01 = (n: number | null | undefined, fallback = 0.5) => Math.max(0, Math.min(1, typeof n === 'number' && Number.isFinite(n) ? n : fallback))

/** Stable 0…1 from an id, so agents without personality data don't all stack on one point. */
function idUnit(id: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10007) / 10007
}

/**
 * Each agent as a point on the Lab globe.
 *   latitude  ← risk        (risky agents near the north pole, prudent ones south)
 *   longitude ← patience, nudged by contrarian (so look-alike agents separate)
 *   size      ← √trades / √max trades (busier agents are bigger)
 */
export function agentSphere(agents: readonly AgentLike[]): SpherePoint[] {
  const maxTrades = Math.max(1, ...agents.map(a => pos(a.trades)))
  return agents.map(a => {
    const lat = (clamp01(a.risk, idUnit(a.id, 1)) - 0.5) * 140
    const lon = clamp01(a.patience, idUnit(a.id, 2)) * 300 + clamp01(a.contrarian, idUnit(a.id, 3)) * 40 - 170
    const φ = (lat * Math.PI) / 180
    const λ = (lon * Math.PI) / 180
    return {
      id: a.id,
      name: a.name ?? a.id,
      state: runState(a.status),
      x: Math.cos(φ) * Math.sin(λ),
      y: Math.sin(φ),
      z: Math.cos(φ) * Math.cos(λ),
      size: 0.55 + 0.45 * Math.sqrt(pos(a.trades) / maxTrades),
      lat,
      lon,
    }
  })
}

// ── News ────────────────────────────────────────────────────────────────

/** Longitude (°E, −180 … 180] where the sun is at its highest right now (mean solar time). */
export function subsolarLongitude(now: Date): number {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  let lon = (12 - h) * 15
  while (lon <= -180) lon += 360
  while (lon > 180) lon -= 360
  return lon
}

/**
 * Orthographic projection onto the unit disc (y up). `depth` = cos of the
 * angular distance to the view centre: > 0 on the visible hemisphere, 1 at
 * the centre, → 0 at the rim.
 */
export function orthographic(lonDeg: number, latDeg: number, lon0Deg: number, lat0Deg = 0): { x: number; y: number; depth: number } {
  const r = Math.PI / 180
  const φ = latDeg * r, λ = (lonDeg - lon0Deg) * r, φ0 = lat0Deg * r
  return {
    x: Math.cos(φ) * Math.sin(λ),
    y: Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ),
    depth: Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ),
  }
}

// ── Chat ────────────────────────────────────────────────────────────────

export interface ConversationLike {
  participants?: readonly string[]
  participantDetails?: ReadonlyArray<{ user_id: string }>
  unread_count?: number
  [key: string]: unknown
}

/**
 * Unread messages for one user: the sum of the per-user badges /chat draws
 * (pages/chat.vue reads `unread_count_<userId>` on each of the user's own
 * conversations), so the nav dot and the page badges always agree.
 */
export function unreadFor(conversations: readonly ConversationLike[], userId: string): number {
  let n = 0
  for (const c of conversations) {
    const mine = c.participants?.includes(userId) || c.participantDetails?.some(p => p.user_id === userId)
    if (!mine) continue
    const own = c[`unread_count_${userId}`]
    n += pos(typeof own === 'number' ? own : 0)
  }
  return Math.round(n)
}

/** Text inside the chat dot: '' when nothing is unread, '99+' past 99. */
export function badgeLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n > 99 ? '99+' : String(Math.floor(n))
}

// ── Routing ─────────────────────────────────────────────────────────────

export type PanelId = 'prices' | 'news' | 'wallet' | 'lab' | 'chat'

/** Which panel a route belongs to (longest matching prefix), so detail pages keep their tab selected. */
export function activePanelFor(path: string, panels: ReadonlyArray<{ id: PanelId; match: readonly string[] }>): PanelId | null {
  let best: { id: PanelId; len: number } | null = null
  for (const p of panels) {
    for (const m of p.match) {
      if ((path === m || path.startsWith(`${m}/`)) && (!best || m.length > best.len)) best = { id: p.id, len: m.length }
    }
  }
  return best?.id ?? null
}

// ── Shared formatting ───────────────────────────────────────────────────

export function compactUsd(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 10_000) return `${s}$${(a / 1_000).toFixed(1)}k`
  if (a >= 1_000) return `${s}$${(a / 1_000).toFixed(2)}k`
  return `${s}$${a.toFixed(0)}`
}

export function signedPct(v: number, digits = 2): string {
  const t = Math.abs(v).toFixed(digits)
  const zero = Number(t) === 0
  return `${zero ? '' : v > 0 ? '+' : '-'}${t}%`
}
