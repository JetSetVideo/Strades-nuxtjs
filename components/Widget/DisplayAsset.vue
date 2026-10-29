<script setup lang="ts">
/**
 * DisplayAsset — one asset in the price list.
 *
 *  name (top, flush left) ·························· friends who called it (top right)
 *  [logo]  price          ┌ mini chart: time scale bottom, prices on the right ┐
 *  TICKER  24h change     └ your calls drawn at their date + price             ┘
 *
 *  • click the card            → the asset's detail page
 *  • click the chart           → the chart stays put and the card grows under it
 *  • title and icon            → the detail page, even while the chart is open
 *  • empty header (open)       → closes the chart
 *  • friends / bots            → their calls, or the bots trading this asset
 *
 * Living-UI mappings kept from Design.md: volatility → pulse speed, confidence ×
 * market cap → glow, 24h move → left accent, asset type → corner radius.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { navigateTo } from '#app'
import type { Asset } from '~/types/asset'
import { useLivingUI } from '~/composables/useLivingUI'
import { usePredictionsStore, type Prediction } from '@/stores/predictions'
import { useAppearanceStore } from '@/stores/appearance'
import { usePaperStore } from '@/stores/paper'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { isBetAsset, BET_COLOR, betSourceLabel } from '~/utils/betAssets'
import { useAssetSeries, chartNow } from '~/composables/useAssetSeries'
import { useFriendPredictions, targetTsOf } from '~/composables/useFriendPredictions'
import PredictChart from '~/components/Asset/PredictChart.vue'
import PredictPanel from '~/components/Asset/PredictPanel.vue'
import AssetBotChip from '~/components/Asset/BotChip.vue'
import { HOUR, priceKindOf, fmtPrice, fmtAxisPrice, typeColor, lerp, type Candle } from '~/utils/assetChart'
import { priceApproach, sameAsset, LEVEL_COLOR, LEVEL_INK } from '~/utils/priceApproach'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps<{
  asset?: Asset | Record<string, unknown>
  assetName?: string
  tagName?: string
  nominalPrice?: string | number
  percentagePrice?: string | number
  profileIcon?: string
  assetId?: string
  liquidityDepth?: number
  priceChangePct?: number
  userId?: string
}>()

defineEmits<{ click: [id: string] }>()

const userId = computed(() => props.userId ?? 'current_user')
const livingAsset = computed(() => props.asset as Asset | undefined)
const { dynamicStyles } = useLivingUI({
  liquidity: props.liquidityDepth ?? livingAsset.value?.liquidity_depth ?? 0.5,
  confidence: 0.65,
})

const predStore = usePredictionsStore()
const appearance = useAppearanceStore()
const paper = usePaperStore()
const annotations = useAssetAnnotationsStore()
if (import.meta.client && !predStore.initialized) predStore.init()

// ── Display values (asset object OR legacy props) ─────────────────────────
const raw = computed(() => (props.asset ?? {}) as Record<string, any>)
const name     = computed(() => String(raw.value.name ?? props.assetName ?? ''))
const symbol   = computed(() => String(raw.value.symbol ?? props.tagName ?? ''))
const icon     = computed(() => String(raw.value.icon_url || props.profileIcon || ''))
const iconFailed = ref(false)
watch(icon, () => { iconFailed.value = false })
const id       = computed(() => String(raw.value.id ?? props.assetId ?? ''))
const category = computed(() => String(raw.value.category ?? 'other'))
/** Short badge copy and accent. Precious metals read as commodities. */
const BADGE: Record<string, { label: string; color: string }> = {
  crypto: { label: 'Crypto', color: '#b48aff' },
  layer1: { label: 'Crypto', color: '#b48aff' },
  meme: { label: 'Crypto', color: '#b48aff' },
  payments: { label: 'Crypto', color: '#b48aff' },
  forex: { label: 'Forex', color: '#4fa8ff' },
  major: { label: 'Forex', color: '#4fa8ff' },
  fiat_currency: { label: 'Forex', color: '#4fa8ff' },
  precious_metals: { label: 'Commodities', color: '#ff9f45' },
  commodity: { label: 'Commodities', color: '#ff9f45' },
  commodities: { label: 'Commodities', color: '#ff9f45' },
  energy: { label: 'Energy', color: '#ffb020' },
  technology: { label: 'Tech', color: '#64b5f6' },
  stock: { label: 'Stocks', color: '#00e58a' },
  finance: { label: 'Finance', color: '#ce93d8' },
  healthcare: { label: 'Health', color: '#f48fb1' },
  consumer: { label: 'Consumer', color: '#26c6da' },
  retail: { label: 'Retail', color: '#26c6da' },
  automotive: { label: 'Auto', color: '#ef6c9a' },
}
const categoryLabel = computed(() => {
  const known = BADGE[category.value]
  if (known) return known.label
  const s = category.value.replace(/_/g, ' ').replace(/([a-z])(\d)/gi, '$1 $2').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const type     = computed(() => String(raw.value.type ?? 'other'))

const currentPrice = computed(() => {
  const v = Number(raw.value.current_price)
  if (Number.isFinite(v) && v > 0) return v
  const n = parseFloat(String(props.nominalPrice ?? '').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
})

const changePct = computed((): number => {
  if (props.priceChangePct !== undefined) return props.priceChangePct
  if (typeof raw.value.change_24h_pct === 'number') return raw.value.change_24h_pct
  const n = parseFloat(String(props.percentagePrice ?? '').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
})

/** A full Asset for the chart composables, even from legacy props. */
const assetObj = computed<Asset>(() => ({
  ...(raw.value as Asset),
  id: id.value || symbol.value.toLowerCase(),
  symbol: symbol.value,
  name: name.value,
  type: (raw.value.type ?? 'other') as Asset['type'],
  current_price: currentPrice.value,
  currency: String(raw.value.currency ?? 'USD'),
}))
const kind = computed(() => priceKindOf(assetObj.value))

// ── Living-UI visuals ─────────────────────────────────────────────────────
const volatility = computed<number>(() => {
  const a = raw.value
  return a.volatility_index ?? a.fluctuation_velocity ?? a.psychology_profile?.volatility_affinity
    ?? a.psychology_profile?.volatility_index ?? a.volatility ?? 0.3
})
const confidence = computed<number>(() => raw.value.psychology_profile?.investor_confidence ?? 0.6)
const marketCap = computed<number>(() => Number(raw.value.market_cap) || 0)
const pulseSpeed = computed(() => `${Math.max(500, 4000 - volatility.value * 3500)}ms`)
const glowColor = computed(() => changePct.value >= 0
  ? `rgba(0,255,136,${0.1 + confidence.value * 0.35})`
  : `rgba(255,68,68,${0.1 + confidence.value * 0.35})`)
const glowRadius = computed(() => {
  const capBonus = marketCap.value > 1e12 ? 12 : marketCap.value > 1e10 ? 7 : 3
  return `${6 + capBonus + confidence.value * 8}px`
})
const cardGlow = computed(() => `0 0 ${glowRadius.value} ${glowColor.value}`)
const accentColor = computed(() => {
  if (changePct.value < 0) return 'var(--app-color-down, var(--error-red))'
  if (changePct.value > 0) return 'var(--app-color-up, var(--success-green))'
  return 'var(--text-gray)'
})
const cardRadius = computed(() => ({
  cryptocurrency: '4px', fiat_currency: '14px', stock: '8px', commodity: '6px',
} as Record<string, string>)[type.value] ?? 'var(--app-border-radius, 10px)')

const isBet = computed(() => isBetAsset(props.asset as { type?: string } | undefined))
const catColor = computed(() => (isBet.value ? BET_COLOR : (BADGE[category.value]?.color ?? '#8aa0b4')))
/** Same colour as the asset page: one colour per asset type (ticker, plate ring). */
const tColor = computed(() => typeColor(type.value))
/** Stable, CSS-safe view-transition names: the card and its chart morph between states. */
const vtId = computed(() => `${(id.value || symbol.value || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
const vtCard = computed(() => `da-${vtId.value}`)
const betSource   = computed(() => betSourceLabel(raw.value.source))
const betSubject  = computed(() => raw.value.subject ?? null)
const betQuestion = computed(() => raw.value.question ?? null)
const betExpiry = computed(() => {
  const t = Date.parse(String(raw.value.expires_at ?? ''))
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null
})

// ── Predictions & friends ─────────────────────────────────────────────────
const minePending = computed(() => predStore.predictions.filter(p =>
  p.userId === userId.value && p.assetId === symbol.value && p.status === 'pending'))
const armedHere = computed(() => Object.values(annotations.triggersById).filter(t =>
  t.status === 'armed' && sameAsset(t.asset_id, id.value, symbol.value)))
const miniLevels = computed(() => armedHere.value.map((t) => {
  const ap = priceApproach(t.current_price_at_creation, t.target_price, currentPrice.value, Date.now() - t.created_at)
  return {
    id: t.id, price: t.target_price, color: LEVEL_COLOR[ap.role], ink: LEVEL_INK[ap.role], hot: ap.closing,
    label: fmtAxisPrice(t.target_price, kind.value),
  }
}))
const nearing = computed(() => {
  const out: { id: string; role: 'limit' | 'support'; label: string }[] = []
  for (const t of armedHere.value) {
    const ap = priceApproach(t.current_price_at_creation, t.target_price, currentPrice.value, Date.now() - t.created_at)
    if (ap.closing) out.push({ id: t.id, role: ap.role, label: fmtAxisPrice(t.target_price, kind.value) })
  }
  for (const p of minePending.value) {
    const ap = priceApproach(p.currentPrice, p.predictedPrice, currentPrice.value, Date.now() - Date.parse(p.timestamp))
    if (ap.closing) out.push({ id: p.id, role: ap.role, label: `${p.timeframe} ${fmtAxisPrice(p.predictedPrice, kind.value)}` })
  }
  return out.slice(0, 2)
})
const { predictions: friendPreds, faces, isRevealed, toggle: toggleFriends } = useFriendPredictions(assetObj, userId.value)
const friendsShown = computed(() => isRevealed.value ? friendPreds.value : [])

// ── Mini chart window: 24 h of candles. A call sits in a short future strip. ──
const farthest = computed(() => {
  let f = 0
  for (const p of [...minePending.value, ...friendsShown.value]) f = Math.max(f, targetTsOf(p) - chartNow.value)
  return f > 0 ? f * 1.08 : 0
})
const miniT0 = computed(() => chartNow.value - 24 * HOUR)
const miniT1 = computed(() => chartNow.value + (farthest.value > 0 ? farthest.value : 0))
const miniWin = computed(() => ({ start: miniT0.value, maxCandles: 28 }))
const changeRef = computed(() => changePct.value)
const { candles: miniCandles, allSimulated } = useAssetSeries(assetObj, miniWin, changeRef)

const trades = computed(() => paper.trades
  .filter(t => t.asset_symbol === symbol.value || t.asset_id === id.value)
  .map(t => ({ t: Date.parse(t.timestamp), price: t.simulated_price, side: t.side })))

const assetAlerts = computed(() =>
  predStore.recentAlerts(userId.value).filter(a => a.assetId === symbol.value))

// ── Expand: the chart stays mounted and lerps into the open window ────────
const expanded = ref(false)
/** CSS grow when opening; skipped when the user prefers reduced motion. */
const grow = ref(false)
const rootEl = ref<HTMLElement | null>(null)
/** 0 = closed card, 1 = open chart. Every mark lerps with this. */
const reveal = ref(0)
const panelOpen = ref(false)
const laidOut = computed(() => expanded.value || reveal.value > 0.02)
const chartH = computed(() => Math.round(lerp(56, 200, reveal.value)))

type ChartPanel = {
  candles: Candle[]
  now: number
  t0: number
  t1: number
  range: { min: number; max: number }
  rangeLock: boolean
  aim: { t: number; price: number; fromT?: number; fromPrice?: number } | null
  mine: Prediction[]
  levels: { id: string; price: number; color: string; label: string; hot?: boolean; ink?: string; fade?: boolean }[]
  friends: Prediction[]
  trades: { t: number; price: number; side: 'buy' | 'sell' }[]
  realFrom: number | null
  snapHours: number
  minLead: number
  extending: boolean
  onAim: (t: number, price: number) => void
  onCommit: (t: number, price: number) => void
  armLimit: (price: number) => void
  onWindow: (edge: 'start' | 'end', t: number) => void
  onScale: (min: number, max: number) => void
}
const panelEl = ref<ChartPanel | null>(null)
let revealRaf = 0

function tickReveal() {
  const goal = expanded.value ? 1 : 0
  if (goal === 1 && !(panelEl.value && Number.isFinite(panelEl.value.t0))) {
    revealRaf = requestAnimationFrame(tickReveal)
    return
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  reveal.value = lerp(reveal.value, goal, reduce ? 1 : 0.16)
  if (Math.abs(reveal.value - goal) < 0.004) {
    reveal.value = goal
    revealRaf = 0
    if (!expanded.value) panelOpen.value = false
    return
  }
  revealRaf = requestAnimationFrame(tickReveal)
}
function startReveal() {
  if (!revealRaf) revealRaf = requestAnimationFrame(tickReveal)
}

function setExpanded(v: boolean) {
  if (expanded.value === v && (v ? reveal.value >= 1 : reveal.value <= 0)) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  grow.value = v && !reduce
  if (v) panelOpen.value = true
  expanded.value = v
  startReveal()
  if (v) rootEl.value?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
}

function onChartClick() {
  if (reveal.value >= 0.98) return
  setExpanded(true)
}

function onSaved() {
  // the call is drawn on the mini chart once the card is closed
  setTimeout(() => setExpanded(false), 350)
}

function goDetail() {
  const pageId = raw.value.id ?? id.value.toLowerCase()
  if (pageId) navigateTo(`/assets/${pageId}`)
}

function onHeadClick(e: MouseEvent) {
  if (!expanded.value) return
  e.stopPropagation()
  setExpanded(false)
}

function goToAssetPage(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.da-chart, .da-friends, .da-close, .bot-chip, .da-name, .da-ident, .pp-chart, .pp-rest')) return
  if (target.closest('.da-info')) { goDetail(); return }
  if (laidOut.value) {
    if (expanded.value) setExpanded(false)
    return
  }
  goDetail()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && expanded.value) setExpanded(false)
}
onMounted(() => {
  appearance.hydrate()
  if (!paper.hydrated) paper.hydrate()
  if (!annotations.hydrated) annotations.hydrateFromStorage()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (revealRaf) cancelAnimationFrame(revealRaf)
})
</script>

<template>
  <div
    ref="rootEl"
    class="widget-asset"
    :class="{ expanded: laidOut, grow }"
    :style="{
      ...dynamicStyles,
      borderRadius: cardRadius,
      boxShadow: cardGlow,
      '--da-pulse': pulseSpeed,
      '--da-accent': accentColor,
      '--da-cat-color': catColor,
      '--da-type-color': tColor,
      viewTransitionName: vtCard,
    }"
    @click="goToAssetPage($event)"
  >
    <div v-if="assetAlerts.length" class="da-alert-ribbon">
      <span v-for="a in assetAlerts.slice(0, 1)" :key="a.id" :class="['da-alert-chip', a.status]">
        {{ a.status === 'accurate' ? '✓' : a.status === 'missed' ? '✗' : '⏱' }}
        {{ a.timeframe }} prediction: {{ a.status }}
        <template v-if="a.accuracyScore !== undefined"> ({{ a.accuracyScore }}%)</template>
      </span>
    </div>

    <!-- ── Name (flush left) + friends (top right). Empty header closes the chart. ── -->
    <div class="da-head" :title="expanded ? 'Close chart' : undefined" @click="onHeadClick">
      <button type="button" class="da-name" :title="betQuestion || name" @click.stop="goDetail">{{ name }}</button>
      <span
        v-if="isBet" class="da-badge"
        :style="{ color: BET_COLOR, borderColor: BET_COLOR + '55', background: BET_COLOR + '18' }"
        :title="betQuestion || 'Prediction-market contract'"
      >BET{{ betSource ? ' · ' + betSource : '' }}</span>
      <span v-else class="da-badge" :style="{ color: catColor, borderColor: catColor + '44', background: catColor + '16' }">{{ categoryLabel }}</span>
      <span v-if="allSimulated" class="da-sim" title="No market history for this asset: the chart is simulated">sim</span>

      <span class="da-head-end">
      <AssetBotChip :symbol="symbol" :asset-id="id" />
      <button
        v-if="faces.length"
        type="button"
        class="da-friends"
        :class="{ on: isRevealed }"
        :aria-pressed="isRevealed"
        :title="isRevealed ? 'Hide friends\' calls' : `Show the calls of ${faces.length} friend${faces.length > 1 ? 's' : ''} (hidden so your own call stays unbiased)`"
        @click.stop="toggleFriends()"
      >
        <img
          v-for="f in faces.slice(0, 3)" :key="f.id" :src="f.avatar" :alt="f.name" class="da-face"
          :class="f.direction === 'bearish' ? 'bear' : 'bull'" loading="lazy"
        />
        <span v-if="faces.length > 3" class="da-face-more">+{{ faces.length - 3 }}</span>
        <svg class="da-eye" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
          <path v-if="!isRevealed" d="M4 4l16 16" />
        </svg>
      </button>
      <button v-if="expanded" type="button" class="da-close" aria-label="Close prediction chart" @click.stop="setExpanded(false)">✕</button>
      </span>
    </div>

    <!-- ── Logo / ticker · price · mini chart ── -->
    <div class="da-row">
      <button type="button" class="da-ident" :aria-label="`${name} details`" @click.stop="goDetail">
        <div class="da-icon-plate">
          <img v-if="icon && !iconFailed" :src="icon" :alt="name" class="da-icon" @error="iconFailed = true" />
          <span v-else class="da-icon-text" aria-hidden="true">{{ symbol.slice(0, 4) || '?' }}</span>
        </div>
        <div class="da-symbol" :title="symbol">{{ symbol }}</div>
      </button>

      <div class="da-info">
        <span class="da-price">{{ fmtPrice(currentPrice, kind, assetObj.currency) }}</span>
        <span class="da-change" :class="changePct >= 0 ? 'pos' : 'neg'">{{ changePct >= 0 ? '+' : '' }}{{ changePct.toFixed(2) }}%</span>
        <span v-if="nearing.length" class="da-near-row">
          <span v-for="c in nearing" :key="c.id" class="da-near" :class="c.role">nearing {{ c.role }} {{ c.label }}</span>
        </span>
        <div v-if="isBet && (betSubject || betExpiry)" class="da-bet-meta">
          <span v-if="betSubject" class="da-bet-subject" title="The underlying this contract is about">{{ betSubject }}</span>
          <span v-if="betExpiry" title="Resolution deadline">⏳ {{ betExpiry }}</span>
        </div>
      </div>

      <div
        class="da-chart"
        :class="{ live: reveal >= 0.98 }"
        :role="reveal >= 0.98 ? undefined : 'button'"
        :tabindex="reveal >= 0.98 ? undefined : 0"
        :aria-label="reveal >= 0.98 ? undefined : `Open the prediction chart for ${name}`"
        @click.stop="onChartClick"
        @keydown.enter.stop.prevent="onChartClick"
      >
        <ClientOnly>
          <PredictChart
            :reveal="reveal"
            :size="reveal >= 0.98 ? 'large' : 'mini'"
            :height="chartH"
            :candles="miniCandles"
            :t0="miniT0" :now="chartNow" :t1="miniT1"
            :current="currentPrice"
            :kind="kind"
            :chart-style="appearance.chartStyle"
            :mine="panelEl?.mine ?? minePending"
            :levels="panelEl?.levels ?? miniLevels"
            :friends="panelEl?.friends ?? friendsShown"
            :trades="panelEl?.trades ?? trades"
            :trend-pct="changePct"
            :open-candles="panelEl?.candles ?? null"
            :open-t0="panelEl?.t0 ?? null"
            :open-t1="panelEl?.t1 ?? null"
            :open-now="panelEl?.now ?? null"
            :open-range="panelEl?.range ?? null"
            :open-range-lock="panelEl?.rangeLock ?? false"
            :aim="reveal >= 0.98 ? (panelEl?.aim ?? null) : null"
            :real-from="reveal > 0.45 ? (panelEl?.realFrom ?? null) : null"
            :snap-hours="panelEl?.snapHours ?? 1"
            :min-lead-hours="panelEl?.minLead ?? 1"
            :extending="panelEl?.extending ?? false"
            :interactive="reveal >= 0.98"
            :label="`${name} price, last ${Math.round((chartNow - miniT0) / HOUR)} hours`"
            @aim="(t: number, price: number) => panelEl?.onAim(t, price)"
            @commit="(t: number, price: number) => panelEl?.onCommit(t, price)"
            @limit="(price: number) => panelEl?.armLimit(price)"
            @window="(edge: 'start' | 'end', t: number) => panelEl?.onWindow(edge, t)"
            @scale="(min: number, max: number) => panelEl?.onScale(min, max)"
          />
          <template #fallback><div style="height: 56px" /></template>
        </ClientOnly>
      </div>
    </div>

    <!-- ── Expanded: the large prediction chart ── -->
    <div v-if="panelOpen" v-show="expanded" class="da-expanded" @click.stop>
      <PredictPanel
        ref="panelEl"
        :asset="assetObj"
        :change-pct="changePct"
        :user-id="userId"
        source="card"
        :height="200"
        :friends="friendPreds"
        :reveal-friends="isRevealed"
        :show-chart="false"
        @saved="onSaved"
        @toggle-friends="toggleFriends()"
      />
    </div>
  </div>
</template>

<style scoped>
.widget-asset {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-left: 3px solid var(--da-accent, var(--border-primary));
  overflow: hidden;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal), transform 0.15s ease;
  cursor: pointer;
  font-family: var(--font-family-secondary);
  color: var(--text-white);
  padding: 3px 4px 3px 5px;
}
.widget-asset:hover:not(.expanded) { transform: translateY(-1px); border-color: var(--da-accent, var(--primary-green)); }
.widget-asset:not(.expanded) { padding: 1px 2px 1px 3px; }
.widget-asset:not(.expanded) .da-head { gap: 3px; min-height: 16px; }
.widget-asset:not(.expanded) .da-head-end { gap: 2px; }
.widget-asset:not(.expanded) .da-row { gap: 4px; }
.widget-asset:not(.expanded) .da-friends { min-height: 16px; padding: 0 3px 0 1px; }
.widget-asset:not(.expanded) .da-face { width: 13px; height: 13px; margin-left: -4px; border-width: 1px; }
.widget-asset:not(.expanded) .da-eye { width: 11px; height: 11px; margin-left: 2px; }
.widget-asset:not(.expanded) :deep(.bot-btn) { min-height: 16px; padding: 0 4px 0 3px; gap: 2px; }
.widget-asset:not(.expanded) :deep(.bot-btn svg) { width: 11px; height: 11px; }
.widget-asset { view-transition-class: da-card; }
.da-chart { view-transition-class: da-chart; }
.widget-asset.grow .da-expanded { animation: da-grow 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
@keyframes da-grow { from { opacity: 0; transform: scale(0.6, 0.3); } to { opacity: 1; transform: none; } }
.widget-asset.expanded { cursor: default; }
.widget-asset.expanded {
  display: grid;
  grid-template-columns: 40px minmax(72px, max-content) minmax(110px, 1fr);
  grid-template-areas:
    "head head head"
    "ident info chart"
    "more more more";
  align-items: start;
  column-gap: 6px;
  row-gap: 4px;
}
.widget-asset.expanded:has(.da-alert-ribbon) {
  grid-template-areas:
    "ribbon ribbon ribbon"
    "head head head"
    "ident info chart"
    "more more more";
}
.widget-asset.expanded .da-alert-ribbon { grid-area: ribbon; }
.widget-asset.expanded .da-head { grid-area: head; cursor: pointer; }
.widget-asset.expanded .da-row { display: contents; }
.widget-asset.expanded .da-ident { grid-area: ident; }
.widget-asset.expanded .da-info { grid-area: info; }
.widget-asset.expanded .da-chart {
  display: block;
  grid-area: chart;
  min-width: 0;
  align-self: stretch;
}
.da-chart.live { cursor: crosshair; }
.widget-asset.expanded .da-expanded { display: contents; padding: 0; }
.widget-asset.expanded :deep(.pp) { display: contents; }
.widget-asset.expanded :deep(.pp-chart) {
  grid-area: chart;
  min-width: 0;
  align-self: stretch;
  overflow: hidden;
  animation: da-chart-in 0.36s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes da-chart-in { from { max-height: 56px; } to { max-height: 220px; } }
.widget-asset.expanded :deep(.pp-rest) {
  grid-area: more;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.widget-asset.grow :deep(.pp-rest) { animation: da-reveal 0.34s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes da-reveal { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.widget-asset:has(.bot-chip.on) { overflow: visible; z-index: 4; }

/* ── Head: name flush left, friends top right ── */
.da-head {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  min-height: 18px;
}
.da-name {
  min-width: 0;
  flex: 0 1 auto;
  align-self: center;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  line-height: 1;
  font-size: 0.78rem;
  font-weight: 650;
  color: #fff;
  font-family: var(--font-market-data, var(--font-family-secondary));
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.da-badge {
  flex-shrink: 0;
  font-size: 0.52rem;
  font-weight: 700;
  padding: 0 6px;
  line-height: 14px;
  border-radius: 999px;
  border: 1px solid;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.da-sim {
  flex-shrink: 0;
  font-size: .52rem; letter-spacing: .05em; text-transform: uppercase; padding: 0 4px; line-height: 13px;
  border-radius: 999px; border: 1px dashed var(--text-secondary, #888); color: var(--text-secondary, #888);
}
.da-head-end { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; }
.da-friends {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0;
  min-height: 24px;
  padding: 1px 5px 1px 3px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.12));
  background: rgba(255,255,255,.03);
  color: var(--text-gray, #9aa0a6);
  cursor: pointer;
}
.da-friends:hover { color: var(--text-white, #fff); border-color: rgba(255,255,255,.3); }
.da-friends.on { color: var(--text-white, #fff); border-color: rgba(120,170,255,.7); background: rgba(120,170,255,.12); }
.da-face {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover;
  margin-left: -5px; border: 1.5px solid #121214; background: #222;
}
.da-face:first-child { margin-left: 0; }
.da-friends.on .da-face.bull { box-shadow: 0 0 0 1.5px var(--app-color-up, #00ff88); }
.da-friends.on .da-face.bear { box-shadow: 0 0 0 1.5px var(--app-color-down, #ff4444); }
.da-face-more { font-size: .58rem; font-weight: 700; margin-left: 3px; }
.da-eye { margin-left: 4px; }
.da-close {
  flex-shrink: 0;
  width: 26px; height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.12));
  background: transparent; color: var(--text-gray, #9aa0a6);
  cursor: pointer; font-size: .7rem;
}
.da-close:hover { color: var(--text-white, #fff); }

/* ── Row ── */
.da-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.da-ident {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: center;
  gap: 5px;
  flex-shrink: 0;
  width: 40px;
  margin-left: -3px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.da-icon-plate {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #eef1f4;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--da-type-color, #607d8b) 65%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.da-icon { width: 24px; height: 24px; object-fit: contain; display: block; }
.da-icon-text { font: 700 .58rem/1 var(--font-market-data, monospace); color: #37474f; letter-spacing: .02em; }
.da-symbol {
  max-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: var(--da-type-color, var(--text-gray));
  font-family: var(--font-market-data, inherit);
  line-height: 1;
}

.da-info {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 128px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.da-price {
  font-size: 0.86rem;
  font-weight: 800;
  color: var(--text-white);
  font-family: var(--font-market-data, var(--font-family-primary));
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.da-change {
  align-self: center;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0 6px;
  line-height: 16px;
  border-radius: 999px;
  font-family: var(--font-market-data, inherit);
  font-variant-numeric: tabular-nums;
}
.da-change.pos {
  color: var(--app-color-up, var(--success-green));
  background: color-mix(in oklch, var(--app-color-up, var(--success-green)) 12%, transparent);
  border: 1px solid color-mix(in oklch, var(--app-color-up, var(--success-green)) 30%, transparent);
}
.da-near-row { display: flex; flex-wrap: wrap; gap: 2px; max-width: 100%; }
.da-near {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 1.3;
  padding: 0.05rem 0.28rem;
  border-radius: 3px;
  color: #3b2410;
  background: #ffcc80;
}
.da-near.support { color: #fff7ed; background: #c2410c; }
.da-change.neg {
  color: var(--app-color-down, var(--error-red));
  background: color-mix(in oklch, var(--app-color-down, var(--error-red)) 12%, transparent);
  border: 1px solid color-mix(in oklch, var(--app-color-down, var(--error-red)) 30%, transparent);
}
.da-bet-meta {
  display: flex; gap: 5px; max-width: 100%;
  font-size: 0.56rem; color: var(--text-secondary, #9aa0a6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.da-bet-subject { color: #ff4d9d; font-weight: 700; overflow: hidden; text-overflow: ellipsis; }

.da-chart {
  flex: 1 1 auto;
  min-width: 110px;
  border-radius: 4px;
  cursor: zoom-in;
}
.da-chart:hover { background: rgba(255,255,255,.03); }
.da-chart:focus-visible { outline: 2px solid rgba(120,170,255,.8); outline-offset: 1px; }

.da-expanded { padding: 4px 0 2px; }

/* ── Alert ribbon ── */
.da-alert-ribbon { margin: -3px -4px 3px -5px; padding: 2px 8px; display: flex; gap: 6px; background: rgba(0,0,0,.2); border-bottom: 1px solid rgba(255,255,255,.05); }
.da-alert-chip { font-size: 0.6rem; padding: 0 7px; border-radius: 10px; border: 1px solid; }
.da-alert-chip.accurate { color: var(--success-green); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.08); }
.da-alert-chip.missed { color: var(--error-red); border-color: rgba(255,68,68,.3); background: rgba(255,68,68,.08); }
.da-alert-chip.expired { color: var(--text-gray); border-color: rgba(136,136,136,.3); }

@media (max-width: 480px) {
  .widget-asset { padding: 3px 3px 3px 4px; }
  .da-info { max-width: 104px; }
  .da-price { font-size: 0.86rem; }
  .da-chart { min-width: 96px; }
}
</style>

<style>
/* The card ↔ prediction-chart morph (View Transitions; skipped under reduced motion). */
::view-transition-group(.da-card),
::view-transition-group(.da-chart) {
  animation-duration: 340ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* the chart stretches from its small box to the large one instead of cross-fading at fixed size */
::view-transition-old(.da-chart),
::view-transition-new(.da-chart) { height: 100%; width: 100%; object-fit: fill; }
::view-transition-group(.da-card) { overflow: clip; border-radius: 8px; }
::view-transition-old(.da-card),
::view-transition-new(.da-card) { height: auto; width: 100%; object-fit: none; object-position: top left; }
</style>
