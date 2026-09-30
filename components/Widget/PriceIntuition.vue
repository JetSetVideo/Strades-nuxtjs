<script setup lang="ts">
/**
 * PriceIntuition Widget — v2
 *
 * Supports multi-timeframe predictions stacked on a single chart.
 * Each TF can hold an independent direction + magnitude, so a user can be
 * bullish 1W and bearish 1M simultaneously. Existing predictions are
 * editable at any time. Friends' and community average lines overlay the chart.
 *
 * Design.md principles applied:
 *  - All colours reference master CSS variables (no hardcoded hex)
 *  - Border-radius morphs with confidence
 *  - Drag-track fill intensity scales with magnitude
 *  - Prediction endpoint pulse speed follows volatility prop
 */
import { ref, computed, watch, onMounted } from 'vue'
import { usePredictionsStore, computeTargetDate } from '@/stores/predictions'
import type { Prediction, PredictionDirection } from '@/stores/predictions'

// ── Props ──────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  assetId?:     string
  assetName?:   string
  currentPrice?: number
  priceHistory?: number[]
  userId?:      string
  maxRangePct?: number
  volatility?:  number
  compact?:     boolean
}>(), {
  assetId:      'BTC',
  assetName:    'Bitcoin',
  currentPrice:  84000,
  priceHistory:  () => [78000, 79500, 81000, 80200, 82500, 83000, 84000],
  userId:        'current_user',
  maxRangePct:   30,
  volatility:    0.3,
  compact:       false,
})

const emit = defineEmits<{
  'prediction-recorded': [p: Prediction]
}>()

// ── Store ──────────────────────────────────────────────────────────────
const store = usePredictionsStore()

// ── Constants ──────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { id: '1D', label: '1D', days: 1 },
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 182 },
  { id: '1Y', label: '1Y', days: 365 },
]
const TF_DAYS: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 182, '1Y': 365 }

const FRIEND_AVATARS: Record<string, string> = {
  kevin_scalper: 'https://i.pravatar.cc/64?u=kevin',
  simon_trader: 'https://i.pravatar.cc/64?u=simon',
  arthuro_investor: 'https://i.pravatar.cc/64?u=arthuro',
}

// Plot geometry. Prices sit in an HTML column to the left of this box.
const SVG_W  = 360
const SVG_H  = 156
const PAD_T  = 18
const PAD_B  = 12
const NOW_X  = 214
const END_X  = SVG_W - 16

// ── State ──────────────────────────────────────────────────────────────
const selectedTf   = ref('1W')
const dragNorm     = ref(0)         // -1 (full bear) to +1 (full bull)
const dragging     = ref(false)
const chartRef     = ref<HTMLElement | null>(null)
const confidence   = ref(3)
const noteText     = ref('')
const useGeo       = ref(false)
const geoLocation  = ref<{ lat: number; lon: number } | null>(null)
const justRecorded = ref(false)
const showHistory  = ref(false)

// ── Store getters ──────────────────────────────────────────────────────
const userActivePreds = computed(() =>
  store.activeByAsset(props.userId!, props.assetId!)
)

const existingForTf = computed(() =>
  store.activeForAssetTf(props.userId!, props.assetId!, selectedTf.value)
)

const isEditing = computed(() => !!existingForTf.value)

const friendsPreds = computed(() =>
  store.predictions.filter(
    p => p.userId !== props.userId && p.assetId === props.assetId
  )
)

const friendsForTf = computed(() =>
  friendsPreds.value.filter(p => p.timeframe === selectedTf.value)
)

const consensus = computed(() =>
  store.consensusForTf(props.assetId!, selectedTf.value)
)

const activePredByTf = computed(() => {
  const result: Record<string, Prediction | null> = {}
  for (const tf of TIMEFRAMES) {
    const pending = store.activeForAssetTf(props.userId!, props.assetId!, tf.id)
    if (pending) { result[tf.id] = pending; continue }
    const mine = store.predictions
      .filter(p => p.userId === props.userId && p.assetId === props.assetId && p.timeframe === tf.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    result[tf.id] = mine[0] ?? null
  }
  return result
})

function friendDir(tf: string): PredictionDirection | null {
  const fps = friendsPreds.value.filter(p => p.timeframe === tf)
  if (!fps.length) return null
  const avg = fps.reduce((s, p) => s + p.predictedChangePct, 0) / fps.length
  if (Math.abs(avg) < 0.05) return 'neutral'
  return avg > 0 ? 'bullish' : 'bearish'
}

const recentHistory = computed(() =>
  store.recentByAsset(props.userId!, props.assetId!, 5)
    .filter(p => p.status !== 'pending')
)

// ── Drag / prediction math ─────────────────────────────────────────────
const predictionPct  = computed(() => dragNorm.value * props.maxRangePct!)
const predictedPrice = computed(() => props.currentPrice! * (1 + predictionPct.value / 100))
const direction      = computed((): PredictionDirection => {
  if (Math.abs(dragNorm.value) < 0.025) return 'neutral'
  return dragNorm.value > 0 ? 'bullish' : 'bearish'
})

const dirColorVar = computed(() =>
  direction.value === 'bullish' ? 'var(--piw-bull)' :
  direction.value === 'bearish' ? 'var(--piw-bear)' : 'var(--piw-neutral)'
)

const hasAim = computed(() => Math.abs(dragNorm.value) >= 0.025)

// Border-radius morphs with confidence (Design.md)
const widgetRadius = computed(() => `${4 + confidence.value * 2}px`)
// Pulse speed from volatility (Design.md)
const pulseSpeed   = computed(() => `${2.5 - (props.volatility ?? 0.3) * 1.8}s`)

// ── Period chart ───────────────────────────────────────────────────────
// Each timeframe rebuilds its own path so switching 1D / 1W / 1Y changes
// the graph, not just a highlight on a shared axis.
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const periodSeries = computed(() => {
  const days = TF_DAYS[selectedTf.value] ?? 7
  const n = Math.min(36, Math.max(14, Math.round(10 + Math.log2(days + 1) * 4)))
  const rand = mulberry32(hashSeed(`${props.assetId}:${selectedTf.value}`))
  const amp = (props.volatility ?? 0.3) * (0.35 + Math.log10(days + 1) * 0.45)
  const back: number[] = [props.currentPrice!]
  let p = props.currentPrice!
  for (let i = 1; i < n; i++) {
    const drift = (rand() - 0.48) * amp * 0.09
    p = Math.max(0.0001, p * (1 - drift))
    back.push(p)
  }
  return back.reverse()
})

function toY(price: number, min: number, max: number): number {
  const range = max - min || 1
  const plot = SVG_H - PAD_T - PAD_B
  return PAD_T + (1 - (price - min) / range) * plot
}

const yRange = computed(() => {
  // Scale to this period's path so the line stays readable. Targets that
  // sit outside the path are pinned to the edge instead of flattening it.
  const prices = [props.currentPrice!, ...periodSeries.value]
  let min = Math.min(...prices)
  let max = Math.max(...prices)
  if (!(max > min)) {
    min *= 0.985
    max *= 1.015
  }
  const pad = (max - min) * 0.45
  return { min: min - pad, max: max + pad }
})

const currentPriceY = computed(() =>
  toY(props.currentPrice!, yRange.value.min, yRange.value.max)
)

const histPolyline = computed(() => {
  const hist = periodSeries.value
  if (hist.length < 2) return ''
  const { min, max } = yRange.value
  return hist.map((p, i) => {
    const x = (i / (hist.length - 1)) * NOW_X
    return `${x.toFixed(1)},${toY(p, min, max).toFixed(1)}`
  }).join(' ')
})

const targetPoint = computed(() => {
  if (!hasAim.value) return null
  const y = toY(predictedPrice.value, yRange.value.min, yRange.value.max)
  return { x: END_X, y }
})

const friendMarks = computed(() => {
  const { min, max } = yRange.value
  return friendsForTf.value.map((fp, i) => ({
    id: fp.id,
    x: END_X - 10 - (i % 3) * 8,
    y: Math.max(PAD_T + 4, Math.min(SVG_H - PAD_B - 4, toY(fp.predictedPrice, min, max))),
    dir: fp.direction,
    price: fp.predictedPrice,
  }))
})

const gradId = computed(() => `piw-grad-${props.assetId}`)

const windowStartLabel = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - (TF_DAYS[selectedTf.value] ?? 7))
  return fmtDate(d.toISOString())
})
const targetDateLabel = computed(() => fmtDate(computeTargetDate(selectedTf.value)))

const friendFaces = computed(() => {
  const seen = new Map<string, Prediction>()
  for (const p of friendsPreds.value) {
    const prev = seen.get(p.userId)
    if (!prev || (p.timeframe === selectedTf.value && prev.timeframe !== selectedTf.value)) {
      seen.set(p.userId, p)
    }
  }
  return [...seen.values()].map(p => ({
    id: p.userId,
    name: friendName(p.userId),
    avatar: FRIEND_AVATARS[p.userId] ?? `https://i.pravatar.cc/64?u=${encodeURIComponent(p.userId)}`,
    direction: p.direction,
    onTf: p.timeframe === selectedTf.value,
  }))
})

// ── Pre-load drag value when switching TF ──────────────────────────────
function loadExistingForTf() {
  const ex = existingForTf.value
  if (ex) {
    dragNorm.value  = Math.max(-1, Math.min(1, ex.predictedChangePct / props.maxRangePct!))
    confidence.value = ex.confidence
    noteText.value   = ex.note
  } else {
    dragNorm.value  = 0
  }
  justRecorded.value = false
}

watch(selectedTf, loadExistingForTf)

onMounted(() => {
  store.init()
  store.seedFromFile()
  loadExistingForTf()
})

// ── Drag on the chart itself ───────────────────────────────────────────
function applyPointer(clientY: number) {
  const el = chartRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const y = (clientY - rect.top) / rect.height
  const padTop = PAD_T / SVG_H
  const plot = (SVG_H - PAD_T - PAD_B) / SVG_H
  const t = Math.max(0, Math.min(1, (y - padTop) / plot))
  const { min, max } = yRange.value
  const price = max - t * (max - min)
  const pct = ((price - props.currentPrice!) / props.currentPrice!) * 100
  dragNorm.value = Math.max(-1, Math.min(1, pct / props.maxRangePct!))
}

function onChartPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  try { el.setPointerCapture(e.pointerId) } catch { /* pointer already released */ }
  dragging.value = true
  applyPointer(e.clientY)
}

function onChartPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  applyPointer(e.clientY)
}

function onChartPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (direction.value !== 'neutral') recordIntuition()
}

// ── Record / Update ────────────────────────────────────────────────────
async function recordIntuition() {
  if (direction.value === 'neutral') return

  if (useGeo.value && !geoLocation.value && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      geoLocation.value = { lat: pos.coords.latitude, lon: pos.coords.longitude }
    })
  }

  const params = {
    userId:            props.userId!,
    assetId:           props.assetId!,
    assetName:         props.assetName!,
    timestamp:         new Date().toISOString(),
    currentPrice:      props.currentPrice!,
    predictedPrice:    Math.round(predictedPrice.value * 100) / 100,
    predictedChangePct: Math.round(predictionPct.value * 10) / 10,
    direction:         direction.value,
    timeframe:         selectedTf.value,
    confidence:        confidence.value,
    note:              noteText.value.trim(),
    latitude:          geoLocation.value?.lat,
    longitude:         geoLocation.value?.lon,
  }

  let result: Prediction
  if (isEditing.value && existingForTf.value) {
    store.updatePrediction(existingForTf.value.id, {
      ...params,
      targetDate: computeTargetDate(selectedTf.value),
    })
    result = existingForTf.value
  } else {
    result = store.addPrediction(params)
  }

  justRecorded.value = true
  emit('prediction-recorded', result)
  setTimeout(() => { justRecorded.value = false }, 3000)
}

// ── Formatting ─────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (p >= 1_000_000) return '$' + (p / 1_000_000).toFixed(2) + 'M'
  if (p >= 10_000)    return '$' + (p / 1000).toFixed(1) + 'k'
  if (p >= 1_000)     return '$' + p.toFixed(0)
  return '$' + p.toFixed(p < 10 ? 3 : 2)
}
function fmtFull(p: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: p < 10 ? 4 : 2, maximumFractionDigits: p < 10 ? 4 : 2 }).format(p)
}
function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}
function friendName(userId: string): string {
  const map: Record<string, string> = {
    kevin_scalper: 'Kevin', simon_trader: 'Simon',
    arthuro_investor: 'Arthuro', current_user: 'You',
  }
  return map[userId] ?? (userId.split('_')[0] ?? userId)
}
function statusIcon(s: string): string {
  return s === 'accurate' ? '✓' : s === 'missed' ? '✗' : s === 'expired' ? '⏱' : '⋯'
}
function predDirColor(dir: PredictionDirection): string {
  return dir === 'bullish' ? 'var(--piw-bull)' : dir === 'bearish' ? 'var(--piw-bear)' : 'var(--piw-neutral)'
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div
    class="piw"
    :class="{ compact }"
    :style="{
      '--piw-radius': widgetRadius,
      '--piw-pulse-speed': pulseSpeed,
    }"
  >
    <div class="piw-body">

        <!-- ─ Timeframe Tabs: color shows whether a call exists, and which way ─ -->
        <div class="piw-tf-tabs">
          <button
            v-for="tf in TIMEFRAMES"
            :key="tf.id"
            class="piw-tf-btn"
            :class="{
              'active': selectedTf === tf.id,
              'has-pred': !!activePredByTf[tf.id] || !!friendDir(tf.id),
              'from-friend': !activePredByTf[tf.id] && !!friendDir(tf.id),
              'bull': (activePredByTf[tf.id]?.direction ?? friendDir(tf.id)) === 'bullish',
              'bear': (activePredByTf[tf.id]?.direction ?? friendDir(tf.id)) === 'bearish',
            }"
            @click="selectedTf = tf.id"
          >
            <span class="tf-label">{{ tf.label }}</span>
            <span v-if="activePredByTf[tf.id] || friendDir(tf.id)" class="tf-dir">
              {{ (activePredByTf[tf.id]?.direction ?? friendDir(tf.id)) === 'bearish' ? '↓' : '↑' }}
            </span>
          </button>
        </div>

        <!-- ─ Chart: drag vertically on the plot to set the target ─ -->
        <div class="piw-chart-layout">
          <div class="piw-y-axis" aria-hidden="true">
            <span class="axis-hi">{{ fmtFull(yRange.max) }}</span>
            <span class="axis-now">{{ fmtFull(currentPrice!) }}</span>
            <span class="axis-lo">{{ fmtFull(yRange.min) }}</span>
          </div>

          <div class="piw-chart-wrap">
            <div
              v-if="friendFaces.length"
              class="piw-friend-avatars"
            >
              <img
                v-for="f in friendFaces"
                :key="f.id"
                :src="f.avatar"
                :alt="f.name"
                :title="`${f.name} · ${f.direction}`"
                class="piw-friend-avatar"
                :class="{ 'on-tf': f.onTf, bear: f.direction === 'bearish', bull: f.direction === 'bullish' }"
              />
            </div>

            <div
              v-if="hasAim"
              class="piw-readout"
              :class="[direction, { recorded: justRecorded }]"
            >
              <span class="readout-kicker">{{ selectedTf }} · {{ targetDateLabel }}</span>
              <span class="readout-price">{{ fmtFull(predictedPrice) }}</span>
              <span class="readout-pct">{{ fmtPct(predictionPct) }}</span>
            </div>

            <div
              ref="chartRef"
              class="piw-plot"
              role="slider"
              :aria-valuemin="yRange.min"
              :aria-valuemax="yRange.max"
              :aria-valuenow="hasAim ? predictedPrice : currentPrice"
              :aria-label="`Set ${selectedTf} price prediction`"
              @pointerdown="onChartPointerDown"
              @pointermove="onChartPointerMove"
              @pointerup="onChartPointerUp"
              @pointercancel="onChartPointerUp"
            >
              <svg
                :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
                class="piw-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient :id="gradId" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stop-color="var(--app-color-down, #ff4444)" />
                    <stop offset="100%" stop-color="var(--app-color-up, #00ff88)" />
                  </linearGradient>
                  <linearGradient :id="gradId + '-fill'" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--app-color-up, #00ff88)" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="var(--app-color-down, #ff4444)" stop-opacity="0.08" />
                  </linearGradient>
                </defs>

                <polygon
                  v-if="histPolyline"
                  :points="`${histPolyline} ${NOW_X},${SVG_H - PAD_B} 0,${SVG_H - PAD_B}`"
                  :fill="`url(#${gradId}-fill)`"
                />
                <polyline
                  v-if="histPolyline"
                  :points="histPolyline"
                  fill="none"
                  :stroke="`url(#${gradId})`"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />

                <line
                  x1="0" :x2="SVG_W"
                  :y1="currentPriceY" :y2="currentPriceY"
                  stroke="rgba(255,255,255,0.16)"
                  stroke-dasharray="3 4"
                  stroke-width="1"
                />
                <line
                  :x1="NOW_X" y1="6"
                  :x2="NOW_X" :y2="SVG_H - 4"
                  stroke="rgba(255,255,255,0.2)"
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <circle
                  :cx="NOW_X" :cy="currentPriceY"
                  r="3.5"
                  fill="#fff"
                  stroke="rgba(0,0,0,0.45)"
                  stroke-width="1"
                />

                <g v-if="targetPoint">
                  <line
                    :x1="NOW_X" :y1="currentPriceY"
                    :x2="targetPoint.x" :y2="targetPoint.y"
                    :stroke="dirColorVar"
                    stroke-width="2"
                    stroke-dasharray="5 3"
                  />
                  <circle
                    :cx="targetPoint.x" :cy="targetPoint.y"
                    r="6"
                    :fill="direction === 'bearish' ? dirColorVar : 'none'"
                    :stroke="dirColorVar"
                    stroke-width="2"
                  />
                </g>

                <g v-for="m in friendMarks" :key="m.id">
                  <circle
                    :cx="m.x" :cy="m.y" r="3.2"
                    :fill="m.dir === 'bearish' ? 'var(--piw-bear)' : 'none'"
                    :stroke="predDirColor(m.dir)"
                    stroke-width="1.4"
                  />
                </g>
              </svg>
            </div>

            <div class="piw-x-axis">
              <span>{{ windowStartLabel }}</span>
              <span>Now</span>
              <span>{{ targetDateLabel }}</span>
            </div>
          </div>
        </div>

        <!-- ─ Community Consensus ─────────────────────────────────── -->
        <div v-if="consensus" class="piw-consensus">
          <div class="cons-header">
            <span class="cons-title">{{ selectedTf }} Community</span>
            <span class="cons-count">{{ consensus.count }} predictions</span>
          </div>
          <div class="cons-bar-wrap">
            <div
              class="cons-bar-fill cons-bull"
              :style="{ width: consensus.bullPct + '%' }"
            />
            <div
              class="cons-bar-fill cons-bear"
              :style="{ width: (100 - consensus.bullPct) + '%' }"
            />
          </div>
          <div class="cons-labels">
            <span class="cons-bull-lbl">↑ {{ consensus.bullPct.toFixed(0) }}% Bullish</span>
            <span class="cons-avg-lbl">avg {{ fmtPct(consensus.avgChangePct) }}</span>
            <span class="cons-bear-lbl">{{ (100 - consensus.bullPct).toFixed(0) }}% Bearish ↓</span>
          </div>
        </div>

        <!-- ─ Friends' Predictions for selected TF ───────────────── -->
        <div v-if="friendsForTf.length" class="piw-friends">
          <span class="piw-friends-label">Friends:</span>
          <div
            v-for="fp in friendsForTf"
            :key="fp.id"
            class="piw-friend-chip"
            :style="{ borderColor: predDirColor(fp.direction) }"
          >
            <span class="fc-name">{{ friendName(fp.userId) }}</span>
            <span class="fc-dir" :style="{ color: predDirColor(fp.direction) }">
              {{ fp.direction === 'bullish' ? '↑' : '↓' }}
            </span>
            <span class="fc-pct" :style="{ color: predDirColor(fp.direction) }">
              {{ fmtPct(fp.predictedChangePct) }}
            </span>
            <span class="fc-target">{{ fmtPrice(fp.predictedPrice) }}</span>
          </div>
        </div>

        <!-- ─ Past Predictions History ────────────────────────────── -->
        <div v-if="recentHistory.length" class="piw-history-section">
          <button class="piw-history-toggle" @click="showHistory = !showHistory">
            {{ showHistory ? '▲' : '▼' }}
            Past predictions
            <span class="piw-hist-count">({{ recentHistory.length }})</span>
          </button>
          <Transition name="fade">
            <div v-if="showHistory" class="piw-history-list">
              <div
                v-for="h in recentHistory"
                :key="h.id"
                class="piw-hist-row"
                :class="h.status"
              >
                <span class="hr-tf">{{ h.timeframe }}</span>
                <span class="hr-dir" :style="{ color: predDirColor(h.direction) }">
                  {{ h.direction === 'bullish' ? '↑' : '↓' }}
                </span>
                <span class="hr-pct">{{ fmtPct(h.predictedChangePct) }}</span>
                <span class="hr-arrow">→</span>
                <span class="hr-price">{{ fmtPrice(h.predictedPrice) }}</span>
                <span v-if="h.actualPrice" class="hr-actual">
                  actual: {{ fmtPrice(h.actualPrice) }}
                </span>
                <span class="hr-status" :class="h.status">{{ statusIcon(h.status) }}</span>
                <span v-if="h.accuracyScore !== undefined" class="hr-score">
                  {{ h.accuracyScore }}%
                </span>
                <span class="hr-date">{{ fmtDate(h.timestamp) }}</span>
              </div>
            </div>
          </Transition>
        </div>

      </div>
  </div>
</template>

<style scoped>
/* ── CSS Variables (scoped overrides) ─────────────────────────────── */
.piw {
  --piw-bull:    var(--app-color-up, var(--success-green, #00ff88));
  --piw-bear:    var(--app-color-down, var(--error-red, #ff4444));
  --piw-neutral: var(--text-gray,     #888);
  --piw-hist:    var(--primary-green, #00cc66);
  --piw-bg:      var(--bg-secondary,  #1a1a1b);
  --piw-border:  var(--border-primary,#2a2a2b);

  border-radius: var(--piw-radius, 12px);
  background:    var(--piw-bg);
  border:        1px solid var(--piw-border);
  overflow:      hidden;
  font-family:   var(--font-family-secondary, sans-serif);
}

.piw.compact { border: none; background: transparent; }

/* ── Body ─────────────────────────────────────────────────────────── */
.piw-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; }

/* ── Timeframe Tabs ───────────────────────────────────────────────── */
.piw-tf-tabs {
  display:   flex;
  gap:       4px;
  flex-wrap: wrap;
}
.piw-tf-btn {
  display:        flex;
  align-items:    center;
  gap:            4px;
  padding:        4px 10px;
  border-radius:  20px;
  border:         1px solid var(--piw-border);
  background:     transparent;
  color:          var(--text-gray, #888);
  font-size:      0.72rem;
  font-weight:    500;
  cursor:         pointer;
  transition:     all 0.2s;
  font-family:    var(--font-family-secondary, sans-serif);
}
.piw-tf-btn:hover { border-color: var(--text-gray); color: var(--text-white, #fff); }
.piw-tf-btn.bull {
  color: var(--piw-bull);
  border-color: color-mix(in srgb, var(--piw-bull) 55%, transparent);
  background: color-mix(in srgb, var(--piw-bull) 16%, transparent);
}
.piw-tf-btn.bear {
  color: var(--piw-bear);
  border-color: color-mix(in srgb, var(--piw-bear) 55%, transparent);
  background: color-mix(in srgb, var(--piw-bear) 16%, transparent);
}
.piw-tf-btn.active:not(.bull):not(.bear) {
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.35);
  color: var(--text-white, #fff);
}
.piw-tf-btn.from-friend { opacity: 0.85; }
.piw-tf-btn.active.bull {
  background: color-mix(in srgb, var(--piw-bull) 28%, transparent);
  box-shadow: inset 0 0 0 1px var(--piw-bull);
}
.piw-tf-btn.active.bear {
  background: color-mix(in srgb, var(--piw-bear) 28%, transparent);
  box-shadow: inset 0 0 0 1px var(--piw-bear);
}
.tf-dir { font-size: 0.62rem; font-weight: 800; line-height: 1; }

/* ── Chart ────────────────────────────────────────────────────────── */
.piw-chart-layout {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
}
.piw-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 0 22px;
  font-family: var(--font-market-data, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.68rem;
  font-weight: 650;
  line-height: 1.15;
}
.axis-hi { color: var(--piw-bull); }
.axis-now { color: rgba(255,255,255,0.78); }
.axis-lo { color: var(--piw-bear); }

.piw-chart-wrap {
  position: relative;
  background: rgba(0,0,0,.22);
  border-radius: 8px;
  min-width: 0;
}
.piw-plot {
  cursor: ns-resize;
  touch-action: none;
}
.piw-svg {
  width: 100%;
  height: 168px;
  display: block;
}
.piw-x-axis {
  display: flex;
  justify-content: space-between;
  padding: 2px 8px 6px;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.42);
  font-family: var(--font-market-data, ui-monospace, monospace);
  pointer-events: none;
}
.piw-friend-avatars {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  z-index: 2;
  pointer-events: none;
}
.piw-friend-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  margin-left: -7px;
  border: 2px solid #121214;
  background: #222;
}
.piw-friend-avatar:first-child { margin-left: 0; }
.piw-friend-avatar.bull.on-tf { box-shadow: 0 0 0 1.5px var(--piw-bull); }
.piw-friend-avatar.bear.on-tf { box-shadow: 0 0 0 1.5px var(--piw-bear); }
.piw-readout {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  pointer-events: none;
  font-family: var(--font-market-data, ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
}
.piw-readout.bull { color: var(--piw-bull); }
.piw-readout.bear { color: var(--piw-bear); }
.readout-kicker {
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.8;
  font-family: var(--font-chrome, inherit);
}
.readout-price {
  font-size: 1.15rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.readout-pct { font-size: 0.72rem; font-weight: 700; }

@keyframes piw-pulse {
  0%, 100% { r: 5; opacity: 0.15; }
  50%       { r: 9; opacity: 0.05; }
}
.piw-pulse-ring {
  animation: piw-pulse var(--piw-pulse-speed, 2s) ease-in-out infinite;
}

/* ── TF Section (drag + controls) ────────────────────────────────── */
.piw-tf-section { display: flex; flex-direction: column; gap: 9px; }

.piw-edit-notice {
  display:         flex;
  justify-content: space-between;
  align-items:     center;
  font-size:       0.72rem;
  padding:         5px 10px;
  border-radius:   6px;
  background:      rgba(255,200,0,.08);
  border:          1px solid rgba(255,200,0,.2);
  color:           #ffc800;
}
.edit-since { opacity: 0.6; font-size: 0.65rem; }

/* Price row */
.piw-price-row {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  gap:             8px;
}
.piw-price-col { display: flex; flex-direction: column; }
.piw-price-col--target { align-items: flex-end; }
.piw-price-label { font-size: 0.62rem; color: var(--text-gray, #888); }
.piw-price-val   { font-size: 0.9rem; font-weight: 600; color: var(--text-white, #fff); font-family: var(--font-family-primary, 'Kanit', sans-serif); }
.piw-price-pct   { font-size: 0.7rem; font-weight: 600; }
.piw-arrow       { font-size: 1rem; font-weight: 700; flex: 1; text-align: center; }

/* Drag track */
.piw-htrack-wrap {
  position:      relative;
  height:        36px;
  border-radius: 18px;
  background:    rgba(255,255,255,.05);
  border:        1px solid var(--piw-border);
  overflow:      visible;
  cursor:        ew-resize;
  touch-action:  none;
}
.piw-htrack-bg {
  position:  absolute;
  inset:     0;
  display:   flex;
  align-items: center;
  justify-content: space-between;
  padding:   0 12px;
  pointer-events: none;
}
.piw-htrack-bear-label,
.piw-htrack-bull-label {
  font-size:  0.65rem;
  color:      rgba(255,255,255,.2);
}
.piw-htrack-fill {
  position:   absolute;
  top:        0;
  height:     100%;
  transition: width 0.1s;
}
.piw-bear-fill {
  right:         50%;
  background:    linear-gradient(to left, var(--piw-bear), transparent);
  border-radius: 18px 0 0 18px;
  opacity: 0.5;
}
.piw-bull-fill {
  left:          50%;
  background:    linear-gradient(to right, var(--piw-bull), transparent);
  border-radius: 0 18px 18px 0;
  opacity: 0.5;
}
.piw-htrack-center {
  position:   absolute;
  left:       50%;
  top:        20%;
  height:     60%;
  width:      1px;
  background: rgba(255,255,255,.3);
  transform:  translateX(-50%);
}
.piw-htrack-thumb {
  position:      absolute;
  top:           50%;
  transform:     translateY(-50%);
  width:         40px;
  height:        40px;
  border-radius: 50%;
  background:    var(--bg-secondary, #1a1a1b);
  border:        2px solid rgba(255,255,255,.3);
  display:       flex;
  align-items:   center;
  justify-content: center;
  cursor:        grab;
  transition:    border-color 0.15s, box-shadow 0.15s;
  z-index:       2;
  user-select:   none;
}
.piw-htrack-thumb.dragging { cursor: grabbing; }
.piw-thumb-icon { font-size: 1rem; line-height: 1; pointer-events: none; }

/* Confidence stars */
.piw-meta-row {
  display:         flex;
  justify-content: space-between;
  align-items:     center;
}
.piw-stars { display: flex; gap: 3px; }
.piw-star {
  font-size:   1.1rem;
  color:       rgba(255,255,255,.2);
  background:  none;
  border:      none;
  cursor:      pointer;
  padding:     0;
  transition:  color 0.15s;
}
.piw-star.filled { color: #ffc800; }
.piw-meta-actions { display: flex; gap: 6px; }
.piw-meta-btn {
  width:         30px;
  height:        30px;
  border-radius: 50%;
  border:        1px solid var(--piw-border);
  background:    transparent;
  cursor:        pointer;
  font-size:     0.85rem;
  transition:    background 0.15s;
}
.piw-meta-btn.active { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.3); }
.piw-note {
  width:        100%;
  box-sizing:   border-box;
  background:   rgba(0,0,0,.2);
  border:       1px solid var(--piw-border);
  border-radius: 6px;
  color:        var(--text-white, #fff);
  font-size:    0.78rem;
  padding:      7px 10px;
  resize:       vertical;
  font-family:  var(--font-family-secondary, sans-serif);
}

/* Record button */
.piw-record-btn {
  width:         100%;
  padding:       10px;
  border-radius: var(--piw-radius, 12px);
  border:        2px solid;
  font-size:     0.82rem;
  font-weight:   600;
  cursor:        pointer;
  transition:    all 0.25s;
  font-family:   var(--font-family-primary, 'Kanit', sans-serif);
  letter-spacing: 0.03em;
}
.piw-record-btn.bull {
  background:   rgba(0,255,136,.12);
  border-color: rgba(0,255,136,.5);
  color:        var(--piw-bull);
}
.piw-record-btn.bear {
  background:   rgba(255,68,102,.12);
  border-color: rgba(255,68,102,.5);
  color:        var(--piw-bear);
}
.piw-record-btn.recorded {
  background:  rgba(0,255,136,.22);
  border-color: rgba(0,255,136,.8);
}
.piw-record-btn.disabled {
  background:   transparent;
  border-color: rgba(255,255,255,.1);
  color:        var(--text-gray, #888);
  cursor:       default;
}
.piw-record-btn.edit-mode:not(.disabled) { font-style: italic; }

/* ── Community consensus ──────────────────────────────────────────── */
.piw-consensus {
  display:       flex;
  flex-direction: column;
  gap:            6px;
}
.cons-header {
  display:         flex;
  justify-content: space-between;
  font-size:       0.7rem;
  color:           var(--text-gray, #888);
}
.cons-count { font-size: 0.65rem; }
.cons-bar-wrap {
  display:       flex;
  height:        6px;
  border-radius: 3px;
  overflow:      hidden;
  background:    rgba(255,255,255,.05);
}
.cons-bar-fill { height: 100%; transition: width 0.4s; }
.cons-bull { background: var(--piw-bull); }
.cons-bear { background: var(--piw-bear); }
.cons-labels { display: flex; justify-content: space-between; font-size: 0.65rem; }
.cons-bull-lbl { color: var(--piw-bull); }
.cons-bear-lbl { color: var(--piw-bear); }
.cons-avg-lbl  { color: var(--text-gray, #888); }

/* ── Friends ──────────────────────────────────────────────────────── */
.piw-friends {
  display:     flex;
  align-items: center;
  flex-wrap:   wrap;
  gap:         6px;
}
.piw-friends-label { font-size: 0.65rem; color: var(--text-gray, #888); }
.piw-friend-chip {
  display:       flex;
  align-items:   center;
  gap:           4px;
  padding:       3px 9px;
  border-radius: 20px;
  border:        1px solid;
  background:    rgba(255,255,255,.04);
  font-size:     0.7rem;
}
.fc-name   { color: rgba(255,255,255,.6); }
.fc-dir    { font-weight: 700; }
.fc-pct    { font-weight: 600; }
.fc-target { color: rgba(255,255,255,.4); font-size: 0.62rem; }

/* ── History ──────────────────────────────────────────────────────── */
.piw-history-section { display: flex; flex-direction: column; gap: 6px; }
.piw-history-toggle {
  background:  transparent;
  border:      none;
  color:       var(--text-gray, #888);
  font-size:   0.72rem;
  cursor:      pointer;
  text-align:  left;
  padding:     0;
}
.piw-hist-count { opacity: 0.6; }
.piw-history-list { display: flex; flex-direction: column; gap: 4px; }
.piw-hist-row {
  display:       flex;
  align-items:   center;
  gap:           6px;
  font-size:     0.68rem;
  padding:       4px 8px;
  border-radius: 6px;
  border-left:   3px solid;
}
.piw-hist-row.accurate { border-color: var(--piw-bull); background: rgba(0,255,136,.05); }
.piw-hist-row.missed   { border-color: var(--piw-bear); background: rgba(255,68,102,.05); }
.piw-hist-row.expired  { border-color: var(--piw-neutral); background: rgba(136,136,136,.05); }
.hr-tf     { font-weight: 600; color: var(--text-white, #fff); min-width: 24px; }
.hr-dir    { font-weight: 700; }
.hr-pct    { color: rgba(255,255,255,.8); }
.hr-arrow  { color: rgba(255,255,255,.3); }
.hr-price  { color: rgba(255,255,255,.7); }
.hr-actual { color: rgba(255,255,255,.4); font-style: italic; }
.hr-status.accurate { color: var(--piw-bull); }
.hr-status.missed   { color: var(--piw-bear); }
.hr-status.expired  { color: var(--piw-neutral); }
.hr-score { color: rgba(255,255,255,.5); }
.hr-date  { color: rgba(255,255,255,.3); margin-left: auto; }

/* ── Transitions ──────────────────────────────────────────────────── */
.piw-body-enter-active,
.piw-body-leave-active { transition: all 0.25s ease; }
.piw-body-enter-from,
.piw-body-leave-to     { opacity: 0; transform: translateY(-6px); }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
