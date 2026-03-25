<script setup lang="ts">
/**
 * DisplayAsset Widget
 *
 * Redesigned per Design.md living-UI principles:
 *   • volatility_index  → animation pulse speed (high vol = fast beat)
 *   • investor_confidence → glow intensity (high conf = bright glow)
 *   • market_sentiment  → card left-border color (bull=green, bear=red)
 *   • market_cap        → glow radius (large cap = wider glow, more "gravity")
 *   • liquidity_depth   → shadow alpha
 *
 * Integrates PriceIntuition widget as a collapsible section below each card.
 * Shows the user's last prediction badge for this asset from the predictions store.
 */
import { ref, computed, onMounted } from 'vue'
import PriceIntuition from '@/components/Widget/PriceIntuition.vue'
import { usePredictionsStore } from '@/stores/predictions'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps<{
  // Preferred: full asset object from assetsStore
  asset?: Record<string, any>
  // Legacy individual props (backwards-compat)
  assetName?: string
  tagName?: string
  nominalPrice?: string | number
  percentagePrice?: string | number
  profileIcon?: string
  assetId?: string
  liquidityDepth?: number
  // Stable % change (pre-computed by parent, avoids re-render jitter)
  priceChangePct?: number
  // Current user ID for predictions
  userId?: string
}>()

defineEmits<{ click: [id: string] }>()

// ── Predictions store ─────────────────────────────────────────────────────
const predStore = usePredictionsStore()
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
const volatility   = computed<number>(() => props.asset?.psychology_profile?.volatility_index ?? props.asset?.volatility ?? 0.3)
const confidence   = computed<number>(() => props.asset?.psychology_profile?.investor_confidence ?? 0.6)
const sentiment    = computed<string>(() => props.asset?.psychology_profile?.market_sentiment ?? 'neutral')
const marketCap    = computed<number>(() => props.asset?.market_cap ?? 0)
const liquidity    = computed<number>(() => props.liquidityDepth ?? props.asset?.liquidity_depth ?? 0.5)

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

// Left accent border color from sentiment
const accentColor = computed(() => {
  if (sentiment.value === 'bullish' || changePct.value > 1) return 'var(--success-green)'
  if (sentiment.value === 'bearish' || changePct.value < -1) return 'var(--error-red)'
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

function buildHistory(current: number, vol: number, n = 12): number[] {
  const pts: number[] = [current]
  for (let i = 1; i < n; i++) {
    const prev = pts[0]!
    const drift = (Math.random() - 0.5) * 2 * vol * 0.06
    pts.unshift(Math.max(0.0001, prev * (1 - drift)))
  }
  return pts  // oldest→newest; last element = current
}

onMounted(() => {
  priceHistory.value = buildHistory(currentPrice.value, volatility.value)
})

// ── Sparkline SVG ─────────────────────────────────────────────────────────
const SVG_W = 80
const SVG_H = 30

const sparkPoints = computed(() => {
  const pts = priceHistory.value
  if (pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * SVG_W
    const y = SVG_H - ((p - min) / range) * SVG_H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const sparkColor = computed(() => changePct.value >= 0 ? 'var(--success-green)' : 'var(--error-red)')

// ── PriceIntuition expand ─────────────────────────────────────────────────
const showIntuition = ref(false)

// ── Last prediction badge ─────────────────────────────────────────────────
const lastPrediction = computed(() =>
  predStore.recentByAsset(props.userId ?? 'current_user', symbol.value, 1)[0] ?? null
)
</script>

<template>
  <div
    class="widget-asset"
    :style="{
      borderRadius: cardRadius,
      boxShadow: cardGlow,
      '--da-pulse': pulseSpeed,
      '--da-accent': accentColor,
      '--da-cat-color': catColor,
    }"
  >
    <!-- ── Main card row ── -->
    <div class="da-row" @click="$emit('click', id)">

      <!-- Icon -->
      <div class="da-icon-wrap">
        <img
          :src="icon"
          :alt="name"
          class="da-icon"
          @error="($event.target as HTMLImageElement).style.display='none'"
        />
        <div class="da-symbol">{{ symbol }}</div>
        <!-- Volatility pulse ring (Design.md: animation speed = volatility) -->
        <div class="da-pulse-ring" :class="{ active: volatility > 0.4 }" />
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

        <!-- Last prediction badge -->
        <div v-if="lastPrediction" class="da-pred-badge"
          :style="{ color: lastPrediction.direction === 'bullish' ? 'var(--success-green)' : 'var(--error-red)' }">
          <span>🎯 {{ lastPrediction.direction === 'bullish' ? '↑' : '↓' }}{{ Math.abs(lastPrediction.predictedChangePct).toFixed(1) }}%</span>
          <span class="da-pred-status">{{ lastPrediction.status === 'pending' ? '⏳' : lastPrediction.status === 'accurate' ? '✓' : '✗' }}</span>
        </div>
      </div>

      <!-- Sparkline -->
      <div class="da-spark">
        <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" preserveAspectRatio="none" class="da-spark-svg">
          <defs>
            <linearGradient :id="`spark-fill-${id}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="sparkColor" stop-opacity="0.15" />
              <stop offset="100%" :stop-color="sparkColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polyline :points="`${sparkPoints} ${SVG_W},${SVG_H} 0,${SVG_H}`"
            :fill="`url(#spark-fill-${id})`" stroke="none" />
          <polyline :points="sparkPoints" fill="none"
            :stroke="sparkColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </div>

      <!-- Predict button -->
      <button
        class="da-predict-btn"
        :class="{ active: showIntuition }"
        @click.stop="showIntuition = !showIntuition"
        title="Record your price intuition"
      >
        🎯
        <span class="da-predict-label">{{ showIntuition ? 'Close' : 'Predict' }}</span>
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
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

/* ── Icon ── */
.da-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}

.da-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
  background: var(--bg-tertiary);
  display: block;
}

.da-symbol {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.48rem;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 999px;
  background: var(--da-cat-color, var(--border-secondary));
  color: #000;
  white-space: nowrap;
  letter-spacing: 0.04em;
}

/* Volatility pulse ring (Design.md: animation driven by volatility) */
.da-pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid var(--da-accent, transparent);
  opacity: 0;
  pointer-events: none;
}

.da-pulse-ring.active {
  animation: da-pulse var(--da-pulse, 2s) ease infinite;
}

@keyframes da-pulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(1.12); }
}

/* ── Info ── */
.da-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.da-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.da-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
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
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-white);
  font-family: var(--font-family-primary);
}

.da-change {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.da-change.pos {
  color: var(--success-green);
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.25);
}

.da-change.neg {
  color: var(--error-red);
  background: rgba(255,68,68,0.1);
  border: 1px solid rgba(255,68,68,0.25);
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

/* ── Sparkline ── */
.da-spark {
  flex-shrink: 0;
  width: 80px;
}

.da-spark-svg {
  width: 80px;
  height: 30px;
  display: block;
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

.da-predict-label {
  font-size: 0.42rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  max-height: 600px;
}

/* Responsive */
@media (max-width: 480px) {
  .da-row { gap: var(--spacing-sm); padding: var(--spacing-sm); }
  .da-spark { display: none; }
  .da-name  { font-size: 0.8rem; max-width: 120px; }
  .da-price { font-size: 0.9rem; }
}
</style>
