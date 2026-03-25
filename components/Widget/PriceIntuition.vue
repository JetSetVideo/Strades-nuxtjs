<script setup lang="ts">
/**
 * PriceIntuition Widget
 * Lets users register their price-evolution intuition for an asset.
 *
 * UX mechanics:
 *  - Vertical drag thumb (↑ bullish green / ↓ bearish red)
 *  - SVG chart continuation: historical sparkline + dashed prediction line
 *  - Timeframe chips (1D → 1Y)
 *  - Confidence stars (1-5)
 *  - Optional text note & opt-in geolocation
 *  - Saves to Pinia store (persisted in localStorage)
 *
 * Design.md principles:
 *  - All colors from CSS variables (--piw-* scoped overrides)
 *  - Border-radius morphs with confidence (more confident = rounder)
 *  - Drag speed/animation rate tied to recent price volatility (props.volatility)
 *  - Color saturation of prediction scales with magnitude
 */
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { usePredictionsStore, computeTargetDate } from '@/stores/predictions'
import type { Prediction } from '@/stores/predictions'

// ── Props ───────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  assetId?:     string
  assetName?:   string
  currentPrice?: number
  priceHistory?: number[]   // recent prices for sparkline (oldest→newest)
  userId?:      string
  maxRangePct?: number      // max drag = this % change (default 30%)
  volatility?:  number      // 0-1; drives animation speed (Design.md)
  compact?:     boolean     // hide chart + history, just drag + submit
}>(), {
  assetId:      'BTC',
  assetName:    'Bitcoin',
  currentPrice:  45230,
  priceHistory:  () => [42100, 43500, 44200, 43800, 44600, 45000, 45230],
  userId:        'current_user',
  maxRangePct:   30,
  volatility:    0.3,
  compact:       false,
})

const emit = defineEmits<{
  'prediction-recorded': [p: Prediction]
}>()

// ── Store ───────────────────────────────────────────────────────────────────
const store = usePredictionsStore()
if (!store.initialized) store.init()
store.seedFromFile()

// ── Widget state ─────────────────────────────────────────────────────────────
const expanded    = ref(!props.compact)
const showNote    = ref(false)
const useLocation = ref(false)
const noteText    = ref('')
const selectedTf  = ref('1W')
const confidence  = ref(3)     // 1-5 stars
const justSaved   = ref(false) // brief success flash

// ── Drag mechanics ───────────────────────────────────────────────────────────
const TRACK_H = 180   // px — total visible track height
const HALF_H  = TRACK_H / 2   // 90px
const THUMB_H = 46    // px

const dragY    = ref(0)  // -HALF_H..+HALF_H; positive = up = bullish
const dragging = ref(false)
let startClientY  = 0
let startDragY    = 0

function clampDragY(v: number) { return Math.max(-HALF_H, Math.min(HALF_H, v)) }

function onThumbMouseDown(e: MouseEvent) {
  e.preventDefault()
  dragging.value = true
  startClientY = e.clientY
  startDragY   = dragY.value
  document.addEventListener('mousemove', onDocMouseMove)
  document.addEventListener('mouseup',   onDocMouseUp)
}

function onDocMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const delta = startClientY - e.clientY   // up = positive
  dragY.value = clampDragY(startDragY + delta)
}

function onDocMouseUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onDocMouseMove)
  document.removeEventListener('mouseup',   onDocMouseUp)
}

function onThumbTouchStart(e: TouchEvent) {
  e.preventDefault()
  const t = e.touches[0]
  if (!t) return
  dragging.value = true
  startClientY = t.clientY
  startDragY   = dragY.value
}

function onThumbTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!dragging.value) return
  const t = e.touches[0]
  if (!t) return
  const delta = startClientY - t.clientY
  dragY.value = clampDragY(startDragY + delta)
}

function onThumbTouchEnd() { dragging.value = false }

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDocMouseMove)
  document.removeEventListener('mouseup',   onDocMouseUp)
})

// ── Computed prediction values ────────────────────────────────────────────
const predictionPct = computed(() => (dragY.value / HALF_H) * props.maxRangePct)
const predictedPrice = computed(() => props.currentPrice * (1 + predictionPct.value / 100))

const direction = computed(() => {
  if (predictionPct.value > 0.1) return 'bullish'
  if (predictionPct.value < -0.1) return 'bearish'
  return 'neutral'
})

const dirIcon = computed(() => {
  if (direction.value === 'bullish') return '↑'
  if (direction.value === 'bearish') return '↓'
  return '↕'
})

// Design.md: saturation scales with magnitude
const dirColorVar = computed(() => {
  if (direction.value === 'bullish') return 'var(--piw-bull)'
  if (direction.value === 'bearish') return 'var(--piw-bear)'
  return 'var(--piw-neutral)'
})

// ── Drag thumb position ────────────────────────────────────────────────────
// thumbTop = 0 when dragY = +HALF_H (max up), TRACK_H-THUMB_H when dragY = -HALF_H
const thumbTop = computed(() => {
  return ((HALF_H - dragY.value) / TRACK_H) * (TRACK_H - THUMB_H)
})

// Track fill: grows from center toward thumb
const bullFillH = computed(() => Math.max(0, dragY.value))
const bearFillH = computed(() => Math.max(0, -dragY.value))

// Design.md: border-radius morphs with confidence (more confident = rounder)
const widgetRadius = computed(() => {
  const r = 4 + (confidence.value - 1) * 3   // 4px → 16px
  return `${r}px`
})

// Design.md: animation speed driven by volatility
const pulseSpeed = computed(() => {
  const ms = 4000 - props.volatility * 3000   // 1000ms (high vol) → 4000ms (low vol)
  return `${Math.max(1000, ms)}ms`
})

// ── SVG Chart continuation ────────────────────────────────────────────────
const SVG_W = 200
const SVG_H = 60
const HIST_END_X = 140   // 70% of SVG_W

const chartData = computed(() => {
  const history = [...props.priceHistory]
  if (history.length < 2) return null

  // Include predicted price in range calculation for full scale
  const allPrices = [...history, predictedPrice.value]
  const minP = Math.min(...allPrices) * 0.97
  const maxP = Math.max(...allPrices) * 1.03
  const range = maxP - minP || 1
  const PAD_Y = 6  // vertical padding inside SVG

  function toY(price: number) {
    return SVG_H - PAD_Y - ((price - minP) / range) * (SVG_H - PAD_Y * 2)
  }

  // Historical polyline points (x: 0 → HIST_END_X)
  const histPts = history.map((p, i) => ({
    x: (i / (history.length - 1)) * HIST_END_X,
    y: toY(p),
  }))

  const lastPt = histPts[histPts.length - 1]!

  // Prediction endpoint (x: SVG_W, y: based on predictedPrice)
  const predPt = { x: SVG_W, y: toY(predictedPrice.value) }

  // Convert to SVG polyline string
  const histStr  = histPts.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')

  // Area fill under historical line (close to bottom)
  const areaStr = `${histStr} ${HIST_END_X},${SVG_H} 0,${SVG_H}`

  return { histStr, areaStr, lastPt, predPt }
})

const predLineColor = computed(() => {
  if (direction.value === 'bullish') return 'var(--piw-bull)'
  if (direction.value === 'bearish') return 'var(--piw-bear)'
  return 'var(--piw-neutral)'
})

// ── Timeframes ────────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { id: '1D', label: '1D', days: 1 },
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 182 },
  { id: '1Y', label: '1Y', days: 365 },
]

const targetDateDisplay = computed(() => {
  const d = new Date()
  const tf = TIMEFRAMES.find(t => t.id === selectedTf.value)
  if (!tf) return ''
  d.setDate(d.getDate() + tf.days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

// ── Geolocation ────────────────────────────────────────────────────────────
async function getLocation(): Promise<{ lat: number, lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 4000 }
    )
  })
}

// ── Past predictions for this asset ───────────────────────────────────────
const pastPredictions = computed(() =>
  store.recentByAsset(props.userId, props.assetId, 4)
)

// ── Record intuition ──────────────────────────────────────────────────────
const canRecord = computed(() => direction.value !== 'neutral')

async function recordIntuition() {
  if (!canRecord.value) return

  let lat: number | undefined
  let lng: number | undefined
  if (useLocation.value) {
    const loc = await getLocation()
    if (loc) { lat = loc.lat; lng = loc.lng }
  }

  const prediction = store.addPrediction({
    userId:             props.userId,
    assetId:            props.assetId,
    assetName:          props.assetName,
    timestamp:          new Date().toISOString(),
    latitude:           lat,
    longitude:          lng,
    currentPrice:       props.currentPrice,
    predictedPrice:     Math.round(predictedPrice.value * 100) / 100,
    predictedChangePct: Math.round(predictionPct.value * 10) / 10,
    direction:          direction.value,
    timeframe:          selectedTf.value,
    confidence:         confidence.value,
    note:               noteText.value.trim(),
  })

  emit('prediction-recorded', prediction)

  // Brief success flash
  justSaved.value = true
  setTimeout(() => { justSaved.value = false }, 2500)

  // Reset drag to neutral
  dragY.value = 0
  noteText.value = ''
}

// ── Formatters ────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (p >= 1)    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusIcon(s: string) {
  if (s === 'accurate') return '✓'
  if (s === 'missed')   return '✗'
  if (s === 'expired')  return '⊘'
  return '⏳'
}

function statusColor(s: string) {
  if (s === 'accurate') return 'var(--piw-bull)'
  if (s === 'missed')   return 'var(--piw-bear)'
  return 'var(--piw-neutral)'
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
    <!-- ══════════════════════════════════════════════
         Header
    ══════════════════════════════════════════════ -->
    <div class="piw-header" @click="expanded = !expanded">
      <span class="piw-header-icon">🎯</span>
      <span class="piw-header-title">Price Intuition</span>
      <span class="piw-asset-badge">{{ assetId }}</span>
      <span class="piw-expand-icon">{{ expanded ? '▲' : '▾' }}</span>
    </div>

    <!-- ══════════════════════════════════════════════
         Body (collapsible)
    ══════════════════════════════════════════════ -->
    <Transition name="piw-body">
    <div v-if="expanded" class="piw-body">

      <!-- ── Chart continuation SVG ── -->
      <div v-if="!compact && chartData" class="piw-chart-wrap">
        <svg
          :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
          preserveAspectRatio="none"
          class="piw-chart-svg"
        >
          <defs>
            <!-- Gradient under historical line -->
            <linearGradient id="piw-hist-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--piw-hist-line)" stop-opacity="0.15" />
              <stop offset="100%" stop-color="var(--piw-hist-line)" stop-opacity="0" />
            </linearGradient>
            <!-- Gradient under prediction line -->
            <linearGradient :id="`piw-pred-fill-${assetId}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="predLineColor" stop-opacity="0.12" />
              <stop offset="100%" :stop-color="predLineColor" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Historical area fill -->
          <polygon :points="chartData.areaStr" fill="url(#piw-hist-fill)" />

          <!-- Historical line -->
          <polyline
            :points="chartData.histStr"
            fill="none"
            stroke="var(--piw-hist-line)"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Vertical divider at HIST_END_X -->
          <line
            :x1="HIST_END_X" y1="0"
            :x2="HIST_END_X" :y2="SVG_H"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="1"
            stroke-dasharray="2 3"
          />

          <!-- Prediction continuation line (dashed) -->
          <line
            :x1="chartData.lastPt.x" :y1="chartData.lastPt.y"
            :x2="chartData.predPt.x" :y2="chartData.predPt.y"
            :stroke="predLineColor"
            stroke-width="1.8"
            stroke-dasharray="5 3"
            stroke-linecap="round"
            class="piw-pred-line"
          />

          <!-- Prediction endpoint (pulsing) -->
          <circle
            v-if="direction !== 'neutral'"
            :cx="chartData.predPt.x"
            :cy="chartData.predPt.y"
            r="3.5"
            :fill="predLineColor"
            class="piw-pred-dot"
          />
          <circle
            v-if="direction !== 'neutral'"
            :cx="chartData.predPt.x"
            :cy="chartData.predPt.y"
            r="3.5"
            :fill="predLineColor"
            opacity="0.3"
            class="piw-pred-dot-ring"
          />

          <!-- Current price marker -->
          <circle
            :cx="chartData.lastPt.x"
            :cy="chartData.lastPt.y"
            r="2.5"
            fill="var(--piw-hist-line)"
          />
        </svg>

        <!-- Chart labels -->
        <div class="piw-chart-labels">
          <span class="piw-chart-lbl hist">Historical</span>
          <span class="piw-chart-lbl pred" :style="{ color: predLineColor }">→ Prediction</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════
           Main drag zone + price display
      ══════════════════════════════════════════ -->
      <div class="piw-main-zone">

        <!-- Live price column (left) -->
        <div class="piw-price-col">
          <span class="piw-curr-lbl">Now</span>
          <span class="piw-curr-price">${{ fmtPrice(currentPrice) }}</span>

          <div class="piw-arrow-indicator" :style="{ color: dirColorVar }">
            {{ dirIcon }}
          </div>

          <span
            class="piw-pred-pct"
            :class="direction"
            :style="{ color: dirColorVar }"
          >
            {{ predictionPct >= 0 ? '+' : '' }}{{ predictionPct.toFixed(1) }}%
          </span>
          <span class="piw-pred-price" :style="{ color: dirColorVar }">
            ${{ fmtPrice(predictedPrice) }}
          </span>
        </div>

        <!-- Drag track (center) -->
        <div class="piw-track-wrap">

          <!-- Top label -->
          <div class="piw-track-lbl top">
            <span class="piw-track-hint">BULLISH</span>
          </div>

          <!-- The track -->
          <div class="piw-track">
            <!-- Center mark -->
            <div class="piw-center-line" />

            <!-- Bull fill: grows from center upward -->
            <div
              class="piw-fill bull"
              :style="{ height: bullFillH + 'px' }"
            />

            <!-- Bear fill: grows from center downward -->
            <div
              class="piw-fill bear"
              :style="{ height: bearFillH + 'px' }"
            />

            <!-- Drag thumb -->
            <div
              class="piw-thumb"
              :class="[direction, { dragging }]"
              :style="{ top: thumbTop + 'px', color: dirColorVar, borderColor: dirColorVar }"
              @mousedown="onThumbMouseDown"
              @touchstart.prevent="onThumbTouchStart"
              @touchmove.prevent="onThumbTouchMove"
              @touchend="onThumbTouchEnd"
            >
              <span class="piw-thumb-arrow">{{ dirIcon }}</span>
              <span class="piw-thumb-hint">drag</span>
            </div>
          </div>

          <!-- Bottom label -->
          <div class="piw-track-lbl bottom">
            <span class="piw-track-hint">BEARISH</span>
          </div>
        </div>

        <!-- Target date column (right) -->
        <div class="piw-date-col">
          <span class="piw-date-lbl">Target date</span>
          <span class="piw-date-val">{{ targetDateDisplay }}</span>
          <span class="piw-date-tf">{{ selectedTf }}</span>
        </div>

      </div>

      <!-- ══════════════════════════════════════════
           Timeframe selector
      ══════════════════════════════════════════ -->
      <div class="piw-tf-row">
        <button
          v-for="tf in TIMEFRAMES"
          :key="tf.id"
          class="piw-tf-btn"
          :class="{ active: selectedTf === tf.id }"
          @click="selectedTf = tf.id"
        >{{ tf.label }}</button>
      </div>

      <!-- ══════════════════════════════════════════
           Confidence stars + options
      ══════════════════════════════════════════ -->
      <div class="piw-options-row">
        <!-- Confidence stars -->
        <div class="piw-confidence">
          <span class="piw-conf-lbl">Confidence</span>
          <div class="piw-stars">
            <button
              v-for="i in 5"
              :key="i"
              class="piw-star"
              :class="{ active: i <= confidence }"
              @click="confidence = i"
            >★</button>
          </div>
        </div>

        <!-- Toggles -->
        <div class="piw-toggles">
          <!-- Note toggle -->
          <button
            class="piw-toggle-btn"
            :class="{ active: showNote }"
            @click="showNote = !showNote"
            title="Add note"
          >📝</button>

          <!-- Location toggle -->
          <button
            class="piw-toggle-btn"
            :class="{ active: useLocation }"
            @click="useLocation = !useLocation"
            title="Include location"
          >📍</button>
        </div>
      </div>

      <!-- Note field (optional) -->
      <Transition name="piw-note">
        <textarea
          v-if="showNote"
          v-model="noteText"
          class="piw-note-input"
          placeholder="Why do you think this? (optional)"
          rows="2"
        />
      </Transition>

      <!-- Location opt-in notice -->
      <Transition name="piw-note">
        <div v-if="useLocation" class="piw-location-notice">
          📍 Your location will be stored with this prediction for geographic analysis.
        </div>
      </Transition>

      <!-- ══════════════════════════════════════════
           Record button
      ══════════════════════════════════════════ -->
      <button
        class="piw-record-btn"
        :class="{ disabled: !canRecord, saved: justSaved }"
        :disabled="!canRecord"
        @click="recordIntuition"
      >
        <span v-if="justSaved" class="piw-save-ok">✓ Recorded!</span>
        <span v-else>
          {{ direction === 'neutral' ? 'Drag the thumb to predict' : `◈ Record ${direction === 'bullish' ? '↑' : '↓'} ${Math.abs(predictionPct).toFixed(1)}% Intuition →` }}
        </span>
      </button>

      <!-- ══════════════════════════════════════════
           Past predictions for this asset
      ══════════════════════════════════════════ -->
      <div v-if="!compact && pastPredictions.length" class="piw-history">
        <div class="piw-history-header">
          <span class="piw-history-lbl">Your past predictions</span>
          <span class="piw-history-asset">{{ assetId }}</span>
        </div>
        <div class="piw-pred-list">
          <div
            v-for="p in pastPredictions"
            :key="p.id"
            class="piw-pred-row"
          >
            <!-- Direction icon -->
            <span
              class="piw-pred-dir"
              :style="{ color: p.direction === 'bullish' ? 'var(--piw-bull)' : p.direction === 'bearish' ? 'var(--piw-bear)' : 'var(--piw-neutral)' }"
            >{{ p.direction === 'bullish' ? '↑' : p.direction === 'bearish' ? '↓' : '→' }}</span>

            <!-- Predicted change -->
            <span class="piw-pred-pct-hist">
              {{ p.predictedChangePct >= 0 ? '+' : '' }}{{ p.predictedChangePct.toFixed(1) }}%
            </span>

            <!-- Timeframe -->
            <span class="piw-pred-tf">{{ p.timeframe }}</span>

            <!-- Date -->
            <span class="piw-pred-date">{{ fmtDate(p.timestamp) }}</span>

            <!-- Status -->
            <span
              class="piw-pred-status"
              :style="{ color: statusColor(p.status) }"
            >
              {{ statusIcon(p.status) }}
              <span v-if="p.accuracyScore !== undefined" class="piw-pred-score">{{ p.accuracyScore }}%</span>
              <span v-else-if="p.status === 'pending'" class="piw-pred-target">→ {{ fmtDate(p.targetDate) }}</span>
            </span>
          </div>
        </div>
      </div>

    </div><!-- end piw-body -->
    </Transition>

  </div><!-- end piw -->
</template>

<style scoped>
/* ══════════════════════════════════════════════════════
   Widget-scoped CSS variables — all inherit from master CSS.
   Override any of these --piw-* vars on the host element
   to retheme the widget independently.
══════════════════════════════════════════════════════ */
.piw {
  /* Inherit from master CSS; override here for widget-specific values */
  --piw-bull:       var(--success-green, #00ff88);
  --piw-bear:       var(--error-red, #ff4444);
  --piw-neutral:    var(--text-gray, #888888);
  --piw-hist-line:  var(--text-light-gray, #cccccc);
  --piw-bg:         var(--bg-secondary, #2a2a2a);
  --piw-border:     var(--border-primary, #333333);
  --piw-text:       var(--text-white, #ffffff);
  --piw-text-dim:   var(--text-gray, #888888);
  --piw-radius:     var(--radius-lg, 12px);  /* overridden dynamically by confidence */
  --piw-pulse-speed: 3s;                      /* overridden by volatility prop */
  --piw-thumb-size: 46px;
  --piw-track-h:    180px;
  --piw-track-w:    5px;
  --piw-transition: var(--transition-fast, 0.2s ease);

  /* Layout */
  display: flex;
  flex-direction: column;
  background: var(--piw-bg);
  border: 1px solid var(--piw-border);
  border-radius: var(--piw-radius);
  overflow: hidden;
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  color: var(--piw-text);
  transition: border-radius var(--piw-transition);
}

/* ── Header ── */
.piw-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid var(--piw-border);
  cursor: pointer;
  user-select: none;
  transition: background var(--piw-transition);
}

.piw-header:hover { background: rgba(255,255,255,0.04); }

.piw-header-icon { font-size: 0.9rem; }

.piw-header-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.piw-asset-badge {
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--piw-border);
}

.piw-expand-icon {
  font-size: 0.55rem;
  color: var(--piw-text-dim);
}

/* ── Body collapse transition ── */
.piw-body-enter-active,
.piw-body-leave-active { transition: all 0.25s ease; }
.piw-body-enter-from,
.piw-body-leave-to { opacity: 0; transform: translateY(-6px); }

.piw-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

/* ── Chart ── */
.piw-chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.piw-chart-svg {
  width: 100%;
  height: 60px;
  display: block;
  border-radius: var(--radius-sm);
  overflow: visible;
}

.piw-pred-line {
  transition: all 0.12s ease;
}

/* Pulsing prediction endpoint */
@keyframes piw-dot-pulse {
  0%, 100% { r: 3.5; opacity: 1; }
  50%       { r: 6;   opacity: 0.4; }
}
.piw-pred-dot {
  animation: piw-dot-pulse var(--piw-pulse-speed) ease infinite;
}
.piw-pred-dot-ring {
  animation: piw-dot-pulse var(--piw-pulse-speed) ease infinite;
  animation-delay: calc(var(--piw-pulse-speed) * -0.5);
}

.piw-chart-labels {
  display: flex;
  justify-content: space-between;
}
.piw-chart-lbl {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--piw-text-dim);
}
.piw-chart-lbl.pred { transition: color 0.15s ease; }

/* ── Main zone (drag + prices) ── */
.piw-main-zone {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

/* Left: price column */
.piw-price-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.piw-curr-lbl {
  font-size: 0.52rem;
  color: var(--piw-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.piw-curr-price {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--piw-text);
}

.piw-arrow-indicator {
  font-size: 1.4rem;
  font-weight: 900;
  line-height: 1;
  transition: color 0.12s ease;
  margin: 2px 0;
}

.piw-pred-pct {
  font-size: 1rem;
  font-weight: 900;
  transition: color 0.12s ease;
  line-height: 1;
}

.piw-pred-price {
  font-size: 0.72rem;
  font-weight: 700;
  transition: color 0.12s ease;
}

/* Center: drag track */
.piw-track-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.piw-track-lbl {
  font-size: 0.48rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.piw-track-lbl.top  { color: var(--piw-bull); }
.piw-track-lbl.bottom { color: var(--piw-bear); }
.piw-track-hint { opacity: 0.7; }

.piw-track {
  position: relative;
  width: var(--piw-track-w);
  height: var(--piw-track-h);
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  flex-shrink: 0;
}

.piw-center-line {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 1px;
  background: rgba(255,255,255,0.25);
  pointer-events: none;
}

/* Fill bars (grow from center) */
.piw-fill {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: var(--piw-track-w);
  border-radius: 999px;
  transition: height 0.06s linear;
  pointer-events: none;
}
.piw-fill.bull {
  bottom: 50%;
  background: var(--piw-bull);
}
.piw-fill.bear {
  top: 50%;
  background: var(--piw-bear);
}

/* Drag thumb */
.piw-thumb {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: var(--piw-thumb-size);
  height: var(--piw-thumb-size);
  border-radius: 50%;
  border: 2px solid var(--piw-neutral);
  background: var(--piw-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: border-color 0.12s ease, transform 0.08s ease, box-shadow 0.12s ease;
  gap: 0;
  z-index: 2;
}

.piw-thumb:hover {
  transform: translateX(-50%) scale(1.06);
}

.piw-thumb.dragging {
  cursor: grabbing;
  transform: translateX(-50%) scale(1.12);
  box-shadow: 0 0 16px rgba(255,255,255,0.15);
}

.piw-thumb.bullish {
  background: rgba(0,255,136,0.08);
  animation: piw-thumb-glow-bull var(--piw-pulse-speed) ease infinite;
}

.piw-thumb.bearish {
  background: rgba(255,68,68,0.08);
  animation: piw-thumb-glow-bear var(--piw-pulse-speed) ease infinite;
}

@keyframes piw-thumb-glow-bull {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(0,255,136,0); }
}

@keyframes piw-thumb-glow-bear {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(255,68,68,0); }
}

.piw-thumb-arrow {
  font-size: 1.1rem;
  font-weight: 900;
  line-height: 1;
  transition: all 0.12s ease;
}

.piw-thumb-hint {
  font-size: 0.38rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
  color: inherit;
}

/* Right: date column */
.piw-date-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.piw-date-lbl {
  font-size: 0.52rem;
  color: var(--piw-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.piw-date-val {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--piw-text);
  line-height: 1.2;
}

.piw-date-tf {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--border-accent, var(--piw-bull));
  background: rgba(0,255,136,0.08);
  border-radius: 999px;
  padding: 1px 8px;
}

/* ── Timeframe chips ── */
.piw-tf-row {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.piw-tf-btn {
  flex: 1;
  padding: 5px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--piw-border);
  background: transparent;
  color: var(--piw-text-dim);
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}

.piw-tf-btn:hover { background: rgba(255,255,255,0.06); color: var(--piw-text); }
.piw-tf-btn.active {
  border-color: var(--border-accent, var(--piw-bull));
  background: rgba(0,255,136,0.1);
  color: var(--piw-bull);
}

/* ── Options row ── */
.piw-options-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.piw-confidence { display: flex; align-items: center; gap: 8px; }

.piw-conf-lbl {
  font-size: 0.6rem;
  color: var(--piw-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.piw-stars { display: flex; gap: 2px; }

.piw-star {
  font-size: 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--piw-border);
  transition: all 0.1s ease;
  padding: 0 1px;
  font-family: inherit;
}

.piw-star.active { color: #ffd700; }
.piw-star:hover  { transform: scale(1.2); }

/* Toggles */
.piw-toggles { display: flex; gap: 4px; }

.piw-toggle-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--piw-border);
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.piw-toggle-btn:hover { background: rgba(255,255,255,0.08); }
.piw-toggle-btn.active {
  border-color: var(--border-accent);
  background: rgba(0,255,136,0.1);
}

/* Note / location notice transitions */
.piw-note-enter-active,
.piw-note-leave-active { transition: all 0.2s ease; }
.piw-note-enter-from,
.piw-note-leave-to { opacity: 0; transform: translateY(-4px); max-height: 0; }
.piw-note-enter-to,
.piw-note-leave-from { max-height: 80px; }

.piw-note-input {
  width: 100%;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--piw-border);
  border-radius: var(--radius-sm);
  color: var(--piw-text);
  font-size: 0.72rem;
  padding: 8px 10px;
  resize: none;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--piw-transition);
}
.piw-note-input:focus { border-color: var(--border-accent); }
.piw-note-input::placeholder { color: var(--piw-text-dim); }

.piw-location-notice {
  font-size: 0.58rem;
  color: var(--piw-text-dim);
  padding: 6px 10px;
  background: rgba(255,255,136,0.04);
  border: 1px solid rgba(255,220,0,0.15);
  border-radius: var(--radius-sm);
}

/* ── Record button ── */
.piw-record-btn {
  width: 100%;
  padding: 12px;
  border-radius: var(--piw-radius);
  border: 1px solid rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.1);
  color: var(--piw-bull);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  letter-spacing: 0.02em;
}

.piw-record-btn:not(.disabled):hover {
  background: rgba(0,255,136,0.18);
  border-color: rgba(0,255,136,0.5);
  box-shadow: 0 0 12px rgba(0,255,136,0.15);
}

.piw-record-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
  color: var(--piw-text-dim);
  background: transparent;
  border-color: var(--piw-border);
}

.piw-record-btn.saved {
  background: rgba(0,255,136,0.2);
  border-color: var(--piw-bull);
  color: var(--piw-bull);
}

.piw-save-ok { font-size: 0.78rem; }

/* ── Past predictions ── */
.piw-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.piw-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.piw-history-lbl {
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--piw-text-dim);
}

.piw-history-asset {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--piw-text-dim);
}

.piw-pred-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.piw-pred-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0,0,0,0.15);
  border-radius: var(--radius-sm);
  border: 1px solid var(--piw-border);
  font-size: 0.65rem;
}

.piw-pred-dir   { font-size: 0.85rem; font-weight: 900; flex-shrink: 0; }
.piw-pred-pct-hist  { font-weight: 700; min-width: 42px; }
.piw-pred-tf    { color: var(--piw-text-dim); min-width: 24px; }
.piw-pred-date  { color: var(--piw-text-dim); flex: 1; font-size: 0.58rem; }
.piw-pred-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  flex-shrink: 0;
}
.piw-pred-score {
  font-size: 0.55rem;
  background: rgba(255,255,255,0.06);
  padding: 1px 4px;
  border-radius: 999px;
}
.piw-pred-target {
  font-size: 0.52rem;
  color: var(--piw-text-dim);
}
</style>
