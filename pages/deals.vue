<script setup lang="ts">/**
 * Deal Pipeline — Cross-strategy trade desk view.
 * Shows every active strategy as a "deal" with its counterparty exposure
 * (suppliers/customers from supply chain data), commodity flows, and live P&L.
 *
 * Strategy user: "juggle between assets, their dealers and clients and commodities"
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStrategies } from '@/composables/useStrategies'
import { useMacroStore } from '@/stores/macro'
import { useWalletStore } from '@/stores/wallet'
import { useAssetsStore } from '@/stores/assets'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIPill from '@/components/UI/Pill.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import DealRow from '@/components/Strategy/DealRow.vue'
import type { DealData } from '@/components/Strategy/DealRow.vue'

definePageMeta({ title: 'Deal Pipeline', layout: 'default' })

const { strategies, fetchStrategies } = useStrategies()
const macro = useMacroStore()
const walletStore = useWalletStore()
const assetsStore = useAssetsStore()

const loading = ref(true)
const search = ref('')
const filterStatus = ref<string>('all')

// Live tick for P&L simulation
const tick = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

const supplyChainCache = ref<Record<string, any>>({})

// All symbols to fetch supply chain data for
const allCommoditySymbols = ['btc', 'eth', 'sol', 'aapl', 'amzn', 'tsla', 'usd', 'eur', 'cny']

onMounted(async () => {
  await Promise.all([
    fetchStrategies(),
    macro.initializeStore(),
    walletStore.initializeStore(),
    assetsStore.initializeStore(),
  ])

  // Load all supply chain data
  const entries = await Promise.all(
    allCommoditySymbols.map(async (sym) => {
      try {
        const data = await $fetch<any>(`/data/supply_chain/${sym}.json`)
        return [sym.toUpperCase(), data] as [string, any]
      } catch { return [sym.toUpperCase(), null] as [string, any] }
    })
  )
  for (const [sym, data] of entries) {
    if (data) supplyChainCache.value[sym] = data
  }

  loading.value = false

  // Simulate live ticks
  ticker = setInterval(() => {
    tick.value = (Math.random() - 0.45) * 2
  }, 4000)
})

onUnmounted(() => { if (ticker) clearInterval(ticker) })

// ─── Build deals from strategies + supply chain ─────────────────────────────
const deals = computed<DealData[]>(() =>
  strategies.value.map(s => {
    const targetSym = (s.target_assets?.[0] ?? '').toUpperCase()
    const sc = supplyChainCache.value[targetSym]
    const vol = macro.macroState?.volatility_by_class ?? {}

    // Extract counterparties from supply chain
    const counterparties: DealData['counterparties'] = []
    if (sc) {
      for (const sup of sc.suppliers ?? []) {
        counterparties.push({ name: sup.name, role: 'supplier', weight: sup.share_pct ?? 10, country: sup.country })
      }
      for (const cus of sc.customers ?? []) {
        counterparties.push({ name: cus.name, role: 'customer', weight: cus.share_pct ?? 10, country: cus.country })
      }
    }

    // Extract commodity flows from shipments
    const commodityFlows: DealData['commodityFlows'] = []
    if (sc) {
      for (const sh of sc.shipments ?? []) {
        commodityFlows.push({
          product: sh.product ?? 'Unknown',
          valueUsd: sh.value_usd ?? 0,
          from: sh.from_country ?? '?',
          to: sh.to_country ?? '?',
        })
      }
    }

    // Live P&L tick
    const assetVol = targetSym === 'BTC' || targetSym === 'ETH' || targetSym === 'SOL' ? vol.crypto ?? 0.5
      : targetSym === 'AAPL' || targetSym === 'AMZN' || targetSym === 'TSLA' ? vol.stocks ?? 0.3
      : 0.3
    const noise = tick.value * assetVol * 0.3

    return {
      id: s.id,
      name: s.name,
      status: s.status,
      targetAssets: s.target_assets ?? [],
      capital: s.current_capital ?? s.initial_capital ?? 0,
      returnPct: (s.total_return_percentage ?? 0) + noise,
      returnAbs: (s.total_return ?? 0) + noise * (s.current_capital ?? 10000) / 100,
      winRate: s.win_rate ?? 0,
      sharpe: s.sharpe_ratio ?? 0,
      maxDd: s.max_drawdown ?? 0,
      counterparties,
      commodityFlows,
      category: s.category ?? 'mixed',
    }
  })
)

// ─── Aggregates ──────────────────────────────────────────────────────────────
const activeDeals = computed(() => deals.value.filter(d => d.status === 'active'))
const totalCapitalExposed = computed(() => activeDeals.value.reduce((s, d) => s + d.capital, 0))
const totalPnl = computed(() => activeDeals.value.reduce((s, d) => s + d.returnAbs, 0))
const avgReturn = computed(() => {
  const a = activeDeals.value
  return a.length > 0 ? a.reduce((s, d) => s + d.returnPct, 0) / a.length : 0
})

// ─── Unique counterparties across all active deals ──────────────────────────
const allCounterparties = computed(() => {
  const map = new Map<string, { name: string; totalExposure: number; role: string; dealCount: number }>()
  for (const d of activeDeals.value) {
    for (const c of d.counterparties) {
      const existing = map.get(c.name) ?? { name: c.name, totalExposure: 0, role: c.role, dealCount: 0 }
      existing.totalExposure += c.weight
      existing.dealCount++
      map.set(c.name, existing)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalExposure - a.totalExposure)
})

// ─── Filter ──────────────────────────────────────────────────────────────────
const filteredDeals = computed(() => {
  let list = deals.value
  if (filterStatus !== 'all') list = list.filter(d => d.status === filterStatus)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(q) || d.targetAssets.some(a => a.toLowerCase().includes(q)))
  }
  return list
})
</script>

<template>
  <div class="deal-pipeline">
    <UIPageHeader title="Deal Pipeline" subtitle="Cross-strategy trade desk — track every deal, its counterparty exposure, commodity flows, and live P&L.">
      <template #actions>
        <NuxtLink to="/monitor" class="nav-link">Monitor →</NuxtLink>
        <NuxtLink to="/risk" class="nav-link">Risk Dashboard →</NuxtLink>
      </template>
    </UIPageHeader>

    <template v-if="loading">
      <AppSkeletonLoader height="60px" />
      <div class="skel-grid">
        <AppSkeletonLoader v-for="i in 4" :key="i" height="160px" />
      </div>
    </template>

    <template v-else>
      <!-- ── Aggregate bar ─────────────────────────────────────────────── -->
      <UIMetricRow :cols="5">
        <UIStat label="Active Deals" :value="activeDeals.length" size="md" />
        <UIStat label="Capital Exposed" :value="totalCapitalExposed" :precision="0" suffix="USD" size="md" />
        <UIStat label="Total P&L" :value="totalPnl" :precision="0" tone="auto" suffix="USD" size="md" />
        <UIStat label="Avg Return" :value="avgReturn" :precision="1" suffix="%" tone="auto" size="md" />
        <UIStat label="Counterparties" :value="allCounterparties.length" size="md" />
      </UIMetricRow>

      <!-- ── Top counterparties ────────────────────────────────────────── -->
      <UICard v-if="allCounterparties.length" title="Concentrated Counterparty Exposure" padding="compact">
        <div class="cp-strip">
          <div
            v-for="cp in allCounterparties.slice(0, 8)"
            :key="cp.name"
            class="cp-chip"
            :class="{ high: cp.totalExposure > 40, medium: cp.totalExposure > 20 }"
            :title="`${cp.name}: ${cp.totalExposure.toFixed(0)}% exposure across ${cp.dealCount} deals`"
          >
            <span class="cp-name">{{ cp.name.length > 20 ? cp.name.slice(0, 18) + '…' : cp.name }}</span>
            <span class="cp-expo">{{ cp.totalExposure.toFixed(0) }}%</span>
            <span class="cp-count">{{ cp.dealCount }} deal{{ cp.dealCount !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Filters ───────────────────────────────────────────────────── -->
      <div class="toolbar">
        <div class="status-filter">
          <button
            v-for="s in ['all', 'active', 'paused', 'stopped']"
            :key="s"
            class="filter-btn" :class="{ active: filterStatus === s }"
            @click="filterStatus = s"
          >{{ s.charAt(0).toUpperCase() + s.slice(1) }} ({{ s === 'all' ? deals.length : deals.filter(d => d.status === s).length }})</button>
        </div>
        <input v-model="search" type="text" class="search-input" placeholder="Search deals or assets..." />
      </div>

      <!-- ── Deal cards ────────────────────────────────────────────────── -->
      <div v-if="filteredDeals.length === 0" class="empty">
        No deals match your filters.
      </div>

      <div v-else class="deal-grid">
        <DealRow v-for="d in filteredDeals" :key="d.id" :deal="d" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.deal-pipeline {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.5rem;
}

.nav-link {
  color: var(--text-gray);
  font-size: 0.65rem;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  transition: border-color 0.12s ease, color 0.12s ease;
}
.nav-link:hover { border-color: var(--primary-green); color: var(--primary-green); }

/* Counterparty strip */
.cp-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.cp-chip {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border-secondary);
  min-width: 80px;
  cursor: default;
}
.cp-chip.high { border-color: rgba(255,68,68,0.3); background: rgba(255,68,68,0.04); }
.cp-chip.medium { border-color: rgba(247,147,26,0.3); background: rgba(247,147,26,0.04); }
.cp-name { font-size: 0.6rem; font-weight: 600; text-align: center; }
.cp-expo { font-size: 0.78rem; font-weight: 800; }
.cp-chip.high .cp-expo { color: var(--error-red); }
.cp-chip.medium .cp-expo { color: var(--warning-orange); }
.cp-count { font-size: 0.55rem; color: var(--text-gray); }

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.status-filter {
  display: flex;
  gap: 2px;
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.filter-btn {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-gray);
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.12s ease;
}
.filter-btn.active { background: rgba(0,255,136,0.12); color: var(--primary-green); }
.search-input {
  flex: 1;
  max-width: 220px;
  padding: 0.3rem 0.5rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.7rem;
  font-family: inherit;
}
.search-input:focus { outline: none; border-color: var(--primary-green); }

.deal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.5rem;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-gray);
  font-size: 0.85rem;
}
</style>
