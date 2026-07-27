<script setup lang="ts">
/**
 * CommodityPipeline — Maps supply-chain commodity flow impact on strategies.
 * Shows how raw materials, dealers, and clients propagate through the portfolio,
 * with real-time risk overlay from macro volatility data.
 *
 * Links to: stores/wallet.ts, stores/macro.ts, stores/strategies.ts
 */
import { ref, computed, onMounted } from 'vue'
import { useMacroStore } from '@/stores/macro'
import { useStrategiesStore } from '@/stores/strategies'
import { useAssetsStore } from '@/stores/assets'
import UIPill from '@/components/UI/Pill.vue'
import type { Strategy } from '@/stores/strategies'

const props = withDefaults(defineProps<{
  maxItems?: number
  compact?: boolean
}>(), { maxItems: 20, compact: false })

const macroStore = useMacroStore()
const strategiesStore = useStrategiesStore()
const assetsStore = useAssetsStore()

const loading = ref(true)

const supplyChainData = ref<Record<string, any>>({})
const commoditySymbols = ['BTC', 'ETH', 'SOL', 'AAPL', 'AMZN', 'TSLA', 'USD', 'EUR', 'CNY']

onMounted(async () => {
  await Promise.all([
    macroStore.initializeStore(),
    strategiesStore.fetchStrategies(),
    assetsStore.initializeStore(),
  ])

  // Load supply chain JSON files
  const entries = await Promise.all(
    commoditySymbols.map(async (sym) => {
      try {
        const data = await $fetch<any>(`/data/supply_chain/${sym.toLowerCase()}.json`)
        return [sym, data] as [string, any]
      } catch { return [sym, null] as [string, any] }
    })
  )
  supplyChainData.value = Object.fromEntries(entries.filter(([, d]) => d !== null))
  loading.value = false
})

// ─── Derived data ────────────────────────────────────────────────────────────

const strategies = computed(() => strategiesStore.strategies)

/** Map each strategy to the commodities/assets it touches via target_assets */
const strategyCommodityMap = computed(() => {
  const map: { strategy: Strategy; commodities: string[]; riskFactor: number }[] = []
  for (const s of strategies.value) {
    const related = s.target_assets.filter(a => commoditySymbols.includes(a.toUpperCase()))
    if (related.length > 0) {
      const volByClass = macroStore.volatility_by_class ?? {}
      const avgVol = related.reduce((sum, a) => {
        const asset = assetsStore.getAssetBySymbol(a)
        const cls = asset?.type === 'cryptocurrency' ? 'crypto' : asset?.type === 'stock' ? 'stocks' : 'fiat'
        return sum + (volByClass[cls] ?? 0.3)
      }, 0) / Math.max(1, related.length)
      map.push({ strategy: s, commodities: related, riskFactor: avgVol })
    }
  }
  return map.sort((a, b) => b.riskFactor - a.riskFactor).slice(0, props.maxItems)
})

/** Aggregate flow: how much capital is exposed to each commodity */
const commodityExposure = computed(() => {
  const map: Record<string, { totalCapital: number; strategyCount: number; riskFactor: number; type: string }> = {}
  for (const item of strategyCommodityMap.value) {
    for (const c of item.commodities) {
      if (!map[c]) {
        const asset = assetsStore.getAssetBySymbol(c)
        map[c] = { totalCapital: 0, strategyCount: 0, riskFactor: 0, type: asset?.type ?? 'unknown' }
      }
      map[c].totalCapital += item.strategy.current_capital ?? 0
      map[c].strategyCount++
      map[c].riskFactor = Math.max(map[c].riskFactor, item.riskFactor)
    }
  }
  return Object.entries(map)
    .map(([sym, d]) => ({ symbol: sym, ...d }))
    .sort((a, b) => b.totalCapital - a.totalCapital)
})

/** Commodity price simulation from macro volatility */
const commodityPrices = computed(() => {
  const volByClass = macroStore.volatility_by_class ?? {}
  return commodityExposure.value.map(c => {
    const asset = assetsStore.getAssetBySymbol(c.symbol)
    const basePrice = asset?.current_price ?? 100
    const cls = asset?.type === 'cryptocurrency' ? 'crypto' : asset?.type === 'stock' ? 'stocks' : 'fiat'
    const vol = volByClass[cls] ?? 0.2
    return {
      symbol: c.symbol,
      price: basePrice,
      volatility: vol,
      change24h: (Math.random() - 0.45) * vol * 5,
    }
  })
})

const totalExposedCapital = computed(() =>
  commodityExposure.value.reduce((s, c) => s + c.totalCapital, 0)
)

const typeColor = (t: string): string => {
  const map: Record<string, string> = {
    cryptocurrency: 'var(--asset-btc)',
    stock: 'var(--primary-blue)',
    fiat_currency: 'var(--success-green)',
    commodity: 'var(--warning-orange)',
  }
  return map[t] ?? 'var(--text-gray)'
}
</script>

<template>
  <div class="commodity-pipeline" :class="{ compact }">
    <!-- Header summary -->
    <div class="pipeline-header" v-if="!loading && !compact">
      <span class="pipeline-title">Commodity Pipeline</span>
      <span class="pipeline-sub">
        {{ commodityExposure.length }} commodities · {{ totalExposedCapital > 0 ? `$${(totalExposedCapital / 1000).toFixed(0)}K exposed` : 'No exposure' }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-pulse">
      <div class="pulse-line" />
      <div class="pulse-line short" />
    </div>

    <!-- Empty -->
    <div v-else-if="commodityExposure.length === 0" class="empty">
      No strategies are linked to commodities or supply-chain assets yet. Create a strategy targeting an asset to see pipeline data.
    </div>

    <template v-else>
      <!-- Commodity price cards -->
      <div class="price-strip">
        <div v-for="c in commodityPrices.slice(0, compact ? 4 : 8)" :key="c.symbol" class="price-chip"
          :style="{ borderColor: c.change24h >= 0 ? 'var(--success-green)' : 'var(--error-red)' }">
          <span class="pc-sym">{{ c.symbol }}</span>
          <span class="pc-price">${{ c.price.toLocaleString() }}</span>
          <span class="pc-chg" :style="{ color: c.change24h >= 0 ? 'var(--success-green)' : 'var(--error-red)' }">
            {{ c.change24h >= 0 ? '+' : '' }}{{ c.change24h.toFixed(1) }}%
          </span>
        </div>
      </div>

      <!-- Exposure bars -->
      <div class="exposure-list">
        <div v-for="c in commodityExposure.slice(0, compact ? 5 : props.maxItems)" :key="c.symbol" class="ex-row">
          <span class="ex-sym" :style="{ color: typeColor(c.type) }">{{ c.symbol }}</span>
          <div class="ex-bar-track">
            <div class="ex-bar-fill" :style="{
              width: `${Math.min(100, (c.totalCapital / Math.max(1, totalExposedCapital)) * 100)}%`,
              background: typeColor(c.type)
            }" />
          </div>
          <span class="ex-capital">${{ (c.totalCapital / 1000).toFixed(0) }}K</span>
          <span class="ex-count">{{ c.strategyCount }} strat</span>
          <UIPill
            :tone="c.riskFactor > 0.5 ? 'danger' : c.riskFactor > 0.25 ? 'warning' : 'success'"
            size="sm"
          >{{ (c.riskFactor * 100).toFixed(0) }}% vol</UIPill>
        </div>
      </div>

      <!-- Strategy-commodity mapping (non-compact) -->
      <div v-if="!compact && strategyCommodityMap.length > 0" class="strat-map">
        <span class="map-label">Strategies × Commodities</span>
        <div v-for="item in strategyCommodityMap.slice(0, 5)" :key="item.strategy.id" class="map-row">
          <span class="map-name">{{ item.strategy.name }}</span>
          <div class="map-tags">
            <span v-for="c in item.commodities" :key="c" class="map-tag"
              :style="{ borderColor: typeColor(assetsStore.getAssetBySymbol(c)?.type ?? '') }">
              {{ c }}
            </span>
          </div>
          <UIPill :tone="item.riskFactor > 0.5 ? 'danger' : item.riskFactor > 0.25 ? 'warning' : 'success'" size="sm">
            {{ (item.riskFactor * 100).toFixed(0) }}%
          </UIPill>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.commodity-pipeline {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.commodity-pipeline.compact { gap: 0.35rem; }

.pipeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pipeline-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-white);
}
.pipeline-sub {
  font-size: 0.6rem;
  color: var(--text-gray);
}

.loading-pulse { display: flex; flex-direction: column; gap: 0.4rem; }
.pulse-line {
  height: 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}
.pulse-line.short { width: 60%; }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

.empty {
  font-size: 0.78rem;
  color: var(--text-gray);
  font-style: italic;
  line-height: 1.5;
}

/* Price strip */
.price-strip {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 2px;
}
.price-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.35rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-sm);
  min-width: 64px;
}
.pc-sym { font-size: 0.65rem; font-weight: 700; }
.pc-price { font-size: 0.7rem; font-variant-numeric: tabular-nums; }
.pc-chg { font-size: 0.6rem; font-weight: 600; }

/* Exposure */
.exposure-list { display: flex; flex-direction: column; gap: 0.3rem; }
.ex-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 60px 52px 48px;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.7rem;
}
.ex-sym { font-weight: 800; letter-spacing: 0.04em; }
.ex-bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.ex-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
.ex-capital { font-variant-numeric: tabular-nums; text-align: right; }
.ex-count { font-size: 0.6rem; color: var(--text-gray); }

/* Strategy map */
.strat-map { display: flex; flex-direction: column; gap: 0.3rem; }
.map-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}
.map-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.3rem 0.4rem;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-sm);
}
.map-name { font-size: 0.72rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.map-tags { display: flex; gap: 3px; }
.map-tag {
  font-size: 0.55rem;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 600;
}
</style>
