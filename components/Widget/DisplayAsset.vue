<script setup lang="ts">
/**
 * DisplayAsset Widget
 *
 * Redesigned per Design.md living-UI principles:
 *   • volatility_index  → animation pulse speed (high vol = fast beat)
 *   • investor_confidence → glow intensity (high conf = bright glow)
 *   • displayed price change → card left-border color (up=green, down=red)
 *   • market_cap        → glow radius (large cap = wider glow, more "gravity")
 *   • liquidity_depth   → shadow alpha
 *
 * Integrates PriceIntuition widget as a collapsible section below each card.
 * Shows the user's last prediction badge for this asset from the predictions store.
 */
import { ref, computed, onMounted } from 'vue'
import { navigateTo } from '#app'
import type { Asset } from '~/types/asset'
import { useLivingUI } from '~/composables/useLivingUI'
import PriceIntuition from '@/components/Widget/PriceIntuition.vue'
import { usePredictionsStore } from '@/stores/predictions'
import { useAppearanceStore } from '@/stores/appearance'
import { usePaperStore } from '@/stores/paper'

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

const livingAsset = computed(() => props.asset as Asset | undefined)
const { dynamicStyles } = useLivingUI({
  liquidity: props.liquidityDepth ?? livingAsset.value?.liquidity_depth ?? 0.5,
  confidence: 0.65,
})

// Navigate to the asset detail page
function goToAssetPage(e: MouseEvent) {
  // Prevent navigation when clicking predict button
  const target = e.target as HTMLElement
  if (target.closest('.da-predict-btn') || target.closest('.da-intuition-wrap')) return
  const assetPageId = props.asset?.id ?? id.value.toLowerCase()
  if (assetPageId) navigateTo(`/assets/${assetPageId}`)
}

// ── Predictions store ─────────────────────────────────────────────────────
const predStore = usePredictionsStore()
const appearance = useAppearanceStore()
const paper = usePaperStore()
if (!predStore.initialized) predStore.init()

// ── Derive display values (asset object OR legacy props) ──────────────────
const name     = computed(() => props.asset?.name      ?? props.assetName  ?? '')
const symbol   = computed(() => props.asset?.symbol    ?? props.tagName    ?? '')
const icon     = computed(() => props.asset?.icon_url  ?? props.profileIcon ?? '')
const id       = computed(() => props.asset?.id        ?? props.assetId    ?? '')
const category = computed(() => props.asset?.category  ?? 'other')
const type     = computed(() => props.asset?.type      ?? 'other')

// Numeric current price (from store or legacy string prop)
const currentPrice = computed(() => {
  if (props.asset?.current_price) return props.asset.current_price as number
  const n = parseFloat(String(props.nominalPrice ?? '').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
})

// Stable % change (parent-computed, or fall back to legacy string)
const changePct = computed((): number => {
  if (props.priceChangePct !== undefined) return props.priceChangePct
  const s = String(props.percentagePrice ?? '')
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
})

// Psychology fields from asset JSON
const volatility = computed<number>(() => {
  const a = livingAsset.value
  return a?.fluctuation_velocity
    ?? (a?.psychology_profile?.volatility_affinity as number | undefined)
    ?? (props.asset as Record<string, any> | undefined)?.psychology_profile?.volatility_index
    ?? (props.asset as Record<string, any> | undefined)?.volatility
    ?? 0.3
})
const confidence = computed<number>(() =>
  (props.asset as Record<string, any> | undefined)?.psychology_profile?.investor_confidence ?? 0.6
)
const marketCap = computed<number>(() => livingAsset.value?.market_cap ?? 0)
const liquidity = computed<number>(() =>
  props.liquidityDepth ?? livingAsset.value?.liquidity_depth ?? 0.5
)

// ── Design.md visual mappings ─────────────────────────────────────────────

// Pulse speed: volatility_index 0–1 → 500ms (high vol) to 4000ms (calm)
const pulseSpeed = computed(() => {
  const ms = 4000 - volatility.value * 3500
  return `${Math.max(500, ms)}ms`
})

// Glow: confidence × market_cap → color intensity + radius
const glowColor = computed(() => {
  if (changePct.value >= 0) return `rgba(0,255,136,${0.1 + confidence.value * 0.35})`
  return `rgba(255,68,68,${0.1 + confidence.value * 0.35})`
})
const glowRadius = computed(() => {
  const base = 6
  const capBonus = marketCap.value > 1e12 ? 12 : marketCap.value > 1e10 ? 7 : 3
  const confBonus = confidence.value * 8
  return `${base + capBonus + confBonus}px`
})
const cardGlow = computed(() => `0 0 ${glowRadius.value} ${glowColor.value}`)

// Left accent follows the price on screen: any down tick is red, any up tick is green.
const accentColor = computed(() => {
  if (changePct.value < 0) return 'var(--app-color-down, var(--error-red))'
  if (changePct.value > 0) return 'var(--app-color-up, var(--success-green))'
  return 'var(--text-gray)'
})

// Design.md: border-radius driven by category
// crypto = sharp (4px), fiat = rounded (14px), stocks = moderate (8px)
const cardRadius = computed(() => {
  const map: Record<string, string> = {
    cryptocurrency: '4px', fiat_currency: '14px',
    stock: '8px', commodity: '6px',
  }
  return map[type.value] ?? 'var(--app-border-radius, 10px)'
})

// Category accent color for badge
const CAT_COLOR: Record<string, string> = {
  technology: '#2196f3', cryptocurrency: '#f7931a', fiat_currency: '#4caf50',
  stock: '#2196f3', energy: '#ff9800', finance: '#9c27b0',
  healthcare: '#e91e63', consumer: '#00bcd4', commodity: '#ffd700',
}
const catColor = computed(() => CAT_COLOR[category.value] ?? '#607d8b')

// ── Price display ─────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (p >= 1000)  return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (p >= 1)     return '$' + p.toFixed(2)
  return '$' + p.toFixed(4)
}

// ── Simulated price history for sparkline & PriceIntuition ───────────────
const priceHistory = ref<number[]>([])

function buildHistory(current: number, vol: number, n = 32): number[] {
  const pts: number[] = [current]
  for (let i = 1; i < n; i++) {
    const prev = pts[0]!
    const drift = (Math.random() - 0.5) * 2 * vol * 0.06
    pts.unshift(Math.max(0.0001, prev * (1 - drift)))
  }
  return pts  // oldest→newest; last element = current
}

onMounted(() => {
  appearance.hydrate()
  if (!paper.hydrated) paper.hydrate()
  priceHistory.value = buildHistory(currentPrice.value, volatility.value)
})

// ── Sparkline SVG ─────────────────────────────────────────────────────────
const SVG_W = 160
const SVG_H = 52
const sparkUp = 'var(--app-color-up, var(--success-green))'
const sparkDown = 'var(--app-color-down, var(--error-red))'

const sparkScale = computed(() => {
  const pts = priceHistory.value
  if (pts.length < 2) return null
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const yOf = (p: number) => SVG_H - 4 - ((p - min) / range) * (SVG_H - 8)
  const xOf = (i: number) => (i / (pts.length - 1)) * SVG_W
  return { pts, min, max, yOf, xOf }
})

const sparkPoints = computed(() => {
  const s = sparkScale.value
  if (!s) return ''
  return s.pts.map((p, i) => `${s.xOf(i).toFixed(1)},${s.yOf(p).toFixed(1)}`).join(' ')
})

const candles = computed(() => {
  const s = sparkScale.value
  if (!s) return []
  const group = 4
  const out: { x: number; w: number; yHigh: number; yLow: number; yBody: number; h: number; up: boolean }[] = []
  const buckets = Math.ceil(s.pts.length / group)
  for (let b = 0; b < buckets; b++) {
    const slice = s.pts.slice(b * group, b * group + group)
    if (!slice.length) continue
    const open = slice[0]!
    const close = slice[slice.length - 1]!
    const high = Math.max(...slice)
    const low = Math.min(...slice)
    const x = ((b + 0.5) / buckets) * SVG_W
    const yOpen = s.yOf(open)
    const yClose = s.yOf(close)
    out.push({
      x,
      w: Math.max(3, (SVG_W / buckets) * 0.55),
      yHigh: s.yOf(high),
      yLow: s.yOf(low),
      yBody: Math.min(yOpen, yClose),
      h: Math.max(1.5, Math.abs(yClose - yOpen)),
      up: close >= open,
    })
  }
  return out
})

type SparkMark = { kind: 'buy' | 'sell' | 'predict-bull' | 'predict-bear'; x: number; y: number }

const sparkMarks = computed((): SparkMark[] => {
  const s = sparkScale.value
  if (!s) return []
  const marks: SparkMark[] = []
  const sym = String(symbol.value)
  const trades = paper.trades.filter(t => t.asset_symbol === sym || t.asset_id === id.value)
  trades.forEach((t, i) => {
    const idx = Math.min(s.pts.length - 1, Math.round(((i + 1) / (trades.length + 1)) * (s.pts.length - 1)))
    marks.push({ kind: t.side, x: s.xOf(idx), y: s.yOf(s.pts[idx]!) })
  })
  const preds = predStore.predictions.filter(p => p.assetId === sym && p.status === 'pending')
  preds.forEach((p, i) => {
    const idx = Math.min(s.pts.length - 1, Math.round((0.62 + i * 0.08) * (s.pts.length - 1)))
    marks.push({
      kind: p.direction === 'bearish' ? 'predict-bear' : 'predict-bull',
      x: s.xOf(idx),
      y: s.yOf(s.pts[idx]!),
    })
  })
  return marks
})

function diamond(x: number, y: number, r = 3.2): string {
  return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`
}

// ── PriceIntuition expand ─────────────────────────────────────────────────
const showIntuition = ref(false)

// ── Multi-TF active predictions ───────────────────────────────────────────
const activeUserPreds = computed(() =>
  predStore.activeByAsset(props.userId ?? 'current_user', symbol.value)
)

// Summary string for button: e.g. "1W↑ 1M↓"
const predSummary = computed(() => {
  if (!activeUserPreds.value.length) return ''
  return activeUserPreds.value
    .sort((a, b) => a.timeframe.localeCompare(b.timeframe))
    .map(p => `${p.timeframe}${p.direction === 'bullish' ? '↑' : '↓'}`)
    .join(' ')
})

// Dominant direction across all active preds
const predDominantDir = computed<'bullish' | 'bearish' | 'mixed' | null>(() => {
  if (!activeUserPreds.value.length) return null
  const bull = activeUserPreds.value.filter(p => p.direction === 'bullish').length
  const bear = activeUserPreds.value.filter(p => p.direction === 'bearish').length
  if (bull === bear) return 'mixed'
  return bull > bear ? 'bullish' : 'bearish'
})

// Alerts for this asset
const assetAlerts = computed(() =>
  predStore.recentAlerts(props.userId ?? 'current_user')
    .filter(a => a.assetId === symbol.value)
)
</script>

<template>
  <div
    class="widget-asset"
    :style="{
      ...dynamicStyles,
      borderRadius: cardRadius,
      boxShadow: cardGlow,
      '--da-pulse': pulseSpeed,
      '--da-accent': accentColor,
      '--da-cat-color': catColor,
    }"
    @click="goToAssetPage($event)"
  >
    <!-- Alert ribbon -->
    <div v-if="assetAlerts.length" class="da-alert-ribbon">
      <span
        v-for="a in assetAlerts.slice(0, 1)"
        :key="a.id"
        :class="['da-alert-chip', a.status]"
      >
        {{ a.status === 'accurate' ? '✓' : a.status === 'missed' ? '✗' : '⏱' }}
        {{ a.timeframe }} prediction: {{ a.status }}
        <template v-if="a.accuracyScore !== undefined"> ({{ a.accuracyScore }}%)</template>
      </span>
    </div>

    <!-- ── Main card row ── -->
    <div class="da-row">

      <!-- Logo + ticker -->
      <div class="da-ident">
        <div class="da-icon-plate">
          <img
            :src="icon"
            :alt="name"
            class="da-icon"
            @error="($event.target as HTMLImageElement).style.display='none'"
          />
        </div>
        <div class="da-symbol">{{ symbol }}</div>
      </div>

      <!-- Name + price -->
      <div class="da-info">
        <div class="da-name-row">
          <span class="da-name">{{ name }}</span>
          <span class="da-cat-badge" :style="{ color: catColor, borderColor: catColor + '44', background: catColor + '16' }">
            {{ category }}
          </span>
        </div>
        <div class="da-price-row">
          <span class="da-price">{{ fmtPrice(currentPrice) }}</span>
          <span
            class="da-change"
            :class="changePct >= 0 ? 'pos' : 'neg'"
          >
            {{ changePct >= 0 ? '+' : '' }}{{ changePct.toFixed(2) }}%
          </span>
        </div>
      </div>

      <!-- Sparkline fills the space the identity block used to leave empty -->
      <div class="da-spark">
        <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" preserveAspectRatio="none" class="da-spark-svg">
          <defs>
            <linearGradient :id="`spark-fill-${id}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--app-color-up, #00ff88)" stop-opacity="0.22" />
              <stop offset="100%" stop-color="var(--app-color-down, #ff4444)" stop-opacity="0.05" />
            </linearGradient>
            <linearGradient :id="`spark-stroke-${id}`" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="var(--app-color-down, #ff4444)" />
              <stop offset="100%" stop-color="var(--app-color-up, #00ff88)" />
            </linearGradient>
          </defs>
          <template v-if="appearance.chartStyle === 'candle'">
            <g v-for="(c, i) in candles" :key="i">
              <line :x1="c.x" :x2="c.x" :y1="c.yHigh" :y2="c.yLow" :stroke="c.up ? sparkUp : sparkDown" stroke-width="1.1" />
              <rect
                :x="c.x - c.w / 2" :y="c.yBody" :width="c.w" :height="c.h"
                :fill="c.up ? sparkUp : sparkDown" rx="0.4"
              />
            </g>
          </template>
          <template v-else>
            <polyline :points="`${sparkPoints} ${SVG_W},${SVG_H} 0,${SVG_H}`"
              :fill="`url(#spark-fill-${id})`" stroke="none" />
            <polyline :points="sparkPoints" fill="none"
              :stroke="`url(#spark-stroke-${id})`" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </template>
          <g v-for="(m, i) in sparkMarks" :key="'m' + i">
            <circle v-if="m.kind === 'buy'" :cx="m.x" :cy="m.y" r="3.1" :fill="sparkUp" />
            <rect v-else-if="m.kind === 'sell'" :x="m.x - 2.6" :y="m.y - 2.6" width="5.2" height="5.2" :fill="sparkDown" rx="0.4" />
            <polygon
              v-else
              :points="diamond(m.x, m.y)"
              :fill="m.kind === 'predict-bear' ? sparkDown : 'none'"
              :stroke="m.kind === 'predict-bear' ? sparkDown : sparkUp"
              stroke-width="1.3"
            />
          </g>
        </svg>
      </div>

      <!-- Predict button — shows multi-TF state when predictions active -->
      <button
        class="da-predict-btn"
        :class="{
          active: showIntuition,
          'has-bull': predDominantDir === 'bullish',
          'has-bear': predDominantDir === 'bearish',
          'has-mixed': predDominantDir === 'mixed',
        }"
        @click.stop="showIntuition = !showIntuition"
        title="Record your price intuition"
      >
        <template v-if="predSummary && !showIntuition">
          <span class="da-pred-summary">{{ predSummary }}</span>
        </template>
        <template v-else>
          🎯
          <span class="da-predict-label">{{ showIntuition ? 'Close' : 'Predict' }}</span>
        </template>
      </button>

    </div><!-- end da-row -->

    <!-- ── Expandable PriceIntuition ── -->
    <Transition name="da-expand">
      <div v-if="showIntuition" class="da-intuition-wrap" @click.stop>
        <PriceIntuition
          :asset-id="symbol"
          :asset-name="name"
          :current-price="currentPrice"
          :price-history="priceHistory"
          :volatility="volatility"
          :user-id="userId ?? 'current_user'"
          :compact="false"
        />
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ── Widget root ── */
.widget-asset {
  position: relative;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-left: 3px solid var(--da-accent, var(--border-primary));
  overflow: hidden;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal),
              transform 0.15s ease;
  cursor: pointer;
  font-family: var(--font-family-secondary);
  color: var(--text-white);
}

.widget-asset:hover {
  transform: translateY(-2px);
  border-color: var(--da-accent, var(--primary-green));
}

/* ── Main row ── */
.da-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 10px;
}

/* ── Identity: steady logo plate + ticker ── */
.da-ident {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  width: 52px;
}

.da-icon-plate {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eef1f4;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--da-cat-color, #607d8b) 65%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.da-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  display: block;
  background: transparent;
}

.da-symbol {
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--da-cat-color, var(--text-gray));
  font-family: var(--font-market-data, inherit);
  line-height: 1;
}

/* ── Info stays content-sized so the spark can take the leftover width ── */
.da-info {
  flex: 0 1 220px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.da-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.da-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-light-gray, rgba(255,255,255,0.75));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  font-family: var(--font-market-data, var(--font-family-secondary));
}

.da-cat-badge {
  font-size: 0.52rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid;
  text-transform: capitalize;
  flex-shrink: 0;
}

.da-price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.da-price {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-white);
  font-family: var(--font-market-data, var(--font-family-primary));
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.da-change {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

.da-change {
  font-family: var(--font-market-data, inherit);
  font-variant-numeric: tabular-nums;
}

.da-change.pos {
  color: var(--app-color-up, var(--success-green));
  background: color-mix(in oklch, var(--app-color-up, var(--success-green)) 12%, transparent);
  border: 1px solid color-mix(in oklch, var(--app-color-up, var(--success-green)) 30%, transparent);
}

.da-change.neg {
  color: var(--app-color-down, var(--error-red));
  background: color-mix(in oklch, var(--app-color-down, var(--error-red)) 12%, transparent);
  border: 1px solid color-mix(in oklch, var(--app-color-down, var(--error-red)) 30%, transparent);
}

/* Last prediction badge */
.da-pred-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6rem;
  font-weight: 700;
  opacity: 0.8;
}

.da-pred-status { font-size: 0.7rem; }

/* ── Sparkline ──
 * Flexes to soak up the row's remaining width instead of leaving a dead
 * gap between the info column and the predict button on wide screens. */
.da-spark {
  flex: 1 1 auto;
  min-width: 120px;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.da-spark-svg {
  width: 100%;
  height: 58px;
  display: block;
}

@media (max-width: 640px) {
  .da-spark { min-width: 72px; }
  .da-spark-svg { height: 44px; }
  .da-info { flex-basis: 150px; }
}

/* ── Alert ribbon ── */
.da-alert-ribbon {
  padding: 4px 12px;
  display: flex;
  gap: 6px;
  background: rgba(0,0,0,.2);
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.da-alert-chip {
  font-size: 0.62rem;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid;
}
.da-alert-chip.accurate {
  color: var(--success-green);
  border-color: rgba(0,255,136,.3);
  background: rgba(0,255,136,.08);
}
.da-alert-chip.missed {
  color: var(--error-red);
  border-color: rgba(255,68,68,.3);
  background: rgba(255,68,68,.08);
}
.da-alert-chip.expired {
  color: var(--text-gray);
  border-color: rgba(136,136,136,.3);
}

/* ── Predict button ── */
.da-predict-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 1rem;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.da-predict-btn:hover {
  background: rgba(255,255,255,0.06);
  border-color: var(--border-accent);
  color: var(--text-white);
}

.da-predict-btn.active {
  background: rgba(0,255,136,0.1);
  border-color: var(--border-accent);
  color: var(--primary-green);
}
.da-predict-btn.has-bull {
  background: rgba(0,255,136,.1);
  border-color: rgba(0,255,136,.4);
  color: var(--success-green);
}
.da-predict-btn.has-bear {
  background: rgba(255,68,68,.1);
  border-color: rgba(255,68,68,.4);
  color: var(--error-red);
}
.da-predict-btn.has-mixed {
  background: rgba(255,200,0,.08);
  border-color: rgba(255,200,0,.3);
  color: #ffc800;
}

.da-predict-label {
  font-size: 0.42rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.da-pred-summary {
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

/* ── PriceIntuition expansion ── */
.da-intuition-wrap {
  border-top: 1px solid var(--border-primary);
  background: rgba(0,0,0,0.15);
}

.da-expand-enter-active,
.da-expand-leave-active {
  transition: all 0.28s ease;
  overflow: hidden;
}

.da-expand-enter-from,
.da-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.da-expand-enter-to,
.da-expand-leave-from {
  opacity: 1;
  max-height: 1400px;
}

/* Responsive */
@media (max-width: 480px) {
  .da-row { gap: var(--spacing-sm); padding: var(--spacing-sm); }
  .da-spark { display: none; }
  .da-name  { font-size: 0.8rem; max-width: 120px; }
  .da-price { font-size: 0.95rem; }
}
</style>
