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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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

// SVG chart constants
const SVG_W   = 250
const SVG_H   = 85
const HIST_X  = 130  // x-position of "now" divider
const PAD_Y   = 10
const FUTURE_W = SVG_W - HIST_X - 15  // usable future zone width

// ── State ──────────────────────────────────────────────────────────────
const selectedTf   = ref('1W')
const dragNorm     = ref(0)         // -1 (full bear) to +1 (full bull)
const dragging     = ref(false)
const trackRef     = ref<HTMLElement | null>(null)
const confidence   = ref(3)
const noteText     = ref('')
const showNote     = ref(false)
const useGeo       = ref(false)
const geoLocation  = ref<{ lat: number; lon: number } | null>(null)
const showBody     = ref(!props.compact)
const justRecorded = ref(false)
const isExpanded   = ref(true)
const showHistory  = ref(false)

let startClientX  = 0
let startDragNorm = 0

// ── Store getters ──────────────────────────────────────────────────────
const userActivePreds = computed(() =>
  store.activeByAsset(props.userId!, props.assetId!)
)

const existingForTf = computed(() =>
  store.activeForAssetTf(props.userId!, props.assetId!, selectedTf.value)
)

const isEditing = computed(() => !!existingForTf.value)

const friendsPreds = computed(() =>
  store.friendsForAsset(props.userId!, props.assetId!)
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
    result[tf.id] = store.activeForAssetTf(props.userId!, props.assetId!, tf.id)
  }
  return result
})

const recentHistory = computed(() =>
  store.recentByAsset(props.userId!, props.assetId!, 5)
    .filter(p => p.status !== 'pending')
)

const alerts = computed(() => store.recentAlerts(props.userId!))

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

const bullFillPct = computed(() => dragNorm.value > 0 ? dragNorm.value * 50 : 0)
const bearFillPct = computed(() => dragNorm.value < 0 ? -dragNorm.value * 50 : 0)
const thumbLeftStyle = computed(() =>
  `calc(${((dragNorm.value + 1) / 2) * 100}% - 20px)`
)

// Border-radius morphs with confidence (Design.md)
const widgetRadius = computed(() => `${4 + confidence.value * 2}px`)
// Pulse speed from volatility (Design.md)
const pulseSpeed   = computed(() => `${2.5 - (props.volatility ?? 0.3) * 1.8}s`)

// ── SVG chart ──────────────────────────────────────────────────────────
function tfX(tf: string): number {
  const days = TF_DAYS[tf] ?? 7
  return HIST_X + (Math.log10(days + 0.5) / Math.log10(365.5)) * FUTURE_W
}

function toY(price: number, min: number, max: number): number {
  const range = max - min || 1
  return SVG_H - PAD_Y - ((price - min) / range) * (SVG_H - PAD_Y * 2)
}

const yRange = computed(() => {
  const all = [
    ...props.priceHistory!,
    props.currentPrice!,
    ...userActivePreds.value.map(p => p.predictedPrice),
    ...friendsPreds.value.map(p => p.predictedPrice),
  ]
  if (Math.abs(dragNorm.value) > 0.025) all.push(predictedPrice.value)
  const mn = Math.min(...all)
  const mx = Math.max(...all)
  const pad = (mx - mn) * 0.08
  return { min: mn - pad, max: mx + pad }
})

const currentPriceY = computed(() =>
  toY(props.currentPrice!, yRange.value.min, yRange.value.max)
)

const histPolyline = computed(() => {
  const hist = props.priceHistory!
  if (hist.length < 2) return ''
  const { min, max } = yRange.value
  return hist.map((p, i) => {
    const x = (i / (hist.length - 1)) * HIST_X
    return `${x.toFixed(1)},${toY(p, min, max).toFixed(1)}`
  }).join(' ')
})

// Live drag preview line for selected TF (shown while dragging or when a value is set)
const liveLine = computed(() => {
  if (Math.abs(dragNorm.value) < 0.025) return null
  const x = tfX(selectedTf.value)
  const y = toY(predictedPrice.value, yRange.value.min, yRange.value.max)
  return { x: x.toFixed(1), y: y.toFixed(1), tf: selectedTf.value }
})

// Unique timeframes across all friends predictions for chart rendering
const friendTfs = computed(() => {
  const seen = new Set<string>()
  return friendsPreds.value.filter(fp => {
    if (seen.has(fp.userId + fp.timeframe)) return false
    seen.add(fp.userId + fp.timeframe)
    return true
  })
})

// Average per-TF prediction from friends
const friendAvgByTf = computed(() => {
  const result: Record<string, { pct: number; dir: PredictionDirection; price: number }> = {}
  for (const tf of TIMEFRAMES) {
    const fps = friendsPreds.value.filter(p => p.timeframe === tf.id)
    if (!fps.length) continue
    const avg = fps.reduce((s, p) => s + p.predictedChangePct, 0) / fps.length
    result[tf.id] = {
      pct:   avg,
      dir:   avg > 0 ? 'bullish' : avg < 0 ? 'bearish' : 'neutral',
      price: props.currentPrice! * (1 + avg / 100),
    }
  }
  return result
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

// ── Drag events ────────────────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
  e.preventDefault()
  dragging.value = true
  startClientX  = e.clientX
  startDragNorm = dragNorm.value
  document.addEventListener('mousemove', onDocMove)
  document.addEventListener('mouseup',  onDocUp)
}

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  dragging.value = true
  startClientX  = e.touches[0]!.clientX
  startDragNorm = dragNorm.value
  document.addEventListener('touchmove',  onDocTouchMove, { passive: false })
  document.addEventListener('touchend',   onDocTouchEnd)
}

function onDocMove(e: MouseEvent) {
  if (!dragging.value || !trackRef.value) return
  const rect     = trackRef.value.getBoundingClientRect()
  const deltaN   = (e.clientX - startClientX) / (rect.width / 2)
  dragNorm.value = Math.max(-1, Math.min(1, startDragNorm + deltaN))
}

function onDocTouchMove(e: TouchEvent) {
  if (!dragging.value || !trackRef.value) return
  e.preventDefault()
  const rect     = trackRef.value.getBoundingClientRect()
  const deltaN   = (e.touches[0]!.clientX - startClientX) / (rect.width / 2)
  dragNorm.value = Math.max(-1, Math.min(1, startDragNorm + deltaN))
}

function onDocUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onDocMove)
  document.removeEventListener('mouseup',  onDocUp)
}

function onDocTouchEnd() {
  dragging.value = false
  document.removeEventListener('touchmove', onDocTouchMove)
  document.removeEventListener('touchend',  onDocTouchEnd)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDocMove)
  document.removeEventListener('mouseup',  onDocUp)
  document.removeEventListener('touchmove', onDocTouchMove)
  document.removeEventListener('touchend',  onDocTouchEnd)
})

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
    :style="{
      '--piw-radius': widgetRadius,
      '--piw-pulse-speed': pulseSpeed,
    }"
  >
    <!-- ─ Header ──────────────────────────────────────────────────── -->
    <div class="piw-header" @click="isExpanded = !isExpanded">
      <div class="piw-header-left">
        <span class="piw-icon">🎯</span>
        <span class="piw-title">Price Intuition</span>
        <span class="piw-asset-tag">{{ assetId }}</span>
        <span v-if="userActivePreds.length" class="piw-active-badge">
          {{ userActivePreds.length }} active
        </span>
      </div>
      <div class="piw-header-right">
        <!-- Alert badges -->
        <span
          v-for="a in alerts.slice(0, 2)"
          :key="a.id"
          class="piw-alert-chip"
          :class="a.status"
        >
          {{ statusIcon(a.status) }} {{ a.assetId }} {{ a.timeframe }}
        </span>
        <span class="piw-chevron">{{ isExpanded ? '▲' : '▼' }}</span>
      </div>
    </div>

    <Transition name="piw-body">
      <div v-if="isExpanded" class="piw-body">

        <!-- ─ Timeframe Tabs ───────────────────────────────────────── -->
        <div class="piw-tf-tabs">
          <button
            v-for="tf in TIMEFRAMES"
            :key="tf.id"
            class="piw-tf-btn"
            :class="{
              'active': selectedTf === tf.id,
              'has-pred': !!activePredByTf[tf.id],
              'bull': activePredByTf[tf.id]?.direction === 'bullish',
              'bear': activePredByTf[tf.id]?.direction === 'bearish',
            }"
            @click="selectedTf = tf.id"
          >
            <span class="tf-label">{{ tf.label }}</span>
            <span
              v-if="activePredByTf[tf.id]"
              class="tf-dir-dot"
              :style="{ background: predDirColor(activePredByTf[tf.id]!.direction) }"
            />
          </button>
        </div>

        <!-- ─ Multi-TF Chart ──────────────────────────────────────── -->
        <div class="piw-chart-wrap">
          <svg
            :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
            class="piw-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--piw-hist)" stop-opacity="0.3" />
                <stop offset="100%" stop-color="var(--piw-hist)" stop-opacity="0.0" />
              </linearGradient>
            </defs>

            <!-- Historical area fill -->
            <polygon
              v-if="histPolyline"
              :points="`${histPolyline} ${HIST_X},${SVG_H} 0,${SVG_H}`"
              fill="url(#hist-fill)"
            />

            <!-- Historical sparkline -->
            <polyline
              v-if="histPolyline"
              :points="histPolyline"
              fill="none"
              stroke="var(--piw-hist)"
              stroke-width="1.5"
              stroke-linejoin="round"
            />

            <!-- "Now" divider -->
            <line
              :x1="HIST_X" y1="0"
              :x2="HIST_X" :y2="SVG_H"
              stroke="rgba(255,255,255,0.18)"
              stroke-dasharray="3 3"
              stroke-width="1"
            />

            <!-- "Now" dot -->
            <circle
              :cx="HIST_X" :cy="currentPriceY"
              r="3.5"
              fill="var(--piw-hist)"
              stroke="var(--bg-primary)"
              stroke-width="1"
            />

            <!-- Friends' average per-TF lines -->
            <g v-for="(avg, tfId) in friendAvgByTf" :key="'favg-' + tfId" opacity="0.35">
              <line
                :x1="HIST_X" :y1="currentPriceY"
                :x2="tfX(tfId)" :y2="toY(avg.price, yRange.min, yRange.max)"
                :stroke="predDirColor(avg.dir)"
                stroke-width="1"
                stroke-dasharray="3 4"
              />
              <circle
                :cx="tfX(tfId)" :cy="toY(avg.price, yRange.min, yRange.max)"
                r="2.5"
                :fill="predDirColor(avg.dir)"
              />
              <text
                :x="tfX(tfId) + 3"
                :y="toY(avg.price, yRange.min, yRange.max) - 5"
                font-size="4.5"
                :fill="predDirColor(avg.dir)"
              >~{{ fmtPrice(avg.price) }}</text>
            </g>

            <!-- User's active prediction lines (all TFs) -->
            <g v-for="pred in userActivePreds" :key="pred.id">
              <!-- Connection line -->
              <line
                :x1="HIST_X" :y1="currentPriceY"
                :x2="tfX(pred.timeframe)" :y2="toY(pred.predictedPrice, yRange.min, yRange.max)"
                :stroke="predDirColor(pred.direction)"
                :stroke-width="selectedTf === pred.timeframe ? 2.5 : 1.5"
                stroke-dasharray="6 3"
                :opacity="selectedTf === pred.timeframe ? 1 : 0.55"
              />
              <!-- Endpoint pulse ring (selected TF only) -->
              <circle
                v-if="selectedTf === pred.timeframe"
                :cx="tfX(pred.timeframe)"
                :cy="toY(pred.predictedPrice, yRange.min, yRange.max)"
                r="7"
                :fill="predDirColor(pred.direction)"
                opacity="0.15"
                class="piw-pulse-ring"
              />
              <!-- Endpoint circle -->
              <circle
                :cx="tfX(pred.timeframe)"
                :cy="toY(pred.predictedPrice, yRange.min, yRange.max)"
                r="4"
                :fill="predDirColor(pred.direction)"
                stroke="var(--bg-primary)"
                stroke-width="1"
              />
              <!-- Target price label -->
              <text
                :x="tfX(pred.timeframe) + 5"
                :y="toY(pred.predictedPrice, yRange.min, yRange.max) - 3"
                font-size="5.5"
                :fill="predDirColor(pred.direction)"
                font-weight="600"
              >{{ fmtPrice(pred.predictedPrice) }}</text>
              <!-- TF label below -->
              <text
                :x="tfX(pred.timeframe) + 5"
                :y="toY(pred.predictedPrice, yRange.min, yRange.max) + 9"
                font-size="4.5"
                fill="rgba(255,255,255,0.45)"
              >{{ pred.timeframe }}</text>
            </g>

            <!-- Live drag preview line -->
            <g v-if="liveLine && !isEditing">
              <line
                :x1="HIST_X" :y1="currentPriceY"
                :x2="liveLine.x" :y2="liveLine.y"
                :stroke="dirColorVar"
                stroke-width="2"
                stroke-dasharray="5 3"
                opacity="0.85"
              />
              <circle
                :cx="liveLine.x" :cy="liveLine.y"
                r="4"
                :fill="dirColorVar"
                opacity="0.9"
                class="piw-pulse-ring"
              />
              <text
                :x="Number(liveLine.x) + 5"
                :y="Number(liveLine.y) - 3"
                font-size="5.5"
                :fill="dirColorVar"
                font-weight="600"
              >{{ fmtPrice(predictedPrice) }}</text>
            </g>

            <!-- TF axis markers (x-axis labels) -->
            <g v-for="tf in TIMEFRAMES" :key="'axis-' + tf.id">
              <text
                :x="tfX(tf.id)"
                :y="SVG_H - 1"
                font-size="4"
                fill="rgba(255,255,255,0.22)"
                text-anchor="middle"
              >{{ tf.label }}</text>
            </g>
          </svg>

          <!-- Price scale (Y-axis hint) -->
          <div class="piw-y-hint">
            <span>{{ fmtPrice(yRange.max) }}</span>
            <span>{{ fmtPrice(yRange.min) }}</span>
          </div>
        </div>

        <!-- ─ TF Controls ──────────────────────────────────────────── -->
        <div class="piw-tf-section">
          <!-- Edit notice -->
          <div v-if="isEditing" class="piw-edit-notice">
            <span>✏️ Editing your {{ selectedTf }} prediction</span>
            <span class="edit-since">set {{ fmtDate(existingForTf!.timestamp) }}</span>
          </div>

          <!-- Price row -->
          <div class="piw-price-row">
            <div class="piw-price-col">
              <span class="piw-price-label">Current</span>
              <span class="piw-price-val">{{ fmtFull(currentPrice!) }}</span>
            </div>
            <div class="piw-arrow" :style="{ color: dirColorVar }">
              {{ direction === 'bullish' ? '→↑' : direction === 'bearish' ? '→↓' : '→' }}
            </div>
            <div class="piw-price-col piw-price-col--target">
              <span class="piw-price-label">{{ selectedTf }} Target</span>
              <span class="piw-price-val" :style="{ color: dirColorVar }">
                {{ Math.abs(dragNorm) > 0.025 ? fmtFull(predictedPrice) : '—' }}
              </span>
              <span class="piw-price-pct" :style="{ color: dirColorVar }">
                {{ Math.abs(dragNorm) > 0.025 ? fmtPct(predictionPct) : '' }}
              </span>
            </div>
          </div>

          <!-- Horizontal drag track -->
          <div class="piw-htrack-wrap" ref="trackRef">
            <div class="piw-htrack-bg">
              <span class="piw-htrack-bear-label">↓ Bear</span>
              <span class="piw-htrack-bull-label">Bull ↑</span>
            </div>
            <!-- Bear fill (from center leftward) -->
            <div
              class="piw-htrack-fill piw-bear-fill"
              :style="{ width: bearFillPct + '%' }"
            />
            <!-- Bull fill (from center rightward) -->
            <div
              class="piw-htrack-fill piw-bull-fill"
              :style="{ width: bullFillPct + '%' }"
            />
            <!-- Center tick -->
            <div class="piw-htrack-center" />
            <!-- Thumb -->
            <div
              class="piw-htrack-thumb"
              :class="{ bull: direction === 'bullish', bear: direction === 'bearish', dragging }"
              :style="{
                left: thumbLeftStyle,
                borderColor: dirColorVar,
                boxShadow: `0 0 ${8 + Math.abs(dragNorm) * 10}px ${dirColorVar}`,
              }"
              @mousedown="onMouseDown"
              @touchstart.prevent="onTouchStart"
            >
              <span class="piw-thumb-icon">
                {{ direction === 'bullish' ? '↑' : direction === 'bearish' ? '↓' : '●' }}
              </span>
            </div>
          </div>

          <!-- Confidence + options row -->
          <div class="piw-meta-row">
            <div class="piw-stars">
              <button
                v-for="s in 5"
                :key="s"
                class="piw-star"
                :class="{ filled: s <= confidence }"
                @click="confidence = s"
              >★</button>
            </div>
            <div class="piw-meta-actions">
              <button
                class="piw-meta-btn"
                :class="{ active: showNote }"
                @click="showNote = !showNote"
                title="Add note"
              >📝</button>
              <button
                class="piw-meta-btn"
                :class="{ active: useGeo }"
                @click="useGeo = !useGeo"
                title="Record location"
              >📍</button>
            </div>
          </div>

          <Transition name="fade">
            <textarea
              v-if="showNote"
              v-model="noteText"
              class="piw-note"
              rows="2"
              placeholder="Your thesis for this prediction…"
            />
          </Transition>

          <!-- Record / Update button -->
          <button
            class="piw-record-btn"
            :class="{
              'bull': direction === 'bullish',
              'bear': direction === 'bearish',
              'recorded': justRecorded,
              'edit-mode': isEditing,
              'disabled': direction === 'neutral',
            }"
            :disabled="direction === 'neutral'"
            @click="recordIntuition"
          >
            <template v-if="justRecorded">
              ✓ {{ isEditing ? 'Updated!' : 'Recorded!' }}
            </template>
            <template v-else-if="direction === 'neutral'">
              ← Drag to set prediction →
            </template>
            <template v-else>
              {{ isEditing ? '↺ Update' : '🎯 Record' }}
              {{ selectedTf }} Prediction
              {{ fmtPct(predictionPct) }}
              {{ direction === 'bullish' ? '↑' : '↓' }}
            </template>
          </button>
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
    </Transition>
  </div>
</template>

<style scoped>
/* ── CSS Variables (scoped overrides) ─────────────────────────────── */
.piw {
  --piw-bull:    var(--success-green, #00ff88);
  --piw-bear:    var(--error-red,     #ff4466);
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

/* ── Header ───────────────────────────────────────────────────────── */
.piw-header {
  display:         flex;
  justify-content: space-between;
  align-items:     center;
  padding:         10px 14px;
  cursor:          pointer;
  background:      rgba(0,0,0,0.2);
  border-bottom:   1px solid var(--piw-border);
  user-select:     none;
}
.piw-header-left { display: flex; align-items: center; gap: 8px; }
.piw-header-right { display: flex; align-items: center; gap: 6px; }

.piw-icon  { font-size: 1rem; }
.piw-title {
  font-family: var(--font-family-primary, 'Kanit', sans-serif);
  font-size:   0.9rem;
  font-weight: 600;
  color:       var(--text-white, #fff);
}
.piw-asset-tag {
  font-size:    0.7rem;
  padding:      2px 7px;
  border-radius: 20px;
  background:   rgba(0,204,102,.15);
  color:        var(--piw-hist);
  font-weight:  600;
}
.piw-active-badge {
  font-size:    0.65rem;
  padding:      1px 6px;
  border-radius: 10px;
  background:   rgba(0,204,102,.1);
  color:        var(--piw-hist);
  border:       1px solid rgba(0,204,102,.2);
}
.piw-alert-chip {
  font-size:     0.6rem;
  padding:       2px 7px;
  border-radius: 10px;
  border:        1px solid;
}
.piw-alert-chip.accurate { color: var(--piw-bull); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.08); }
.piw-alert-chip.missed   { color: var(--piw-bear); border-color: rgba(255,68,102,.3); background: rgba(255,68,102,.08); }
.piw-alert-chip.expired  { color: var(--piw-neutral); border-color: rgba(136,136,136,.3); background: rgba(136,136,136,.08); }
.piw-chevron { color: var(--text-gray, #888); font-size: 0.7rem; }

/* ── Body ─────────────────────────────────────────────────────────── */
.piw-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }

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
.piw-tf-btn.active {
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.3);
  color: var(--text-white, #fff);
}
.piw-tf-btn.has-pred.bull { border-color: rgba(0,255,136,.4); color: var(--piw-bull); }
.piw-tf-btn.has-pred.bear { border-color: rgba(255,68,102,.4); color: var(--piw-bear); }
.tf-dir-dot {
  width:         5px;
  height:        5px;
  border-radius: 50%;
  display:       inline-block;
}

/* ── Chart ────────────────────────────────────────────────────────── */
.piw-chart-wrap {
  position: relative;
  background: rgba(0,0,0,.15);
  border-radius: 8px;
  overflow: visible;
  padding: 4px 0 4px 0;
}
.piw-svg {
  width:  100%;
  height: 85px;
  display: block;
  overflow: visible;
}
.piw-y-hint {
  position:   absolute;
  right:      -2px;
  top:        0;
  bottom:     0;
  display:    flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  padding:    4px 0;
}
.piw-y-hint span {
  font-size:  0.58rem;
  color:      rgba(255,255,255,.3);
  white-space: nowrap;
}

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
