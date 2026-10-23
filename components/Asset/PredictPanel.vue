<script setup lang="ts">
/**
 * PredictPanel — the large "record your call" chart.
 *
 * Pick a horizon (1D … 1Y): the chart shows 1.5× that much past, and one
 * horizon of future on the right. Tap or drag in the future zone: x is the
 * target date, y the price (magnets at exactly 1 day / 1 week / … and at the
 * right edge). The point is a draft until "Save prediction" is pressed; on the
 * price list the card then closes back with the call drawn on its mini chart.
 *
 * Offered price range: the largest rise / fall over the same length of time in
 * the past, never less than 3 σ of the expected move, and it grows when the
 * pointer is pushed against its top or bottom edge.
 *
 * Every call stores price, date and % move plus its context (range offered,
 * whether friends' calls were visible, chart style, simulated history…) and is
 * sent to the training buffer that shapes the user's trading profile.
 */
import { computed, ref, watch } from 'vue'
import type { Asset } from '~/types/asset'
import { usePredictionsStore, type Prediction } from '~/stores/predictions'
import { useAppearanceStore } from '~/stores/appearance'
import { usePaperStore } from '~/stores/paper'
import { useAssetSeries, chartNow } from '~/composables/useAssetSeries'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { friendProfile, targetTsOf } from '~/composables/useFriendPredictions'
import PredictChart from '~/components/Asset/PredictChart.vue'
import {
  HOUR, HORIZONS, horizonById, PAST_PER_HORIZON, predictionRange, priceKindOf, volIndexOf,
  fmtPrice, fmtPct, fmtTarget, fmtAxisPrice, fmtIn, snapTarget,
} from '~/utils/assetChart'

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
const tracker = useAgentTracker()
if (import.meta.client && !store.initialized) store.init()

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

// ── Window & data ───────────────────────────────────────────────────────────
const asset = computed(() => props.asset)
const changeRef = computed(() => props.changePct)
const win = computed(() => ({ start: chartNow.value - PAST_PER_HORIZON * H.value.hours * HOUR, maxCandles: 48 }))
const { candles, now, realFrom, allSimulated } = useAssetSeries(asset, win, changeRef)

const t0 = computed(() => now.value - PAST_PER_HORIZON * H.value.hours * HOUR)
const t1 = computed(() => now.value + H.value.hours * HOUR)

/** Grows when the pointer is pushed against the top / bottom of the range. */
const boost = ref(0)
watch(() => H.value.id, () => { boost.value = 0 })
const range = computed(() => predictionRange(candles.value, H.value.hours, current.value, kind.value, {
  volIndex: volIndexOf(props.asset as any), boost: boost.value,
}))
const snapHours = computed(() => H.value.hours <= 24 ? 0.25 : H.value.hours <= 168 ? 1 : H.value.hours <= 720 ? 6 : 24)
const minLead = computed(() => Math.max(snapHours.value, H.value.hours * 0.02))

const trades = computed(() => paper.trades
  .filter(t => t.asset_symbol === symbol.value || t.asset_id === props.asset.id)
  .map(t => ({ t: Date.parse(t.timestamp), price: t.simulated_price, side: t.side })))

// ── Draft → save ────────────────────────────────────────────────────────────
const aim = ref<{ t: number; price: number } | null>(null)
const status = ref<'idle' | 'draft' | 'saved'>('idle')
function syncAim() {
  const e = existing.value
  aim.value = e ? { t: targetTsOf(e), price: e.predictedPrice } : null
  status.value = e ? 'saved' : 'idle'
}
watch(() => [H.value.id, existing.value?.id], syncAim, { immediate: true })

const aimPct = computed(() => aim.value && current.value ? (aim.value.price / current.value - 1) * 100 : 0)
const exactLabel = computed(() => {
  if (!aim.value) return ''
  const { exact } = snapTarget(aim.value.t, now.value, t1.value, 1000)
  if (exact) return `exactly ${exact.label === '1D' ? '1 day' : exact.label === '1W' ? '1 week' : exact.label === '1M' ? '1 month' : exact.label === '3M' ? '3 months' : exact.label === '6M' ? '6 months' : '1 year'}`
  return fmtIn(aim.value.t - now.value)
})

let lastBoost = 0
function pushRange(price: number) {
  const r = range.value
  const span = r.max - r.min
  const atEdge = price >= r.max - span * 0.01 || price <= r.min + span * 0.01
  if (atEdge && Date.now() - lastBoost > 180 && boost.value < 4) { boost.value = +(boost.value + 0.25).toFixed(2); lastBoost = Date.now() }
}

function onAim(t: number, price: number) {
  aim.value = { t, price }
  status.value = 'draft'
  pushRange(price)
}
function onCommit(t: number, price: number) {
  aim.value = { t, price }
  status.value = 'draft'
}

function roundPrice(v: number) {
  if (kind.value === 'probability') return Math.round(v * 10000) / 10000
  return Number(v.toPrecision(6))
}

function save() {
  if (!aim.value) return
  const { t, price } = aim.value
  const nowMs = Date.now()
  const cur = current.value
  if (!(cur > 0)) return
  const predicted = roundPrice(price)
  const pct = Math.round((predicted / cur - 1) * 10000) / 100
  const r = range.value
  const rangePosition = predicted >= cur
    ? (r.max > cur ? (predicted - cur) / (r.max - cur) : 0)
    : (r.min < cur ? -(cur - predicted) / (cur - r.min) : 0)
  const prev = existing.value
  const saved = store.savePrediction({
    userId: props.userId,
    assetId: symbol.value,
    assetName: props.asset.name,
    timestamp: new Date(nowMs).toISOString(),
    currentPrice: cur,
    predictedPrice: predicted,
    predictedChangePct: pct,
    direction: Math.abs(pct) < 0.05 ? 'neutral' : pct > 0 ? 'bullish' : 'bearish',
    timeframe: H.value.id,
    targetDate: new Date(t).toISOString(),
    targetTs: t,
    horizonHours: Math.round(((t - nowMs) / HOUR) * 100) / 100,
    confidence: prev?.confidence ?? 3,
    note: prev?.note ?? '',
    rangeMin: roundPrice(r.min),
    rangeMax: roundPrice(r.max),
    rangePosition: Math.round(rangePosition * 1000) / 1000,
    sawFriendsFirst: !!prev?.sawFriendsFirst || props.revealFriends,
    friendsCountAtRecord: props.friends.length,
    source: props.source,
    assetType: props.asset.type,
    chartStyle: appearance.chartStyle,
    simulatedHistory: allSimulated.value,
  })
  aim.value = { t, price: predicted }
  status.value = 'saved'
  // Training signal for the user's trading profile (personal agent) + activity log.
  tracker.track('prediction_set', {
    component: 'PredictPanel',
    asset_id: props.asset.id,
    symbol: symbol.value,
    asset_type: props.asset.type,
    horizon: H.value.id,
    horizon_hours: saved.horizonHours,
    target_ts: t,
    target_price: predicted,
    target_pct: pct,
    current_price: cur,
    range_min: saved.rangeMin,
    range_max: saved.rangeMax,
    range_position: saved.rangePosition,
    range_boost: boost.value,
    saw_friends_first: saved.sawFriendsFirst,
    friends_count: props.friends.length,
    revision: saved.revisions?.length ?? 0,
    source: props.source,
  })
  try {
    useTracking().track('prediction_create', { payload: { id: saved.id, symbol: symbol.value, target_price: predicted, target_pct: pct, target_ts: t, horizon: H.value.id } })
  } catch { /* offline / signed out: the local record stays */ }
  emit('saved', saved)
}

function discard() { syncAim() }

function removeCall(p: Prediction) {
  store.deletePrediction(p.id)
  if (p.id === existing.value?.id || p.timeframe === H.value.id) { aim.value = null; status.value = 'idle' }
}

// ── Lists ───────────────────────────────────────────────────────────────────
const mineShown = computed(() => minePending.value.filter(p => p.id !== existing.value?.id && targetTsOf(p) <= t1.value))
const friendsShown = computed(() => props.revealFriends ? props.friends : [])
const friendsList = computed(() => [...friendsShown.value].sort((a, b) => targetTsOf(a) - targetTsOf(b)))
const consensus = computed(() => {
  const f = friendsShown.value.filter(p => p.status === 'pending')
  if (!f.length) return null
  const bull = f.filter(p => p.predictedChangePct > 0).length
  return { n: f.length, bullPct: Math.round((bull / f.length) * 100), avg: f.reduce((s, p) => s + p.predictedChangePct, 0) / f.length }
})

const pastLabel = computed(() => {
  const h = PAST_PER_HORIZON * H.value.hours
  if (h < 24 * 3) return `${h} h`
  if (h < 24 * 60) return `${Math.round(h / 24)} days`
  return `${Math.round(h / 730)} months`
})
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
        :aim="aim"
        :mine="mineShown"
        :friends="friendsShown"
        :trades="trades"
        :real-from="realFrom"
        :snap-hours="snapHours"
        :min-lead-hours="minLead"
        :morph-name="morphName"
        :trend-pct="changePct ?? null"
        :label="`${asset.name} ${H.label} prediction chart`"
        interactive
        @aim="onAim"
        @commit="onCommit"
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
          @click="horizonId = h.id"
        >{{ h.label }}<span v-if="mineOn(h.id)" class="pp-h-dir">{{ mineOn(h.id)!.predictedChangePct >= 0 ? '↑' : '↓' }}</span></button>
      </div>
      <div v-if="aim" class="pp-readout" :class="aimPct >= 0 ? 'up' : 'down'" aria-live="polite">
        <span class="pp-r-price">{{ fmtPrice(aim.price, kind, asset.currency || 'USD') }}</span>
        <span class="pp-r-pct">{{ fmtPct(aimPct, 2) }}</span>
        <span class="pp-r-date">{{ fmtTarget(aim.t, H.hours) }} · {{ exactLabel }}</span>
      </div>
    </div>

    <!-- The place to register the call (and, on the list, to close back) -->
    <div class="pp-actions">
      <button
        type="button" class="pp-save" :class="[aimPct >= 0 ? 'up' : 'down', { done: status === 'saved' }]"
        :disabled="!aim || status === 'saved'"
        @click="save"
      >
        <template v-if="!aim">Save prediction</template>
        <template v-else-if="status === 'saved'">✓ Saved {{ H.label }} prediction</template>
        <template v-else>✓ {{ existing ? 'Update' : 'Save' }} prediction{{ source === 'card' ? ' & close' : '' }}</template>
      </button>
      <button v-if="status === 'draft'" type="button" class="pp-ghost" @click="discard">Undo</button>
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
      <div class="pp-list-h"><span class="pp-k">Your predictions</span><span class="pp-muted">{{ mineAll.length || 'none yet' }}</span></div>
      <div
        v-for="p in mineAll" :key="p.id" class="pp-row" :class="{ current: p.id === existing?.id, done: p.status !== 'pending' }"
        role="button" tabindex="0"
        @click="horizonId = p.timeframe" @keydown.enter="horizonId = p.timeframe"
      >
        <span class="pp-tf">{{ p.timeframe }}</span>
        <span :class="p.predictedChangePct >= 0 ? 'up' : 'down'" class="pp-num">{{ fmtAxisPrice(p.predictedPrice, kind) }} {{ fmtPct(p.predictedChangePct) }}</span>
        <span class="pp-muted">by {{ fmtTarget(targetTsOf(p), horizonById(p.timeframe).hours) }}</span>
        <span class="pp-muted pp-made">made {{ shortDate(p.timestamp) }}<template v-if="p.revisions?.length"> · moved {{ p.revisions.length }}×</template></span>
        <span class="pp-status" :title="p.status">{{ STATUS_ICON[p.status] ?? '' }}<template v-if="p.accuracyScore !== undefined"> {{ p.accuracyScore }}%</template></span>
        <button type="button" class="pp-x" :aria-label="`Delete ${p.timeframe} prediction`" @click.stop="removeCall(p)">✕</button>
      </div>

      <div class="pp-list-h">
        <span class="pp-k">Friends' predictions</span>
        <button v-if="friends.length" type="button" class="pp-link" @click="emit('toggle-friends')">{{ revealFriends ? 'Hide' : `Show ${friends.length}` }}</button>
        <span v-else class="pp-muted">none</span>
      </div>
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
      <div v-else-if="friends.length" class="pp-muted pp-hidden">Hidden until you ask, so your own call stays yours.</div>
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

.pp-actions { display: flex; gap: 6px; }
.pp-save {
  flex: 1; min-height: 38px; border-radius: 9px; border: 1px solid currentColor;
  font: 700 0.8rem/1 var(--font-family-secondary, inherit); cursor: pointer; letter-spacing: .01em;
}
.pp-save.up { color: #03130b; background: var(--app-color-up, #00ff88); border-color: transparent; }
.pp-save.down { color: #fff; background: var(--app-color-down, #ff4444); border-color: transparent; }
.pp-save:disabled { cursor: default; color: var(--text-gray, #9aa0a6); background: rgba(255,255,255,.04); border: 1px dashed var(--border-primary, rgba(255,255,255,.2)); }
.pp-save.done:disabled { color: var(--app-color-up, #00ff88); border: 1px solid color-mix(in srgb, var(--app-color-up, #00ff88) 40%, transparent); background: color-mix(in srgb, var(--app-color-up, #00ff88) 8%, transparent); }
.pp-ghost { min-height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--border-primary, rgba(255,255,255,.15)); background: transparent; color: var(--text-light-gray, rgba(255,255,255,.8)); cursor: pointer; font: 600 0.75rem/1 inherit; }

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
.pp-row.friend { cursor: default; }
.pp-tf { font-weight: 800; color: var(--text-white, #fff); min-width: 20px; }
.pp-num { font-weight: 700; }
.pp-made { margin-left: auto; }
.pp-status { min-width: 16px; text-align: center; }
.pp-x { min-width: 26px; min-height: 24px; border: 0; border-radius: 5px; background: transparent; color: var(--text-gray, #9aa0a6); cursor: pointer; }
.pp-x:hover { color: var(--app-color-down, #ff4444); background: rgba(255,68,68,.08); }
.pp-link { background: none; border: 0; padding: 3px 0; color: rgba(140,180,255,.95); font: 600 0.66rem/1 inherit; cursor: pointer; }
.pp-cons { display: flex; align-items: center; gap: 6px; font-size: 0.66rem; padding: 0 4px; }
.pp-cons-bar { width: 70px; height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--app-color-down, #ff4444) 60%, transparent); overflow: hidden; }
.pp-cons-bar i { display: block; height: 100%; background: var(--app-color-up, #00ff88); }
.pp-av { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #222; }
.pp-fname { font-weight: 700; color: var(--text-white, #fff); font-family: var(--font-family-secondary, inherit); }
.pp-muted { color: var(--text-gray, #9aa0a6); font-size: 0.64rem; }
.pp-hidden { padding: 0 4px 2px; }
.pp-note { flex: 1 1 140px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,.55); font-family: var(--font-family-secondary, inherit); font-style: italic; }
</style>
