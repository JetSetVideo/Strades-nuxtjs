<script setup lang="ts">
/**
 * PredictPanel — the large "record your call" chart.
 *
 * Pick a horizon (1D … 1Y), or drag either end of the date axis: the chart
 * shows that much future, and the past beside it. Crossing into another
 * horizon highlights that button. Dragging the price axis sets the vertical
 * window. Tap or drag in the future zone: x is the target date, y the price.
 * On the price list the first click closes the card; the call stays on its mini chart.
 *
 * Offered price range: the largest rise / fall over the same length of time in
 * the past, never less than 3 σ of the expected move, and it grows when the
 * pointer is pushed against its top or bottom edge.
 *
 * Every call stores price, date and % move plus its context (range offered,
 * whether friends' calls were visible, chart style, simulated history…) and is
 * sent to the training buffer that shapes the user's trading profile.
 */
import { computed, ref } from 'vue'
import type { Asset } from '~/types/asset'
import { usePredictionsStore, type Prediction } from '~/stores/predictions'
import { useAppearanceStore } from '~/stores/appearance'
import { usePaperStore } from '~/stores/paper'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { useAssetSeries, chartNow } from '~/composables/useAssetSeries'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { friendProfile, targetTsOf } from '~/composables/useFriendPredictions'
import PredictChart from '~/components/Asset/PredictChart.vue'
import {
  HOUR, HORIZONS, horizonById, nearestHorizon, PAST_PER_HORIZON, predictionRange, priceKindOf, volIndexOf,
  fmtPrice, fmtPct, fmtTarget, fmtAxisPrice, fmtIn, snapTarget,
} from '~/utils/assetChart'
import { limitTone, priceApproach, sameAsset } from '~/utils/priceApproach'
import { dropStop, extendStops, pathPattern, PATTERN_COLOR, splitStops, userStops, type PathPattern } from '~/utils/predictionPath'

const props = withDefaults(defineProps<{
  asset: Asset
  changePct?: number
  userId?: string
  source?: 'card' | 'detail'
  height?: number
  /** friends' calls on this asset (drawn only when `revealFriends`) */
  friends?: Prediction[]
  revealFriends?: boolean
  /** view-transition-name for the chart (the card's mini chart morphs into it) */
  morphName?: string
}>(), { userId: 'current_user', source: 'card', height: 200, friends: () => [], revealFriends: false, morphName: undefined })

const emit = defineEmits<{ saved: [p: Prediction]; 'toggle-friends': [] }>()

const store = usePredictionsStore()
const appearance = useAppearanceStore()
const paper = usePaperStore()
const annotations = useAssetAnnotationsStore()
const tracker = useAgentTracker()
if (import.meta.client && !store.initialized) store.init()
if (import.meta.client && !annotations.hydrated) annotations.hydrateFromStorage()

const symbol = computed(() => props.asset.symbol)
const kind = computed(() => priceKindOf(props.asset))
const current = computed(() => Number(props.asset.current_price) || 0)

const mineAll = computed(() => store.predictions
  .filter(p => p.userId === props.userId && p.assetId === symbol.value)
  .sort((a, b) => targetTsOf(a) - targetTsOf(b)))
const minePending = computed(() => mineAll.value.filter(p => p.status === 'pending'))

// ── Horizon ─────────────────────────────────────────────────────────────────
const first = minePending.value[0]?.timeframe
const horizonId = ref(first && HORIZONS.some(h => h.id === first) ? first : '1W')
const H = computed(() => horizonById(horizonId.value))
const mineOn = (id: string) => minePending.value.find(p => p.timeframe === id) ?? null
const existing = computed(() => mineOn(H.value.id))

/** Hours of past and future, once the user has dragged an end of the date axis. */
const windowSpan = ref<{ pastH: number; futureH: number } | null>(null)
/** Exact price window, once the user has dragged an end of the price axis. */
const priceSpan = ref<{ min: number; max: number } | null>(null)
const pastHours = computed(() => windowSpan.value?.pastH ?? PAST_PER_HORIZON * H.value.hours)
const futureHours = computed(() => windowSpan.value?.futureH ?? H.value.hours)

function pickHorizon(id: string) {
  if (!HORIZONS.some(h => h.id === id)) return
  horizonId.value = id
  windowSpan.value = null
  priceSpan.value = null
  boost.value = 0
}

const MIN_HOURS = 6
const MAX_FUTURE = HORIZONS[HORIZONS.length - 1]!.hours * 1.2
const MAX_PAST = MAX_FUTURE * PAST_PER_HORIZON

function onWindow(edge: 'start' | 'end', t: number) {
  const n = now.value
  let pastH = pastHours.value
  let futureH = futureHours.value
  if (edge === 'start') pastH = (n - t) / HOUR
  else futureH = (t - n) / HOUR
  pastH = Math.min(MAX_PAST, Math.max(MIN_HOURS, pastH))
  futureH = Math.min(MAX_FUTURE, Math.max(MIN_HOURS, futureH))
  windowSpan.value = { pastH, futureH }
  const fit = nearestHorizon(futureH).id
  if (fit !== horizonId.value) horizonId.value = fit
}

function onScale(min: number, max: number) {
  const cur = current.value || 1
  const gap = Math.max(Math.abs(cur) * 0.008, 1e-6)
  let lo = Math.min(min, max)
  let hi = Math.max(min, max)
  if (hi - lo < gap) { const mid = (hi + lo) / 2; lo = mid - gap / 2; hi = mid + gap / 2 }
  if (cur >= hi) hi = cur + gap
  if (cur <= lo) lo = cur - gap
  priceSpan.value = { min: lo, max: hi }
}

// ── Window & data ───────────────────────────────────────────────────────────
const asset = computed(() => props.asset)
const changeRef = computed(() => props.changePct)
const historyHours = computed(() => {
  const h = pastHours.value
  const step = h < 72 ? 12 : h < 24 * 21 ? 24 : h < 24 * 180 ? 24 * 7 : 24 * 30
  return Math.ceil(h / step) * step
})
const win = computed(() => ({ start: chartNow.value - historyHours.value * HOUR, maxCandles: 64 }))
const { candles, now, realFrom, allSimulated } = useAssetSeries(asset, win, changeRef)

const t0 = computed(() => now.value - pastHours.value * HOUR)
const t1 = computed(() => now.value + futureHours.value * HOUR)

/** Grows when the pointer is pushed against the top / bottom of the offered range. */
const boost = ref(0)
const offered = computed(() => predictionRange(candles.value, futureHours.value, current.value, kind.value, {
  volIndex: volIndexOf(props.asset as any), boost: boost.value,
}))
const range = computed(() => priceSpan.value ?? offered.value)
const snapHours = computed(() => futureHours.value <= 24 ? 0.25 : futureHours.value <= 168 ? 1 : futureHours.value <= 720 ? 6 : 24)
const minLead = computed(() => Math.max(snapHours.value, futureHours.value * 0.02))

const trades = computed(() => paper.trades
  .filter(t => t.asset_symbol === symbol.value || t.asset_id === props.asset.id)
  .map(t => ({ t: Date.parse(t.timestamp), price: t.simulated_price, side: t.side })))

// ── Place on click. A later click, further right, extends the same call. ──
const preview = ref<{ t: number; price: number } | null>(null)

const aim = computed(() => {
  const p = preview.value
  if (!p) return null
  const end = existing.value ? userStops(existing.value).at(-1) : undefined
  if (end && p.t <= end.t) return null
  return end ? { t: p.t, price: p.price, fromT: end.t, fromPrice: end.price } : { t: p.t, price: p.price }
})
const shown = computed(() => aim.value ?? (existing.value ? { t: targetTsOf(existing.value), price: existing.value.predictedPrice } : null))
const aimPct = computed(() => shown.value && current.value ? (shown.value.price / current.value - 1) * 100 : 0)
const exactLabel = computed(() => {
  if (!shown.value) return ''
  const { exact } = snapTarget(shown.value.t, now.value, t1.value, 1000)
  if (exact) return `exactly ${exact.label === '1D' ? '1 day' : exact.label === '1W' ? '1 week' : exact.label === '1M' ? '1 month' : exact.label === '3M' ? '3 months' : exact.label === '6M' ? '6 months' : '1 year'}`
  return fmtIn(shown.value.t - now.value)
})

let lastBoost = 0
function pushRange(price: number) {
  const r = range.value
  const span = r.max - r.min
  const atEdge = price >= r.max - span * 0.01 || price <= r.min + span * 0.01
  if (atEdge && Date.now() - lastBoost > 180 && boost.value < 4) { boost.value = +(boost.value + 0.25).toFixed(2); lastBoost = Date.now() }
}

function onAim(t: number, price: number) {
  preview.value = { t, price }
  pushRange(price)
}
function onCommit(t: number, price: number) {
  preview.value = null
  place(t, price)
}

function roundPrice(v: number) {
  if (kind.value === 'probability') return Math.round(v * 10000) / 10000
  return Number(v.toPrecision(6))
}

function logCall(action: string, saved: Prediction, pattern: PathPattern) {
  const stops = userStops(saved)
  tracker.track('prediction_set', {
    component: 'PredictPanel',
    intent: action,
    asset_id: props.asset.id,
    symbol: symbol.value,
    asset_type: props.asset.type,
    horizon: saved.timeframe,
    horizon_hours: saved.horizonHours,
    target_ts: saved.targetTs,
    target_price: saved.predictedPrice,
    target_pct: saved.predictedChangePct,
    current_price: saved.currentPrice,
    range_min: saved.rangeMin,
    range_max: saved.rangeMax,
    range_position: saved.rangePosition,
    range_boost: boost.value,
    saw_friends_first: saved.sawFriendsFirst,
    friends_count: props.friends.length,
    revision: saved.revisions?.length ?? 0,
    stops: stops.length,
    pattern,
    path: stops.map(s => ({ t: s.t, price: s.price })),
    source: props.source,
  })
  try {
    useTracking().track('prediction_create', { payload: {
      id: saved.id, symbol: symbol.value, action, pattern,
      target_price: saved.predictedPrice, target_pct: saved.predictedChangePct,
      target_ts: saved.targetTs, horizon: saved.timeframe, stops: stops.length,
    } })
  } catch { /* offline / signed out: the local record stays */ }
}

function writeCall(prev: Prediction | null, stops: { t: number; price: number }[]): Prediction | null {
  const split = splitStops(stops)
  const cur = prev?.currentPrice || current.value
  if (!split || !(cur > 0)) return null
  const { end, legs } = split
  const nowMs = Date.now()
  const made = prev ? Date.parse(prev.timestamp) : nowMs
  const predicted = roundPrice(end.price)
  const pct = Math.round((predicted / cur - 1) * 10000) / 100
  const r = range.value
  const rangePosition = predicted >= cur
    ? (r.max > cur ? (predicted - cur) / (r.max - cur) : 0)
    : (r.min < cur ? -(cur - predicted) / (cur - r.min) : 0)
  return store.savePrediction({
    userId: props.userId,
    assetId: symbol.value,
    assetName: props.asset.name,
    timestamp: new Date(made).toISOString(),
    currentPrice: cur,
    predictedPrice: predicted,
    predictedChangePct: pct,
    direction: Math.abs(pct) < 0.05 ? 'neutral' : pct > 0 ? 'bullish' : 'bearish',
    timeframe: H.value.id,
    targetDate: new Date(end.t).toISOString(),
    targetTs: end.t,
    horizonHours: Math.round(((end.t - made) / HOUR) * 100) / 100,
    confidence: prev?.confidence ?? 3,
    note: prev?.note ?? '',
    legs,
    rangeMin: roundPrice(r.min),
    rangeMax: roundPrice(r.max),
    rangePosition: Math.round(rangePosition * 1000) / 1000,
    sawFriendsFirst: !!prev?.sawFriendsFirst || props.revealFriends,
    friendsCountAtRecord: prev?.friendsCountAtRecord ?? props.friends.length,
    source: props.source,
    assetType: props.asset.type,
    chartStyle: appearance.chartStyle,
    simulatedHistory: prev?.simulatedHistory ?? allSimulated.value,
  })
}

/** First click records the call. A later click counts only when it is further right. */
function place(t: number, price: number) {
  const prev = existing.value
  const stops = prev ? userStops(prev) : []
  const gap = stops.length ? snapHours.value * HOUR * 0.5 : 0
  const next = extendStops(stops, { t, price: roundPrice(price) }, gap)
  if (!next) return
  const saved = writeCall(prev, next)
  if (!saved) return
  logCall(stops.length ? 'extend' : 'place', saved, pathPattern(saved.currentPrice, next))
  if (!prev) emit('saved', saved)
}

function removeStop(p: Prediction, index: number) {
  const left = dropStop(userStops(p), index)
  if (!left.length) { removeCall(p); return }
  const saved = writeCall(p, left)
  if (saved) logCall('drop', saved, pathPattern(saved.currentPrice, left))
}

function removeCall(p: Prediction) {
  const stops = userStops(p)
  store.deletePrediction(p.id)
  preview.value = null
  tracker.track('prediction_set', {
    component: 'PredictPanel', intent: 'delete',
    asset_id: props.asset.id, symbol: symbol.value, horizon: p.timeframe,
    target_price: p.predictedPrice, target_pct: p.predictedChangePct,
    stops: stops.length, pattern: pathPattern(p.currentPrice, stops),
    path: stops.map(s => ({ t: s.t, price: s.price })),
  })
}

function armLimit(price: number) {
  const cur = current.value
  if (!(cur > 0)) return
  const target = roundPrice(price)
  const keys = [props.asset.id, symbol.value]
  const have = Object.values(annotations.triggersById).filter(t => t.status === 'armed' && sameAsset(t.asset_id, ...keys))
  if (have.some(t => Math.abs(t.target_price - target) <= Math.max(cur * 0.0015, 1e-6))) return
  const tone = limitTone(target, cur)
  const trig = annotations.addTrigger({
    asset_id: props.asset.id || symbol.value,
    kind: tone.role === 'limit' ? 'cross_above' : 'cross_below',
    target_price: target,
    current_price_at_creation: cur,
  })
  tracker.track('chart_annotation', {
    component: 'PredictPanel', intent: 'arm_limit', kind: 'level',
    asset_id: props.asset.id, symbol: symbol.value,
    role: tone.role, target_price: target, current_price: cur, id: trig.id,
  })
}

function removeLimit(id: string) {
  const t = annotations.triggersById[id]
  annotations.removeTrigger(id)
  if (!t) return
  tracker.track('chart_annotation', {
    component: 'PredictPanel', intent: 'remove_limit', kind: 'level',
    asset_id: props.asset.id, symbol: symbol.value,
    role: limitTone(t.target_price, current.value).role, target_price: t.target_price, id,
  })
}

// ── Lists ───────────────────────────────────────────────────────────────────
const mineShown = computed(() => minePending.value.filter((p) => {
  const target = targetTsOf(p)
  if (!Number.isFinite(target)) return false
  const made = Date.parse(p.timestamp)
  const start = Number.isFinite(made) ? made : now.value
  return target >= t0.value && start <= t1.value
}))

/** Armed alerts on this asset. Yellow-orange above the price, red-orange below. The line fades in from the left. */
const chartLevels = computed(() => {
  const cur = current.value
  const keys = [props.asset.id, symbol.value]
  return Object.values(annotations.triggersById)
    .filter(t => t.status === 'armed' && sameAsset(t.asset_id, ...keys))
    .map((t) => {
      const tone = limitTone(t.target_price, cur)
      const ap = priceApproach(t.current_price_at_creation, t.target_price, cur, Date.now() - t.created_at)
      return {
        id: t.id, price: t.target_price, color: tone.color, ink: tone.ink, hot: ap.closing, fade: true,
        label: `${tone.role === 'limit' ? 'L' : 'S'} ${fmtAxisPrice(t.target_price, kind.value)}`,
      }
    })
})
const armedHere = computed(() => {
  const keys = [props.asset.id, symbol.value]
  return Object.values(annotations.triggersById)
    .filter(t => t.status === 'armed' && sameAsset(t.asset_id, ...keys))
    .sort((a, b) => a.target_price - b.target_price)
})
const friendsShown = computed(() => props.revealFriends ? props.friends : [])
const friendsList = computed(() => [...friendsShown.value].sort((a, b) => targetTsOf(a) - targetTsOf(b)))
const consensus = computed(() => {
  const f = friendsShown.value.filter(p => p.status === 'pending')
  if (!f.length) return null
  const bull = f.filter(p => p.predictedChangePct > 0).length
  return { n: f.length, bullPct: Math.round((bull / f.length) * 100), avg: f.reduce((s, p) => s + p.predictedChangePct, 0) / f.length }
})

const pastLabel = computed(() => {
  const h = pastHours.value
  if (h < 24 * 3) return `${Math.round(h)} h`
  if (h < 24 * 60) return `${Math.round(h / 24)} days`
  return `${Math.round(h / 730)} months`
})

const yoursCount = computed(() => mineAll.value.length + armedHere.value.length)
const friendFaces = computed(() => {
  const seen = new Map<string, ReturnType<typeof friendProfile>>()
  for (const p of [...props.friends].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    if (!seen.has(p.userId)) seen.set(p.userId, friendProfile(p.userId))
  }
  return [...seen.values()]
})
function patternOf(p: Prediction): PathPattern {
  return pathPattern(p.currentPrice, userStops(p))
}
function stepDir(p: Prediction, index: number): 'up' | 'down' {
  const stops = userStops(p)
  const prev = index === 0 ? p.currentPrice : stops[index - 1]!.price
  return (stops[index]?.price ?? prev) >= prev ? 'up' : 'down'
}
const STATUS_ICON: Record<string, string> = { pending: '⏳', accurate: '✓', missed: '✗', expired: '⏱' }
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="pp" @click.stop>
    <!-- Chart first so the card can park it in the mini chart's cell. Controls follow, under it. -->
    <div class="pp-chart">
    <ClientOnly>
      <PredictChart
        size="large"
        :height="height"
        :candles="candles"
        :t0="t0" :now="now" :t1="t1"
        :current="current"
        :kind="kind"
        :chart-style="appearance.chartStyle"
        :range="{ min: range.min, max: range.max }"
        :range-lock="!!priceSpan"
        :aim="aim"
        :mine="mineShown"
        :levels="chartLevels"
        :friends="friendsShown"
        :trades="trades"
        :real-from="realFrom"
        :snap-hours="snapHours"
        :min-lead-hours="minLead"
        :morph-name="morphName"
        :trend-pct="changePct ?? null"
        :label="`${asset.name} ${H.label} prediction chart`"
        :extending="!!existing"
        interactive
        @aim="onAim"
        @commit="onCommit"
        @limit="armLimit"
        @window="onWindow"
        @scale="onScale"
      />
      <template #fallback><div :style="{ height: `${height}px` }" /></template>
    </ClientOnly>
    </div>

    <div class="pp-rest">
    <div class="pp-bar">
      <div class="pp-horizons" role="group" aria-label="Prediction horizon">
        <button
          v-for="h in HORIZONS" :key="h.id" type="button"
          class="pp-h" :class="{ active: h.id === H.id, bull: mineOn(h.id) && mineOn(h.id)!.predictedChangePct >= 0, bear: mineOn(h.id) && mineOn(h.id)!.predictedChangePct < 0 }"
          :aria-pressed="h.id === H.id"
          @click="pickHorizon(h.id)"
        >{{ h.label }}<span v-if="mineOn(h.id)" class="pp-h-dir">{{ mineOn(h.id)!.predictedChangePct >= 0 ? '↑' : '↓' }}</span></button>
      </div>
      <div v-if="shown" class="pp-readout" :class="aimPct >= 0 ? 'up' : 'down'" aria-live="polite">
        <span class="pp-r-price">{{ fmtPrice(shown.price, kind, asset.currency || 'USD') }}</span>
        <span class="pp-r-pct">{{ fmtPct(aimPct, 2) }}</span>
        <span class="pp-r-date">{{ fmtTarget(shown.t, H.hours) }} · {{ exactLabel }}</span>
      </div>
    </div>

    <div class="pp-foot">
      <span class="pp-range">
        Range ({{ pastLabel }} of history{{ boost ? `, widened ×${(1 + boost).toFixed(2)}` : '' }}):
        <b class="down">{{ fmtAxisPrice(range.min, kind) }}</b> – <b class="up">{{ fmtAxisPrice(range.max, kind) }}</b>
      </span>
      <span v-if="allSimulated" class="pp-sim" title="No market history for this asset: the past is simulated">simulated history</span>
    </div>

    <!-- Individual predictions -->
    <div class="pp-list">
      <div class="pp-list-h"><span class="pp-k">Your calls</span><span class="pp-muted">{{ yoursCount || 'none yet' }}</span></div>
      <template v-for="p in mineAll" :key="p.id">
        <div
          class="pp-row" :class="{ current: p.id === existing?.id, done: p.status !== 'pending' }"
          role="button" tabindex="0"
          @click="pickHorizon(p.timeframe)" @keydown.enter="pickHorizon(p.timeframe)"
        >
          <svg class="pp-arrow" :style="{ color: PATTERN_COLOR[patternOf(p)] }" viewBox="0 0 14 14" aria-hidden="true">
            <path v-if="patternOf(p) === 'up'" d="M7 11 V3 M4 6 L7 3 L10 6" />
            <path v-else-if="patternOf(p) === 'down'" d="M7 3 V11 M4 8 L7 11 L10 8" />
            <path v-else-if="patternOf(p) === 'down-up'" d="M3 4 V9 M3 9 L5.2 7 M8 10 V4 M8 4 L10.2 6" />
            <path v-else-if="patternOf(p) === 'up-down'" d="M3 10 V5 M3 5 L5.2 7 M8 4 V10 M8 10 L10.2 8" />
            <path v-else d="M2 9 L5 5 L8 9 L12 4" />
          </svg>
          <span class="pp-tf">{{ p.timeframe }}</span>
          <span :class="p.predictedChangePct >= 0 ? 'up' : 'down'" class="pp-num">{{ fmtAxisPrice(p.predictedPrice, kind) }} {{ fmtPct(p.predictedChangePct) }}</span>
          <span class="pp-muted">by {{ fmtTarget(targetTsOf(p), horizonById(p.timeframe).hours) }}</span>
          <span class="pp-muted pp-made">made {{ shortDate(p.timestamp) }}<template v-if="userStops(p).length > 1"> · {{ userStops(p).length }} steps</template></span>
          <span class="pp-status" :title="p.status">{{ STATUS_ICON[p.status] ?? '' }}<template v-if="p.accuracyScore !== undefined"> {{ p.accuracyScore }}%</template></span>
          <button type="button" class="pp-x" :aria-label="`Delete ${p.timeframe} prediction`" @click.stop="removeCall(p)">✕</button>
        </div>
        <div
          v-for="(s, i) in userStops(p).length > 1 ? userStops(p) : []" :key="`${p.id}:${i}`"
          class="pp-row child"
        >
          <svg class="pp-arrow" :class="stepDir(p, i)" viewBox="0 0 14 14" aria-hidden="true">
            <path v-if="stepDir(p, i) === 'up'" d="M7 11 V3 M4 6 L7 3 L10 6" />
            <path v-else d="M7 3 V11 M4 8 L7 11 L10 8" />
          </svg>
          <span class="pp-num" :class="stepDir(p, i)">{{ fmtAxisPrice(s.price, kind) }}</span>
          <span class="pp-muted">by {{ fmtTarget(s.t, horizonById(p.timeframe).hours) }}</span>
          <button type="button" class="pp-x" :aria-label="`Delete step ${i + 1} of the ${p.timeframe} prediction`" @click.stop="removeStop(p, i)">✕</button>
        </div>
      </template>

      <template v-if="armedHere.length">
        <div v-for="t in armedHere" :key="t.id" class="pp-row limit">
          <span class="pp-swatch" :style="{ background: limitTone(t.target_price, current).color }" />
          <span class="pp-num" :style="{ color: limitTone(t.target_price, current).color }">{{ limitTone(t.target_price, current).role }} {{ fmtAxisPrice(t.target_price, kind) }}</span>
          <span class="pp-muted pp-made">from {{ fmtAxisPrice(t.current_price_at_creation, kind) }}</span>
          <button type="button" class="pp-x" :aria-label="`Delete ${limitTone(t.target_price, current).role} at ${fmtAxisPrice(t.target_price, kind)}`" @click.stop="removeLimit(t.id)">✕</button>
        </div>
      </template>

      <button
        v-if="friendFaces.length"
        type="button"
        class="pp-friends"
        :class="{ on: revealFriends }"
        :aria-pressed="revealFriends"
        :title="revealFriends ? 'Hide friends\' calls' : 'Show friends\' calls'"
        @click="emit('toggle-friends')"
      >
        <img v-for="f in friendFaces.slice(0, 4)" :key="f.id" :src="f.avatar" :alt="f.name" class="pp-face" />
        <span>{{ revealFriends ? 'Hide' : 'Show' }} {{ friendFaces.length }}</span>
      </button>
      <template v-if="revealFriends">
        <div v-if="consensus" class="pp-cons">
          <span class="pp-cons-bar"><i :style="{ width: consensus.bullPct + '%' }" /></span>
          <span class="up">{{ consensus.bullPct }}% up</span>
          <span class="pp-muted">avg {{ fmtPct(consensus.avg) }} · {{ consensus.n }} calls</span>
        </div>
        <div v-for="p in friendsList" :key="p.id" class="pp-row friend">
          <img :src="friendProfile(p.userId).avatar" :alt="friendProfile(p.userId).name" class="pp-av" />
          <span class="pp-fname">{{ friendProfile(p.userId).name }}</span>
          <span class="pp-tf">{{ p.timeframe }}</span>
          <span :class="p.predictedChangePct >= 0 ? 'up' : 'down'" class="pp-num">{{ fmtAxisPrice(p.predictedPrice, kind) }} {{ fmtPct(p.predictedChangePct) }}</span>
          <span class="pp-muted">by {{ fmtTarget(targetTsOf(p), horizonById(p.timeframe).hours) }}</span>
          <span v-if="p.note" class="pp-note" :title="p.note">“{{ p.note }}”</span>
        </div>
      </template>
    </div>
    </div>
  </div>
</template>

<style scoped>
.pp { display: flex; flex-direction: column; gap: 4px; min-width: 0; cursor: default; }
.pp-chart { min-width: 0; }
.pp-rest { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pp-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: space-between; min-height: 26px; }
.pp-horizons { display: flex; gap: 2px; }
.pp-h {
  display: inline-flex; align-items: center; gap: 2px;
  min-height: 26px; padding: 0 7px; border-radius: 6px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.12));
  background: transparent; color: var(--text-gray, #9aa0a6);
  font: 600 0.7rem/1 var(--font-market-data, inherit); cursor: pointer;
}
.pp-h:hover { color: var(--text-white, #fff); }
.pp-h.active { color: var(--text-white, #fff); border-color: rgba(255,255,255,.45); background: rgba(255,255,255,.08); }
.pp-h.bull { color: var(--app-color-up, #00ff88); border-color: color-mix(in srgb, var(--app-color-up, #00ff88) 45%, transparent); }
.pp-h.bear { color: var(--app-color-down, #ff4444); border-color: color-mix(in srgb, var(--app-color-down, #ff4444) 45%, transparent); }
.pp-h.active.bull { background: color-mix(in srgb, var(--app-color-up, #00ff88) 18%, transparent); }
.pp-h.active.bear { background: color-mix(in srgb, var(--app-color-down, #ff4444) 18%, transparent); }
.pp-h-dir { font-size: 0.65rem; }
.pp-readout {
  display: flex; align-items: center; gap: 6px; white-space: nowrap; height: 22px; overflow: hidden;
  font-family: var(--font-market-data, ui-monospace, monospace); font-variant-numeric: tabular-nums;
  font-size: 0.7rem; color: var(--text-light-gray, rgba(255,255,255,.75));
}
.pp-r-price { font-size: 0.92rem; line-height: 22px; font-weight: 800; color: var(--text-white, #fff); }
.pp-readout.up .pp-r-pct { color: var(--app-color-up, #00ff88); font-weight: 700; }
.pp-readout.down .pp-r-pct { color: var(--app-color-down, #ff4444); font-weight: 700; }
.pp-r-date { color: var(--text-gray, #9aa0a6); }

.pp-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.64rem; color: var(--text-gray, #9aa0a6); }
.pp-range b { font-family: var(--font-market-data, inherit); }
.up { color: var(--app-color-up, #00ff88); }
.down { color: var(--app-color-down, #ff4444); }
.pp-sim { padding: 0 5px; border: 1px dashed currentColor; border-radius: 999px; font-size: 0.58rem; text-transform: uppercase; letter-spacing: .04em; }

.pp-list { display: flex; flex-direction: column; gap: 2px; padding-top: 4px; border-top: 1px solid var(--border-primary, rgba(255,255,255,.08)); }
.pp-list-h { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
.pp-k { color: var(--text-light-gray, rgba(255,255,255,.7)); text-transform: uppercase; letter-spacing: .05em; font-size: 0.6rem; font-weight: 700; }
.pp-row {
  display: flex; align-items: center; gap: 2px 7px; flex-wrap: wrap; min-width: 0;
  padding: 3px 4px; border-radius: 6px; cursor: pointer; white-space: nowrap;
  font-size: 0.68rem; font-family: var(--font-market-data, inherit); font-variant-numeric: tabular-nums;
}
.pp-row:hover { background: rgba(255,255,255,.04); }
.pp-row.current { background: rgba(255,255,255,.06); }
.pp-row.done { opacity: .6; }
.pp-row.friend, .pp-row.child, .pp-row.limit { cursor: default; }
.pp-row.child { margin-left: 1.15rem; padding-left: 0.55rem; border-left: 2px solid rgba(255,255,255,.1); }
.pp-row.child .pp-x, .pp-row.limit .pp-x { margin-left: auto; }
.pp-arrow { width: 14px; height: 14px; flex: 0 0 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pp-arrow.up { color: var(--app-color-up, #00ff88); }
.pp-arrow.down { color: var(--app-color-down, #ff4444); }
.pp-swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 10px; }
.pp-tf { font-weight: 800; color: var(--text-white, #fff); min-width: 20px; }
.pp-num { font-weight: 700; }
.pp-made { margin-left: auto; }
.pp-status { min-width: 16px; text-align: center; }
.pp-x { min-width: 26px; min-height: 24px; border: 0; border-radius: 5px; background: transparent; color: var(--text-gray, #9aa0a6); cursor: pointer; }
.pp-x:hover { color: var(--app-color-down, #ff4444); background: rgba(255,68,68,.08); }
.pp-friends {
  align-self: flex-end; display: inline-flex; align-items: center;
  min-height: 26px; padding: 1px 8px 1px 2px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--border-primary, rgba(255,255,255,.14)); background: rgba(255,255,255,.03);
  color: var(--text-gray, #9aa0a6); font: 600 0.64rem/1 inherit;
}
.pp-friends.on { color: var(--text-white, #fff); border-color: rgba(120,170,255,.7); background: rgba(120,170,255,.12); }
.pp-face { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; margin-left: -5px; border: 1.5px solid #121214; background: #222; }
.pp-face:first-child { margin-left: 0; }
.pp-friends span { margin-left: 5px; }
.pp-cons { display: flex; align-items: center; gap: 6px; font-size: 0.66rem; padding: 0 4px; }
.pp-cons-bar { width: 70px; height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--app-color-down, #ff4444) 60%, transparent); overflow: hidden; }
.pp-cons-bar i { display: block; height: 100%; background: var(--app-color-up, #00ff88); }
.pp-av { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #222; }
.pp-fname { font-weight: 700; color: var(--text-white, #fff); font-family: var(--font-family-secondary, inherit); }
.pp-muted { color: var(--text-gray, #9aa0a6); font-size: 0.64rem; }
.pp-note { flex: 1 1 140px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,.55); font-family: var(--font-family-secondary, inherit); font-style: italic; }
</style>
