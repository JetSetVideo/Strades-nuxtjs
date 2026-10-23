<template>
  <div class="allocation-slider-container" :style="rootStyle">
    <WalletEquityCurve
      v-if="chartTotal > 0"
      class="book-chart"
      :wallet-id="chartId"
      :total-value="chartTotal"
      :performance-history="wallet?.performance_history"
      :period="chartPeriod"
      :layers="paintedLayers"
      :breakdown="isAll ? 'Wallets' : 'Holdings'"
    />

    <div class="risk-strip">
      <div class="risk-head">
        <span class="risk-title">Risk profile</span>
        <span :class="['risk-pill', `lv-${risk.riskLevel}`]">{{ risk.riskLevel }}</span>
      </div>
      <div class="risk-metrics">
        <div class="metric">
          <span class="m-label">Sharpe</span>
          <span class="m-value">{{ risk.sharpe.toFixed(1) }}</span>
        </div>
        <div class="metric">
          <span class="m-label">Win rate</span>
          <span class="m-value">{{ risk.winRate.toFixed(1) }}%</span>
        </div>
        <div class="metric">
          <span class="m-label">Concentration</span>
          <span class="m-value">{{ (risk.concentration * 100).toFixed(0) }}</span>
        </div>
        <div class="metric">
          <span class="m-label">Risk score</span>
          <span class="m-value">{{ risk.riskScore }}/100</span>
        </div>
      </div>
    </div>

    <header class="slider-header">
      <div class="title-block">
        <h3 class="title">100% Allocation</h3>
        <p class="lede">{{ lede }}</p>
        <span class="subtitle" :class="{ ok: allocationStore.is100Percent }">
          {{ allocationStore.is100Percent ? 'Balanced' : 'Rebalancing…' }}
        </span>
      </div>
      <div
        class="health-indicator"
        :title="`Capital flow velocity ${(flowPct).toFixed(0)}% — how fast money is moving across this wallet`"
      >
        <span class="dot" :style="{ animationDuration: `${Math.max(0.3, 1.6 - flow * 1.4)}s` }" />
        <div class="health-copy">
          <span class="health-label">Flow velocity</span>
          <span class="flow-label">{{ flowPct }}%</span>
        </div>
      </div>
    </header>

    <div class="total-bar" role="img" :aria-label="barAria">
      <div
        v-for="seg in barSegments"
        :key="seg.id"
        class="total-segment"
        :class="[{ dominant: !isAll && macro.dominant_asset_class === seg.id, muted: isHidden(seg.id) }]"
        :style="{ width: `${seg.pct}%`, background: seg.color }"
        :title="`${seg.label}: ${seg.pct.toFixed(1)}%`"
      >
        <span v-if="seg.pct >= 10" class="segment-label">
          <span v-if="seg.pct >= 18" class="seg-name">{{ seg.label }}</span>
          {{ seg.pct.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Swarm advisory overlay: ghost markers showing where agents want the user to be -->
    <div v-if="!isAll && opinions.activeCount > 0" class="swarm-advisory">
      <div class="swarm-row">
        <span class="swarm-label">SWARM ({{ opinions.activeCount }}) · diverges {{ Math.round(opinions.divergence) }}%</span>
        <button type="button" class="apply-swarm" @click="opinions.commitToWallet()">Match swarm</button>
      </div>
      <div class="ghost-bar">
        <div
          v-for="key in visibleClasses"
          :key="key"
          :class="['ghost-seg', `bg-${key}`]"
          :style="{ width: `${opinions.swarmVector[key] ?? 0}%` }"
        />
      </div>
    </div>

    <div v-if="!visibleClasses.length" class="empty">
      This wallet has no holdings to allocate yet.
    </div>

    <div v-else class="sliders" :class="{ compact: isCompact, wallets: isAll }">
      <div
        v-for="row in rows"
        :key="row.id"
        class="slider-row"
        :class="[`row-${row.id}`, { dominant: !isAll && macro.dominant_asset_class === row.id, 'is-hidden': isHidden(row.id) }]"
      >
        <button
          v-if="!isAll"
          type="button"
          class="key-name"
          :title="`Set ${row.label} as the dominant class`"
          @click="setDominant(row.id)"
        >
          <span class="swatch" :style="{ background: row.color }" />
          {{ row.label }}
        </button>
        <span v-else class="key-name static">
          <span class="swatch" :style="{ background: row.color }" />
          {{ row.label }}
        </span>
        <input
          v-if="!isAll"
          type="range"
          :min="0"
          :max="100"
          :step="0.5"
          :value="pie[row.id]"
          :aria-label="`${row.label} allocation`"
          class="range-slider"
          :style="{ '--fill': `${row.pct}%`, '--track': row.color }"
          @input="onInput(row.id, Number(($event.target as HTMLInputElement).value))"
        />
        <span v-else class="share-track" aria-hidden="true">
          <span class="share-fill" :style="{ width: `${row.pct}%`, background: row.color }" />
        </span>
        <span class="percent">{{ row.pct.toFixed(1) }}%</span>
        <button
          type="button"
          class="eye"
          :aria-pressed="!isHidden(row.id)"
          :title="isHidden(row.id) ? `Show ${row.label} on the chart` : `Hide ${row.label} on the chart`"
          @click="toggleEye(row.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
            <path v-if="isHidden(row.id)" d="M5 19L19 5" stroke="currentColor" stroke-width="1.7" />
          </svg>
        </button>
      </div>
    </div>

    <footer v-if="!isAll && visibleClasses.length" class="slider-footer">
      <button type="button" class="reset-btn" :disabled="isEqual" @click="resetEqual">
        Reset equal
      </button>
      <button
        type="button"
        class="cycle-btn"
        :title="`Currently: ${macro.dominant_asset_class}`"
        @click="cycleDominant"
      >
        Dominant: {{ LABELS[macro.dominant_asset_class] ?? macro.dominant_asset_class }} →
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAllocationStore, type AllocationPie } from '~/stores/allocation'
import { EMPTY_ALLOCATION_PIE, normalizeAllocationPie } from '~/types/allocation'
import { useMacroStore, type AssetClass } from '~/stores/macro'
import { useOpinionsStore } from '~/stores/opinions'
import { useLivingUI } from '~/composables/useLivingUI'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { resolveAssetClass, type AssetClassId } from '~/utils/assetClass'
import {
  ALL_WALLETS,
  CLASS_COLORS,
  POINTS_FOR,
  WALLET_COLORS,
  assetLayers,
  riskProfile,
  sharePaths,
  walletLayers,
  type PieClass,
} from '~/utils/walletBook'

interface WalletAsset {
  asset_id?: string
  symbol: string
  current_value?: number
  allocation_percentage?: number
  return_percentage?: number
}

interface WalletLike {
  id?: string
  name?: string
  total_value?: number
  assets?: WalletAsset[]
  performance_history?: Record<string, { change: number; change_percentage: number }>
}

const props = withDefaults(defineProps<{
  /** Selected wallet, or the aggregated book when scope is `all`. */
  wallet?: WalletLike | null
  /** Every wallet. Used when the total chip is selected. */
  wallets?: WalletLike[]
  scope?: 'wallet' | 'all'
  period?: '1d' | '7d' | '30d' | '90d' | '1y'
}>(), {
  scope: 'wallet',
  period: '30d',
  wallets: () => [],
})

const allocationStore = useAllocationStore()
const macro = useMacroStore()
const opinions = useOpinionsStore()
const tracker = useAgentTracker()

const { dynamicStyles, isCompact } = useLivingUI({ density: 'compact' })

/** Drop living-UI scale — it blew past the page column width. */
const rootStyle = computed(() => {
  const s = { ...dynamicStyles.value } as Record<string, string | number>
  delete s.transform
  s['--lui-scale'] = '1'
  return s
})

const ORDER: Array<keyof AllocationPie> = ['fiat', 'crypto', 'stocks', 'commodities']
const LABELS: Record<keyof AllocationPie, string> = {
  fiat: 'Fiat',
  crypto: 'Crypto',
  stocks: 'Stocks',
  commodities: 'Commodities',
}
const COLORS: Record<keyof AllocationPie, string> = CLASS_COLORS

const chartPeriod = computed(() => props.period)
const isAll = computed(() => props.scope === 'all')
const chartId = computed(() => props.wallet?.id || (isAll.value ? ALL_WALLETS : 'wallet'))
const chartTotal = computed(() => Number(props.wallet?.total_value) || 0)

/** Groups hidden on the chart. A class in wallet scope, a wallet id when the total is selected. */
const hiddenGroups = ref<Set<string>>(new Set())
watch(() => [props.scope, props.wallet?.id], () => {
  hiddenGroups.value = new Set()
})

const isHidden = (id: string) => hiddenGroups.value.has(id)
const toggleEye = (id: string) => {
  const next = new Set(hiddenGroups.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  hiddenGroups.value = next
}

function toPieClass(id: AssetClassId): keyof AllocationPie {
  if (id === 'precious_metals') return 'commodities'
  if (id === 'fiat' || id === 'crypto' || id === 'stocks' || id === 'commodities') return id
  return 'stocks'
}

/** Build a closed 100% pie from the selected wallet’s positions. */
function pieFromWallet(wallet: WalletLike | null | undefined): AllocationPie {
  const assets = wallet?.assets ?? []
  if (!assets.length) return { ...EMPTY_ALLOCATION_PIE }

  const raw: AllocationPie = { ...EMPTY_ALLOCATION_PIE }
  let usedValue = false
  for (const a of assets) {
    const cls = toPieClass(resolveAssetClass({ symbol: a.symbol }))
    const value = Number(a.current_value)
    if (Number.isFinite(value) && value > 0) {
      raw[cls] += value
      usedValue = true
    }
  }
  if (!usedValue) {
    for (const a of assets) {
      const cls = toPieClass(resolveAssetClass({ symbol: a.symbol }))
      raw[cls] += Number(a.allocation_percentage) || 0
    }
  }
  return normalizeAllocationPie(raw)
}

const pie = computed(() => allocationStore.allocationPie)
const walletName = computed(() => props.wallet?.name ?? 'this wallet')
const lede = computed(() =>
  isAll.value
    ? 'Each wallet’s share of the combined book. The chart splits the same way.'
    : `Class breakdown of ${walletName.value}. Holdings sum to 100% of invested value.`,
)

const risk = computed(() => riskProfile(props.wallet?.assets ?? [], props.wallet?.performance_history))

interface BookRow { id: string; label: string; pct: number; color: string }

const walletRows = computed<BookRow[]>(() => {
  const list = props.wallets ?? []
  const sum = list.reduce((total, wallet) => total + (Number(wallet.total_value) || 0), 0) || 1
  return list.map((wallet, index) => ({
    id: wallet.id || `wallet-${index}`,
    label: wallet.name || 'Wallet',
    pct: ((Number(wallet.total_value) || 0) / sum) * 100,
    color: WALLET_COLORS[index % WALLET_COLORS.length],
  }))
})

const classRows = computed<BookRow[]>(() =>
  visibleClasses.value.map(key => ({
    id: key,
    label: LABELS[key],
    pct: pie.value[key],
    color: COLORS[key],
  })),
)

const rows = computed(() => (isAll.value ? walletRows.value : classRows.value))
const barSegments = computed(() => rows.value.filter(row => row.pct > 0))

const bookLayers = computed(() => {
  if (isAll.value) {
    return walletLayers((props.wallets ?? []).map((wallet, index) => ({
      id: wallet.id || `wallet-${index}`,
      name: wallet.name || 'Wallet',
      total_value: Number(wallet.total_value) || 0,
    })))
  }
  return assetLayers((props.wallet?.assets ?? []).map(asset => ({
    asset_id: asset.asset_id || asset.symbol,
    symbol: asset.symbol,
    current_value: asset.current_value,
  })))
})

const paintedLayers = computed(() => {
  const layers = bookLayers.value
  const n = POINTS_FOR[chartPeriod.value] ?? 30
  const grid = sharePaths(layers, n, `${chartId.value}::${chartPeriod.value}`)
  return layers.map((layer, index) => ({
    id: layer.id,
    label: layer.label,
    color: layer.color,
    hidden: hiddenGroups.value.has(layer.group),
    shares: grid.map(row => row[index] ?? 0),
  }))
})

/** Classes present in the selected wallet’s holdings — these are the only draggable rows. */
const visibleClasses = computed(() => {
  const present = new Set<keyof AllocationPie>()
  for (const a of props.wallet?.assets ?? []) {
    present.add(toPieClass(resolveAssetClass({ symbol: a.symbol })))
  }
  return ORDER.filter(k => present.has(k))
})

const flow = computed(() => allocationStore.flowVelocity || macro.flow_velocity || 0)
const flowPct = computed(() => Math.round(flow.value * 100))

const barAria = computed(() =>
  barSegments.value.map(seg => `${seg.label} ${seg.pct.toFixed(1)}%`).join(', ')
)

const isEqual = computed(() => {
  const n = visibleClasses.value.length
  if (!n) return true
  const target = 100 / n
  return visibleClasses.value.every(k => Math.abs(pie.value[k] - target) < 0.15)
})

watch(
  () => props.wallet?.id,
  () => {
    const next = pieFromWallet(props.wallet)
    allocationStore.$patch({ allocationPie: next })
    // Dominant class follows the heaviest sleeve in this wallet
    const top = ORDER.reduce((a, b) => (next[b] > next[a] ? b : a), ORDER[0])
    if (next[top] > 0) macro.applyTick({ dominant_asset_class: top as AssetClass })
  },
  { immediate: true }
)

// Re-sync when holdings values change for the same wallet (live marks)
watch(
  () => (props.wallet?.assets ?? []).map(a => `${a.symbol}:${a.current_value}`).join('|'),
  () => {
    if (!props.wallet?.id) return
    allocationStore.$patch({ allocationPie: pieFromWallet(props.wallet) })
  }
)

const onInput = (category: string, value: number) => {
  if (!ORDER.includes(category as PieClass)) return
  const key = category as keyof AllocationPie
  const previous = allocationStore.allocationPie[key]
  // Keep absent classes at 0 while squeezing among the visible set
  const locked = ORDER.filter(k => !visibleClasses.value.includes(k))
  allocationStore.updateAllocation(key, value)
  for (const k of locked) allocationStore.allocationPie[k] = 0
  // Renormalize visible share to 100 after locking zeros
  const vis = visibleClasses.value
  const sum = vis.reduce((s, k) => s + allocationStore.allocationPie[k], 0)
  if (sum > 0 && Math.abs(sum - 100) > 0.05) {
    for (const k of vis) {
      allocationStore.allocationPie[k] = (allocationStore.allocationPie[k] / sum) * 100
    }
  }
  tracker.track('allocation_change', { category, magnitude: value - previous, new_value: value })
}

const setDominant = (k: string) => {
  if (!ORDER.includes(k as PieClass)) return
  macro.applyTick({ dominant_asset_class: k as AssetClass })
}

const cycleDominant = () => {
  const pool = visibleClasses.value.length ? visibleClasses.value : ORDER
  const idx = pool.indexOf(macro.dominant_asset_class as keyof AllocationPie)
  setDominant(pool[(idx + 1) % pool.length]!)
}

const resetEqual = () => {
  const n = visibleClasses.value.length
  if (!n) return
  const share = 100 / n
  const next: AllocationPie = { ...EMPTY_ALLOCATION_PIE }
  for (const k of visibleClasses.value) next[k] = share
  allocationStore.$patch({ allocationPie: next })
}
</script>

<style scoped>
.allocation-slider-container {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(20, 20, 28, 0.92), rgba(14, 14, 18, 0.92));
  backdrop-filter: blur(var(--app-glass-blur, 10px));
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: white;
  /* living-UI padding/radius applied via :style; no transform scale */
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.title {
  margin: 0;
  font-family: var(--font-chrome, 'Poppins', sans-serif);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.lede {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.55);
}
.lede strong { color: rgba(255, 255, 255, 0.88); font-weight: 600; }

.subtitle {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--warning-orange, #ffa500);
}
.subtitle.ok { color: var(--primary-green, #00ff88); }

.health-indicator {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.health-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.health-label {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}
.flow-label {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-green, #00ff88);
  animation: pulse-dot infinite ease-in-out;
  flex-shrink: 0;
}
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.6); transform: scale(1); }
  50% { box-shadow: 0 0 0 5px rgba(0, 255, 136, 0); transform: scale(1.15); }
}

.total-bar {
  display: flex;
  width: 100%;
  height: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--app-border-radius, 6px);
}
.total-segment {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  transition: width 0.25s ease, filter 0.3s ease;
}
.total-segment.dominant { filter: brightness(1.15) saturate(1.15); }
.segment-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 4px;
  font-size: 0.58rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(0, 0, 0, 0.72);
  white-space: nowrap;
  overflow: hidden;
}
.seg-name {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.85;
}

.swarm-advisory {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.35rem 0.45rem;
  background: rgba(0, 255, 136, 0.04);
  border: 1px dashed rgba(0, 255, 136, 0.2);
  border-radius: 6px;
  margin-bottom: 0.55rem;
}
.swarm-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.swarm-label {
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-green, #00ff88);
}
.apply-swarm {
  background: transparent;
  border: 1px solid var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
}
.apply-swarm:hover { background: rgba(0, 255, 136, 0.15); }
.ghost-bar {
  display: flex;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  opacity: 0.5;
}
.ghost-seg { height: 100%; transition: width 0.4s ease; }

.empty {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
  padding: 0.35rem 0;
}

.sliders { display: flex; flex-direction: column; gap: 0.45rem; }
.sliders.compact { gap: 0.3rem; }
.sliders.wallets .slider-row {
  grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) 3.2rem 1.4rem;
}

.slider-row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) 3.2rem 1.4rem;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.4rem;
  border-radius: var(--app-border-radius, 8px);
  background: rgba(255, 255, 255, 0.03);
  min-width: 0;
}
.slider-row.dominant {
  background: rgba(0, 255, 136, 0.07);
}
.slider-row.is-hidden { opacity: 0.42; }

.key-name.static { cursor: default; }
.key-name.static:hover { color: inherit; }

.share-track {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.share-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.eye {
  width: 1.35rem;
  height: 1.35rem;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
}
.eye svg { width: 14px; height: 14px; }
.eye:hover { border-color: rgba(255, 255, 255, 0.4); color: #fff; }
.eye[aria-pressed="false"] { color: rgba(255, 255, 255, 0.35); }

.total-segment.muted { opacity: 0.28; }

.book-chart { margin-bottom: 0.45rem; }

.risk-strip {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.risk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
.risk-title {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
}
.risk-pill {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
}
.lv-low { background: rgba(0, 255, 136, 0.12); color: var(--success-green, #00ff88); }
.lv-medium { background: rgba(255, 170, 0, 0.12); color: #ffaa00; }
.lv-high { background: rgba(255, 77, 106, 0.15); color: #ff4d6a; }
.risk-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.3rem;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
  min-width: 0;
  padding: 0.28rem 0.4rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 5px;
}
.m-label {
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
  font-weight: 700;
}
.m-value {
  font-size: 0.86rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
@media (max-width: 540px) {
  .risk-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .slider-row { grid-template-columns: 4.6rem minmax(0, 1fr) 2.8rem 1.35rem; }
  .slider-header { flex-wrap: wrap; }
  .title-block { flex: 1 1 100%; }
  .health-indicator { margin-left: auto; }
}

.key-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.65rem;
  cursor: pointer;
  padding: 0;
  min-width: 0;
}
.key-name:hover { color: var(--primary-green, #00ff88); }

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Track: filled (left of thumb) = full class color; remainder muted */
.range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  outline: none;
  min-width: 0;
  background: linear-gradient(
    to right,
    var(--track) 0%,
    var(--track) var(--fill, 0%),
    rgba(255, 255, 255, 0.1) var(--fill, 0%),
    rgba(255, 255, 255, 0.1) 100%
  );
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--track, #fff);
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
}
.range-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--track, #fff);
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
}
.range-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: transparent;
}

.percent {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 0.78rem;
}

.bg-fiat { background: #4A90E2; }
.bg-crypto { background: #F5A623; }
.bg-stocks { background: #7ED321; }
.bg-commodities { background: #F8E71C; }

.slider-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.55rem;
  gap: 0.4rem;
}
.reset-btn,
.cycle-btn {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  padding: 0.3rem 0.55rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: all 0.2s ease;
}
.reset-btn:hover:not(:disabled),
.cycle-btn:hover {
  background: rgba(0, 255, 136, 0.1);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
