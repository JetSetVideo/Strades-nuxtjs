<script setup lang="ts">
/**
 * PredictChart — one price chart for every asset surface.
 *
 * Time runs left → right with a time scale at the bottom; prices sit on a
 * scale on the right. The right-hand zone after "now" is the future: a
 * prediction is a point there — its x is the target date, its y the price.
 * Everything (candles, line, the user's calls, friends' calls, paper trades,
 * the live aim) goes through the same time and price scale, so a dot is always
 * drawn where that scale puts it. On a closed card the future is a short strip
 * and calls that would squash the candles are squares; opening lerps both.
 *
 * size="mini"  — the price-list card: compact axes, not interactive.
 * size="large" — expanded card / detail page: tap or drag in the future zone.
 *
 * A closed card keeps the price scale on the candles. Calls that would squash
 * that scale are squares in a short future strip. `reveal` lerps every mark
 * from that strip into the open chart, where the future is wider and each
 * call sits on its real date and price.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Prediction } from '~/stores/predictions'
import { useAppearanceStore } from '~/stores/appearance'
import {
  HOUR, priceDomain, niceTicks, timeTicks, fmtAxisPrice, fmtTarget, clamp, lerp,
  chartX, chartT, naturalFutureFrac, CLOSED_FUTURE_FRAC, edgeNudge,
  snapTarget, clipPrediction, type Candle, type PriceKind,
} from '~/utils/assetChart'
import { friendProfile, targetTsOf } from '~/composables/useFriendPredictions'
import { userStops, type PathStop } from '~/utils/predictionPath'
import { limitTone } from '~/utils/priceApproach'
import AxisEnds from '~/components/Chart/AxisEnds.vue'

const appearance = useAppearanceStore()
if (import.meta.client) appearance.hydrate()
/** Same IANA zone as the header clock (settings → clock timezone). */
const timeZone = computed(() => appearance.resolvedTimezone || 'UTC')
function zonedTarget(t: number, hours: number) {
  return fmtTarget(t, hours, undefined, timeZone.value)
}

const props = withDefaults(defineProps<{
  candles: Candle[]
  t0: number
  now: number
  t1: number
  current: number
  kind?: PriceKind
  chartStyle?: 'line' | 'candle'
  size?: 'mini' | 'large'
  height?: number
  range?: { min: number; max: number } | null
  /** Use `range` as the exact price window instead of fitting every candle. */
  rangeLock?: boolean
  aim?: { t: number; price: number; fromT?: number; fromPrice?: number } | null
  mine?: Prediction[]
  friends?: Prediction[]
  trades?: { t: number; price: number; side: 'buy' | 'sell' }[]
  interactive?: boolean
  realFrom?: number | null
  /** target dates snap to this many hours */
  snapHours?: number
  /** earliest target, hours after now */
  minLeadHours?: number
  label?: string
  /** colour the line by this move (e.g. the 24h % shown next to it) instead of first → last */
  trendPct?: number | null
  /** horizontal price levels. `fade` draws them clear on the left and solid at the price scale. */
  levels?: { id: string; price: number; color: string; label: string; hot?: boolean; ink?: string; fade?: boolean }[]
  /** drag vertically anywhere on the plot to pick a level (alerts) instead of a prediction */
  levelMode?: boolean
  /** view-transition-name, so the card's mini chart can morph into this one */
  morphName?: string
  /** The horizon already has a call, so the hint asks for a later point. */
  extending?: boolean
  /**
   * 0 = closed card (candles own the scale, future is a short strip).
   * 1 = open chart (calls at their real date and price).
   * Omit to follow `size`.
   */
  reveal?: number | null
  /** Open-chart window. While `reveal` moves, time and series lerp toward it. */
  openCandles?: Candle[] | null
  openT0?: number | null
  openT1?: number | null
  openNow?: number | null
  openRange?: { min: number; max: number } | null
  openRangeLock?: boolean
}>(), {
  kind: 'money', chartStyle: 'line', size: 'mini', height: 64, range: null, rangeLock: false, aim: null,
  mine: () => [], friends: () => [], trades: () => [], interactive: false, realFrom: null,
  snapHours: 1, minLeadHours: 1, label: 'Price chart', trendPct: null, levels: () => [], levelMode: false,
  extending: false, reveal: null, openCandles: null, openT0: null, openT1: null, openNow: null,
  openRange: null, openRangeLock: false,
})

const emit = defineEmits<{
  aim: [t: number, price: number]
  commit: [t: number, price: number]
  level: [price: number]
  levelCommit: [price: number]
  /** A click on the price scale (the gutter right of the plot), not a prediction point. */
  limit: [price: number]
  /** Drag an end of the date axis. `start` is the left edge, `end` the right. */
  window: [edge: 'start' | 'end', t: number]
  /** Drag an end of the price axis. Values are the new bottom and top. */
  scale: [min: number, max: number]
}>()

// ── Size ────────────────────────────────────────────────────────────────────
const root = ref<HTMLElement | null>(null)
const width = ref(320)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  width.value = Math.max(80, root.value.clientWidth)
  ro = new ResizeObserver(([e]) => { if (e) width.value = Math.max(80, Math.round(e.contentRect.width)) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const mini = computed(() => props.size === 'mini')
/** 0 = closed card, 1 = open chart. Defaults from `size` when the parent doesn't animate. */
const revealV = computed(() => {
  if (props.reveal == null || !Number.isFinite(props.reveal)) return mini.value ? 0 : 1
  return clamp(props.reveal, 0, 1)
})
function labelWidth(text: string, font: number) {
  return Math.ceil(text.length * font * 0.62 + 7)
}
const G = computed(() => {
  const font = 9
  const vals = candleVals(props.candles).filter(Number.isFinite)
  const lo = vals.length ? Math.min(...vals) : props.current
  const hi = vals.length ? Math.max(...vals) : props.current
  const need = Math.max(
    labelWidth(fmtAxisPrice(props.current, props.kind), font),
    labelWidth(fmtAxisPrice(lo, props.kind), font),
    labelWidth(fmtAxisPrice(hi, props.kind), font),
  )
  const closed = { left: 0, right: clamp(need, 28, 48), top: 2, bottom: 11, font }
  const open = { left: 4, right: 54, top: 10, bottom: 18, font: 10 }
  const r = revealV.value
  if (r <= 0) return closed
  if (r >= 1) return open
  return {
    left: lerp(closed.left, open.left, r),
    right: lerp(closed.right, open.right, r),
    top: lerp(closed.top, open.top, r),
    bottom: lerp(closed.bottom, open.bottom, r),
    font: lerp(closed.font, open.font, r),
  }
})

const box = computed(() => ({
  left: G.value.left,
  top: G.value.top,
  width: Math.max(10, width.value - G.value.left - G.value.right),
  height: Math.max(10, props.height - G.value.top - G.value.bottom),
}))

// ── Domain & scales ─────────────────────────────────────────────────────────
function candleVals(candles: Candle[]) {
  const vals: number[] = [props.current]
  for (const c of candles) {
    if (props.chartStyle === 'candle') vals.push(c.h, c.l)
    else vals.push(c.c, c.o)
  }
  return vals
}

/** Closed card: candles and the live price only, so a far call cannot flatten them. */
const closedDomain = computed(() => priceDomain(candleVals(props.candles), props.kind, 0.1))

function fittedDomain(candles: Candle[], range: { min: number; max: number } | null, rangeLock: boolean) {
  if (rangeLock && range && range.max > range.min) return [range.min, range.max] as [number, number]
  const vals = candleVals(candles)
  if (range) vals.push(range.min, range.max)
  const tEnd = props.openT1 ?? props.t1
  const tStart = props.openT0 ?? props.t0
  for (const p of props.mine) {
    if (targetTsOf(p) <= tEnd) vals.push(p.predictedPrice)
    for (const leg of p.legs ?? []) vals.push(leg.price)
  }
  for (const p of props.friends) if (targetTsOf(p) <= tEnd) vals.push(p.predictedPrice)
  for (const tr of props.trades) if (tr.t >= tStart) vals.push(tr.price)
  for (const l of props.levels) vals.push(l.price)
  return priceDomain(vals, props.kind, 0.06)
}

const openDomain = computed(() => fittedDomain(
  props.openCandles?.length ? props.openCandles : props.candles,
  props.openRange ?? props.range,
  props.openRangeLock || props.rangeLock,
))

const domain = computed((): [number, number] => {
  const r = revealV.value
  const closed = closedDomain.value
  const open = openDomain.value
  if (r <= 0) return closed
  if (r >= 1) return open
  return [lerp(closed[0], open[0], r), lerp(closed[1], open[1], r)]
})

const hasOpenWindow = computed(() => props.openT0 != null && props.openT1 != null && Number.isFinite(props.openT0) && Number.isFinite(props.openT1))

function timeX(t: number, left: number, width: number) {
  const r = revealV.value
  const cFrac = Math.min(CLOSED_FUTURE_FRAC, naturalFutureFrac(props.t0, props.now, props.t1))
  const x0 = chartX(t, props.t0, props.now, props.t1, left, width, cFrac)
  if (!(r > 0) || !hasOpenWindow.value) {
    if (r >= 1) return chartX(t, props.t0, props.now, props.t1, left, width, naturalFutureFrac(props.t0, props.now, props.t1))
    return x0
  }
  const oNow = props.openNow ?? props.now
  const x1 = chartX(t, props.openT0!, oNow, props.openT1!, left, width, naturalFutureFrac(props.openT0!, oNow, props.openT1!))
  if (r >= 1) return x1
  return lerp(x0, x1, r)
}

function timeT(x: number, left: number, width: number) {
  const r = revealV.value
  const oNow = props.openNow ?? props.now
  if (r >= 1 && hasOpenWindow.value) {
    return chartT(x, props.openT0!, oNow, props.openT1!, left, width, naturalFutureFrac(props.openT0!, oNow, props.openT1!))
  }
  if (r >= 1) return chartT(x, props.t0, props.now, props.t1, left, width, naturalFutureFrac(props.t0, props.now, props.t1))
  const cFrac = Math.min(CLOSED_FUTURE_FRAC, naturalFutureFrac(props.t0, props.now, props.t1))
  return chartT(x, props.t0, props.now, props.t1, left, width, cFrac)
}

const S = computed(() => {
  const b = box.value
  const [p0, p1] = domain.value
  const dp = p1 - p0 || Math.abs(p1) * 0.01 || 1
  return {
    x: (t: number) => timeX(t, b.left, b.width),
    y: (p: number) => b.top + (1 - (p - p0) / dp) * b.height,
    tAt: (x: number) => timeT(x, b.left, b.width),
    pAt: (y: number) => p0 + (1 - (y - b.top) / Math.max(1, b.height)) * dp,
    box: b, t0: props.t0, t1: props.t1, p0, p1,
  }
})

const up = 'var(--app-color-up, var(--success-green, #00ff88))'
const down = 'var(--app-color-down, var(--error-red, #ff4444))'
const xNow = computed(() => S.value.x(props.now))
const yNow = computed(() => S.value.y(props.current))
const hasFuture = computed(() => {
  if (props.t1 > props.now + 1000) return true
  const oNow = props.openNow ?? props.now
  return hasOpenWindow.value && props.openT1! > oNow + 1000 && revealV.value > 0.02
})
/**
 * The live price, rounded once. The series, the white dot and every prediction
 * line share this point so the line into the future leaves the dot exactly.
 */
const tip = computed(() => {
  const x = Math.min(xNow.value, box.value.left + box.value.width)
  return { x: Math.round(x * 10) / 10, y: Math.round(yNow.value * 10) / 10 }
})
/** The candle the live dot is sitting on. Its colour flips as that candle's close crosses its open. */
const tipCandleUp = computed(() => {
  const open = revealV.value > 0.5 && !!props.openCandles?.length
  const src = open ? props.openCandles! : props.candles
  const tNow = open ? (props.openNow ?? props.now) : props.now
  let candle = src[src.length - 1]
  for (let i = src.length - 1; i >= 0; i--) {
    if (src[i]!.t <= tNow) { candle = src[i]; break }
  }
  return !candle || candle.c >= candle.o
})
/** Once the card is open, aiming uses the open window, not the closed card's short one. */
const aimWindow = computed(() => {
  if (revealV.value >= 0.98 && hasOpenWindow.value) {
    return { t0: props.openT0!, now: props.openNow ?? props.now, t1: props.openT1! }
  }
  return { t0: props.t0, now: props.now, t1: props.t1 }
})
const tagUp = computed(() => {
  if (props.trendPct !== null && props.trendPct !== undefined && Number.isFinite(props.trendPct)) return props.trendPct >= 0
  const first = props.candles[0]
  return !first || props.current >= first.o
})

/** Half opacity when the price is still, solid when the latest move is fast. */
const tagOpacity = computed(() => {
  let pct = 0
  if (props.trendPct != null && Number.isFinite(props.trendPct)) pct = Math.abs(props.trendPct)
  else if (props.candles.length >= 2) {
    const a = props.candles[props.candles.length - 2]!.c
    const b = props.candles[props.candles.length - 1]!.c
    pct = a ? Math.abs(b / a - 1) * 100 : 0
  }
  return 0.5 + 0.5 * (1 - Math.exp(-pct / 1.6))
})

const liveTag = computed(() => {
  const label = fmtAxisPrice(props.current, props.kind)
  const font = G.value.font
  const w = Math.max(10, label.length * font * 0.62 + 6)
  const h = font + 2
  return {
    label, w, h,
    x: box.value.left + box.value.width + 2,
    y: tip.value.y - h / 2,
    opacity: tagOpacity.value,
  }
})

// ── Series ──────────────────────────────────────────────────────────────────
function seriesPaths(candles: Candle[], t0: number) {
  const s = S.value
  const c = candles
  const empty = { runs: [] as { pts: string; up: boolean; sim: boolean }[], area: '', bars: [] as { cx: number; w: number; yh: number; yl: number; y: number; h: number; color: string; sim: boolean }[] }
  if (!c.length) return empty
  const gap = c.length > 1 ? c[1]!.t - c[0]!.t : HOUR
  const pts: { x: number; y: number; sim: boolean }[] = [{ x: s.x(c[0]!.t), y: s.y(c[0]!.o), sim: !!c[0]!.sim }]
  for (const k of c) {
    const tEnd = Math.min(props.now, k.t + gap)
    pts.push({ x: s.x(tEnd), y: s.y(k.c), sim: !!k.sim })
  }
  const tp = tip.value
  const end = pts[pts.length - 1]
  if (!end || Math.abs(end.x - tp.x) > 0.2 || Math.abs(end.y - tp.y) > 0.2) {
    pts.push({ x: tp.x, y: tp.y, sim: false })
  }
  const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  const k = c.findIndex(x => !x.sim)
  const split = k <= 0 ? 0 : k
  const runs: { pts: string; up: boolean; sim: boolean }[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const rising = b.y <= a.y
    const sim = split > 0 && i <= split
    const last = runs[runs.length - 1]
    if (last && last.up === rising && last.sim === sim) last.pts += ` ${fmt(b)}`
    else runs.push({ pts: `${fmt(a)} ${fmt(b)}`, up: rising, sim })
  }
  const base = (s.box.top + s.box.height).toFixed(1)
  const area = `${pts.map(fmt).join(' ')} ${pts[pts.length - 1]!.x.toFixed(1)},${base} ${pts[0]!.x.toFixed(1)},${base}`
  const mixedHere = c.some(x => x.sim) && c.some(x => !x.sim)
  const slot = Math.abs(s.x(t0 + gap) - s.x(t0))
  const tight = revealV.value < 0.45
  const w = tight ? Math.max(1.6, slot * 0.84) : Math.max(1.2, Math.min(14, slot * 0.68))
  const bars = c.map((candle) => {
    const cx = s.x(Math.min(props.now, candle.t + gap / 2))
    const yo = s.y(candle.o)
    const yc = s.y(candle.c)
    return {
      cx, w, yh: s.y(candle.h), yl: s.y(candle.l),
      y: Math.min(yo, yc), h: Math.max(1, Math.abs(yc - yo)),
      color: candle.c >= candle.o ? up : down, sim: !!candle.sim && mixedHere,
    }
  })
  return { runs, area, bars }
}

const hasOpenSeries = computed(() => !!props.openCandles?.length && hasOpenWindow.value && revealV.value > 0)
const primaryOpacity = computed(() => hasOpenSeries.value ? 1 - revealV.value : 1)
const openSeriesOpacity = computed(() => hasOpenSeries.value ? revealV.value : 0)
const linePts = computed(() => seriesPaths(props.candles, props.t0))
const openLinePts = computed(() => hasOpenSeries.value ? seriesPaths(props.openCandles!, props.openT0!) : null)

/** Lines and numbers fade in as the card opens; squares carry the closed state. */
function smooth(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
const bodyOp = computed(() => smooth(0.12, 0.82, revealV.value))
const squareOp = computed(() => 1 - smooth(0.08, 0.7, revealV.value))
const labelOp = computed(() => smooth(0.5, 0.92, revealV.value))

const lineColor = computed(() => {
  if (props.trendPct !== null && props.trendPct !== undefined && Number.isFinite(props.trendPct)) return props.trendPct >= 0 ? up : down
  const first = props.candles[0]
  return !first || props.current >= first.o ? up : down
})
const gradId = `pc-grad-${Math.random().toString(36).slice(2, 8)}`
const clipId = `pc-clip-${Math.random().toString(36).slice(2, 8)}`

// ── Axes ────────────────────────────────────────────────────────────────────
const priceTicks = computed(() => {
  const [lo, hi] = domain.value
  const ticks = niceTicks(lo, hi, mini.value ? 3 : 4)
  return ticks
    .map(v => ({ v, y: S.value.y(v), label: fmtAxisPrice(v, props.kind) }))
    .filter(t => t.y >= box.value.top - 1 && t.y <= box.value.top + box.value.height + 1)
    .filter(t => Math.abs(t.y - yNow.value) > G.value.font + 2)
    // don't crowd the tags drawn on the scale (range edges, aim, alert levels)
    .filter(t => !tagYs.value.some(y => Math.abs(t.y - y) < G.value.font + 2))
})

/** Closed card: only the low and the high of the candles on screen. */
const extremeTicks = computed(() => {
  const vals = candleVals(props.candles).filter(Number.isFinite)
  if (!vals.length) return [] as { v: number; y: number; label: string }[]
  const ends = [Math.max(...vals), Math.min(...vals)]
  const seen = new Set<string>()
  const out: { v: number; y: number; label: string }[] = []
  for (const v of ends) {
    const label = fmtAxisPrice(v, props.kind)
    if (seen.has(label)) continue
    seen.add(label)
    const y = S.value.y(v)
    if (Math.abs(y - yNow.value) <= G.value.font + 1) continue
    if (y < box.value.top - 2 || y > box.value.top + box.value.height + 2) continue
    out.push({ v, y, label })
  }
  return out
})

const tagYs = computed(() => {
  const ys: number[] = []
  if (props.range && hasFuture.value) ys.push(S.value.y(props.range.max), S.value.y(props.range.min))
  if (props.aim) ys.push(S.value.y(props.aim.price))
  for (const l of props.levels) ys.push(S.value.y(l.price))
  return ys
})

/** Closed card names the window on the left. The clock stays on the ticks, in the header's timezone, so a time never sits inside the period label. */
const periodLabel = computed(() => {
  if (revealV.value > 0.55) return ''
  const hours = Math.max(0, (props.now - props.t0) / HOUR)
  if (hours <= 36) return '24h'
  if (hours < 24 * 3) return `${Math.round(hours)}h`
  if (hours < 24 * 60) return `${Math.round(hours / 24)}d`
  try {
    return new Date(props.t0).toLocaleDateString(undefined, { timeZone: timeZone.value, day: 'numeric', month: 'short' })
  } catch {
    return new Date(props.t0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
})

function axisTextWidth(text: string) {
  return text.length * G.value.font * 0.64
}

const tTicks = computed(() => {
  const raw = timeTicks(props.t0, props.t1, mini.value ? 3 : Math.max(3, Math.min(6, Math.floor(box.value.width / 80))), undefined, timeZone.value)
  const out: { x: number; label: string }[] = []
  const gap = 14
  const periodEnd = periodLabel.value ? box.value.left + axisTextWidth(periodLabel.value) : box.value.left
  for (const t of raw) {
    const x = S.value.x(t.t)
    const half = axisTextWidth(t.label) / 2
    if (x - half < periodEnd + gap) continue
    if (x + half > box.value.left + box.value.width + G.value.right - 4) continue
    const prev = out[out.length - 1]
    if (prev && x - half < prev.x + axisTextWidth(prev.label) / 2 + gap) continue
    out.push({ x, label: t.label })
  }
  return out
})

// ── Predictions ─────────────────────────────────────────────────────────────
function dirColor(p: { direction?: string; predictedChangePct?: number }) {
  if (p.direction === 'bearish') return down
  if (p.direction === 'bullish') return up
  return (p.predictedChangePct ?? 0) < 0 ? down : up
}

function chainOf(p: Prediction): PathStop[] {
  const made = Date.parse(p.timestamp)
  const chain: PathStop[] = []
  if (Number.isFinite(made) && Number.isFinite(p.currentPrice)) chain.push({ t: made, price: p.currentPrice })
  for (const s of userStops(p)) {
    const prev = chain[chain.length - 1]
    if (!prev || s.t > prev.t) chain.push(s)
  }
  if (!chain.length) {
    const tT = targetTsOf(p)
    if (Number.isFinite(tT)) chain.push({ t: props.now, price: props.current }, { t: tT, price: p.predictedPrice })
  }
  return chain
}

function pieces(p: Prediction) {
  const s = S.value
  const chain = chainOf(p)
  const out: { id: string; x1: number; y1: number; x2: number; y2: number; color: string; anchored: boolean; dot: boolean }[] = []
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]!
    const b = chain[i]!
    const clip = clipPrediction(a.t, b.t, a.price, b.price, props.t0, props.t1)
    if (!clip) continue
    out.push({
      id: `${p.id}:${i}`,
      x1: s.x(clip.from), y1: s.y(clip.priceFrom),
      x2: s.x(clip.to), y2: s.y(clip.priceTo),
      color: b.price >= a.price ? up : down,
      price: b.price,
      label: fmtAxisPrice(b.price, props.kind),
      anchored: i === 1 && Math.abs(clip.from - a.t) < 2,
      dot: Math.abs(clip.to - b.t) < 2,
    })
  }
  return out
}

const mineSegs = computed(() => props.mine.flatMap(pieces))
const friendSegs = computed(() => props.friends.flatMap((p) => {
  const segs = pieces(p)
  const last = segs[segs.length - 1]
  if (!last) return []
  const profile = friendProfile(p.userId)
  return segs.map((seg, i) => ({ ...seg, avatar: profile.avatar, name: profile.name, face: i === segs.length - 1 }))
}))

/** A price that sits outside the candle scale is parked on the frame as a square. */
function parkY(raw: number, slot: number, edge: 'in' | 'above' | 'below') {
  const b = box.value
  const top = b.top + 2.5
  const bot = b.top + b.height - 2.5
  if (edge === 'in') return clamp(raw, top, bot)
  const gap = Math.min(6, Math.max(4, (bot - top) / 8))
  if (edge === 'above') return Math.min(bot - 2, top + slot * gap)
  return Math.max(top + 2, bot - slot * gap)
}

const parkedCalls = computed(() => {
  const b = box.value
  const rows = [
    ...mineSegs.value.filter(m => m.dot).map(m => ({ id: 'm' + m.id, x: m.x2, raw: m.y2, color: m.color, label: m.label })),
    ...friendSegs.value.filter(f => f.face).map(f => ({ id: 'f' + f.id, x: f.x2, raw: f.y2, color: f.color, label: f.label })),
  ].sort((a, c) => a.raw - c.raw)
  const n = rows.length
  const s = 5
  const gap = s + 2
  const total = Math.max(s, n * gap - 2)
  const colX = b.left + b.width - s / 2 - 1
  const origin = b.top + Math.max(1, (b.height - total) / 2)
  const r = revealV.value
  return rows.map((row, i) => {
    const colY = origin + i * gap + s / 2
    const realY = clamp(row.raw, b.top + s / 2, b.top + b.height - s / 2)
    return {
      ...row,
      x: lerp(colX, row.x, r),
      y: lerp(colY, realY, r),
      s,
    }
  })
})

const tradeMarks = computed(() => props.trades
  .filter(t => t.t >= props.t0 && t.t <= props.now)
  .map(t => ({ x: S.value.x(t.t), y: S.value.y(t.price), side: t.side })))

const rangeBand = computed(() => {
  const range = props.range ?? (revealV.value > 0.04 ? props.openRange : null)
  if (props.rangeLock || props.openRangeLock || !range || !hasFuture.value) return null
  if (!props.range && revealV.value < 0.04) return null
  const s = S.value
  return {
    x: xNow.value, w: s.box.left + s.box.width - xNow.value,
    yMax: s.y(range.max), yMin: s.y(range.min),
    labelMax: fmtAxisPrice(range.max, props.kind), labelMin: fmtAxisPrice(range.min, props.kind),
    opacity: props.range ? 1 : labelOp.value,
  }
})

const aimMark = computed(() => {
  if (!props.aim) return null
  const s = S.value
  const x = s.x(props.aim.t)
  const y = s.y(props.aim.price)
  const color = props.aim.price >= props.current ? up : down
  const dateLabel = zonedTarget(props.aim.t, (props.t1 - props.now) / HOUR)
  const dateW = dateLabel.length * G.value.font * 0.58 + 10
  const from = props.aim.fromT != null && props.aim.fromPrice != null
    ? { x: s.x(props.aim.fromT), y: s.y(props.aim.fromPrice) }
    : { x: tip.value.x, y: tip.value.y }
  return {
    x, y, color, fromX: from.x, fromY: from.y,
    priceLabel: fmtAxisPrice(props.aim.price, props.kind),
    dateLabel, dateW,
    dateX: clamp(x - dateW / 2, box.value.left, box.value.left + box.value.width - dateW),
  }
})

// ── Pointer: tap / drag in the future zone ──────────────────────────────────
const zone = ref<HTMLElement | null>(null)
const dragging = ref(false)
const placingLimit = ref(false)
const railHover = ref(false)
let last: { t: number; price: number } | null = null

function inRail(clientX: number) {
  const el = root.value
  if (!el) return false
  const x = clientX - el.getBoundingClientRect().left
  return x >= box.value.left + box.value.width - 1
}

function pick(clientX: number, clientY: number) {
  const el = root.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const s = S.value
  const w = aimWindow.value
  const snap = Math.max(0.25, props.snapHours) * HOUR
  const lead = props.minLeadHours * HOUR
  let t = s.tAt(clientX - r.left)
  t = clamp(t, w.now + lead, w.t1)
  t = Math.min(w.t1, Math.max(w.now + lead, Math.round(t / snap) * snap))
  // magnets: exactly 1 day / 1 week / … from now, and the right edge (12 px each)
  const tol = (10 / Math.max(1, s.box.width)) * (w.t1 - w.t0)
  t = snapTarget(t, w.now, w.t1, tol).t
  t = clamp(t, w.now + lead, w.t1)
  let price = s.pAt(clientY - r.top)
  const locked = (props.openRangeLock || props.rangeLock) ? (props.openRange ?? props.range) : null
  const lo = locked ? locked.min : domain.value[0]
  const hi = locked ? locked.max : domain.value[1]
  price = clamp(price, lo, hi)
  return { t, price }
}

// A trackpad click is pointerdown + pointerup, and some browsers also emit click.
// `sawPointer` keeps that second event from recording the same point twice.
// Moves are painted once per frame so a drag does not rebuild the chart on every event.
let sawPointer = false
let committedAt = 0
let aimFrame = 0
let prevPtr = { x: 0, y: 0, ok: false }
const edgeHot = ref<'' | 'right' | 'top' | 'bottom' | 'top-right' | 'bottom-right'>('')

/** Grow the open window when the pointer pushes into the outer 10% of the future plot. */
function nudgeWindow(x: number, y: number, dx: number, dy: number) {
  const b = box.value
  const left = xNow.value
  const plotW = b.left + b.width - left
  if (!(plotW > 8) || x > b.left + b.width + 1) {
    edgeHot.value = ''
    return
  }
  const n = edgeNudge(x, y, dx, dy, left, b.top, plotW, b.height, 0.1)
  const rx = (x - left) / plotW
  const ry = (y - b.top) / b.height
  const onRight = rx > 0.9 && rx <= 1.02
  const onTop = ry < 0.1 && ry >= -0.02
  const onBottom = ry > 0.9 && ry <= 1.02
  edgeHot.value = onRight && onTop ? 'top-right' : onRight && onBottom ? 'bottom-right' : onRight ? 'right' : onTop ? 'top' : onBottom ? 'bottom' : ''
  const cap = 0.04
  const w = aimWindow.value
  if (n.date > 0) {
    const future = Math.max(HOUR, w.t1 - w.now)
    emit('window', 'end', w.t1 + future * Math.min(cap, n.date * 1.6))
  }
  if (n.priceUp > 0 || n.priceDown > 0) {
    const [lo, hi] = domain.value
    const span = Math.max(1e-9, hi - lo)
    const up = span * Math.min(cap, n.priceUp * 1.6)
    const down = span * Math.min(cap, n.priceDown * 1.6)
    emit('scale', lo - down, hi + up)
  }
}
let levelFrame = 0
let hoverFrame = 0
let levelPending: number | null = null
let hoverPending: { t: number; price: number } | null = null
function queueAim() {
  if (aimFrame) return
  aimFrame = requestAnimationFrame(() => {
    aimFrame = 0
    if (dragging.value && last) emit('aim', last.t, last.price)
  })
}
function queueLevel(price: number) {
  levelPending = price
  if (levelFrame) return
  levelFrame = requestAnimationFrame(() => {
    levelFrame = 0
    if (!placingLimit.value || levelPending == null) return
    dragLevel.value = levelPending
    emit('level', levelPending)
  })
}
function cancelFrames() {
  if (aimFrame) cancelAnimationFrame(aimFrame)
  if (levelFrame) cancelAnimationFrame(levelFrame)
  if (hoverFrame) cancelAnimationFrame(hoverFrame)
  aimFrame = 0
  levelFrame = 0
  hoverFrame = 0
}

function onDown(e: PointerEvent) {
  if (!props.interactive || e.button > 0) return
  e.preventDefault()
  sawPointer = true
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* released */ }
  if (inRail(e.clientX)) {
    placingLimit.value = true
    dragging.value = false
    dragLevel.value = levelAt(e.clientY)
    levelPending = dragLevel.value
    emit('level', dragLevel.value)
    return
  }
  placingLimit.value = false
  dragging.value = true
  last = pick(e.clientX, e.clientY)
  if (last) emit('aim', last.t, last.price)
}
const hover = ref<{ t: number; price: number } | null>(null)
const canHover = ref(false)
onMounted(() => { canHover.value = !!window.matchMedia?.('(hover: hover)').matches })

function queueHover(next: { t: number; price: number } | null) {
  hoverPending = next
  if (hoverFrame) return
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    if (dragging.value || placingLimit.value) return
    hover.value = hoverPending
  })
}
function onMove(e: PointerEvent) {
  const r = root.value?.getBoundingClientRect()
  const x = r ? e.clientX - r.left : 0
  const y = r ? e.clientY - r.top : 0
  const dx = prevPtr.ok ? x - prevPtr.x : 0
  const dy = prevPtr.ok ? y - prevPtr.y : 0
  prevPtr = { x, y, ok: true }
  railHover.value = inRail(e.clientX)
  if (!placingLimit.value && !railHover.value && r) nudgeWindow(x, y, dx, dy)
  else if (!placingLimit.value) edgeHot.value = ''
  if (placingLimit.value) {
    queueLevel(levelAt(e.clientY))
    return
  }
  if (!dragging.value) {
    queueHover(e.pointerType === 'mouse' && !railHover.value ? pick(e.clientX, e.clientY) : null)
    return
  }
  hover.value = null
  last = pick(e.clientX, e.clientY)
  queueAim()
}
function onLeave() { hover.value = null; railHover.value = false; edgeHot.value = ''; prevPtr.ok = false }
function finishGesture() {
  sawPointer = false
  committedAt = performance.now()
  cancelFrames()
}
onBeforeUnmount(cancelFrames)
function onUp() {
  if (placingLimit.value) {
    finishGesture()
    placingLimit.value = false
    const price = levelPending ?? dragLevel.value
    levelPending = null
    dragLevel.value = null
    if (price != null) emit('limit', price)
    return
  }
  if (!dragging.value) { sawPointer = false; return }
  finishGesture()
  dragging.value = false
  if (last) emit('commit', last.t, last.price)
}
/** A click that arrived without a pointer gesture (or after one was lost) still records. */
function onClick(e: MouseEvent) {
  if (!props.interactive || e.button > 0) return
  if (sawPointer || performance.now() - committedAt < 400) return
  if (inRail(e.clientX)) {
    emit('limit', levelAt(e.clientY))
    return
  }
  const picked = pick(e.clientX, e.clientY)
  if (picked) emit('commit', picked.t, picked.price)
}

function onKey(e: KeyboardEvent) {
  if (!props.interactive) return
  const lo = props.range ? props.range.min : domain.value[0]
  const hi = props.range ? props.range.max : domain.value[1]
  const w = aimWindow.value
  const cur = props.aim ?? { t: w.now + (w.t1 - w.now) / 2, price: props.current }
  const dp = (hi - lo) / 50
  const dt = Math.max(props.snapHours, (w.t1 - w.now) / HOUR / 24) * HOUR
  let next = { ...cur }
  if (e.key === 'ArrowUp') next.price = clamp(cur.price + dp, lo, hi)
  else if (e.key === 'ArrowDown') next.price = clamp(cur.price - dp, lo, hi)
  else if (e.key === 'ArrowRight') next.t = clamp(cur.t + dt, w.now + props.minLeadHours * HOUR, w.t1)
  else if (e.key === 'ArrowLeft') next.t = clamp(cur.t - dt, w.now + props.minLeadHours * HOUR, w.t1)
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('commit', cur.t, cur.price); return }
  else return
  e.preventDefault()
  next = { t: next.t, price: next.price }
  emit('aim', next.t, next.price)
}

// ── Level mode (alerts): vertical drag anywhere on the plot ─────────────────
const dragLevel = ref<number | null>(null)
function levelAt(clientY: number) {
  const r = root.value!.getBoundingClientRect()
  return clamp(S.value.pAt(clientY - r.top), domain.value[0], domain.value[1])
}
function onLevelDown(e: PointerEvent) {
  if (e.button > 0) return
  e.preventDefault()
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* released */ }
  dragLevel.value = levelAt(e.clientY)
  emit('level', dragLevel.value)
}
function onLevelMove(e: PointerEvent) {
  if (dragLevel.value === null) return
  dragLevel.value = levelAt(e.clientY)
  emit('level', dragLevel.value)
}
function onLevelUp() {
  if (dragLevel.value === null) return
  emit('levelCommit', dragLevel.value)
  dragLevel.value = null
}
const nowFrac = computed(() => {
  const w = box.value.width
  if (!(w > 0)) return 0.5
  return clamp((xNow.value - box.value.left) / w, 0.02, 0.98)
})
const levelMarks = computed(() => {
  const saved = props.levels.map(l => ({
    ...l, gid: String(l.id).replace(/[^A-Za-z0-9_-]/g, ''),
    y: S.value.y(l.price), live: false, ink: l.ink || '#fff', fade: !!l.fade,
  }))
  if (dragLevel.value === null) return saved
  const tone = limitTone(dragLevel.value, props.current)
  return [...saved, {
    id: 'drag', gid: 'drag', price: dragLevel.value, color: tone.color, ink: tone.ink,
    label: fmtAxisPrice(dragLevel.value, props.kind), y: S.value.y(dragLevel.value),
    live: true, hot: false, fade: true,
  }]
})
const parkedLevels = computed(() => {
  const b = box.value
  const top = b.top + 2.5
  const bot = b.top + b.height - 2.5
  const rows = levelMarks.value.filter(l => !l.live).map(l => ({ id: l.id, x: xNow.value + Math.max(8, (b.left + b.width - xNow.value) * 0.45), raw: l.y, color: l.color }))
  const above = rows.filter(r => r.raw < top).sort((a, c) => a.raw - c.raw)
  const below = rows.filter(r => r.raw > bot).sort((a, c) => c.raw - a.raw)
  const aboveAt = new Map(above.map((r, i) => [r.id, i]))
  const belowAt = new Map(below.map((r, i) => [r.id, i]))
  return rows.map((r) => {
    const edge = aboveAt.has(r.id) ? 'above' as const : belowAt.has(r.id) ? 'below' as const : 'in' as const
    const slot = aboveAt.get(r.id) ?? belowAt.get(r.id) ?? 0
    return { ...r, y: parkY(r.raw, slot, edge) }
  })
})
const hint = computed(() => {
  if (canHover.value) return props.extending ? 'click further right to extend' : 'click to predict'
  return props.extending ? 'tap further right' : 'tap to predict'
})
const plotStyle = computed(() => ({
  left: `${box.value.left}px`, top: `${box.value.top}px`, width: `${box.value.width}px`, height: `${box.value.height}px`,
}))

// ── Read the series: mouse hover, finger stays down ─────────────────────────
const samples = computed(() => {
  const src = revealV.value > 0.55 && props.openCandles?.length ? props.openCandles : props.candles
  const gap = src.length > 1 ? src[1]!.t - src[0]!.t : HOUR
  const s = S.value
  const out: { t: number; price: number; up: boolean; x: number }[] = []
  for (const k of src) {
    const tEnd = Math.min(props.now, k.t + gap)
    out.push({ t: tEnd, price: k.c, up: k.c >= k.o, x: s.x(Math.min(props.now, k.t + gap / 2)) })
  }
  const last = src[src.length - 1]
  out.push({ t: props.now, price: props.current, up: last ? last.c >= last.o : true, x: s.x(props.now) })
  return out
})

const probe = ref<{ t: number; price: number; up: boolean; x: number } | null>(null)
const pressing = ref(false)
let holdTimer = 0
let scrubMoved = false
let scrubOrigin = { x: 0, y: 0 }

function nearestSample(clientX: number) {
  const el = root.value
  if (!el || !samples.value.length) return null
  const x = clientX - el.getBoundingClientRect().left
  const b = box.value
  if (x < b.left - 12 || x > b.left + b.width + 12) return null
  let best = samples.value[0]!
  let bestD = Infinity
  for (const p of samples.value) {
    const d = Math.abs(p.x - x)
    if (d < bestD) { bestD = d; best = p }
  }
  return best
}

function onScrubDown(e: PointerEvent) {
  if (e.button > 0) return
  scrubMoved = false
  scrubOrigin = { x: e.clientX, y: e.clientY }
  if (e.pointerType === 'mouse') {
    probe.value = nearestSample(e.clientX)
    return
  }
  window.clearTimeout(holdTimer)
  holdTimer = window.setTimeout(() => {
    pressing.value = true
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* released */ }
    probe.value = nearestSample(scrubOrigin.x)
  }, 160)
}
function onScrubMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') {
    probe.value = nearestSample(e.clientX)
    return
  }
  const dx = Math.abs(e.clientX - scrubOrigin.x)
  const dy = Math.abs(e.clientY - scrubOrigin.y)
  if (!pressing.value) {
    if (dx > 8 || dy > 8) window.clearTimeout(holdTimer)
    return
  }
  scrubMoved = true
  probe.value = nearestSample(e.clientX)
}
function onScrubUp(e: PointerEvent) {
  window.clearTimeout(holdTimer)
  if (e.pointerType === 'mouse') return
  pressing.value = false
  probe.value = null
}
function onScrubLeave() {
  if (pressing.value) return
  probe.value = null
}
function onScrubClick(e: MouseEvent) {
  if (!scrubMoved) return
  scrubMoved = false
  e.stopPropagation()
  e.preventDefault()
}
onBeforeUnmount(() => window.clearTimeout(holdTimer))

const probeMark = computed(() => {
  const p = probe.value
  if (!p) return null
  const s = S.value
  const x = s.x(p.t)
  const y = s.y(p.price)
  let when = ''
  try {
    when = new Date(p.t).toLocaleString(undefined, { timeZone: timeZone.value, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    when = new Date(p.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const text = `${fmtAxisPrice(p.price, props.kind)} · ${when}`
  const sub = `now ${fmtAxisPrice(props.current, props.kind)}`
  const w = Math.max(text.length, sub.length) * G.value.font * 0.56 + 10
  const left = x + 8 + w > box.value.left + box.value.width
  const tx = left ? x - 8 - w : x + 8
  const ty = clamp(y - G.value.font * 2.2, box.value.top, box.value.top + box.value.height - G.value.font * 3.2)
  const bg = p.up ? 'rgba(0, 86, 44, 0.72)' : 'rgba(112, 20, 20, 0.72)'
  return { x, y, text, sub, w, tx, ty, color: p.up ? up : down, bg }
})

/** Past scrub ends at "now". The future scrub is the short strip that lerps wider as the card opens. */
const scrubPastStyle = computed(() => ({
  left: `${box.value.left}px`,
  top: `${box.value.top}px`,
  width: `${Math.max(0, hasFuture.value ? xNow.value - box.value.left : box.value.width)}px`,
  height: `${box.value.height}px`,
}))
const showFutureScrub = computed(() => hasFuture.value && !(props.interactive && revealV.value > 0.98))
const scrubFutureStyle = computed(() => ({
  left: `${xNow.value}px`,
  top: `${box.value.top}px`,
  width: `${Math.max(0, box.value.left + box.value.width - xNow.value)}px`,
  height: `${box.value.height}px`,
}))

const hoverMark = computed(() => {
  if (!hover.value) return null
  const s = S.value
  const wdw = aimWindow.value
  const x = s.x(hover.value.t)
  const y = s.y(hover.value.price)
  const pct = props.current ? (hover.value.price / props.current - 1) * 100 : 0
  const priceLabel = fmtAxisPrice(hover.value.price, props.kind)
  const text = `${priceLabel} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% · ${zonedTarget(hover.value.t, (wdw.t1 - wdw.now) / HOUR)}`
  const w = text.length * G.value.font * 0.56 + 8
  const left = x + 10 + w > box.value.left + box.value.width
  const priceW = Math.max(10, priceLabel.length * G.value.font * 0.62 + 8)
  let tagY = y
  if (Math.abs(y - yNow.value) < G.value.font + 8) tagY = y < yNow.value ? y - G.value.font - 6 : y + G.value.font + 6
  tagY = clamp(tagY, box.value.top + G.value.font, box.value.top + box.value.height - G.value.font)
  const rising = pct >= 0
  return {
    x, y, text, w,
    tx: left ? x - 10 - w : x + 10,
    ty: clamp(y - G.value.font, box.value.top, box.value.top + box.value.height - G.value.font * 1.6),
    color: rising ? up : down,
    bg: rising ? 'rgba(0, 86, 44, 0.72)' : 'rgba(112, 20, 20, 0.72)',
    priceLabel, priceW, tagY,
  }
})

// The zone runs over the price scale too: anything right of the plot is the
// last instant of the window, so "exactly one horizon ahead" is easy to hit.
const zoneStyle = computed(() => ({
  left: `${xNow.value}px`,
  top: `${box.value.top}px`,
  width: `${Math.max(0, width.value - xNow.value)}px`,
  height: `${box.value.height}px`,
}))
/** Outer 10% of the future plot: right extends the date, top and bottom the price, corners both. */
const edgeBands = computed(() => {
  const b = box.value
  const x = xNow.value
  const w = Math.max(0, b.left + b.width - x)
  const bw = w * 0.1
  const bh = b.height * 0.1
  return {
    right: { x: b.left + b.width - bw, y: b.top, w: bw, h: b.height },
    top: { x, y: b.top, w: Math.max(0, w - bw), h: bh },
    bottom: { x, y: b.top + b.height - bh, w: Math.max(0, w - bw), h: bh },
  }
})

// Each strip stops short of the corner so the date grip and the price grip
// can both be grabbed. The corner used to belong to whichever rendered last.
const timeAxisStyle = computed(() => ({
  left: `${box.value.left}px`,
  top: `${box.value.top + box.value.height + 2}px`,
  width: `${Math.max(16, box.value.width + G.value.right - 18)}px`,
  height: '16px',
}))
const priceAxisStyle = computed(() => ({
  left: `${box.value.left + box.value.width + 6}px`,
  top: `${box.value.top}px`,
  width: '16px',
  height: `${Math.max(16, box.value.height + G.value.bottom - 6)}px`,
}))

let axis0: { axis: 'time' | 'price'; edge: 'start' | 'end'; x: number; y: number; t0: number; t1: number; min: number; max: number; pxPerMs: number; pxPerPrice: number } | null = null
function onAxis(axis: 'time' | 'price', edge: 'start' | 'end', x: number, y: number, phase: 'start' | 'move' | 'end') {
  if (phase === 'start') {
    const w = aimWindow.value
    const spanT = Math.max(1, w.t1 - w.t0)
    const spanP = Math.max(1e-9, domain.value[1] - domain.value[0])
    axis0 = {
      axis, edge, x, y, t0: w.t0, t1: w.t1,
      min: domain.value[0], max: domain.value[1],
      pxPerMs: box.value.width / spanT,
      pxPerPrice: box.value.height / spanP,
    }
    return
  }
  const d = axis0
  if (!d || d.axis !== axis || d.edge !== edge) return
  if (axis === 'time') {
    const dt = (x - d.x) / d.pxPerMs
    emit('window', edge, edge === 'start' ? d.t0 + dt : d.t1 + dt)
  } else {
    const dp = -(y - d.y) / d.pxPerPrice
    emit('scale', edge === 'end' ? d.min : d.min + dp, edge === 'end' ? d.max + dp : d.max)
  }
  if (phase === 'end') axis0 = null
}
</script>

<template>
  <div
    ref="root"
    class="pc"
    :class="[size, { interactive, dragging }]"
    :style="{ height: `${height}px`, viewTransitionName: morphName || undefined, viewTransitionClass: morphName ? 'da-chart' : undefined }"
  >
    <svg
      class="pc-svg"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="label"
    >
      <defs>
        <linearGradient
          v-for="l in levelMarks.filter(l => l.fade)" :key="'lg' + l.id"
          :id="`${clipId}-lv-${l.gid}`" gradientUnits="userSpaceOnUse"
          :x1="box.left" :x2="box.left + box.width" y1="0" y2="0"
        >
          <stop offset="0" :stop-color="l.color" stop-opacity="0.15" />
          <stop :offset="nowFrac" :stop-color="l.color" stop-opacity="0.5" />
          <stop offset="1" :stop-color="l.color" stop-opacity="1" />
        </linearGradient>
        <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="lineColor" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
        </linearGradient>
        <clipPath v-for="(f, i) in friendSegs" :id="`${clipId}-f${i}`" :key="'cf' + f.id">
          <circle :cx="f.x2" :cy="f.y2" r="8.5" />
        </clipPath>
        <clipPath :id="clipId">
          <rect :x="box.left" :y="box.top - 2" :width="box.width" :height="box.height + 4" />
        </clipPath>
      </defs>

      <!-- future zone -->
      <rect
        v-if="hasFuture"
        :x="xNow" :y="box.top" :width="box.left + box.width - xNow" :height="box.height"
        class="pc-future" :class="{ active: interactive }"
      />

      <!-- price grid + right-hand scale. Closed: only the low and the high. -->
      <g v-if="revealV < 0.82" :opacity="1 - revealV">
        <g v-for="t in extremeTicks" :key="'e' + t.v">
          <line :x1="box.left" :x2="box.left + box.width" :y1="t.y" :y2="t.y" class="pc-grid" />
          <text :x="box.left + box.width + 4" :y="t.y + G.font * 0.35" class="pc-axis" :font-size="G.font">{{ t.label }}</text>
        </g>
      </g>
      <g v-if="revealV > 0.08" :opacity="revealV">
        <g v-for="t in priceTicks" :key="'p' + t.v">
          <line :x1="box.left" :x2="box.left + box.width" :y1="t.y" :y2="t.y" class="pc-grid" />
          <text :x="box.left + box.width + 4" :y="t.y + G.font * 0.35" class="pc-axis" :font-size="G.font">{{ t.label }}</text>
        </g>
      </g>

      <!-- potential range from past moves -->
      <g v-if="rangeBand" :opacity="rangeBand.opacity">
        <rect :x="rangeBand.x" :y="rangeBand.yMax" :width="rangeBand.w" :height="Math.max(0, rangeBand.yMin - rangeBand.yMax)" class="pc-range" />
        <line :x1="rangeBand.x" :x2="box.left + box.width" :y1="rangeBand.yMax" :y2="rangeBand.yMax" class="pc-range-edge" :stroke="up" />
        <line :x1="rangeBand.x" :x2="box.left + box.width" :y1="rangeBand.yMin" :y2="rangeBand.yMin" class="pc-range-edge" :stroke="down" />
        <text :x="box.left + box.width + 4" :y="rangeBand.yMax + G.font * 0.35" class="pc-axis strong" :fill="up" :font-size="G.font">{{ rangeBand.labelMax }}</text>
        <text :x="box.left + box.width + 4" :y="rangeBand.yMin + G.font * 0.35" class="pc-axis strong" :fill="down" :font-size="G.font">{{ rangeBand.labelMin }}</text>
      </g>

      <g :clip-path="`url(#${clipId})`">
        <!-- series: closed candles fade out as the open window fades in -->
        <g :opacity="primaryOpacity">
          <template v-if="chartStyle === 'candle'">
            <g v-for="(c, i) in linePts.bars" :key="'c' + i" :opacity="c.sim ? 0.45 : 1">
              <line :x1="c.cx" :x2="c.cx" :y1="c.yh" :y2="c.yl" :stroke="c.color" stroke-width="1" />
              <rect :x="c.cx - c.w / 2" :y="c.y" :width="c.w" :height="c.h" :fill="c.color" rx="0.5" />
            </g>
          </template>
          <template v-else>
            <polygon v-if="linePts.area" :points="linePts.area" :fill="`url(#${gradId})`" />
            <polyline
              v-for="(r, i) in linePts.runs" :key="'r' + i"
              :points="r.pts" fill="none" :stroke="r.up ? up : down"
              :stroke-width="mini ? 1.6 : 2" :stroke-opacity="r.sim ? 0.45 : 1" :stroke-dasharray="r.sim ? '3 2' : undefined"
              stroke-linejoin="round" stroke-linecap="round" class="pc-run" :class="r.up ? 'up' : 'down'"
            />
          </template>
        </g>
        <g v-if="openLinePts" :opacity="openSeriesOpacity">
          <template v-if="chartStyle === 'candle'">
            <g v-for="(c, i) in openLinePts.bars" :key="'oc' + i" :opacity="c.sim ? 0.45 : 1">
              <line :x1="c.cx" :x2="c.cx" :y1="c.yh" :y2="c.yl" :stroke="c.color" stroke-width="1" />
              <rect :x="c.cx - c.w / 2" :y="c.y" :width="c.w" :height="c.h" :fill="c.color" rx="0.5" />
            </g>
          </template>
          <template v-else>
            <polygon v-if="openLinePts.area" :points="openLinePts.area" :fill="`url(#${gradId})`" />
            <polyline
              v-for="(r, i) in openLinePts.runs" :key="'or' + i"
              :points="r.pts" fill="none" :stroke="r.up ? up : down"
              :stroke-width="mini ? 1.6 : 2" :stroke-opacity="r.sim ? 0.45 : 1" :stroke-dasharray="r.sim ? '3 2' : undefined"
              stroke-linejoin="round" stroke-linecap="round" class="pc-run" :class="r.up ? 'up' : 'down'"
            />
          </template>
        </g>

        <!-- paper trades -->
        <g v-for="(m, i) in tradeMarks" :key="'t' + i">
          <circle v-if="m.side === 'buy'" :cx="m.x" :cy="m.y" :r="mini ? 2.6 : 3.5" :fill="up" stroke="#0b0d10" stroke-width="1" />
          <rect v-else :x="m.x - (mini ? 2.4 : 3.2)" :y="m.y - (mini ? 2.4 : 3.2)" :width="mini ? 4.8 : 6.4" :height="mini ? 4.8 : 6.4" :fill="down" stroke="#0b0d10" stroke-width="1" />
        </g>

        <!-- friends' calls: squares while closed, avatar and path once open -->
        <g v-for="(f, i) in friendSegs" :key="f.id" class="pc-friend" :opacity="bodyOp">
          <line :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2" :stroke="f.color" stroke-width="1" stroke-dasharray="2 3" stroke-opacity="0.75" />
          <template v-if="f.face && !mini">
            <circle :cx="f.x2" :cy="f.y2" r="10" :fill="f.color" />
            <image :href="f.avatar" :x="f.x2 - 8.5" :y="f.y2 - 8.5" width="17" height="17" :clip-path="`url(#${clipId}-f${i})`" preserveAspectRatio="xMidYMid slice"><title>{{ f.name }}</title></image>
          </template>
          <template v-else-if="f.face">
            <circle :cx="f.x2" :cy="f.y2" r="3.2" :fill="f.color" stroke="#0b0d10" stroke-width="1" />
          </template>
          <text v-if="f.face && labelOp > 0.04" :x="f.x2 - 4" :y="f.y2 - 8" text-anchor="end" class="pc-tag-text" :fill="f.color" :font-size="G.font" :opacity="labelOp">{{ f.label }}</text>
        </g>

        <!-- my calls -->
        <g v-for="m in mineSegs" :key="m.id" :opacity="bodyOp">
          <line :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" :stroke="m.color" :stroke-width="mini ? 1.2 : 1.6" stroke-dasharray="4 3" />
          <circle v-if="m.anchored" :cx="m.x1" :cy="m.y1" :r="mini ? 1.6 : 2.2" :fill="m.color" />
          <circle v-if="m.dot" :cx="m.x2" :cy="m.y2" :r="mini ? 3.2 : 5" :fill="m.color" stroke="#0b0d10" stroke-width="1.4" class="pc-mine" />
          <text v-if="m.dot && labelOp > 0.04" :x="m.x2 - 4" :y="m.y2 - 8" text-anchor="end" class="pc-tag-text" :fill="m.color" :font-size="G.font" :opacity="labelOp">{{ m.label }}</text>
        </g>

        <!-- closed state: one square per call, same colour, inside the plot -->
        <g v-if="squareOp > 0.02" :opacity="squareOp">
          <g v-for="p in parkedCalls" :key="p.id">
            <rect
              :x="p.x - (p.s + 3) / 2" :y="p.y - (p.s + 3) / 2" :width="p.s + 3" :height="p.s + 3"
              :fill="p.color" opacity="0.38"
            />
            <rect
              :x="p.x - p.s / 2" :y="p.y - p.s / 2" :width="p.s" :height="p.s"
              :fill="p.color" stroke="#0b0d10" stroke-width="0.8"
            />
          </g>
          <rect
            v-for="p in parkedLevels" :key="'ls' + p.id"
            :x="p.x - 2.5" :y="p.y - 2.5" width="5" height="5"
            :fill="p.color" stroke="#0b0d10" stroke-width="1"
          />
        </g>
      </g>

      <!-- now -->
      <line v-if="hasFuture" :x1="xNow" :x2="xNow" :y1="box.top - 2" :y2="box.top + box.height" class="pc-now" />
      <text v-if="hasFuture && (!mini || revealV > 0.62)" :x="xNow + 3" :y="box.top + G.font" class="pc-axis" :font-size="G.font - 1" :opacity="mini ? labelOp : 1">now</text>
      <line :x1="box.left" :x2="box.left + box.width" :y1="tip.y" :y2="tip.y" class="pc-current" />
      <g>
        <rect :x="liveTag.x" :y="liveTag.y" :width="liveTag.w" :height="liveTag.h" rx="2" class="pc-tag" :class="tagUp ? 'up' : 'down'" :fill-opacity="liveTag.opacity" />
        <text :x="liveTag.x + 3" :y="tip.y + G.font * 0.35" class="pc-tag-text" fill="#fff" :font-size="G.font">{{ liveTag.label }}</text>
      </g>
      <circle :cx="tip.x" :cy="tip.y" :r="mini ? 2.6 : 3.4" :fill="tipCandleUp ? up : down" stroke="#0b0d10" stroke-width="1" />

      <!-- price levels (alerts) -->
      <g v-for="l in levelMarks" :key="'l' + l.id">
        <line :x1="box.left" :x2="box.left + box.width" :y1="l.y" :y2="l.y" :stroke="l.fade ? `url(#${clipId}-lv-${l.gid})` : l.color" :stroke-dasharray="l.live ? '2 2' : '5 3'" :stroke-width="l.hot ? 2.4 : 1.6" :opacity="l.live ? 1 : bodyOp" />
        <rect :x="box.left + box.width + 1" :y="l.y - G.font * 0.75" :width="G.right - 2" :height="G.font * 1.5" rx="2" :fill="l.color" :opacity="l.live ? 1 : labelOp" />
        <text :x="box.left + box.width + 4" :y="l.y + G.font * 0.35" class="pc-tag-text" :fill="l.ink" :font-size="G.font" :opacity="l.live ? 1 : labelOp">{{ l.label }}</text>
      </g>

      <!-- live aim -->
      <g v-if="aimMark" class="pc-aim">
        <line :x1="aimMark.x" :x2="box.left + box.width" :y1="aimMark.y" :y2="aimMark.y" :stroke="aimMark.color" stroke-dasharray="2 2" />
        <line :x1="aimMark.x" :x2="aimMark.x" :y1="aimMark.y" :y2="box.top + box.height" :stroke="aimMark.color" stroke-dasharray="2 2" />
        <line :x1="aimMark.fromX" :y1="aimMark.fromY" :x2="aimMark.x" :y2="aimMark.y" :stroke="aimMark.color" stroke-width="2" />
        <circle :cx="aimMark.x" :cy="aimMark.y" r="11" :fill="aimMark.color" opacity="0.18" />
        <circle :cx="aimMark.x" :cy="aimMark.y" r="6" :fill="aimMark.color" stroke="#0b0d10" stroke-width="1.5" />
        <rect :x="box.left + box.width + 1" :y="aimMark.y - G.font * 0.8" :width="G.right - 2" :height="G.font * 1.6" rx="2" :fill="aimMark.color" />
        <text :x="box.left + box.width + 4" :y="aimMark.y + G.font * 0.35" class="pc-tag-text" :font-size="G.font">{{ aimMark.priceLabel }}</text>
        <rect :x="aimMark.dateX" :y="box.top + box.height + 2" :width="aimMark.dateW" :height="G.bottom - 3" rx="2" :fill="aimMark.color" />
        <text :x="aimMark.dateX + aimMark.dateW / 2" :y="box.top + box.height + G.bottom - 5" text-anchor="middle" class="pc-tag-text" :font-size="G.font - 1">{{ aimMark.dateLabel }}</text>
      </g>

      <!-- price at the pointer: closest point on the series -->
      <g v-if="probeMark" class="pc-hover" pointer-events="none">
        <line :x1="probeMark.x" :x2="probeMark.x" :y1="box.top" :y2="box.top + box.height" :stroke="probeMark.color" stroke-width="1" stroke-dasharray="2 3" opacity="0.85" />
        <circle :cx="probeMark.x" :cy="probeMark.y" :r="mini ? 3 : 4" :fill="probeMark.color" stroke="#fff" stroke-width="1.2" />
        <rect :x="probeMark.tx" :y="probeMark.ty" :width="probeMark.w" :height="G.font * 2.7" rx="3" :fill="probeMark.bg" :stroke="probeMark.color" stroke-width="0.8" />
        <text :x="probeMark.tx + 5" :y="probeMark.ty + G.font * 1.15" class="pc-axis" :fill="probeMark.color" :font-size="G.font">{{ probeMark.text }}</text>
        <text :x="probeMark.tx + 5" :y="probeMark.ty + G.font * 2.3" class="pc-axis" fill="rgba(255,255,255,.72)" :font-size="G.font - 1">{{ probeMark.sub }}</text>
      </g>

      <!-- mouse preview: crosshair at the cursor, line back to the live price -->
      <g v-if="hoverMark && !probeMark" class="pc-hover" pointer-events="none">
        <line :x1="hoverMark.x" :x2="hoverMark.x" :y1="box.top" :y2="box.top + box.height" :stroke="hoverMark.color" stroke-width="1" stroke-dasharray="2 3" opacity="0.85" />
        <line :x1="hoverMark.x" :x2="box.left + box.width" :y1="hoverMark.y" :y2="hoverMark.y" :stroke="hoverMark.color" stroke-width="1" stroke-dasharray="2 3" opacity="0.9" />
        <line :x1="tip.x" :y1="tip.y" :x2="hoverMark.x" :y2="hoverMark.y" :stroke="hoverMark.color" stroke-width="1.4" />
        <circle :cx="hoverMark.x" :cy="hoverMark.y" r="5" :fill="hoverMark.color" stroke="#0b0d10" stroke-width="1.2" />
        <rect :x="box.left + box.width + 1" :y="hoverMark.tagY - G.font * 0.8" :width="hoverMark.priceW" :height="G.font * 1.6" rx="2" :fill="hoverMark.bg" />
        <text :x="box.left + box.width + 5" :y="hoverMark.tagY + G.font * 0.35" class="pc-axis" :font-size="G.font">{{ hoverMark.priceLabel }}</text>
        <rect :x="hoverMark.tx" :y="hoverMark.ty" :width="hoverMark.w" :height="G.font * 1.6" rx="3" :fill="hoverMark.bg" :stroke="hoverMark.color" stroke-width="0.8" />
        <text :x="hoverMark.tx + 4" :y="hoverMark.ty + G.font * 1.15" class="pc-axis" :font-size="G.font">{{ hoverMark.text }}</text>
      </g>

      <g v-if="interactive && hasFuture" class="pc-edges" pointer-events="none">
        <rect :x="edgeBands.right.x" :y="edgeBands.right.y" :width="edgeBands.right.w" :height="edgeBands.right.h" :opacity="edgeHot === 'right' || edgeHot === 'top-right' || edgeHot === 'bottom-right' ? 0.16 : 0.045" />
        <rect :x="edgeBands.top.x" :y="edgeBands.top.y" :width="edgeBands.top.w" :height="edgeBands.top.h" :opacity="edgeHot === 'top' || edgeHot === 'top-right' ? 0.16 : 0.045" />
        <rect :x="edgeBands.bottom.x" :y="edgeBands.bottom.y" :width="edgeBands.bottom.w" :height="edgeBands.bottom.h" :opacity="edgeHot === 'bottom' || edgeHot === 'bottom-right' ? 0.16 : 0.045" />
      </g>

      <!-- time scale -->
      <line :x1="box.left" :x2="box.left + box.width" :y1="box.top + box.height" :y2="box.top + box.height" class="pc-baseline" />
      <text
        v-if="periodLabel"
        :x="box.left" :y="height - 1" text-anchor="start" class="pc-axis" :font-size="G.font"
      >{{ periodLabel }}</text>
      <g v-if="!aimMark || mini">
        <text
          v-for="t in tTicks" :key="'x' + t.x"
          :x="t.x" :y="height - (mini ? 2 : 4)" text-anchor="middle" class="pc-axis" :font-size="G.font"
        >{{ t.label }}</text>
      </g>
      <g v-else>
        <text
          v-for="t in tTicks.filter(t => Math.abs(t.x - aimMark!.x) > aimMark!.dateW / 2 + 22)" :key="'x' + t.x"
          :x="t.x" :y="height - 4" text-anchor="middle" class="pc-axis" :font-size="G.font"
        >{{ t.label }}</text>
      </g>

      <text v-if="!mini && realFrom" :x="box.left + 4" :y="box.top + G.font" class="pc-axis" :font-size="G.font - 1">simulated before {{ zonedTarget(realFrom, 999) }}</text>
      <text v-if="interactive && !aim && hasFuture" :x="xNow + (box.left + box.width - xNow) / 2" :y="box.top + box.height / 2" text-anchor="middle" class="pc-hint" :font-size="G.font">{{ hint }}</text>
    </svg>

    <div
      v-if="!levelMode"
      class="pc-scrub"
      :class="{ pressing }"
      :style="scrubPastStyle"
      @pointerdown="onScrubDown"
      @pointermove="onScrubMove"
      @pointerup="onScrubUp"
      @pointercancel="onScrubUp"
      @pointerleave="onScrubLeave"
      @click="onScrubClick"
    />
    <div
      v-if="showFutureScrub && !levelMode"
      class="pc-scrub pc-scrub-future"
      :style="scrubFutureStyle"
    />
    <div
      v-if="levelMode"
      class="pc-zone level"
      :style="plotStyle"
      :aria-label="`${label}: drag up or down to place a price alert`"
      @pointerdown="onLevelDown"
      @pointermove="onLevelMove"
      @pointerup="onLevelUp"
      @pointercancel="onLevelUp"
    />
    <div
      v-if="interactive && hasFuture"
      ref="zone"
      class="pc-zone"
      :class="{ rail: railHover }"
      :style="zoneStyle"
      tabindex="0"
      role="slider"
      :aria-label="`${label}: set your predicted price and date`"
      :aria-valuenow="aim?.price ?? current"
      :aria-valuetext="aim ? `${fmtAxisPrice(aim.price, kind)} on ${zonedTarget(aim.t, (t1 - now) / HOUR)}` : 'no prediction'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
      @click="onClick"
      @keydown="onKey"
    />
    <AxisEnds
      v-if="interactive && !mini && !levelMode"
      orientation="horizontal"
      start-label="Drag the start of the date range"
      end-label="Drag the end of the date range"
      :style="timeAxisStyle"
      @drag="(edge, x, y, phase) => onAxis('time', edge, x, y, phase)"
    />
    <AxisEnds
      v-if="interactive && !mini && !levelMode"
      orientation="vertical"
      start-label="Drag the low end of the price range"
      end-label="Drag the high end of the price range"
      :style="priceAxisStyle"
      @drag="(edge, x, y, phase) => onAxis('price', edge, x, y, phase)"
    />
  </div>
</template>

<style scoped>
.pc { position: relative; width: 100%; min-width: 0; user-select: none; -webkit-user-select: none; }
.pc-svg { display: block; overflow: visible; }
.pc-grid { stroke: rgba(255, 255, 255, 0.06); stroke-width: 1; }
.pc-baseline { stroke: rgba(255, 255, 255, 0.14); stroke-width: 1; }
.pc-axis {
  fill: rgba(255, 255, 255, 0.58);
  font-family: var(--font-market-data, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}
.pc-hover .pc-axis { fill: #fff; }
.pc-axis.strong { font-weight: 700; }
.pc-edges rect { fill: rgba(150, 190, 255, 0.9); }
.pc-future { fill: rgba(255, 255, 255, 0.025); }
.pc-future.active { fill: rgba(120, 170, 255, 0.07); }
.pc-range { fill: rgba(255, 255, 255, 0.035); }
.pc-range-edge { stroke-width: 1; stroke-dasharray: 4 3; stroke-opacity: 0.7; }
.pc-now { stroke: rgba(255, 255, 255, 0.35); stroke-width: 1; stroke-dasharray: 2 3; }
.pc-current { stroke: rgba(255, 255, 255, 0.2); stroke-width: 1; stroke-dasharray: 3 4; }
.pc-tag.up { fill: var(--app-color-up, #00ff88); }
.pc-tag.down { fill: var(--app-color-down, #ff4444); }
.pc-tag-text {
  font-weight: 700;
  font-family: var(--font-market-data, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}
.pc-hint { fill: rgba(170, 200, 255, 0.75); font-weight: 600; letter-spacing: 0.04em; pointer-events: none; }
.pc-scrub {
  position: absolute;
  cursor: crosshair;
  touch-action: pan-y;
  border-radius: 2px;
}
.pc-scrub.pressing { touch-action: none; }
.pc-scrub-future { pointer-events: none; }
.pc-zone {
  position: absolute;
  cursor: crosshair;
  touch-action: none;
  border-radius: 2px;
}
.pc-zone.level, .pc-zone.rail { cursor: ns-resize; }
.pc-zone:focus-visible { outline: 2px solid rgba(120, 170, 255, 0.8); outline-offset: 1px; }
.pc.dragging .pc-zone { cursor: grabbing; }
.pc-mine { filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.5)); }
</style>
