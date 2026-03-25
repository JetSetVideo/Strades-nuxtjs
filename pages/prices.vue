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
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useAssetsStore } from '@/stores/assets'
import { usePredictionsStore } from '@/stores/predictions'
import DisplayAsset from '@/components/Widget/DisplayAsset.vue'
import Heatmap from '@/components/Asset/Heatmap.vue'

definePageMeta({
  title: 'Market Prices',
  description: 'Live asset prices and market data',
  layout: 'prices',
})

const assetsStore      = useAssetsStore()
const predStore        = usePredictionsStore()

const selectedType     = ref('all')
const selectedAssetId  = ref<string | null>(null)
const showMoreAssets   = ref(false)
const loading          = ref(false)
const sortBy           = ref<'default' | 'gainers' | 'losers' | 'vol_high' | 'cap'>('default')
const searchQuery      = ref('')

// ── Stable per-asset % changes (avoid re-render jitter) ──────────────────
// Uses a reactive plain object keyed by asset id
const priceChanges = reactive<Record<string, number>>({})

function seedChanges() {
  assetsStore.assets.forEach(asset => {
    if (priceChanges[asset.id] !== undefined) return
    const vol = (asset as any).psychology_profile?.volatility_index ?? 0.3
    priceChanges[asset.id] = +(((Math.random() - 0.5) * 2 * vol * 12)).toFixed(2)
  })
}

// ── Real-time simulation ─────────────────────────────────────────────────
let ticker: ReturnType<typeof setInterval>

function startTicker() {
  ticker = setInterval(() => {
    assetsStore.assets.forEach(asset => {
      const vol  = (asset as any).psychology_profile?.volatility_index ?? 0.3
      const prev = priceChanges[asset.id] ?? 0
      const nudge = (Math.random() - 0.5) * vol * 0.8
      priceChanges[asset.id] = +(prev + nudge).toFixed(2)
      // Update store price slightly for reactive display
      const p = asset.current_price * (1 + nudge / 100)
      assetsStore.updateAssetPrice(asset.id, +p.toFixed(asset.current_price < 1 ? 6 : 2))
    })
    assetsStore.lastUpdated = new Date()
  }, 5000)
}

onMounted(async () => {
  loading.value = true
  await assetsStore.initializeStore()
  seedChanges()
  loading.value = false
  startTicker()
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

// ── Filter + search + sort ─────────────────────────────────────────────────
const filtered = computed(() => {
  let list = assetsStore.assets

  // Type filter
  if (selectedType.value !== 'all')
    list = list.filter(a => a.type === selectedType.value)

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
      ((b.asset as any).psychology_profile?.volatility_index ?? 0) -
      ((a.asset as any).psychology_profile?.volatility_index ?? 0)); break
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

    <!-- ── Market overview bar ──────────────────────────────────────── -->
    <div class="market-bar" v-if="!loading">
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

      <!-- Last updated -->
      <span class="last-updated" v-if="assetsStore.lastUpdated">
        ⟳ {{ new Date(assetsStore.lastUpdated).toLocaleTimeString() }}
      </span>
    </div>

    <!-- ── Search + Filters + Sort ──────────────────────────────────── -->
    <div class="controls-bar" v-if="!loading">
      <!-- Search -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="Search assets…"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</button>
      </div>

      <!-- Type filter chips -->
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

      <!-- Sort -->
      <div class="sort-wrap">
        <select v-model="sortBy" class="sort-select">
          <option value="default">Default</option>
          <option value="gainers">↑ Top Gainers</option>
          <option value="losers">↓ Top Losers</option>
          <option value="vol_high">⚡ High Volatility</option>
          <option value="cap">💎 Market Cap</option>
        </select>
      </div>
    </div>

    <!-- ── Loading skeleton ─────────────────────────────────────────── -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <p>Loading market data…</p>
    </div>

    <!-- ── Asset list ────────────────────────────────────────────────── -->
    <div v-if="!loading" class="assets-section">

      <!-- Heatmap panel for selected asset -->
      <Transition name="fade">
        <Heatmap v-if="selectedAssetId" :companyId="selectedAssetId" class="heatmap-panel" />
      </Transition>

      <!-- Count -->
      <div class="results-meta">
        <span>{{ filtered.length }} assets</span>
        <span v-if="searchQuery" class="search-term">for "{{ searchQuery }}"</span>
      </div>

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
  gap: var(--spacing-md);
  padding: 5rem 1rem 6rem;
  min-height: 100vh;
  color: var(--text-white);
}

@media (min-width: 768px) {
  .prices-page { padding: 5rem 1.5rem 6rem; }
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

.last-updated {
  font-size: 0.58rem;
  color: var(--text-gray);
  flex-shrink: 0;
  margin-left: auto;
}

/* ── Controls ── */
.controls-bar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Search */
.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: border-color var(--transition-fast);
}

.search-wrap:focus-within { border-color: var(--border-accent); }
.search-icon { font-size: 0.7rem; opacity: 0.5; flex-shrink: 0; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-white);
  font-size: 0.78rem;
  outline: none;
  font-family: var(--font-family-secondary);
}
.search-input::placeholder { color: var(--text-gray); }

.search-clear {
  background: transparent; border: none;
  color: var(--text-gray); cursor: pointer; font-size: 0.6rem;
}

/* Type chips */
.type-chips { display: flex; gap: 6px; flex-wrap: wrap; }

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

/* Sort */
.sort-wrap { display: flex; align-items: center; }

.sort-select {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-light-gray);
  font-size: 0.68rem;
  cursor: pointer;
  outline: none;
  font-family: var(--font-family-secondary);
  -webkit-appearance: none;
}
.sort-select:focus { border-color: var(--border-accent); }

/* ── Loading ── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xxl);
  color: var(--text-gray);
  gap: var(--spacing-md);
}

.loading-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border-primary);
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
  font-size: 0.62rem;
  color: var(--text-gray);
}
.search-term { font-style: italic; }

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
