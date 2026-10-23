<script setup lang="ts">
/**
 * PredictChart — one price chart for every asset surface.
 *
 * Time runs left → right with a time scale at the bottom; prices sit on a
 * scale on the right. The right-hand zone after "now" is the future: a
 * prediction is a point there — its x is the target date, its y the price.
 * Everything (candles, line, the user's calls, friends' calls, paper trades,
 * the live aim) goes through the same `makeScales`, so a dot is always drawn
 * where it was placed.
 *
 * size="mini"  — the price-list card: compact axes, not interactive.
 * size="large" — expanded card / detail page: tap or drag in the future zone.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Prediction } from '~/stores/predictions'
import {
  HOUR, makeScales, priceDomain, niceTicks, timeTicks, fmtAxisPrice, fmtTarget, clamp,
  snapTarget, type Candle, type PriceKind,
} from '~/utils/assetChart'
import { friendProfile, targetTsOf } from '~/composables/useFriendPredictions'

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
  aim?: { t: number; price: number } | null
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
  /** horizontal price levels (e.g. armed alerts) */
  levels?: { id: string; price: number; color: string; label: string }[]
  /** drag vertically anywhere on the plot to pick a level (alerts) instead of a prediction */
  levelMode?: boolean
  /** view-transition-name, so the card's mini chart can morph into this one */
  morphName?: string
}>(), {
  kind: 'money', chartStyle: 'line', size: 'mini', height: 64, range: null, aim: null,
  mine: () => [], friends: () => [], trades: () => [], interactive: false, realFrom: null,
  snapHours: 1, minLeadHours: 1, label: 'Price chart', trendPct: null, levels: () => [], levelMode: false,
})

const emit = defineEmits<{
  aim: [t: number, price: number]
  commit: [t: number, price: number]
  level: [price: number]
  levelCommit: [price: number]
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
const G = computed(() => mini.value
  ? { left: 1, right: 40, top: 5, bottom: 13, font: 9.5 }
  : { left: 4, right: 54, top: 10, bottom: 18, font: 10 })

const box = computed(() => ({
  left: G.value.left,
  top: G.value.top,
  width: Math.max(10, width.value - G.value.left - G.value.right),
  height: Math.max(10, props.height - G.value.top - G.value.bottom),
}))

// ── Domain & scales ─────────────────────────────────────────────────────────
const domain = computed(() => {
  const vals: number[] = [props.current]
  for (const c of props.candles) {
    if (props.chartStyle === 'candle') vals.push(c.h, c.l)
    else vals.push(c.c, c.o)
  }
  if (props.range) vals.push(props.range.min, props.range.max)
  for (const p of props.mine) if (targetTsOf(p) <= props.t1) vals.push(p.predictedPrice)
  for (const p of props.friends) if (targetTsOf(p) <= props.t1) vals.push(p.predictedPrice)
  for (const tr of props.trades) if (tr.t >= props.t0) vals.push(tr.price)
  for (const l of props.levels) vals.push(l.price)
  return priceDomain(vals, props.kind, mini.value ? 0.1 : 0.06)
})

const S = computed(() => makeScales(props.t0, props.t1, domain.value[0], domain.value[1], box.value))

const step = computed(() => {
  const c = props.candles
  return c.length > 1 ? c[1]!.t - c[0]!.t : HOUR
})

const up = 'var(--app-color-up, var(--success-green, #00ff88))'
const down = 'var(--app-color-down, var(--error-red, #ff4444))'
const xNow = computed(() => S.value.x(props.now))
const yNow = computed(() => S.value.y(props.current))
const hasFuture = computed(() => props.t1 > props.now + 1000)
/**
 * The live price, rounded once. The series, the white dot and every prediction
 * line share this point so the line into the future leaves the dot exactly.
 */
const tip = computed(() => {
  const x = Math.min(xNow.value, box.value.left + box.value.width)
  return { x: Math.round(x * 10) / 10, y: Math.round(yNow.value * 10) / 10 }
})
const tagUp = computed(() => {
  if (props.trendPct !== null && props.trendPct !== undefined && Number.isFinite(props.trendPct)) return props.trendPct >= 0
  const first = props.candles[0]
  return !first || props.current >= first.o
})

// ── Series ──────────────────────────────────────────────────────────────────
const linePts = computed(() => {
  const s = S.value
  const c = props.candles
  if (!c.length) return { real: '', sim: '', area: '' }
  const pts: { x: number; y: number; sim: boolean }[] = [{ x: s.x(c[0]!.t), y: s.y(c[0]!.o), sim: !!c[0]!.sim }]
  for (const k of c) {
    const tEnd = Math.min(props.now, k.t + step.value)
    pts.push({ x: s.x(tEnd), y: s.y(k.c), sim: !!k.sim })
  }
  const tp = tip.value
  const end = pts[pts.length - 1]
  if (!end || Math.abs(end.x - tp.x) > 0.2 || Math.abs(end.y - tp.y) > 0.2) {
    pts.push({ x: tp.x, y: tp.y, sim: false })
  }
  const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  // The line is green where the price rises and red where it falls (screen y
  // grows downwards, so a smaller y is a higher price). Consecutive segments
  // going the same way are joined into one run.
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
  return { runs, area }
})

const mixed = computed(() => props.candles.some(c => c.sim) && props.candles.some(c => !c.sim))

const candleShapes = computed(() => {
  const s = S.value
  const w = Math.max(1.2, Math.min(14, (s.x(props.t0 + step.value) - s.x(props.t0)) * 0.68))
  return props.candles.map((k) => {
    const cx = s.x(Math.min(props.now, k.t + step.value / 2))
    const yo = s.y(k.o)
    const yc = s.y(k.c)
    return {
      cx, w, yh: s.y(k.h), yl: s.y(k.l),
      y: Math.min(yo, yc), h: Math.max(1, Math.abs(yc - yo)),
      color: k.c >= k.o ? up : down, sim: !!k.sim && mixed.value,
    }
  })
})

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

const tagYs = computed(() => {
  const ys: number[] = []
  if (props.range && hasFuture.value) ys.push(S.value.y(props.range.max), S.value.y(props.range.min))
  if (props.aim) ys.push(S.value.y(props.aim.price))
  for (const l of props.levels) ys.push(S.value.y(l.price))
  return ys
})

const tTicks = computed(() => {
  const raw = timeTicks(props.t0, props.t1, mini.value ? 3 : Math.max(3, Math.min(6, Math.floor(box.value.width / 80))))
  const out: { x: number; label: string }[] = []
  for (const t of raw) {
    const x = S.value.x(t.t)
    const half = t.label.length * G.value.font * 0.3
    if (x - half < box.value.left || x + half > box.value.left + box.value.width + G.value.right - 4) continue
    if (out.length && x - out[out.length - 1]!.x < half * 2 + 8) continue
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

function segment(p: Prediction) {
  const s = S.value
  const tT = targetTsOf(p)
  if (tT > props.t1 + 1 || tT < props.now) return null
  // The ray leaves the live price (the white dot) and ends on the call.
  return {
    id: p.id,
    x1: tip.value.x, y1: tip.value.y,
    x2: s.x(tT), y2: s.y(p.predictedPrice),
    color: dirColor(p),
  }
}

const mineSegs = computed(() => props.mine.map(segment).filter(Boolean) as NonNullable<ReturnType<typeof segment>>[])
const friendSegs = computed(() => props.friends.map((p) => {
  const seg = segment(p)
  return seg ? { ...seg, avatar: friendProfile(p.userId).avatar, name: friendProfile(p.userId).name } : null
}).filter(Boolean) as (NonNullable<ReturnType<typeof segment>> & { avatar: string; name: string })[])

const tradeMarks = computed(() => props.trades
  .filter(t => t.t >= props.t0 && t.t <= props.now)
  .map(t => ({ x: S.value.x(t.t), y: S.value.y(t.price), side: t.side })))

const rangeBand = computed(() => {
  if (!props.range || !hasFuture.value) return null
  const s = S.value
  return {
    x: xNow.value, w: s.box.left + s.box.width - xNow.value,
    yMax: s.y(props.range.max), yMin: s.y(props.range.min),
    labelMax: fmtAxisPrice(props.range.max, props.kind), labelMin: fmtAxisPrice(props.range.min, props.kind),
  }
})

const aimMark = computed(() => {
  if (!props.aim) return null
  const s = S.value
  const x = s.x(props.aim.t)
  const y = s.y(props.aim.price)
  const color = props.aim.price >= props.current ? up : down
  const dateLabel = fmtTarget(props.aim.t, (props.t1 - props.now) / HOUR)
  const dateW = dateLabel.length * G.value.font * 0.58 + 10
  return {
    x, y, color,
    priceLabel: fmtAxisPrice(props.aim.price, props.kind),
    dateLabel, dateW,
    dateX: clamp(x - dateW / 2, box.value.left, box.value.left + box.value.width - dateW),
  }
})

// ── Pointer: tap / drag in the future zone ──────────────────────────────────
const zone = ref<HTMLElement | null>(null)
const dragging = ref(false)
let last: { t: number; price: number } | null = null

function pick(clientX: number, clientY: number) {
  const el = root.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const s = S.value
  const snap = Math.max(0.25, props.snapHours) * HOUR
  let t = s.tAt(clientX - r.left)
  t = clamp(t, props.now + props.minLeadHours * HOUR, props.t1)
  t = Math.min(props.t1, Math.max(props.now + props.minLeadHours * HOUR, Math.round(t / snap) * snap))
  // magnets: exactly 1 day / 1 week / … from now, and the right edge (12 px each)
  const tol = (10 / Math.max(1, s.box.width)) * (props.t1 - props.t0)
  t = snapTarget(t, props.now, props.t1, tol).t
  let price = s.pAt(clientY - r.top)
  const lo = props.range ? props.range.min : domain.value[0]
  const hi = props.range ? props.range.max : domain.value[1]
  price = clamp(price, lo, hi)
  return { t, price }
}

function onDown(e: PointerEvent) {
  if (!props.interactive || e.button > 0) return
  e.preventDefault()
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* released */ }
  dragging.value = true
  last = pick(e.clientX, e.clientY)
  if (last) emit('aim', last.t, last.price)
}
const hover = ref<{ t: number; price: number } | null>(null)
const canHover = ref(false)
onMounted(() => { canHover.value = !!window.matchMedia?.('(hover: hover)').matches })

function onMove(e: PointerEvent) {
  if (!dragging.value) {
    // mouse: preview where a click would land
    hover.value = e.pointerType === 'mouse' ? pick(e.clientX, e.clientY) : null
    return
  }
  hover.value = null
  last = pick(e.clientX, e.clientY)
  if (last) emit('aim', last.t, last.price)
}
function onLeave() { hover.value = null }
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  if (last) emit('commit', last.t, last.price)
}

function onKey(e: KeyboardEvent) {
  if (!props.interactive) return
  const lo = props.range ? props.range.min : domain.value[0]
  const hi = props.range ? props.range.max : domain.value[1]
  const cur = props.aim ?? { t: props.now + (props.t1 - props.now) / 2, price: props.current }
  const dp = (hi - lo) / 50
  const dt = Math.max(props.snapHours, (props.t1 - props.now) / HOUR / 24) * HOUR
  let next = { ...cur }
  if (e.key === 'ArrowUp') next.price = clamp(cur.price + dp, lo, hi)
  else if (e.key === 'ArrowDown') next.price = clamp(cur.price - dp, lo, hi)
  else if (e.key === 'ArrowRight') next.t = clamp(cur.t + dt, props.now + props.minLeadHours * HOUR, props.t1)
  else if (e.key === 'ArrowLeft') next.t = clamp(cur.t - dt, props.now + props.minLeadHours * HOUR, props.t1)
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
const levelMarks = computed(() => [
  ...props.levels.map(l => ({ ...l, y: S.value.y(l.price), live: false })),
  ...(dragLevel.value !== null ? [{ id: 'drag', price: dragLevel.value, color: 'rgba(120,170,255,.95)', label: fmtAxisPrice(dragLevel.value, props.kind), y: S.value.y(dragLevel.value), live: true }] : []),
])
const plotStyle = computed(() => ({
  left: `${box.value.left}px`, top: `${box.value.top}px`, width: `${box.value.width}px`, height: `${box.value.height}px`,
}))

// ── Read the series: mouse hover, finger stays down ─────────────────────────
const samples = computed(() => {
  const out: { t: number; price: number }[] = []
  for (const k of props.candles) out.push({ t: Math.min(props.now, k.t + step.value), price: k.c })
  out.push({ t: props.now, price: props.current })
  return out
})

const probe = ref<{ t: number; price: number } | null>(null)
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
  const s = S.value
  let best = samples.value[0]!
  let bestD = Infinity
  for (const p of samples.value) {
    const d = Math.abs(s.x(p.t) - x)
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
  const rising = p.price >= props.current
  const when = new Date(p.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  const text = `${fmtAxisPrice(p.price, props.kind)} · ${when}`
  const sub = `now ${fmtAxisPrice(props.current, props.kind)}`
  const w = Math.max(text.length, sub.length) * G.value.font * 0.56 + 10
  const left = x + 8 + w > box.value.left + box.value.width
  const tx = left ? x - 8 - w : x + 8
  const ty = clamp(y - G.value.font * 2.2, box.value.top, box.value.top + box.value.height - G.value.font * 3.2)
  return { x, y, text, sub, w, tx, ty, color: rising ? up : down }
})

const scrubStyle = computed(() => {
  const pastOnly = props.interactive && hasFuture.value
  const w = pastOnly ? Math.max(0, xNow.value - box.value.left) : box.value.width
  return {
    left: `${box.value.left}px`,
    top: `${box.value.top}px`,
    width: `${Math.max(0, w)}px`,
    height: `${box.value.height}px`,
  }
})

const hoverMark = computed(() => {
  if (!hover.value) return null
  const s = S.value
  const x = s.x(hover.value.t)
  const y = s.y(hover.value.price)
  const pct = props.current ? (hover.value.price / props.current - 1) * 100 : 0
  const text = `${fmtAxisPrice(hover.value.price, props.kind)} ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% · ${fmtTarget(hover.value.t, (props.t1 - props.now) / HOUR)}`
  const w = text.length * G.value.font * 0.56 + 8
  const left = x + 10 + w > box.value.left + box.value.width
  return { x, y, text, w, tx: left ? x - 10 - w : x + 10, ty: clamp(y - G.value.font, box.value.top, box.value.top + box.value.height - G.value.font * 1.6), color: pct >= 0 ? up : down }
})

// The zone runs over the price scale too: anything right of the plot is the
// last instant of the window, so "exactly one horizon ahead" is easy to hit.
const zoneStyle = computed(() => ({
  left: `${xNow.value}px`,
  top: `${box.value.top}px`,
  width: `${Math.max(0, width.value - xNow.value)}px`,
  height: `${box.value.height}px`,
}))
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

      <!-- price grid + right-hand scale -->
      <g v-for="t in priceTicks" :key="'p' + t.v">
        <line :x1="box.left" :x2="box.left + box.width" :y1="t.y" :y2="t.y" class="pc-grid" />
        <text :x="box.left + box.width + 4" :y="t.y + G.font * 0.35" class="pc-axis" :font-size="G.font">{{ t.label }}</text>
      </g>

      <!-- potential range from past moves -->
      <g v-if="rangeBand">
        <rect :x="rangeBand.x" :y="rangeBand.yMax" :width="rangeBand.w" :height="Math.max(0, rangeBand.yMin - rangeBand.yMax)" class="pc-range" />
        <line :x1="rangeBand.x" :x2="box.left + box.width" :y1="rangeBand.yMax" :y2="rangeBand.yMax" class="pc-range-edge" :stroke="up" />
        <line :x1="rangeBand.x" :x2="box.left + box.width" :y1="rangeBand.yMin" :y2="rangeBand.yMin" class="pc-range-edge" :stroke="down" />
        <text :x="box.left + box.width + 4" :y="rangeBand.yMax + G.font * 0.35" class="pc-axis strong" :fill="up" :font-size="G.font">{{ rangeBand.labelMax }}</text>
        <text :x="box.left + box.width + 4" :y="rangeBand.yMin + G.font * 0.35" class="pc-axis strong" :fill="down" :font-size="G.font">{{ rangeBand.labelMin }}</text>
      </g>

      <g :clip-path="`url(#${clipId})`">
        <!-- series -->
        <template v-if="chartStyle === 'candle'">
          <g v-for="(c, i) in candleShapes" :key="'c' + i" :opacity="c.sim ? 0.45 : 1">
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

        <!-- paper trades -->
        <g v-for="(m, i) in tradeMarks" :key="'t' + i">
          <circle v-if="m.side === 'buy'" :cx="m.x" :cy="m.y" :r="mini ? 2.6 : 3.5" :fill="up" stroke="#0b0d10" stroke-width="1" />
          <rect v-else :x="m.x - (mini ? 2.4 : 3.2)" :y="m.y - (mini ? 2.4 : 3.2)" :width="mini ? 4.8 : 6.4" :height="mini ? 4.8 : 6.4" :fill="down" stroke="#0b0d10" stroke-width="1" />
        </g>

        <!-- friends' calls (only passed in once revealed) -->
        <g v-for="(f, i) in friendSegs" :key="f.id" class="pc-friend">
          <line :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2" :stroke="f.color" stroke-width="1" stroke-dasharray="2 3" stroke-opacity="0.75" />
          <template v-if="mini">
            <circle :cx="f.x2" :cy="f.y2" r="2.6" fill="#0b0d10" :stroke="f.color" stroke-width="1.3" />
          </template>
          <template v-else>
            <circle :cx="f.x2" :cy="f.y2" r="10" :fill="f.color" />
            <image :href="f.avatar" :x="f.x2 - 8.5" :y="f.y2 - 8.5" width="17" height="17" :clip-path="`url(#${clipId}-f${i})`" preserveAspectRatio="xMidYMid slice"><title>{{ f.name }}</title></image>
          </template>
        </g>

        <!-- my calls -->
        <g v-for="m in mineSegs" :key="m.id">
          <line :x1="m.x1" :y1="m.y1" :x2="m.x2" :y2="m.y2" :stroke="m.color" :stroke-width="mini ? 1.2 : 1.6" stroke-dasharray="4 3" />
          <circle :cx="m.x2" :cy="m.y2" :r="mini ? 3.2 : 5" :fill="m.color" stroke="#0b0d10" stroke-width="1.4" class="pc-mine" />
        </g>
      </g>

      <!-- now -->
      <line v-if="hasFuture" :x1="xNow" :x2="xNow" :y1="box.top - 2" :y2="box.top + box.height" class="pc-now" />
      <text v-if="hasFuture && !mini" :x="xNow + 3" :y="box.top + G.font" class="pc-axis" :font-size="G.font - 1">now</text>
      <line :x1="box.left" :x2="box.left + box.width" :y1="tip.y" :y2="tip.y" class="pc-current" />
      <g>
        <rect :x="box.left + box.width + 1" :y="tip.y - G.font * 0.75" :width="G.right - 2" :height="G.font * 1.5" rx="2" class="pc-tag" :class="tagUp ? 'up' : 'down'" />
        <text :x="box.left + box.width + 4" :y="tip.y + G.font * 0.35" class="pc-tag-text" :fill="tagUp ? '#04140c' : '#fff'" :font-size="G.font">{{ fmtAxisPrice(current, kind) }}</text>
      </g>
      <circle :cx="tip.x" :cy="tip.y" :r="mini ? 2.4 : 3.2" fill="#fff" />

      <!-- price levels (alerts) -->
      <g v-for="l in levelMarks" :key="'l' + l.id">
        <line :x1="box.left" :x2="box.left + box.width" :y1="l.y" :y2="l.y" :stroke="l.color" :stroke-dasharray="l.live ? '2 2' : '5 3'" stroke-width="1.2" />
        <rect :x="box.left + box.width + 1" :y="l.y - G.font * 0.75" :width="G.right - 2" :height="G.font * 1.5" rx="2" :fill="l.color" />
        <text :x="box.left + box.width + 4" :y="l.y + G.font * 0.35" class="pc-tag-text" :font-size="G.font">{{ l.label }}</text>
      </g>

      <!-- live aim -->
      <g v-if="aimMark" class="pc-aim">
        <line :x1="aimMark.x" :x2="box.left + box.width" :y1="aimMark.y" :y2="aimMark.y" :stroke="aimMark.color" stroke-dasharray="2 2" />
        <line :x1="aimMark.x" :x2="aimMark.x" :y1="aimMark.y" :y2="box.top + box.height" :stroke="aimMark.color" stroke-dasharray="2 2" />
        <line :x1="tip.x" :y1="tip.y" :x2="aimMark.x" :y2="aimMark.y" :stroke="aimMark.color" stroke-width="2" />
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
        <rect :x="probeMark.tx" :y="probeMark.ty" :width="probeMark.w" :height="G.font * 2.7" rx="3" fill="rgba(11,13,16,.94)" :stroke="probeMark.color" stroke-width="0.8" />
        <text :x="probeMark.tx + 5" :y="probeMark.ty + G.font * 1.15" class="pc-axis" :fill="probeMark.color" :font-size="G.font">{{ probeMark.text }}</text>
        <text :x="probeMark.tx + 5" :y="probeMark.ty + G.font * 2.3" class="pc-axis" fill="rgba(255,255,255,.72)" :font-size="G.font - 1">{{ probeMark.sub }}</text>
      </g>

      <!-- mouse preview -->
      <g v-if="hoverMark && !probeMark" class="pc-hover" pointer-events="none">
        <line :x1="xNow" :y1="yNow" :x2="hoverMark.x" :y2="hoverMark.y" :stroke="hoverMark.color" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.7" />
        <circle :cx="hoverMark.x" :cy="hoverMark.y" r="5" fill="none" :stroke="hoverMark.color" stroke-width="1.5" />
        <rect :x="hoverMark.tx" :y="hoverMark.ty" :width="hoverMark.w" :height="G.font * 1.6" rx="3" fill="rgba(11,13,16,.9)" :stroke="hoverMark.color" stroke-width="0.8" />
        <text :x="hoverMark.tx + 4" :y="hoverMark.ty + G.font * 1.15" class="pc-axis" :fill="hoverMark.color" :font-size="G.font">{{ hoverMark.text }}</text>
      </g>

      <!-- time scale -->
      <line :x1="box.left" :x2="box.left + box.width" :y1="box.top + box.height" :y2="box.top + box.height" class="pc-baseline" />
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

      <text v-if="!mini && realFrom" :x="box.left + 4" :y="box.top + G.font" class="pc-axis" :font-size="G.font - 1">simulated before {{ fmtTarget(realFrom, 999) }}</text>
      <text v-if="interactive && !aim && hasFuture" :x="xNow + (box.left + box.width - xNow) / 2" :y="box.top + box.height / 2" text-anchor="middle" class="pc-hint" :font-size="G.font">{{ canHover ? 'click to predict' : 'tap to predict' }}</text>
    </svg>

    <div
      v-if="!levelMode"
      class="pc-scrub"
      :class="{ pressing }"
      :style="scrubStyle"
      @pointerdown="onScrubDown"
      @pointermove="onScrubMove"
      @pointerup="onScrubUp"
      @pointercancel="onScrubUp"
      @pointerleave="onScrubLeave"
      @click="onScrubClick"
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
      :style="zoneStyle"
      tabindex="0"
      role="slider"
      :aria-label="`${label}: set your predicted price and date`"
      :aria-valuenow="aim?.price ?? current"
      :aria-valuetext="aim ? `${fmtAxisPrice(aim.price, kind)} on ${fmtTarget(aim.t, (t1 - now) / HOUR)}` : 'no prediction'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
      @keydown="onKey"
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
.pc-axis.strong { font-weight: 700; }
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
.pc-zone {
  position: absolute;
  cursor: crosshair;
  touch-action: none;
  border-radius: 2px;
}
.pc-zone.level { cursor: ns-resize; }
.pc-zone:focus-visible { outline: 2px solid rgba(120, 170, 255, 0.8); outline-offset: 1px; }
.pc.dragging .pc-zone { cursor: grabbing; }
.pc-mine { filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.5)); }
</style>
