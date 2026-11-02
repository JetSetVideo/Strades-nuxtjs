<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NO_EQUITY_HISTORY, POINTS_FOR, areaPath, equityPath, equityStats, isPending, linePath, stackBands } from '~/utils/walletBook'
import { fmtDate, fmtMoney, fmtPctFromPercent, fmtShortDate, fmtTime } from '~/utils/format'
import { fmtMoneyKpi } from '~/utils/valueTree'

interface PerfPoint { change: number; change_percentage: number }

export interface CurveLayer {
  id: string
  label?: string
  color: string
  /** Share of the book at each sample. Same length as the equity path. */
  shares: number[]
  hidden?: boolean
}

const props = defineProps<{
  walletId: string
  totalValue: number
  performanceHistory: Record<string, PerfPoint> | undefined
  period: '1d' | '7d' | '30d' | '90d' | '1y'
  /** Bands under the total line. Empty draws the line alone. */
  layers?: CurveLayer[]
  /** Quiet label for what the bands are: Holdings or Wallets. */
  breakdown?: string
}>()

const wrap = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)
const W = ref(420)
const H = 172
const PAD_L = 6
const PAD_R = 48
const PAD_T = 8
const PAD_B = 20
let ro: ResizeObserver | null = null

const nowMs = ref<number | null>(null)

onMounted(() => {
  nowMs.value = Date.now()
  if (wrap.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      if (w > 0) W.value = w
    })
    ro.observe(wrap.value)
  }
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.clearTimeout(holdTimer)
})

interface CurvePoint { x: number; y: number; value: number; t: number }

const SPAN_MS: Record<string, number> = {
  '1d': 24 * 3600_000,
  '7d': 7 * 86400_000,
  '30d': 30 * 86400_000,
  '90d': 90 * 86400_000,
  '1y': 365 * 86400_000,
}

const series = computed<CurvePoint[]>(() => {
  const n = POINTS_FOR[props.period] ?? 30
  const totalChangePct = props.performanceHistory?.[props.period]?.change_percentage ?? 0
  const values = equityPath(`${props.walletId}::${props.period}`, n, props.totalValue, totalChangePct)
  const end = nowMs.value ?? Date.now()
  const span = SPAN_MS[props.period] ?? SPAN_MS['30d']
  return values.map((value, i) => ({
    x: 0,
    y: 0,
    value,
    t: end - span + (span * i) / Math.max(1, n - 1),
  }))
})

const minMax = computed(() => {
  if (!series.value.length) return { min: 0, max: 1 }
  const vals = series.value.map(p => p.value)
  return { min: Math.min(...vals), max: Math.max(...vals) }
})

const plotRight = computed(() => W.value - PAD_R)
const plotBottom = H - PAD_B

const projected = computed(() => {
  const innerW = plotRight.value - PAD_L
  const innerH = plotBottom - PAD_T
  const { min, max } = minMax.value
  const range = max - min || 1
  const step = innerW / Math.max(1, series.value.length - 1)
  return series.value.map((p, i) => ({
    ...p,
    x: PAD_L + i * step,
    y: PAD_T + innerH - ((p.value - min) / range) * innerH,
  }))
})

const pathD = computed(() => linePath(projected.value))

const bands = computed(() => {
  const layers = props.layers ?? []
  if (!layers.length || !projected.value.length) return []
  const sharesByPoint = projected.value.map((_, i) => layers.map(layer => layer.shares[i] ?? 0))
  return stackBands(
    projected.value,
    sharesByPoint,
    layers.map(layer => ({ id: layer.id, hidden: layer.hidden })),
    plotBottom,
  ).map((band, index) => {
    const layer = layers[index]
    return {
      ...band,
      label: layer?.label || layer?.id || band.id,
      color: layer?.color ?? '#fff',
      shares: layer?.shares ?? [],
      area: areaPath(band.points),
      edge: linePath(band.points.map(point => ({ x: point.x, y: point.top }))),
    }
  })
})

const visibleBands = computed(() => bands.value.filter(band => !band.hidden))
const showSoloFill = computed(() => !bands.value.length)

const areaD = computed(() => {
  if (!projected.value.length) return ''
  const head = `M ${projected.value[0].x.toFixed(2)} ${plotBottom}`
  const lines = projected.value.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const tail = `L ${projected.value[projected.value.length - 1].x.toFixed(2)} ${plotBottom} Z`
  return `${head} ${lines} ${tail}`
})

const minPoint = computed(() => projected.value.reduce((a, b) => (a.value < b.value ? a : b), projected.value[0]))
const maxPoint = computed(() => projected.value.reduce((a, b) => (a.value > b.value ? a : b), projected.value[0]))

function yOf(value: number) {
  const { min, max } = minMax.value
  const range = max - min || 1
  const innerH = plotBottom - PAD_T
  return PAD_T + innerH - ((value - min) / range) * innerH
}

const priceTicks = computed(() => {
  const { min, max } = minMax.value
  const mid = (min + max) / 2
  const ticks = [
    { value: max, y: yOf(max) },
    { value: mid, y: yOf(mid) },
    { value: min, y: yOf(min) },
  ]
  const kept = [ticks[0]]
  for (const tick of ticks.slice(1)) {
    if (kept.every(prev => Math.abs(prev.y - tick.y) > 14)) kept.push(tick)
  }
  return kept
})

const dateTicks = computed(() => {
  const pts = projected.value
  if (pts.length < 2 || nowMs.value == null) return []
  const mid = pts[Math.floor((pts.length - 1) / 2)]
  return [
    { t: pts[0].t, x: pts[0].x, anchor: 'start' as const },
    { t: mid.t, x: (pts[0].x + pts[pts.length - 1].x) / 2, anchor: 'middle' as const },
    { t: pts[pts.length - 1].t, x: pts[pts.length - 1].x, anchor: 'end' as const },
  ]
})

/**
 * Best / Worst / Max DD need a recorded daily equity series. `equityPath` is a straight
 * line (stored period start -> today), so these stay pending ('—') until one exists:
 * then pass that series and `true`.
 */
const stats = computed(() => equityStats(series.value.map(p => p.value), false)) // no recorded series yet
const pct = (v: number | { toFixed(): string }, sign = false) =>
  isPending(v) ? '—' : fmtPctFromPercent(v as number, { signed: sign })

const isPositive = computed(() => (props.performanceHistory?.[props.period]?.change_percentage ?? 0) >= 0)
const stroke = computed(() => isPositive.value ? 'var(--app-color-up, var(--success-green, #00ff88))' : 'var(--app-color-down, #ff4d6a)')
const fillFrom = computed(() => isPositive.value ? 'rgba(0,255,136,0.42)' : 'rgba(255,77,106,0.42)')

// Money: the readout uses fmtMoneyKpi (same as the KPI strip); axis ticks are compact whole dollars ("$950", "$12.3k").
const fmtAxis = (n: number) => fmtMoney(n, { compact: true, decimals: 0 })

// Dates via utils/format.ts: 1d → "15:41"; other periods → "Nov 2"; the hover readout on 1y adds the year.
function fmtWhen(ms: number, withTime = false) {
  if (props.period === '1d') return fmtTime(ms)
  if (props.period === '1y' && withTime) return fmtDate(ms)
  return fmtShortDate(ms)
}

const periodLabel = computed(() => ({
  '1d': 'Last 24h',
  '7d': 'Last week',
  '30d': 'Last 30d',
  '90d': 'Last 90d',
  '1y': 'Last year',
}[props.period]))

function gradId(id: string) {
  return `band-${props.walletId}-${props.period}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '')
}

// ── Read the line: mouse hover, finger stays down ──────────────────────────
const probe = ref<number | null>(null)
const pressing = ref(false)
let holdTimer = 0
let origin = { x: 0, y: 0 }

function pickIndex(clientX: number) {
  const el = svgEl.value
  const pts = projected.value
  if (!el || !pts.length) return null
  const rect = el.getBoundingClientRect()
  if (!rect.width) return null
  const x = ((clientX - rect.left) / rect.width) * W.value
  if (x < PAD_L - 12 || x > plotRight.value + 12) return null
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(pts[i].x - x)
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}

function onDown(e: PointerEvent) {
  if (e.button > 0) return
  origin = { x: e.clientX, y: e.clientY }
  if (e.pointerType === 'mouse') {
    probe.value = pickIndex(e.clientX)
    return
  }
  window.clearTimeout(holdTimer)
  holdTimer = window.setTimeout(() => {
    pressing.value = true
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* released */ }
    probe.value = pickIndex(origin.x)
  }, 160)
}

function onMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') {
    probe.value = pickIndex(e.clientX)
    return
  }
  const dx = Math.abs(e.clientX - origin.x)
  const dy = Math.abs(e.clientY - origin.y)
  if (!pressing.value) {
    if (dx > 8 || dy > 8) window.clearTimeout(holdTimer)
    return
  }
  probe.value = pickIndex(e.clientX)
}

function onUp(e: PointerEvent) {
  window.clearTimeout(holdTimer)
  if (e.pointerType === 'mouse') return
  pressing.value = false
  probe.value = null
}

function onLeave() {
  if (pressing.value) return
  probe.value = null
}

interface ReadLine { text: string; color: string }

const readout = computed(() => {
  const i = probe.value
  const point = i == null ? null : projected.value[i]
  if (i == null || !point) return null
  const lines: ReadLine[] = [
    { text: fmtWhen(point.t, true), color: 'rgba(255,255,255,0.55)' },
    { text: fmtMoneyKpi(point.value), color: '#fff' },
  ]
  const sleeves = visibleBands.value.slice().reverse()
  for (const band of sleeves) {
    const share = band.shares[i] ?? 0
    if (share <= 0.004) continue
    const name = band.label.length > 16 ? `${band.label.slice(0, 15)}…` : band.label
    lines.push({ text: `${name}  ${fmtMoneyKpi(share * point.value)}`, color: band.color })
  }
  const w = Math.min(plotRight.value - PAD_L, Math.max(...lines.map(line => line.text.length)) * 6.15 + 16)
  const h = 8 + lines.length * 13
  let tx = point.x + 10
  if (tx + w > plotRight.value) tx = point.x - 10 - w
  if (tx < PAD_L) tx = PAD_L
  let ty = point.y - h - 8
  if (ty < PAD_T) ty = Math.min(point.y + 10, plotBottom - h)
  if (ty + h > plotBottom) ty = Math.max(PAD_T, plotBottom - h)
  return { x: point.x, y: point.y, tx, ty, w, h, lines }
})
</script>

<template>
  <div class="equity-curve" ref="wrap">
    <header class="head">
      <span class="title">
        Equity · {{ periodLabel }}
        <em v-if="breakdown">{{ breakdown }}</em>
      </span>
      <div class="head-stats">
        <span class="stat" title="Highest single-step gain">
          <em>Best</em>
          <strong :class="isPending(stats.best) ? '' : 'pos'">{{ pct(stats.best, true) }}</strong>
        </span>
        <span class="stat" title="Lowest single-step loss">
          <em>Worst</em>
          <strong :class="isPending(stats.worst) ? '' : 'neg'">{{ pct(stats.worst) }}</strong>
        </span>
        <span class="stat" title="Max peak-to-trough drawdown over the period">
          <em>Max DD</em>
          <strong>{{ pct(stats.maxDrawdown) }}</strong>
          <UISourceChip v-if="isPending(stats.maxDrawdown)" source="pending" :note="NO_EQUITY_HISTORY" />
        </span>
      </div>
    </header>

    <svg
      ref="svgEl"
      :viewBox="`0 0 ${W} ${H}`"
      :width="W"
      :height="H"
      preserveAspectRatio="none"
      class="curve-svg"
      :class="{ pressing }"
      role="img"
      aria-label="Equity, with dates and prices. Hover or press a point to read it."
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onLeave"
    >
      <defs>
        <linearGradient :id="`grad-${walletId}-${period}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="fillFrom" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </linearGradient>
        <linearGradient
          v-for="band in visibleBands"
          :id="gradId(band.id)"
          :key="band.id"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" :stop-color="band.color" stop-opacity="0.78" />
          <stop offset="58%" :stop-color="band.color" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="band.color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <line :x1="PAD_L" :y1="H * 0.33" :x2="plotRight" :y2="H * 0.33" stroke="rgba(255,255,255,0.04)" />
      <line :x1="PAD_L" :y1="H * 0.62" :x2="plotRight" :y2="H * 0.62" stroke="rgba(255,255,255,0.04)" />

      <path v-if="showSoloFill" :d="areaD" :fill="`url(#grad-${walletId}-${period})`" />

      <g v-for="band in visibleBands" :key="band.id">
        <path :d="band.area" :fill="`url(#${gradId(band.id)})`" />
        <path
          :d="band.edge"
          :stroke="band.color"
          stroke-width="1.35"
          fill="none"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </g>

      <path :d="pathD" :stroke="stroke" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />

      <g v-if="projected.length && !readout" pointer-events="none">
        <circle :cx="maxPoint.x" :cy="maxPoint.y" r="3" fill="var(--app-color-up, var(--success-green, #00ff88))" />
        <circle :cx="minPoint.x" :cy="minPoint.y" r="3" fill="var(--app-color-down, #ff4d6a)" />
      </g>

      <g class="axis" pointer-events="none">
        <text
          v-for="tick in priceTicks"
          :key="`p-${tick.value}`"
          :x="plotRight + 6"
          :y="tick.y"
          dominant-baseline="middle"
          class="axis-price"
        >{{ fmtAxis(tick.value) }}</text>
        <text
          v-for="(tick, index) in dateTicks"
          :key="`d-${index}`"
          :x="tick.x"
          :y="H - 4"
          :text-anchor="tick.anchor"
          class="axis-date"
        >{{ fmtWhen(tick.t) }}</text>
      </g>

      <g v-if="readout" class="readout" pointer-events="none">
        <line
          :x1="readout.x"
          :x2="readout.x"
          :y1="PAD_T"
          :y2="plotBottom"
          stroke="rgba(255,255,255,0.45)"
          stroke-dasharray="2 3"
        />
        <circle :cx="readout.x" :cy="readout.y" r="3.5" fill="#fff" :stroke="stroke" stroke-width="1.4" />
        <rect
          :x="readout.tx"
          :y="readout.ty"
          :width="readout.w"
          :height="readout.h"
          rx="4"
          fill="rgba(10,12,16,0.94)"
          stroke="rgba(255,255,255,0.16)"
        />
        <text
          v-for="(line, index) in readout.lines"
          :key="index"
          :x="readout.tx + 8"
          :y="readout.ty + 14 + index * 13"
          :fill="line.color"
          class="read-line"
        >{{ line.text }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.equity-curve {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem 1.25rem;
  min-width: 0;
  flex-wrap: wrap;
}
.title {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
  white-space: nowrap;
}
.title em {
  font-style: normal;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.38);
  font-weight: 600;
}
.head-stats {
  display: flex;
  align-items: baseline;
  gap: 1.15rem;
  margin-left: auto;
  flex-wrap: wrap;
}
.stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  white-space: nowrap;
  line-height: 1;
}
.stat em {
  font-style: normal;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  font-weight: 700;
}
.stat strong {
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.9);
}
.stat strong.pos { color: var(--app-color-up, var(--success-green, #00ff88)); }
.stat strong.neg { color: var(--app-color-down, #ff4d6a); }

.curve-svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: pan-y;
  cursor: crosshair;
}
.curve-svg.pressing { touch-action: none; }

.axis-price,
.axis-date,
.read-line {
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 600;
}
.axis-price {
  font-size: 9px;
  fill: rgba(255,255,255,0.48);
}
.axis-date {
  font-size: 9px;
  fill: rgba(255,255,255,0.42);
}
.read-line {
  font-size: 10px;
  font-weight: 700;
}

@media (max-width: 540px) {
  .head-stats { gap: 0.75rem; }
  .stat { gap: 0.28rem; }
  .stat strong { font-size: 0.74rem; }
}
</style>
