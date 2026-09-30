<script setup lang="ts">
/**
 * Prices page — redesigned per Design.md / Data.md / CodingAgent.md
 *
 * Key principles applied:
 *  • global_volatility_index  → animation speed of the market sentiment strip
 *  • dominant_asset_class     → app border-radius shift (via CSS variable)
 *  • market_sentiment         → sentiment bar color saturation
 *  • asset.volatility_index   → per-card pulse speed (handled in DisplayAsset)
 *  • Stable price simulation: % changes are computed once and updated
 *    at a fixed interval instead of re-randomised on every render
 *  • PriceIntuition widget is embedded in each DisplayAsset card
 */
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useAssetsStore } from '@/stores/assets'
import { usePredictionsStore } from '@/stores/predictions'
import { useMacroStore } from '@/stores/macro'
import DisplayAsset from '@/components/Widget/DisplayAsset.vue'
import Heatmap from '@/components/Asset/Heatmap.vue'
import PricesMap from '@/components/Map/PricesMap.vue'
import { regionOf } from '~/composables/useAssetRegion'

definePageMeta({
  title: 'Market Prices',
  description: 'Live asset prices and market data',
  layout: 'default',
})

const assetsStore      = useAssetsStore()
const predStore        = usePredictionsStore()
const macroStore       = useMacroStore()

const selectedType     = ref('all')
const selectedAssetId  = ref<string | null>(null)
const showMoreAssets   = ref(false)
const sortBy           = ref<'default' | 'gainers' | 'losers' | 'vol_high' | 'cap'>('default')
const searchQuery      = useState('marketQuery', () => '')
const viewMode         = ref<'list' | 'map'>('list')
const selectedRegionIso = ref<string | null>(null)

// Aliases to store reactive state
const loading      = computed(() => assetsStore.loading)
const isRefreshing = computed(() => assetsStore.isRefreshing)
const hasData      = computed(() => assetsStore.assets.length > 0)

// ── Stable per-asset % changes (avoid re-render jitter) ──────────────────
// Uses a reactive plain object keyed by asset id
const priceChanges = reactive<Record<string, number>>({})

import type { Asset } from '~/types/asset'

function assetVolatility(asset: Asset): number {
  return asset.psychology_profile?.volatility_affinity
    ?? asset.fluctuation_velocity
    ?? 0.3
}

function seedChanges() {
  assetsStore.assets.forEach(asset => {
    if (priceChanges[asset.id] !== undefined) return
    const vol = assetVolatility(asset)
    priceChanges[asset.id] = +(((Math.random() - 0.5) * 2 * vol * 12)).toFixed(2)
  })
  macroStore.updateFromPriceChanges(priceChanges)
}

// ── Real-time simulation ─────────────────────────────────────────────────
let ticker: ReturnType<typeof setInterval>

function startTicker() {
  ticker = setInterval(() => {
    assetsStore.assets.forEach(asset => {
      const vol  = assetVolatility(asset)
      const prev = priceChanges[asset.id] ?? 0
      const nudge = (Math.random() - 0.5) * vol * 0.8
      priceChanges[asset.id] = +(prev + nudge).toFixed(2)
      // Update store price slightly for reactive display
      const p = asset.current_price * (1 + nudge / 100)
      assetsStore.updateAssetPrice(asset.id, +p.toFixed(asset.current_price < 1 ? 6 : 2))
    })
    // Sync aggregates into macro store so nav icons always reflect live session data
    macroStore.updateFromPriceChanges(priceChanges)
  }, 5000)
}

// Seed price changes + start ticker as soon as assets are available
// (may be from cache before network completes)
const tickerStarted = ref(false)
watch(
  () => assetsStore.assets.length,
  (len) => {
    if (len > 0) {
      seedChanges()
      if (!tickerStarted.value) {
        tickerStarted.value = true
        startTicker()
      }
    }
  },
  { immediate: true }
)

onMounted(async () => {
  assetsStore.initializeStore()
  predStore.init()
  predStore.seedFromFile()
})

onUnmounted(() => clearInterval(ticker))

// ── Available filter types ────────────────────────────────────────────────
const availableTypes = computed(() => {
  const types = new Set(assetsStore.assets.map(a => a.type))
  return ['all', ...Array.from(types)]
})

const TYPE_LABELS: Record<string, string> = {
  all: 'All',
  stock: 'Stocks',
  cryptocurrency: 'Crypto',
  fiat_currency: 'Forex / Fiat',
  commodity: 'Commodities',
}

const SORTS: { id: 'default' | 'gainers' | 'losers' | 'vol_high' | 'cap'; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'gainers', label: '↑ Top Gainers' },
  { id: 'losers', label: '↓ Top Losers' },
  { id: 'vol_high', label: '⚡ High Volatility' },
  { id: 'cap', label: '💎 Market Cap' },
]

// ── Filter + search + sort ─────────────────────────────────────────────────
const filtered = computed(() => {
  let list = assetsStore.assets

  // Type filter
  if (selectedType.value !== 'all')
    list = list.filter(a => a.type === selectedType.value)

  // Region filter (from the map view)
  if (selectedRegionIso.value)
    list = list.filter(a => regionOf(a).iso === selectedRegionIso.value)

  // Text search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.symbol.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q)
    )
  }

  // Sort
  const withChange = list.map(a => ({ asset: a, pct: priceChanges[a.id] ?? 0 }))
  switch (sortBy.value) {
    case 'gainers': withChange.sort((a, b) => b.pct - a.pct); break
    case 'losers':  withChange.sort((a, b) => a.pct - b.pct); break
    case 'vol_high': withChange.sort((a, b) =>
      (b.asset.fluctuation_velocity ?? b.asset.psychology_profile?.volatility_affinity ?? 0) -
      (a.asset.fluctuation_velocity ?? a.asset.psychology_profile?.volatility_affinity ?? 0)); break
    case 'cap': withChange.sort((a, b) => (b.asset.market_cap ?? 0) - (a.asset.market_cap ?? 0)); break
  }
  return withChange.map(x => x.asset)
})

const primaryAssets   = computed(() => filtered.value.slice(0, 6))
const additionalAssets = computed(() => filtered.value.slice(6))

// ── Market overview stats ─────────────────────────────────────────────────
const gainers = computed(() =>
  Object.entries(priceChanges).filter(([, v]) => v > 0).length
)
const losers = computed(() =>
  Object.entries(priceChanges).filter(([, v]) => v < 0).length
)
const topGainer = computed(() => {
  const entries = Object.entries(priceChanges)
  if (!entries.length) return null
  const [id, pct] = entries.reduce((a, b) => b[1] > a[1] ? b : a)
  const a = assetsStore.getAssetById(id)
  return a ? { symbol: a.symbol, pct } : null
})
const topLoser = computed(() => {
  const entries = Object.entries(priceChanges)
  if (!entries.length) return null
  const [id, pct] = entries.reduce((a, b) => b[1] < a[1] ? b : a)
  const a = assetsStore.getAssetById(id)
  return a ? { symbol: a.symbol, pct } : null
})

// Overall market sentiment: weighted avg of changes (bull > 0)
const marketSentiment = computed(() => {
  const vals = Object.values(priceChanges)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
})

// ── Actions ───────────────────────────────────────────────────────────────
function navigateToAsset(assetId: string) {
  selectedAssetId.value = assetId
}
</script>

<template>
  <div class="prices-page">

    <!-- ── Background-refresh overlay spinner ───────────────────────── -->
    <Transition name="fade">
      <div v-if="isRefreshing && hasData" class="refresh-overlay">
        <div class="refresh-pill">
          <div class="refresh-spinner" />
          <span>Updating…</span>
        </div>
      </div>
    </Transition>

    <!-- ── Market overview bar ──────────────────────────────────────── -->
    <div class="market-bar" v-if="hasData">
      <!-- Sentiment signal -->
      <div class="market-sentiment"
        :class="marketSentiment >= 0 ? 'bull' : 'bear'"
      >
        <span class="ms-icon">{{ marketSentiment >= 0.5 ? '🟢' : marketSentiment >= 0 ? '🟡' : '🔴' }}</span>
        <span class="ms-label">{{ marketSentiment >= 0.5 ? 'Bullish' : marketSentiment >= 0 ? 'Neutral' : 'Bearish' }}</span>
        <span class="ms-val">{{ marketSentiment >= 0 ? '+' : '' }}{{ marketSentiment.toFixed(2) }}%</span>
      </div>

      <div class="market-stats">
        <!-- Gainers/Losers -->
        <div class="mstat">
          <span class="mstat-icon" style="color:var(--success-green)">↑</span>
          <span class="mstat-val">{{ gainers }}</span>
        </div>
        <div class="mstat">
          <span class="mstat-icon" style="color:var(--error-red)">↓</span>
          <span class="mstat-val">{{ losers }}</span>
        </div>

        <!-- Top gainer / loser -->
        <div v-if="topGainer" class="mstat highlight" style="color:var(--success-green)">
          ↑ {{ topGainer.symbol }} +{{ topGainer.pct.toFixed(1) }}%
        </div>
        <div v-if="topLoser" class="mstat highlight" style="color:var(--error-red)">
          ↓ {{ topLoser.symbol }} {{ topLoser.pct.toFixed(1) }}%
        </div>
      </div>

    </div>

    <!-- ── Type, view, sort, and result count on one bar ───────────── -->
    <div class="controls-bar" v-if="hasData">
      <div class="type-chips">
        <button
          v-for="type in availableTypes"
          :key="type"
          class="type-chip"
          :class="{ active: selectedType === type }"
          @click="selectedType = type"
        >
          {{ TYPE_LABELS[type] ?? type }}
        </button>
      </div>

      <div class="view-toggle" role="group" aria-label="View mode">
        <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="List view">☰ List</button>
        <button :class="{ active: viewMode === 'map' }" @click="viewMode = 'map'" title="Map view">🌍 Map</button>
      </div>

      <div class="sort-chips" role="group" aria-label="Sort">
        <button
          v-for="opt in SORTS"
          :key="opt.id"
          class="sort-chip"
          :class="{ active: sortBy === opt.id }"
          @click="sortBy = opt.id"
        >{{ opt.label }}</button>
      </div>

      <div class="results-meta">
        <span>{{ filtered.length }} assets</span>
        <span v-if="searchQuery" class="search-term">for "{{ searchQuery }}"</span>
        <button v-if="searchQuery" class="meta-clear" @click="searchQuery = ''">Clear</button>
        <button v-if="selectedRegionIso" class="region-chip" @click="selectedRegionIso = null">
          📍 {{ selectedRegionIso }} ✕
        </button>
      </div>
    </div>

    <!-- ── Cold loading skeleton (no data at all) ──────────────────── -->
    <div v-if="loading && !hasData" class="loading-state">
      <div class="skeleton-cards">
        <div v-for="n in 6" :key="n" class="skeleton-card" />
      </div>
      <div class="loading-hint">
        <div class="loading-spinner" />
        <p>Loading market data…</p>
      </div>
    </div>

    <!-- ── Asset list ────────────────────────────────────────────────── -->
    <div v-if="hasData" class="assets-section">

      <!-- Map view -->
      <PricesMap
        v-if="viewMode === 'map'"
        :assets="filtered"
        :price-changes="priceChanges"
        :selected-iso="selectedRegionIso"
        @select="selectedRegionIso = $event"
      />

      <!-- Heatmap panel for selected asset -->
      <Transition name="fade">
        <Heatmap v-if="selectedAssetId" :companyId="selectedAssetId" class="heatmap-panel" />
      </Transition>

      <!-- Primary grid -->
      <div class="asset-grid">
        <DisplayAsset
          v-for="asset in primaryAssets"
          :key="asset.id"
          :asset="asset"
          :priceChangePct="priceChanges[asset.id]"
          :userId="'current_user'"
          @click="navigateToAsset"
        />
      </div>

      <!-- Empty state -->
      <div v-if="!filtered.length" class="empty-state">
        <span class="empty-icon">📊</span>
        <p>No assets match your filters.</p>
        <button @click="searchQuery = ''; selectedType = 'all'" class="reset-btn">Reset filters</button>
      </div>

      <!-- Show more -->
      <div v-if="additionalAssets.length" class="show-more-wrap">
        <button class="show-more-btn" @click="showMoreAssets = !showMoreAssets">
          {{ showMoreAssets ? '▲ Show less' : `▾ Show ${additionalAssets.length} more assets` }}
        </button>
      </div>

      <Transition name="fade">
        <div v-if="showMoreAssets" class="asset-grid additional">
          <DisplayAsset
            v-for="asset in additionalAssets"
            :key="asset.id"
            :asset="asset"
            :priceChangePct="priceChanges[asset.id]"
            :userId="'current_user'"
            @click="navigateToAsset"
          />
        </div>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
.prices-page {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0;
  min-height: 100%;
  color: var(--text-white);
  /* Cap reading width on large/ultrawide screens — an uncapped single-column
   * list stretches into an uncomfortable half-empty row on wide viewports. */
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

/* ── Market overview bar ── */
.market-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.market-sentiment {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.market-sentiment.bull { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); color: var(--success-green); }
.market-sentiment.bear { background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.3); color: var(--error-red); }

.ms-icon  { font-size: 0.65rem; }
.ms-label { font-size: 0.65rem; }
.ms-val   { font-size: 0.72rem; font-weight: 800; }

.market-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  flex-wrap: wrap;
}

.mstat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
}

.mstat-icon { font-size: 0.75rem; font-weight: 900; }
.mstat-val  { font-weight: 700; }
.mstat.highlight { font-weight: 700; font-size: 0.62rem; }

/* ── One toolbar: type, view, sort, count ── */
.controls-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.type-chips, .sort-chips, .view-toggle {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.type-chip {
  padding: 5px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  transition: all var(--transition-fast);
  font-family: var(--font-family-secondary);
  white-space: nowrap;
}

.type-chip:hover { background: var(--bg-tertiary); color: var(--text-white); }
.type-chip.active { background: var(--primary-gradient); border-color: var(--primary-green); color: var(--secondary-darker); }

.sort-chip {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  white-space: nowrap;
}
.sort-chip:hover { color: var(--text-white); }
.sort-chip.active {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.28);
  color: var(--text-white);
}

/* ── Background refresh overlay ── */
.refresh-overlay {
  position: fixed;
  top: 4.5rem;
  right: 1rem;
  z-index: 40;
  pointer-events: none;
}

.refresh-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  font-size: 0.65rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.refresh-spinner {
  width: 10px; height: 10px;
  border: 1.5px solid var(--border-secondary);
  border-top-color: var(--primary-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

/* ── Cold loading skeleton ── */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.loading-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.skeleton-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton-card {
  height: 72px;
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}

.loading-spinner {
  width: 28px; height: 28px;
  border: 2.5px solid var(--border-primary);
  border-top-color: var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Assets section ── */
.assets-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.heatmap-panel { margin-bottom: var(--spacing-sm); }

.results-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 0.62rem;
  color: var(--text-gray);
  white-space: nowrap;
}
.search-term { font-style: italic; }
.meta-clear {
  background: transparent;
  border: none;
  color: var(--text-light-gray);
  cursor: pointer;
  font-size: 0.62rem;
  font-family: inherit;
  padding: 0;
}
.region-chip {
  margin-left: auto;
  background: rgba(0,170,255,0.1);
  border: 1px solid rgba(0,170,255,0.3);
  color: var(--primary-blue, #00aaff);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
}

.view-toggle { display: flex; gap: 2px; }
.view-toggle button {
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
}
.view-toggle button.active {
  background: rgba(0,255,136,0.08);
  border-color: var(--primary-green);
  color: var(--primary-green);
}

.asset-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.additional { opacity: 0.85; }

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xxl);
  color: var(--text-gray);
}
.empty-icon { font-size: 2.5rem; opacity: 0.3; }
.empty-state p { font-size: 0.82rem; margin: 0; }

.reset-btn {
  font-size: 0.65rem;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-light-gray);
  cursor: pointer;
  font-family: var(--font-family-secondary);
  transition: all var(--transition-fast);
}
.reset-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-white); }

/* Show more */
.show-more-wrap { display: flex; justify-content: center; }

.show-more-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: transparent;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  color: var(--text-gray);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family-secondary);
}
.show-more-btn:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-white);
  border-color: var(--border-primary);
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
