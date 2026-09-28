<template>
  <div class="price-chart">
    <div class="chart-toolbar">
      <div class="seg-group" role="group" aria-label="Period">
        <button
          v-for="p in PERIODS"
          :key="p.key"
          :class="{ active: period === p.key }"
          @click="period = p.key"
        >{{ p.label }}</button>
      </div>
      <div class="seg-group" role="group" aria-label="Chart type">
        <button :class="{ active: chartType === 'line' }" @click="chartType = 'line'">Line</button>
        <button :class="{ active: chartType === 'candle' }" @click="chartType = 'candle'">Candles</button>
      </div>
    </div>

    <div class="chart-hint">Drag anywhere on the chart to place a price alert — release to arm it.</div>

    <svg
      ref="svgEl"
      class="chart-svg"
      :viewBox="`0 0 ${VB_W} ${VB_H}`"
      preserveAspectRatio="none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <!-- Y-axis gridlines + price labels -->
      <g v-for="g in gridLines" :key="g.y">
        <line :x1="PAD_L" :x2="VB_W" :y1="g.y" :y2="g.y" class="grid-line" />
        <text :x="PAD_L - 6" :y="g.y + 3" class="grid-label" text-anchor="end">{{ formatPrice(g.price) }}</text>
      </g>

      <!-- Candles -->
      <template v-if="chartType === 'candle'">
        <g v-for="(c, idx) in series" :key="idx">
          <line
            :x1="xFor(idx)" :x2="xFor(idx)"
            :y1="yFor(c.high)" :y2="yFor(c.low)"
            :stroke="c.close >= c.open ? upColor : downColor"
            stroke-width="1"
          />
          <rect
            :x="xFor(idx) - candleW / 2"
            :y="Math.min(yFor(c.open), yFor(c.close))"
            :width="candleW"
            :height="Math.max(1, Math.abs(yFor(c.open) - yFor(c.close)))"
            :fill="c.close >= c.open ? upColor : downColor"
          />
        </g>
      </template>

      <!-- Line -->
      <template v-else>
        <polyline :points="linePoints" fill="none" :stroke="lineColor" stroke-width="2" />
      </template>

      <!-- Current price marker -->
      <line :x1="PAD_L" :x2="VB_W" :y1="yFor(currentPrice)" :y2="yFor(currentPrice)" class="current-line" />

      <!-- Armed triggers (persisted price alerts) -->
      <g v-for="t in triggers" :key="t.id">
        <line
          :x1="PAD_L" :x2="VB_W" :y1="yFor(t.target_price)" :y2="yFor(t.target_price)"
          class="trigger-line" :class="t.kind"
        />
        <text :x="VB_W - 4" :y="yFor(t.target_price) - 4" text-anchor="end" class="trigger-label" :class="t.kind">
          {{ t.kind === 'cross_above' ? '↑' : '↓' }} {{ formatPrice(t.target_price) }}
        </text>
      </g>

      <!-- Live drag line -->
      <g v-if="dragging">
        <line :x1="PAD_L" :x2="VB_W" :y1="dragY" :y2="dragY" class="drag-line" />
        <text :x="VB_W - 4" :y="dragY - 4" text-anchor="end" class="drag-label">{{ formatPrice(dragPrice) }}</text>
      </g>
    </svg>

    <!-- Alert list -->
    <div v-if="triggers.length" class="alert-list">
      <span v-for="t in triggers" :key="t.id" class="alert-chip" :class="t.kind">
        {{ t.kind === 'cross_above' ? '↑ above' : '↓ below' }} {{ formatPrice(t.target_price) }}
        <button @click="assetAnnotations.removeTrigger(t.id)" aria-label="Remove alert">✕</button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { seededRandom } from '~/composables/useSeededRandom'

const props = withDefaults(defineProps<{
  assetId: string
  currentPrice: number
  volatility?: number
}>(), { volatility: 0.3 })

const assetAnnotations = useAssetAnnotationsStore()
onMounted(() => { if (!assetAnnotations.hydrated) assetAnnotations.hydrateFromStorage() })

const triggers = computed(() => assetAnnotations.triggersByAsset(props.assetId).filter(t => t.status === 'armed'))

// ── Period + chart type ────────────────────────────────────────────────
const PERIODS = [
  { key: '1D', label: '1D', points: 24 },
  { key: '1W', label: '1W', points: 7 },
  { key: '1M', label: '1M', points: 30 },
  { key: '3M', label: '3M', points: 36 },
  { key: '1Y', label: '1Y', points: 52 },
] as const
type PeriodKey = typeof PERIODS[number]['key']
const period = ref<PeriodKey>('1M')
const chartType = ref<'line' | 'candle'>('line')

// ── Deterministic synthetic OHLC series per asset+period ─────────────────
interface Candle { open: number; high: number; low: number; close: number }
const series = computed<Candle[]>(() => {
  const cfg = PERIODS.find(p => p.key === period.value)!
  const rand = seededRandom(`${props.assetId}-pricechart-${period.value}`)
  const n = cfg.points
  const vol = Math.max(0.05, Math.min(1, props.volatility))
  // Walk backwards from current price so the most recent candle always closes at currentPrice.
  const closes: number[] = [props.currentPrice]
  for (let i = 1; i < n; i++) {
    const prev = closes[0]
    const drift = (rand() - 0.5) * 2 * vol * 0.04
    closes.unshift(Math.max(0.0001, prev * (1 - drift)))
  }
  const out: Candle[] = []
  for (let i = 0; i < n; i++) {
    const open = i === 0 ? closes[0] * (1 + (rand() - 0.5) * vol * 0.02) : closes[i - 1]
    const close = closes[i]
    const hi = Math.max(open, close) * (1 + rand() * vol * 0.015)
    const lo = Math.min(open, close) * (1 - rand() * vol * 0.015)
    out.push({ open, high: hi, low: lo, close })
  }
  return out
})

// ── Geometry ───────────────────────────────────────────────────────────
const VB_W = 640
const VB_H = 260
const PAD_L = 52
const PAD_TOP = 10
const PAD_BOTTOM = 10

const priceRange = computed(() => {
  const all = series.value.flatMap(c => [c.high, c.low])
  all.push(props.currentPrice, ...triggers.value.map(t => t.target_price))
  const min = Math.min(...all)
  const max = Math.max(...all)
  const pad = (max - min) * 0.08 || max * 0.02 || 1
  return { min: min - pad, max: max + pad }
})

function yFor(price: number): number {
  const { min, max } = priceRange.value
  const t = (price - min) / Math.max(1e-9, max - min)
  return VB_H - PAD_BOTTOM - t * (VB_H - PAD_TOP - PAD_BOTTOM)
}
function priceForY(y: number): number {
  const { min, max } = priceRange.value
  const t = 1 - (y - PAD_TOP) / Math.max(1e-9, VB_H - PAD_TOP - PAD_BOTTOM)
  return min + t * (max - min)
}
function xFor(idx: number): number {
  const n = series.value.length
  const usable = VB_W - PAD_L - 8
  return PAD_L + (n <= 1 ? usable / 2 : (idx / (n - 1)) * usable)
}
const candleW = computed(() => Math.max(2, Math.min(14, (VB_W - PAD_L) / series.value.length - 3)))

const linePoints = computed(() =>
  series.value.map((c, i) => `${xFor(i)},${yFor(c.close)}`).join(' ')
)

const gridLines = computed(() => {
  const { min, max } = priceRange.value
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = min + ((max - min) * i) / steps
    return { y: yFor(price), price }
  })
})

function formatPrice(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : v >= 1 ? v.toFixed(2) : v.toFixed(4)
}

const upColor = 'var(--success-green, #00ff88)'
const downColor = 'var(--error-red, #ff4444)'
const lineColor = computed(() =>
  series.value[series.value.length - 1]?.close >= (series.value[0]?.open ?? 0) ? upColor : downColor
)

// ── Drag-to-set-alert ─────────────────────────────────────────────────
const svgEl = ref<SVGSVGElement | null>(null)
const dragging = ref(false)
const dragY = ref(0)
const dragPrice = computed(() => priceForY(dragY.value))

function clientYToSvgY(clientY: number): number {
  const rect = svgEl.value!.getBoundingClientRect()
  const t = (clientY - rect.top) / rect.height
  return t * VB_H
}

function onPointerDown(e: PointerEvent) {
  if (!svgEl.value) return
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  dragging.value = true
  dragY.value = clientYToSvgY(e.clientY)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !svgEl.value) return
  dragY.value = clientYToSvgY(e.clientY)
}
function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  const target = Math.round(dragPrice.value * 100) / 100
  const kind = target >= props.currentPrice ? 'cross_above' : 'cross_below'
  assetAnnotations.addTrigger({
    asset_id: props.assetId,
    kind,
    target_price: target,
    current_price_at_creation: props.currentPrice
  })
}
</script>

<style scoped>
.price-chart { display: flex; flex-direction: column; gap: 0.5rem; }
.chart-toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem; }
.seg-group { display: flex; gap: 2px; }
.seg-group button {
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.6);
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
}
.seg-group button.active {
  background: rgba(0,255,136,0.1);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.chart-hint { font-size: 0.62rem; color: rgba(255,255,255,0.4); }

.chart-svg {
  width: 100%;
  height: 260px;
  display: block;
  touch-action: none;
  cursor: crosshair;
  background: rgba(255,255,255,0.015);
  border-radius: 8px;
}
.grid-line { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
.grid-label { font-size: 9px; fill: rgba(255,255,255,0.35); font-family: ui-monospace, monospace; }
.current-line { stroke: rgba(255,255,255,0.5); stroke-width: 1; stroke-dasharray: 2 3; }
.trigger-line { stroke-width: 1.5; stroke-dasharray: 5 3; }
.trigger-line.cross_above { stroke: var(--success-green, #00ff88); }
.trigger-line.cross_below { stroke: var(--error-red, #ff4444); }
.trigger-label { font-size: 9px; font-weight: 700; font-family: ui-monospace, monospace; }
.trigger-label.cross_above { fill: var(--success-green, #00ff88); }
.trigger-label.cross_below { fill: var(--error-red, #ff4444); }
.drag-line { stroke: #fff; stroke-width: 1.5; stroke-dasharray: 3 3; }
.drag-label { font-size: 10px; font-weight: 800; fill: #fff; font-family: ui-monospace, monospace; }

.alert-list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.alert-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.65rem; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
  border: 1px solid;
}
.alert-chip.cross_above { color: var(--success-green, #00ff88); border-color: rgba(0,255,136,0.35); background: rgba(0,255,136,0.08); }
.alert-chip.cross_below { color: var(--error-red, #ff4444); border-color: rgba(255,68,68,0.35); background: rgba(255,68,68,0.08); }
.alert-chip button { background: none; border: none; color: inherit; cursor: pointer; font-size: 0.7rem; padding: 0; }
</style>
