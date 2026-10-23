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
 *  • Each DisplayAsset card opens into its own prediction chart (PredictPanel)
 *  • One Line / Candles switch (ChartStyleToggle) drives every chart
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useTradingPrefsStore } from '@/stores/tradingPrefs'
import { useStreamedAssets } from '~/composables/useStreamedAssets'
import { feedKeyForAsset, feedStreams } from '~/utils/assetFeeds'
import { usePredictionsStore } from '@/stores/predictions'
import { useMacroStore } from '@/stores/macro'
import DisplayAsset from '@/components/Widget/DisplayAsset.vue'
import ChartStyleToggle from '@/components/Asset/ChartStyleToggle.vue'
import Heatmap from '@/components/Asset/Heatmap.vue'
import PricesMap from '@/components/Map/PricesMap.vue'
import PricesApiPanel from '@/components/Prices/ApiPanel.vue'
import { regionOf } from '~/composables/useAssetRegion'
import {
  isBetAsset,
  HORIZON_BUCKETS,
  defaultHorizonStates,
  applyHorizonStates,
  countHiddenByHorizonStates,
} from '~/utils/betAssets'
import {
  applyTypeFilters,
  cycleKey,
  sortAssets,
  type FilterTriState,
} from '~/utils/priceFilters'

definePageMeta({
  title: 'Market Prices',
  description: 'Live asset prices and market data',
  layout: 'default',
})

const { assetsStore, feedPrefs, dataFeeds, streamed } = useStreamedAssets()
const tradingPrefs     = useTradingPrefsStore()
onMounted(() => tradingPrefs.hydrate())
const predStore        = usePredictionsStore()
const macroStore       = useMacroStore()

const selectedAssetId  = ref<string | null>(null)
const sortBy           = ref<'default' | 'gainers' | 'losers' | 'vol_high' | 'cap'>('default')
const sortReverse      = ref(false)
const typeStates       = reactive<Record<string, FilterTriState>>({})
const searchQuery      = useState('marketQuery', () => '')
const viewMode         = ref<'list' | 'tree' | 'map'>('list')
const treeSelected     = ref<string | null>(null)
const liveCount        = computed(() => assetsStore.liveCount)
const loadError        = computed(() => assetsStore.error)
const selectedRegionIso = ref<string | null>(null)

// ── Bet class: horizon filter + API panel ────────────────────────────────
// Default horizon EXCLUDES far-future bets (see utils/betAssets.ts).
const horizonStates = reactive<Record<string, FilterTriState>>(defaultHorizonStates())
const showApiPanel = ref(false)
const hasBetAssets = computed(() => streamed.value.some(isBetAsset))

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
    // Live markets: the real 24h change, always (overwrites any earlier seed).
    if (asset.live && asset.change_24h_pct !== undefined) {
      priceChanges[asset.id] = +asset.change_24h_pct.toFixed(2)
      return
    }
    if (priceChanges[asset.id] !== undefined) return
    const vol = assetVolatility(asset)
    priceChanges[asset.id] = +(((Math.random() - 0.5) * 2 * vol * 12)).toFixed(2)
  })
  macroStore.updateFromPriceChanges(priceChanges)
}

// ── Real-time simulation ─────────────────────────────────────────────────
let ticker: ReturnType<typeof setInterval>

let tickCount = 0
function startTicker() {
  ticker = setInterval(async () => {
    // Every 30 s pull real quotes; live assets never get simulated nudges.
    if (++tickCount % 6 === 0) {
      await assetsStore.mergeLiveQuotes()
      seedChanges()
    }
    assetsStore.assets.forEach(asset => {
      const key = feedKeyForAsset(asset)
      if (!feedStreams(feedPrefs.isEnabled(key), dataFeeds.stateOf(key))) return
      if (asset.live) return
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

// Re-seed when live quotes land (same length, new data)
watch(() => assetsStore.liveCount, () => seedChanges())

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
  window.addEventListener('scroll', fillListIfNear, { passive: true })
  window.addEventListener('resize', fillListIfNear)
  nextTick(() => fillListIfNear())
})

onUnmounted(() => {
  clearInterval(ticker)
  listObserver?.disconnect()
  window.removeEventListener('scroll', fillListIfNear)
  window.removeEventListener('resize', fillListIfNear)
})

// ── Available filter types (no All — every chip neutral shows everything) ─
const filterTypes = computed(() => {
  const types = new Set(streamed.value.map(a => a.type))
  return Array.from(types)
})

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stocks',
  cryptocurrency: 'Crypto',
  crypto: 'Crypto',
  fiat_currency: 'Forex / Fiat',
  forex: 'Forex / Fiat',
  commodity: 'Commodities',
  bet: 'Bets',
}

const typeOptions = computed(() =>
  filterTypes.value.map(type => ({
    id: type,
    label: TYPE_LABELS[type] ?? type,
    tone: type === 'bet' ? 'bet' as const : undefined,
  })),
)

function resetHorizon() {
  for (const key of Object.keys(horizonStates)) delete horizonStates[key]
  Object.assign(horizonStates, defaultHorizonStates())
}

watch(hasBetAssets, (on) => {
  if (on) return
  delete typeStates.bet
  resetHorizon()
})

function resetFilters() {
  searchQuery.value = ''
  sortBy.value = 'default'
  sortReverse.value = false
  for (const key of Object.keys(typeStates)) delete typeStates[key]
  resetHorizon()
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
  let list = streamed.value

  // Settings › Trading › "Hide simulated assets"
  if (tradingPrefs.hideSimulated) list = list.filter(a => !!a.live)

  // Tri-state type chips: include whitelists, exclude always hides.
  list = applyTypeFilters(list, typeStates)

  // Bet time-horizon filter — removes ONLY bet rows resolving beyond the horizon.
  list = applyHorizonStates(list, horizonStates, Date.now())

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

  return sortAssets(list, sortBy.value, priceChanges, sortReverse.value)
})

/** Live quotes inside the current result set — the "40" next to the asset count. */
const liveInView = computed(() => filtered.value.filter(a => a.live).length)
const feedTitle = computed(() => {
  const n = filtered.value.length
  const live = liveInView.value
  if (!live) return `${n} assets in this list, none with a live quote. Open to see which API each asset comes from.`
  return `${live} of ${n} assets in this list have a live quote. Open to see which API each asset comes from.`
})

// Paint the top of the list first. Further rows mount as the scroll
// position nears the end, so a long list stays one continuous column.
const LIST_CHUNK = 10
const LIST_PRELOAD_PX = 800
const visibleCount = ref(LIST_CHUNK)
const visibleAssets = computed(() => filtered.value.slice(0, visibleCount.value))
const hasMoreAssets = computed(() => visibleCount.value < filtered.value.length)
const listSentinel = ref<HTMLElement | null>(null)
let listObserver: IntersectionObserver | null = null
let fillingList = false

function resetListWindow() {
  visibleCount.value = LIST_CHUNK
  nextTick(() => fillListIfNear())
}

async function fillListIfNear() {
  if (fillingList || typeof window === 'undefined') return
  fillingList = true
  try {
    while (visibleCount.value < filtered.value.length) {
      const el = listSentinel.value
      if (!el) break
      if (el.getBoundingClientRect().top > window.innerHeight + LIST_PRELOAD_PX) break
      const next = Math.min(filtered.value.length, visibleCount.value + LIST_CHUNK)
      if (next === visibleCount.value) break
      visibleCount.value = next
      await nextTick()
    }
  } finally {
    fillingList = false
  }
}

function bindListSentinel(el: HTMLElement | null) {
  listObserver?.disconnect()
  listObserver = null
  if (!el || typeof IntersectionObserver === 'undefined') return
  listObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) fillListIfNear()
  }, { rootMargin: `${LIST_PRELOAD_PX}px 0px` })
  listObserver.observe(el)
}

watch(listSentinel, bindListSentinel)
watch(() => filtered.value.length, () => { nextTick(() => fillListIfNear()) })
watch([sortBy, sortReverse, searchQuery, selectedRegionIso], resetListWindow)
watch(typeStates, resetListWindow, { deep: true })
watch(horizonStates, resetListWindow, { deep: true })
watch(() => tradingPrefs.hideSimulated, resetListWindow)

/** Bets the current horizon is hiding (shown next to the horizon chips). */
const hiddenBets = computed(() =>
  countHiddenByHorizonStates(streamed.value, horizonStates, Date.now())
)

// ── Market overview stats (bound to the filtered list) ────────────────────
function pctOf(asset: Asset): number {
  return priceChanges[asset.id] ?? asset.change_24h_pct ?? 0
}

const filteredMoves = computed(() =>
  filtered.value.map(a => ({ asset: a, pct: pctOf(a) }))
)

const gainers = computed(() =>
  filteredMoves.value.filter(({ pct }) => pct > 0).length
)
const losers = computed(() =>
  filteredMoves.value.filter(({ pct }) => pct < 0).length
)
const topGainer = computed(() => {
  const ups = filteredMoves.value.filter(({ pct }) => pct > 0)
  if (!ups.length) return null
  const best = ups.reduce((a, b) => b.pct > a.pct ? b : a)
  return { symbol: best.asset.symbol, pct: best.pct }
})
const topLoser = computed(() => {
  const downs = filteredMoves.value.filter(({ pct }) => pct < 0)
  if (!downs.length) return null
  const worst = downs.reduce((a, b) => b.pct < a.pct ? b : a)
  return { symbol: worst.asset.symbol, pct: worst.pct }
})

// Overall sentiment of the visible list (bull ≥ 0)
const marketSentiment = computed(() => {
  const vals = filteredMoves.value
  if (!vals.length) return 0
  return vals.reduce((sum, { pct }) => sum + pct, 0) / vals.length
})

const avgPrice = computed(() => {
  const list = filtered.value
  if (!list.length) return null
  return list.reduce((sum, a) => sum + (a.current_price || 0), 0) / list.length
})

const totalMarketCap = computed(() => {
  const sum = filtered.value.reduce((s, a) => s + (a.market_cap || 0), 0)
  return sum > 0 ? sum : null
})

function formatCompactUsd(value: number): string {
  const a = Math.abs(value)
  if (a >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `$${(value / 1e3).toFixed(1)}k`
  return `$${value.toFixed(value < 10 ? 2 : 0)}`
}

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

    <!-- ── Type + sort share one row; view and bet horizon sit below ─ -->
    <div class="controls-bar" v-if="hasData">
      <div class="controls-primary">
        <UIOpChips
          class="type-chips"
          label="Asset type"
          uppercase
          nowrap
          :options="typeOptions"
          :states="typeStates"
          @cycle="id => cycleKey(typeStates, id)"
        />

        <div class="sort-chips" role="group" aria-label="Sort">
          <button
            v-for="opt in SORTS"
            :key="opt.id"
            class="sort-chip"
            :class="{ active: sortBy === opt.id }"
            :aria-pressed="sortBy === opt.id"
            @click="sortBy = opt.id"
          >{{ opt.label }}</button>
          <button
            class="sort-chip dir-chip"
            :class="{ active: sortReverse }"
            :aria-pressed="sortReverse"
            :title="sortReverse ? 'List is bottom to top. Click to restore top to bottom.' : 'Flip the list bottom to top.'"
            @click="sortReverse = !sortReverse"
          >{{ sortReverse ? '↑ Reversed' : '↓ Order' }}</button>
        </div>

        <div class="results-meta">
          <button
            class="src-badge"
            :class="{ live: liveInView }"
            :title="feedTitle"
            :aria-label="feedTitle"
            @click="showApiPanel = true"
          >
            {{ filtered.length }} assets · {{ liveInView ? `${liveInView} live` : 'none live' }}
          </button>
          <span v-if="searchQuery" class="search-term">for "{{ searchQuery }}"</span>
          <button v-if="searchQuery" class="meta-clear" @click="searchQuery = ''">Clear</button>
          <button v-if="selectedRegionIso" class="region-chip" @click="selectedRegionIso = null">
            📍 {{ selectedRegionIso }} ✕
          </button>
        </div>
      </div>

      <div class="controls-secondary">
        <div class="view-toggle" role="group" aria-label="View mode">
          <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="List view">☰ List</button>
          <button :class="{ active: viewMode === 'tree' }" @click="viewMode = 'tree'" title="Market tree: parents ↔ children">⌥ Tree</button>
          <button :class="{ active: viewMode === 'map' }" @click="viewMode = 'map'" title="Map view">🌍 Map</button>
        </div>

        <ChartStyleToggle />

        <!-- Bet-only time horizon: hides bets resolving beyond the window. -->
        <div v-if="hasBetAssets" class="horizon-chips">
          <span class="horizon-label">Bet horizon</span>
          <UIOpChips
            label="Bet time horizon"
            tone="bet"
            :options="HORIZON_BUCKETS.map(h => ({ id: h.id, label: h.label }))"
            :states="horizonStates"
            @cycle="id => cycleKey(horizonStates, id)"
          />
          <span v-if="hiddenBets" class="horizon-hidden" :title="`${hiddenBets} bet(s) resolving outside the highlighted windows are hidden`">
            {{ hiddenBets }} hidden
          </span>
        </div>
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

    <!-- ── Nothing to show (load failed) ─────────────────────────────── -->
    <div v-if="!loading && !hasData" class="empty-state">
      <span class="empty-icon">📉</span>
      <p>{{ loadError ? 'Market data could not be loaded.' : 'No market data yet.' }}</p>
      <button class="reset-btn" @click="assetsStore.fetchAssets()">Retry</button>
    </div>

    <!-- ── Asset list ────────────────────────────────────────────────── -->
    <div v-if="hasData" class="assets-section">

      <!-- Tree view: Market → class → sector → asset, with the linking equations -->
      <PricesMarketTree
        v-if="viewMode === 'tree'"
        v-model:selected="treeSelected"
        :assets="filtered"
        :price-changes="priceChanges"
      />

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

      <template v-if="viewMode !== 'tree'">
      <div class="list-stack" v-if="filtered.length">
        <!-- Market overview sits flush above the asset list; stats follow filters -->
        <div
          class="market-bar"
          :class="marketSentiment >= 0 ? 'is-bull' : 'is-bear'"
        >
          <div
            class="market-sentiment"
            :class="marketSentiment >= 0 ? 'bull' : 'bear'"
          >
            <span class="ms-icon">{{ marketSentiment >= 0.5 ? '🟢' : marketSentiment >= 0 ? '🟡' : '🔴' }}</span>
            <span class="ms-label">{{ marketSentiment >= 0.5 ? 'Bullish' : marketSentiment >= 0 ? 'Neutral' : 'Bearish' }}</span>
            <span class="ms-val">{{ marketSentiment >= 0 ? '+' : '' }}{{ marketSentiment.toFixed(2) }}%</span>
          </div>

          <div class="market-stats">
            <div class="mstat-pair up">
              <div class="mstat">
                <span class="mstat-icon">↑</span>
                <span class="mstat-val">{{ gainers }}</span>
              </div>
              <div v-if="topGainer" class="mstat highlight">
                ↑ {{ topGainer.symbol }} +{{ topGainer.pct.toFixed(1) }}%
              </div>
            </div>

            <div class="mstat-pair down">
              <div class="mstat">
                <span class="mstat-icon">↓</span>
                <span class="mstat-val">{{ losers }}</span>
              </div>
              <div v-if="topLoser" class="mstat highlight">
                ↓ {{ topLoser.symbol }} {{ topLoser.pct.toFixed(1) }}%
              </div>
            </div>

            <div class="mstat-meta" v-if="avgPrice != null || totalMarketCap">
              <div v-if="avgPrice != null" class="mstat meta" title="Average price in this list">
                Avg {{ formatCompactUsd(avgPrice) }}
              </div>
              <div v-if="totalMarketCap" class="mstat meta" title="Total market cap in this list">
                Cap {{ formatCompactUsd(totalMarketCap) }}
              </div>
            </div>
          </div>
        </div>

        <div class="asset-grid">
          <DisplayAsset
            v-for="asset in visibleAssets"
            :key="asset.id"
            :asset="asset"
            :priceChangePct="priceChanges[asset.id]"
            :userId="'current_user'"
            @click="navigateToAsset"
          />
        </div>
      </div>
      <div
        v-if="hasMoreAssets"
        ref="listSentinel"
        class="list-sentinel"
        aria-hidden="true"
      />

      <div v-if="!filtered.length" class="empty-state">
        <span class="empty-icon">📊</span>
        <p>No assets match your filters.</p>
        <button @click="resetFilters" class="reset-btn">Reset filters</button>
      </div>
      </template>

    </div>

    <!-- ── Data APIs, grouped by what they feed ────────────────────── -->
    <PricesApiPanel v-model:open="showApiPanel" :catalog="assetsStore.assets" :active="filtered" />
  </div>
</template>

<style scoped>
.src-badge {
  font-size: .68rem; padding: 1px 8px; border-radius: 999px;
  border: 1px solid var(--border-primary); color: var(--text-secondary);
  background: transparent; cursor: pointer; font-family: inherit; white-space: nowrap;
}
.src-badge:hover { border-color: var(--border-accent); color: var(--text-white); }
.src-badge.live { color: var(--app-color-up, var(--success-green)); border-color: currentColor; }
.prices-page {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0;
  min-height: 100%;
  color: var(--text-white);
  /* Cap reading width on large/ultrawide screens — an uncapped single-column
   * list stretches into an uncomfortable half-empty row on wide viewports. */
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

/* ── Market overview bar — cap of the asset list ── */
.list-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.market-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: 0;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid var(--border-primary);
  /* Round top, square bottom — sits flush on the list below */
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border-bottom-color: transparent;
  flex-wrap: wrap;
  min-width: 0;
}

.market-bar.is-bull {
  border-color: color-mix(in srgb, var(--app-color-up, var(--success-green)) 28%, var(--border-primary));
  border-bottom-color: transparent;
}
.market-bar.is-bear {
  border-color: color-mix(in srgb, var(--app-color-down, var(--error-red)) 28%, var(--border-primary));
  border-bottom-color: transparent;
}

.market-sentiment {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  flex-shrink: 0;
  transition: border-radius 0.35s ease, background 0.35s ease, border-color 0.35s ease;
}

/* Strades directional corners:
 * up/green → right angles at top-right + bottom-left
 * down/red → pointy (sharp) at top-left + bottom-right */
.market-sentiment.bull {
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.3);
  color: var(--app-color-up, var(--success-green));
  border-radius: 8px 0 8px 0;
}
.market-sentiment.bear {
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: var(--app-color-down, var(--error-red));
  border-radius: 0 8px 0 8px;
}

.ms-icon  { font-size: 0.6rem; }
.ms-label { font-size: 0.62rem; }
.ms-val   { font-size: 0.68rem; font-weight: 800; }

.market-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}

.mstat-pair {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.mstat-pair.up { color: var(--app-color-up, var(--success-green)); }
.mstat-pair.down { color: var(--app-color-down, var(--error-red)); }

.mstat {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.62rem;
  line-height: 1.2;
}

.mstat-icon { font-size: 0.72rem; font-weight: 900; }
.mstat-val  { font-weight: 700; }
.mstat.highlight { font-weight: 700; font-size: 0.6rem; white-space: nowrap; }

.mstat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 1;
  min-width: 0;
}
.mstat.meta {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.58rem;
  font-family: var(--font-market-data, inherit);
  white-space: nowrap;
}

@media (max-width: 420px) {
  .mstat-meta { display: none; }
}

/* ── Toolbar: type + sort on one row, view + horizon on the next ── */
.controls-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.controls-primary,
.controls-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.controls-primary {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.controls-primary::-webkit-scrollbar { display: none; }

.controls-secondary { flex-wrap: wrap; }

.type-chips, .sort-chips, .view-toggle {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  flex-shrink: 0;
  align-items: center;
}

.type-chip {
  height: 26px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
  font-family: var(--font-family-secondary);
  white-space: nowrap;
  box-shadow: none;
}

.type-chip:hover { background: var(--bg-tertiary); color: var(--text-white); }

/* Include: raised — light inner edge, dark drop shadow. */
.type-chip.include {
  background: linear-gradient(180deg, #eafff4 0%, var(--primary-green) 42%, #00b368 100%);
  border-color: var(--primary-green);
  color: var(--secondary-darker);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.72),
    0 3px 8px rgba(0,0,0,0.55);
}
.type-chip.include:hover { color: var(--secondary-darker); }

/* Exclude: pressed — dark inset, light outer lip. */
.type-chip.exclude {
  background: #101218;
  border-color: rgba(255,255,255,0.08);
  color: var(--text-gray);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.78),
    0 1px 0 rgba(255,255,255,0.16);
}
.type-chip.exclude:hover { color: var(--text-light-gray); background: #101218; }

/* Bets: distinct hot-pink class, never the commodity/equity colours. */
.type-chip.bet { color: #ff4d9d; border-color: rgba(255,77,157,0.5); }
.type-chip.bet:hover { background: rgba(255,77,157,0.12); color: #ff4d9d; }
.type-chip.bet.include {
  background: linear-gradient(180deg, #ffe4f1 0%, #ff4d9d 46%, #d41474 100%);
  border-color: #ff4d9d;
  color: #1a0a12;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.7),
    0 3px 8px rgba(0,0,0,0.55);
}
.type-chip.bet.include:hover { color: #1a0a12; background: linear-gradient(180deg, #ffe4f1 0%, #ff4d9d 46%, #d41474 100%); }
.type-chip.bet.exclude {
  background: #140810;
  border-color: rgba(255,77,157,0.25);
  color: rgba(255,77,157,0.72);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.78),
    0 1px 0 rgba(255,77,157,0.28);
}
.type-chip.bet.exclude:hover { color: #ff4d9d; background: #140810; }

/* ── Bet time-horizon filter ── */
.horizon-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 6px;
  border-left: 1px solid var(--border-primary);
}
.horizon-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #ff4d9d;
  font-weight: 700;
  margin-right: 2px;
}
.horizon-chip {
  height: 26px;
  padding: 0 8px;
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
.horizon-chip:hover { color: var(--text-white); }
.horizon-chip.active {
  background: rgba(255,77,157,0.14);
  border-color: rgba(255,77,157,0.6);
  color: #ff4d9d;
}
.horizon-hidden {
  font-size: 0.6rem;
  color: var(--text-secondary);
  border: 1px dashed var(--text-secondary);
  border-radius: 999px;
  padding: 0 6px;
}

.sort-chip {
  height: 26px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  white-space: nowrap;
  box-shadow: none;
}
.sort-chip:hover { color: var(--text-white); }
.sort-chip.active {
  background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04));
  border-color: rgba(255,255,255,0.32);
  color: var(--text-white);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    0 3px 8px rgba(0,0,0,0.55);
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
  gap: var(--spacing-sm);
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
  flex-shrink: 0;
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
  height: 26px;
  padding: 0 0.6rem;
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
  gap: 4px;
  padding: 4px;
  margin: 0;
  border: 1px solid var(--border-primary);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: rgba(0, 0, 0, 0.12);
}

.list-stack:has(.market-bar.is-bull) .asset-grid {
  border-color: color-mix(in srgb, var(--app-color-up, var(--success-green)) 28%, var(--border-primary));
}
.list-stack:has(.market-bar.is-bear) .asset-grid {
  border-color: color-mix(in srgb, var(--app-color-down, var(--error-red)) 28%, var(--border-primary));
}

.list-stack:has(.market-bar) .asset-grid {
  border-top: none;
}

.list-sentinel { height: 1px; }

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

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
