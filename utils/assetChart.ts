/**
 * Asset chart maths: one source of truth for every price chart that shows an
 * asset (price-list card, expanded prediction card, asset detail page, alerts).
 *
 * Everything here is pure and deterministic so the same asset draws the same
 * path in the small card and on its detail page, and so a prediction is drawn
 * exactly where the user put it: x is a time, y is a price, both go through
 * the same scale in both directions (see makeScales / tests/assetChart.test.ts).
 */
import { cyrb53, mulberry32 } from '~/composables/useSeededRandom'

export const HOUR = 3_600_000

export interface Candle {
  /** bucket start, epoch ms */
  t: number
  o: number
  h: number
  l: number
  c: number
  /** traded volume in the base asset, when the source has it (real candles only) */
  v?: number
  /** true when the candle is simulated (no market data for that period) */
  sim?: boolean
}

/** How prices of an asset are read: money, or a 0–1 probability (bets). */
export type PriceKind = 'money' | 'probability'

export interface Horizon { id: string; label: string; hours: number }

/** Prediction horizons. The future zone of the chart is exactly one horizon long. */
export const HORIZONS: Horizon[] = [
  { id: '1D', label: '1D', hours: 24 },
  { id: '1W', label: '1W', hours: 168 },
  { id: '1M', label: '1M', hours: 720 },
  { id: '3M', label: '3M', hours: 2160 },
  { id: '6M', label: '6M', hours: 4368 },
  { id: '1Y', label: '1Y', hours: 8760 },
]

export function horizonById(id: string): Horizon {
  return HORIZONS.find(h => h.id === id) ?? HORIZONS[1]!
}

/** Smallest horizon that contains `hours` (falls back to the largest). */
export function horizonFor(hours: number): Horizon {
  return HORIZONS.find(h => h.hours >= hours - 1e-9) ?? HORIZONS[HORIZONS.length - 1]!
}

/** Horizon closest to `hours`, so a dragged window changes category at the midpoint. */
export function nearestHorizon(hours: number): Horizon {
  const h = Math.max(1e-6, hours)
  let best = HORIZONS[0]!
  let bestD = Infinity
  for (const item of HORIZONS) {
    const d = Math.abs(Math.log(h) - Math.log(item.hours))
    if (d < bestD) { best = item; bestD = d }
  }
  return best
}

/** The past shown next to a horizon: 1.5× as long, so the future zone is the right 40 %. */
export const PAST_PER_HORIZON = 1.5

// ── Candle intervals ─────────────────────────────────────────────────────────

/** Interval ids match Binance kline intervals so real and simulated candles align. */
export const INTERVALS: { id: string; hours: number }[] = [
  { id: '1h', hours: 1 }, { id: '2h', hours: 2 }, { id: '4h', hours: 4 }, { id: '6h', hours: 6 },
  { id: '8h', hours: 8 }, { id: '12h', hours: 12 }, { id: '1d', hours: 24 }, { id: '3d', hours: 72 },
  { id: '1w', hours: 168 }, { id: '1M', hours: 720 },
]

/** Smallest interval that draws `spanHours` in at most `maxCandles` candles. */
export function pickInterval(spanHours: number, maxCandles = 60): { id: string; hours: number } {
  return INTERVALS.find(i => spanHours / i.hours <= maxCandles) ?? INTERVALS[INTERVALS.length - 1]!
}

// ── Simulated path (assets without market history) ──────────────────────────

/** Hourly volatility from the 0–1 volatility index: EUR ≈ 0.45 %/day, BTC ≈ 2.4 %/day. */
export function hourlySigma(volIndex: number): number {
  const v = Number.isFinite(volIndex) ? Math.max(0, Math.min(1, volIndex)) : 0.3
  return 0.0004 + v * 0.0075
}

interface PathCache { logf: number[]; rand: () => number; sigma: number }
const PATHS = new Map<string, PathCache>()

/**
 * log(price(age) / price(now)) for whole hours of age, extended on demand.
 * Seeded by the asset key, so it never changes between renders or pages.
 */
function logPath(key: string, sigma: number, hours: number): number[] {
  const id = `${key}|${sigma.toFixed(6)}`
  let p = PATHS.get(id)
  if (!p) {
    p = { logf: [0], rand: mulberry32(cyrb53(`asset-path:${key}`)), sigma }
    PATHS.set(id, p)
  }
  const need = Math.ceil(hours) + 2
  while (p.logf.length < need) {
    // Box–Muller normal step, small drift-free walk going back in time.
    const u = Math.max(1e-12, p.rand())
    const v = p.rand()
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    p.logf.push(p.logf[p.logf.length - 1]! - z * p.sigma)
  }
  return p.logf
}

export interface SimSpec {
  key: string
  volIndex: number
  current: number
  kind?: PriceKind
  /** the 24h move shown next to the chart; the path is tilted to agree with it */
  change24hPct?: number
}

/** Simulated price `ageHours` before now (fractional hours interpolate). */
export function simPriceAt(spec: SimSpec, ageHours: number): number {
  const a = Math.max(0, ageHours)
  const sigma = spec.kind === 'probability' ? hourlySigma(spec.volIndex) * 1.6 : hourlySigma(spec.volIndex)
  const lf = logPath(spec.key, sigma, a + 25)
  const i = Math.floor(a)
  const frac = a - i
  let l = lf[i]! + (lf[i + 1]! - lf[i]!) * frac
  if (spec.change24hPct !== undefined && Number.isFinite(spec.change24hPct) && spec.change24hPct > -99) {
    const want = Math.log(1 / (1 + spec.change24hPct / 100))
    const alpha = want - lf[24]!
    l += alpha * Math.min(a, 24) / 24
  }
  if (spec.kind === 'probability') {
    // Walk in log-odds space so a probability never leaves (0, 1).
    const p0 = clamp(spec.current, 0.005, 0.995)
    const odds = Math.log(p0 / (1 - p0)) + l * 4
    return 1 / (1 + Math.exp(-odds))
  }
  return spec.current * Math.exp(l)
}

/** Simulated candles aligned on interval boundaries, last one closing at `now`. */
export function simCandles(spec: SimSpec, nowMs: number, startMs: number, intervalHours: number): Candle[] {
  const step = intervalHours * HOUR
  const first = Math.floor(startMs / step) * step
  const out: Candle[] = []
  for (let t = first; t <= nowMs; t += step) {
    const end = Math.min(nowMs, t + step)
    const ageOpen = (nowMs - t) / HOUR
    const ageClose = (nowMs - end) / HOUR
    const o = simPriceAt(spec, ageOpen)
    const c = simPriceAt(spec, ageClose)
    let h = Math.max(o, c)
    let l = Math.min(o, c)
    // sample the hours inside the bucket for true highs / lows
    const n = Math.min(48, Math.max(1, Math.round(intervalHours)))
    for (let k = 1; k < n; k++) {
      const p = simPriceAt(spec, ageOpen - (ageOpen - ageClose) * (k / n))
      if (p > h) h = p
      if (p < l) l = p
    }
    out.push({ t, o, h, l, c, sim: true })
  }
  return out
}

/** Real hourly closes rebuilt from returns (oldest first), ending at `current`. */
export function closesFromReturns(current: number, returns: number[]): number[] {
  const pts = [current]
  for (let i = returns.length - 1; i >= 0; i--) pts.unshift(pts[0]! / (1 + returns[i]!))
  return pts
}

/** Hourly closes (oldest first, last = now) grouped into candles of `intervalHours`. */
export function candlesFromHourlyCloses(closes: number[], nowMs: number, intervalHours: number): Candle[] {
  const n = closes.length
  if (n < 2) return []
  const step = intervalHours * HOUR
  const tOf = (i: number) => nowMs - (n - 1 - i) * HOUR
  const buckets = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const b = Math.floor(tOf(i) / step) * step
    if (!buckets.has(b)) buckets.set(b, [])
    buckets.get(b)!.push(i)
  }
  const out: Candle[] = []
  for (const [t, idx] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const firstI = idx[0]!
    const o = firstI > 0 ? closes[firstI - 1]! : closes[firstI]!
    const vals = idx.map(i => closes[i]!)
    const c = vals[vals.length - 1]!
    out.push({ t, o, c, h: Math.max(o, ...vals), l: Math.min(o, ...vals) })
  }
  return out
}

/**
 * Real candles first; where they don't reach back to `startMs`, simulated
 * candles continue the path (flagged `sim`), scaled to join without a jump.
 */
export function stitchCandles(real: Candle[], spec: SimSpec, nowMs: number, startMs: number, intervalHours: number): Candle[] {
  const step = intervalHours * HOUR
  const first = Math.floor(startMs / step) * step
  const realIn = real.filter(c => c.t + step > first)
  if (!realIn.length) return simCandles(spec, nowMs, startMs, intervalHours)
  if (realIn[0]!.t <= first) return realIn
  const sim = simCandles(spec, nowMs, startMs, intervalHours).filter(c => c.t < realIn[0]!.t)
  if (!sim.length) return realIn
  const k = realIn[0]!.o / sim[sim.length - 1]!.c
  return [...sim.map(c => ({ ...c, o: c.o * k, h: c.h * k, l: c.l * k, c: c.c * k })), ...realIn]
}

/** Close at time t (step-wise from candles; current price after the last close). */
export function priceAtTime(candles: Candle[], t: number, current: number): number | null {
  if (!candles.length || t < candles[0]!.t) return null
  for (let i = candles.length - 1; i >= 0; i--) if (candles[i]!.t <= t) return i === candles.length - 1 ? current : candles[i]!.c
  return null
}

// ── Potential range for a prediction ────────────────────────────────────────

/**
 * How far the price could plausibly go within `horizonHours`, read from the
 * past: the largest rise and the largest fall seen over any stretch of the
 * same length in `candles`, applied to the current price (×1.25 headroom).
 * Bets stay inside 0–1.
 */
export function predictionRange(
  candles: Candle[], horizonHours: number, current: number, kind: PriceKind = 'money',
  opts: { volIndex?: number; boost?: number } = {},
): { min: number; max: number; rise: number; fall: number } {
  let rise = 0
  let fall = 0
  const span = horizonHours * HOUR
  for (let i = 0; i < candles.length; i++) {
    const a = candles[i]!
    // inside one candle the order of high and low is unknown: measure from its open
    if (a.o > 0) { rise = Math.max(rise, a.h / a.o - 1); fall = Math.max(fall, 1 - a.l / a.o) }
    let hi = -Infinity
    let lo = Infinity
    for (let j = i + 1; j < candles.length && candles[j]!.t - a.t <= span; j++) {
      hi = Math.max(hi, candles[j]!.h)
      lo = Math.min(lo, candles[j]!.l)
    }
    if (a.l > 0 && hi > -Infinity) rise = Math.max(rise, hi / a.l - 1)
    if (a.h > 0 && lo < Infinity) fall = Math.max(fall, 1 - lo / a.h)
  }
  // A quiet past window must not cap the call: never offer less than three
  // standard deviations of the move expected over the horizon, measured on
  // the candles themselves (realised) and on the asset's volatility index.
  const sd = Math.max(realisedHourlySigma(candles), opts.volIndex !== undefined ? hourlySigma(opts.volIndex) : 0)
  const statistical = 3 * sd * Math.sqrt(Math.max(1, horizonHours))
  const floor = Math.max(0.005, statistical)
  const boost = 1 + Math.max(0, opts.boost ?? 0)
  rise = Math.max(rise * 1.25, floor) * boost
  fall = Math.min(0.95, Math.max(fall * 1.25, floor) * boost)
  if (kind === 'probability') {
    const width = Math.max(0.02, Math.max(rise, fall) * current)
    return { min: clamp(current - width, 0, 1), max: clamp(current + width, 0, 1), rise, fall }
  }
  return { min: current * (1 - fall), max: current * (1 + rise), rise, fall }
}

/** Standard deviation of hourly log returns implied by the candles' closes. */
export function realisedHourlySigma(candles: Candle[]): number {
  if (candles.length < 3) return 0
  const step = (candles[1]!.t - candles[0]!.t) / HOUR || 1
  const r: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1]!.c
    const b = candles[i]!.c
    if (a > 0 && b > 0) r.push(Math.log(b / a))
  }
  if (r.length < 2) return 0
  const m = r.reduce((s, v) => s + v, 0) / r.length
  const v = r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1)
  return Math.sqrt(v / step)
}

/**
 * Snap a target time to "exactly 1 day / 1 week / … from now" (and to the end
 * of the window) when the pointer is within `tolerance` ms of one of them.
 */
export function snapTarget(t: number, now: number, end: number, tolerance: number): { t: number; exact: Horizon | null } {
  const marks: { t: number; h: Horizon | null }[] = HORIZONS
    .filter(h => now + h.hours * HOUR <= end + 1)
    .map(h => ({ t: now + h.hours * HOUR, h }))
  if (!marks.some(m => Math.abs(m.t - end) < 1000)) marks.push({ t: end, h: null })
  let best: { t: number; h: Horizon | null } | null = null
  for (const m of marks) if (Math.abs(m.t - t) <= tolerance && (!best || Math.abs(m.t - t) < Math.abs(best.t - t))) best = m
  return best ? { t: best.t, exact: best.h } : { t, exact: null }
}

/** "in 7 days", "in 3 h", "in 2 months". */
export function fmtIn(ms: number): string {
  const h = ms / HOUR
  if (h < 36) return `in ${Math.max(1, Math.round(h))} h`
  const d = h / 24
  if (d < 60) return `in ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`
  const mo = d / 30.4
  if (mo < 18) return `in ${Math.round(mo)} months`
  return `in ${(d / 365).toFixed(1)} years`
}

// ── Detail-page shapes ──────────────────────────────────────────────────────

export interface MapPoint { name: string; lat: number; lng: number; kind: 'hq' | 'facility' | 'supplier' | 'client' | 'hub'; sub?: string }

export interface TreeNode {
  name: string
  /** Legal or catalog name when `name` is a short label or ticker. */
  realName?: string
  sub?: string
  /** Partner, Competitor, or Peer — the carousel under the asset. */
  role?: string
  share_pct?: number | null
  /** Nominal amount in US dollars, converted for display from the settings currency. */
  value_usd?: number | null
  flag?: string
  /** ISO region code, when the row has one. */
  countryCode?: string
  country?: string
  city?: string
  lat?: number | null
  lng?: number | null
  logo?: string
  /** listed asset id: the node links to its page */
  assetId?: string
}

// ── Asset types ─────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<string, string> = {
  stock: 'Company', company: 'Company', cryptocurrency: 'Crypto', fiat_currency: 'Forex',
  commodity: 'Commodity', bet: 'Bet', index: 'Index', etf: 'ETF',
}
/** One colour per asset type: the ticker under the logo, the type badge, the plate ring. */
export const TYPE_COLOR: Record<string, string> = {
  stock: '#2196f3', company: '#2196f3', cryptocurrency: '#f7931a', fiat_currency: '#4caf50',
  commodity: '#ffd700', bet: '#ff4d9d', index: '#00bcd4', etf: '#9c27b0',
}
export function typeColor(type: string | undefined | null): string {
  return TYPE_COLOR[String(type ?? '')] ?? '#607d8b'
}

// ── Scales ──────────────────────────────────────────────────────────────────

export interface Box { left: number; top: number; width: number; height: number }

export interface Scales {
  x: (t: number) => number
  y: (p: number) => number
  tAt: (x: number) => number
  pAt: (y: number) => number
  box: Box
  t0: number
  t1: number
  p0: number
  p1: number
}

/**
 * Share of the plot the future occupies on a closed price card.
 * Far calls stay in that strip instead of stealing width from the candles.
 */
export const CLOSED_FUTURE_FRAC = 0.12

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** How much of [t0, t1] sits after `now`. 0 when the window has no future. */
export function naturalFutureFrac(t0: number, now: number, t1: number): number {
  if (!(t1 > now + 1)) return 0
  return clamp((t1 - now) / Math.max(1, t1 - t0), 0, 0.92)
}

/**
 * Time → x. `futureFrac` is the share of `width` given to [now, t1].
 * The natural share is ordinary linear time, so raising the fraction from a
 * smaller value stretches only the future and every mark moves with it.
 */
export function chartX(
  t: number, t0: number, now: number, t1: number,
  left: number, width: number, futureFrac: number,
): number {
  if (!(width > 0)) return left
  if (!(t1 > now + 1) || !(futureFrac > 0)) {
    const span = Math.max(1, (t1 > t0 ? t1 : now) - t0)
    return left + clamp((t - t0) / span, 0, 1) * width
  }
  const frac = clamp(futureFrac, 0, 0.92)
  const nowX = left + width * (1 - frac)
  if (t <= now) {
    const past = Math.max(1, now - t0)
    return left + clamp((t - t0) / past, 0, 1) * (nowX - left)
  }
  const fut = Math.max(1, t1 - now)
  return nowX + clamp((t - now) / fut, 0, 1) * (left + width - nowX)
}

/**
 * How hard a pointer inside the future plot should extend the window.
 * The outer `band` (default 10%) of the top, bottom, and right is sensitive,
 * and only while the pointer moves toward that edge. The two right-hand
 * corners extend the date and the price together.
 * Returned fractions are 0–1 of the pointer's travel across the plot.
 */
export function edgeNudge(
  x: number, y: number, dx: number, dy: number,
  left: number, top: number, width: number, height: number,
  band = 0.1,
): { date: number; priceUp: number; priceDown: number } {
  const none = { date: 0, priceUp: 0, priceDown: 0 }
  if (!(width > 0) || !(height > 0)) return none
  const rx = (x - left) / width
  const ry = (y - top) / height
  const rightDepth = rx > 1 - band && rx <= 1.02 ? clamp((rx - (1 - band)) / band, 0, 1) : 0
  const upDepth = ry < band && ry >= -0.02 ? clamp((band - ry) / band, 0, 1) : 0
  const downDepth = ry > 1 - band && ry <= 1.02 ? clamp((ry - (1 - band)) / band, 0, 1) : 0
  const rightTravel = dx > 0 ? dx / width : 0
  const upTravel = dy < 0 ? -dy / height : 0
  const downTravel = dy > 0 ? dy / height : 0
  if (rightDepth > 0 && upDepth > 0 && (rightTravel > 0 || upTravel > 0)) {
    const push = Math.max(rightTravel, upTravel) * Math.max(rightDepth, upDepth)
    return { date: push, priceUp: push, priceDown: 0 }
  }
  if (rightDepth > 0 && downDepth > 0 && (rightTravel > 0 || downTravel > 0)) {
    const push = Math.max(rightTravel, downTravel) * Math.max(rightDepth, downDepth)
    return { date: push, priceUp: 0, priceDown: push }
  }
  return {
    date: rightDepth * rightTravel,
    priceUp: upDepth * upTravel,
    priceDown: downDepth * downTravel,
  }
}

/** Inverse of `chartX` for the same window and future share. */
export function chartT(
  x: number, t0: number, now: number, t1: number,
  left: number, width: number, futureFrac: number,
): number {
  if (!(width > 0)) return t0
  if (!(t1 > now + 1) || !(futureFrac > 0)) {
    const span = Math.max(1, (t1 > t0 ? t1 : now) - t0)
    return t0 + clamp((x - left) / width, 0, 1) * span
  }
  const frac = clamp(futureFrac, 0, 0.92)
  const nowX = left + width * (1 - frac)
  if (x <= nowX) {
    const past = Math.max(1, now - t0)
    const w = Math.max(1, nowX - left)
    return t0 + clamp((x - left) / w, 0, 1) * past
  }
  const fut = Math.max(1, t1 - now)
  const w = Math.max(1, left + width - nowX)
  return now + clamp((x - nowX) / w, 0, 1) * fut
}

/** Linear time → x and price → y over a plot box, invertible. */
export function makeScales(t0: number, t1: number, p0: number, p1: number, box: Box): Scales {
  const dt = Math.max(1, t1 - t0)
  const dp = p1 - p0 || Math.abs(p1) * 0.01 || 1
  return {
    x: t => box.left + ((t - t0) / dt) * box.width,
    y: p => box.top + (1 - (p - p0) / dp) * box.height,
    tAt: x => t0 + ((x - box.left) / box.width) * dt,
    pAt: y => p0 + (1 - (y - box.top) / box.height) * dp,
    box, t0, t1, p0, p1,
  }
}

/** Price domain covering every value, padded so lines don't touch the frame. */
export function priceDomain(values: number[], kind: PriceKind = 'money', padFrac = 0.06): [number, number] {
  const v = values.filter(Number.isFinite)
  if (!v.length) return [0, 1]
  let lo = Math.min(...v)
  let hi = Math.max(...v)
  if (!(hi > lo)) { const d = Math.abs(hi) * 0.01 || 0.01; lo -= d; hi += d }
  const pad = (hi - lo) * padFrac
  lo -= pad
  hi += pad
  if (kind === 'probability') { lo = Math.max(0, lo); hi = Math.min(1, hi) }
  else lo = Math.max(lo, 0)
  return [lo, hi]
}

/** "Nice" round price ticks inside [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo]
  const raw = (hi - lo) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12))
  return out
}

const TIME_STEPS_H = [1, 2, 3, 6, 12, 24, 48, 72, 168, 336, 720, 1440, 2160, 4380, 8760]

/** Round time ticks (hours / days / months) inside [t0, t1] with labels. `timeZone` is an IANA zone, the same one the header clock uses. */
export function timeTicks(t0: number, t1: number, count = 4, locale?: string, timeZone?: string): { t: number; label: string }[] {
  const spanH = (t1 - t0) / HOUR
  const stepH = TIME_STEPS_H.find(s => spanH / s <= count) ?? TIME_STEPS_H[TIME_STEPS_H.length - 1]!
  const out: { t: number; label: string }[] = []
  if (stepH < 24) {
    const step = stepH * HOUR
    for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push({ t, label: fmtTimeLabel(t, spanH, locale, timeZone) })
  } else if (stepH < 720) {
    const d = new Date(t0); d.setHours(0, 0, 0, 0)
    const days = stepH / 24
    while (d.getTime() < t0) d.setDate(d.getDate() + 1)
    for (; d.getTime() <= t1; d.setDate(d.getDate() + days)) out.push({ t: d.getTime(), label: fmtTimeLabel(d.getTime(), spanH, locale, timeZone) })
  } else {
    const months = Math.max(1, Math.round(stepH / 730))
    const d = new Date(t0); d.setHours(0, 0, 0, 0); d.setDate(1)
    while (d.getTime() < t0) d.setMonth(d.getMonth() + 1)
    while (d.getMonth() % months !== 0) d.setMonth(d.getMonth() + 1)
    for (; d.getTime() <= t1; d.setMonth(d.getMonth() + months)) out.push({ t: d.getTime(), label: fmtTimeLabel(d.getTime(), spanH, locale, timeZone) })
  }
  return out
}

function zoneOf(timeZone?: string): Intl.DateTimeFormatOptions {
  return timeZone ? { timeZone } : {}
}

function fmtTimeLabel(t: number, spanH: number, locale?: string, timeZone?: string): string {
  const d = new Date(t)
  const zone = zoneOf(timeZone)
  if (spanH <= 48) return d.toLocaleTimeString(locale, { ...zone, hour: '2-digit', minute: '2-digit', hour12: false })
  if (spanH <= 24 * 120) return d.toLocaleDateString(locale, { ...zone, day: 'numeric', month: 'short' })
  return d.toLocaleDateString(locale, { ...zone, month: 'short', year: '2-digit' })
}

/** Date + time for a prediction target, precise enough for its horizon. */
export function fmtTarget(t: number, horizonHours: number, locale?: string, timeZone?: string): string {
  const d = new Date(t)
  const zone = zoneOf(timeZone)
  if (horizonHours <= 48) {
    return d.toLocaleString(locale, { ...zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString(locale, { ...zone, day: 'numeric', month: 'short', year: horizonHours > 24 * 200 ? 'numeric' : undefined })
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** Short axis label: 82.8k, 213.4, 1.1186, 0.00671, 33 %. */
export function fmtAxisPrice(v: number, kind: PriceKind = 'money'): string {
  if (!Number.isFinite(v)) return '—'
  if (kind === 'probability') return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  if (a >= 1000) return v.toFixed(0)
  if (a >= 100) return v.toFixed(1)
  if (a >= 1) return v.toFixed(2)
  if (a >= 0.01) return v.toFixed(4)
  return v.toPrecision(3)
}

/** Full price: $82,758.56, $1.1186, 32.9 % chance. */
export function fmtPrice(v: number, kind: PriceKind = 'money', currency = 'USD'): string {
  if (!Number.isFinite(v)) return '—'
  if (kind === 'probability') return `${(v * 100).toFixed(1)}%`
  const a = Math.abs(v)
  const digits = a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
  } catch {
    return `$${v.toFixed(digits)}`
  }
}

export function fmtPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * The part of a saved call that sits inside the chart window [t0, t1].
 * The line always runs from the price when the call was made to the predicted price
 * at the target time. Sliding the window only clips that segment; it does not
 * re-anchor the start to the live price.
 */
export function clipPrediction(
  made: number, target: number, priceThen: number, priceTarget: number, t0: number, t1: number,
): { from: number; to: number; priceFrom: number; priceTo: number } | null {
  if (!Number.isFinite(made) || !Number.isFinite(target) || !(target > made)) return null
  if (!Number.isFinite(priceThen) || !Number.isFinite(priceTarget)) return null
  if (target < t0 || made > t1) return null
  const from = Math.max(made, t0)
  const to = Math.min(target, t1)
  if (!(to > from)) return null
  const at = (t: number) => priceThen + (priceTarget - priceThen) * ((t - made) / (target - made))
  return { from, to, priceFrom: at(from), priceTo: at(to) }
}

/** Bets trade as 0–1 probabilities. */
export function priceKindOf(asset: { type?: string } | null | undefined): PriceKind {
  return asset?.type === 'bet' ? 'probability' : 'money'
}

/** Volatility index from whichever field the asset carries. */
export function volIndexOf(asset: Record<string, any> | null | undefined): number {
  const v = asset?.volatility_index
    ?? asset?.psychology_profile?.volatility_index
    ?? asset?.fluctuation_velocity
    ?? asset?.psychology_profile?.volatility_affinity
    ?? asset?.volatility
  const n = Number(v)
  return Number.isFinite(n) ? n : 0.3
}
