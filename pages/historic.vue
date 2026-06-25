<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import UIPill from '@/components/UI/Pill.vue'
import UICard from '@/components/UI/Card.vue'
import WalletTrades from '@/components/Wallet/Trades.vue'

definePageMeta({ title: 'History', description: 'Closed, open and upcoming trades across all wallets.', layout: 'default' })

interface Trade {
  id: string
  asset_id: string
  status?: 'closed' | 'open' | 'upcoming' | string
  pnl_usd?: number
  [key: string]: any
}

const walletStore = useWalletStore()

const tab = ref<'closed' | 'open' | 'upcoming'>('closed')
const search = ref('')
const loading = ref(true)

onMounted(async () => {
  if (!walletStore.hydrated) await walletStore.initializeStore()
  loading.value = false
})

const allTrades = computed<Trade[]>(() =>
  walletStore.wallets.flatMap(w => (w.transactions ?? []) as Trade[])
)

function statusOf(t: Trade): 'closed' | 'open' | 'upcoming' {
  if (t.status === 'open' || t.status === 'upcoming' || t.status === 'closed') return t.status
  return 'closed'
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return allTrades.value.filter(t => {
    if (statusOf(t) !== tab.value) return false
    if (!term) return true
    return (t.asset_id ?? '').toLowerCase().includes(term)
  })
})

const tabs = computed<TabItem[]>(() => [
  { id: 'closed',   label: 'Closed',   count: allTrades.value.filter(t => statusOf(t) === 'closed').length },
  { id: 'open',     label: 'Open',     count: allTrades.value.filter(t => statusOf(t) === 'open').length },
  { id: 'upcoming', label: 'Upcoming', count: allTrades.value.filter(t => statusOf(t) === 'upcoming').length }
])

const stats = computed(() => {
  const closed = allTrades.value.filter(t => statusOf(t) === 'closed')
  const totalPnl = closed.reduce((s, t) => s + (t.pnl_usd ?? 0), 0)
  const winners = closed.filter(t => (t.pnl_usd ?? 0) > 0).length
  const winRate = closed.length ? (winners / closed.length) * 100 : 0
  return {
    total: allTrades.value.length,
    totalPnl,
    winRate,
    wallets: walletStore.wallets.length
  }
})
</script>

<template>
  <div class="historic-page">
    <UIPageHeader
      title="History"
      subtitle="Every closed, open and upcoming trade — across every wallet you connect."
    >
      <template #actions>
        <UIPill tone="info">{{ stats.wallets }} wallets</UIPill>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="Total trades" :value="stats.total"   size="md" />
      <UIStat label="Realized PnL" :value="stats.totalPnl" tone="auto" suffix="USD" :precision="0" size="md" />
      <UIStat label="Win rate"     :value="stats.winRate"  suffix="%" :precision="1" size="md" />
      <UIStat label="Currently"    :value="tab"            size="md" />
    </UIMetricRow>

    <UICard title="Filters" padding="tight">
      <div class="filter-bar">
        <input
          v-model="search"
          type="search"
          placeholder="Search by asset symbol…"
          class="search-input"
          aria-label="Search history"
        />
      </div>
    </UICard>

    <UISectionTabs v-model="tab" :tabs="tabs" />

    <UICard :title="`${tab[0].toUpperCase() + tab.slice(1)} trades`">
      <UIEmptyState
        v-if="!loading && filtered.length === 0"
        icon="◯"
        title="No trades match this filter"
        message="Try another tab or clear the search box."
      />
      <WalletTrades v-else :trades="filtered" />
    </UICard>
  </div>
</template>

<style scoped>
.historic-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.filter-bar { display: flex; gap: 0.5rem; align-items: center; }
.search-input {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: var(--text-white, #fff);
  padding: 0.45rem 0.65rem;
  border-radius: var(--app-border-radius, 6px);
  font-family: inherit;
  font-size: 0.8rem;
  transition: border-color 0.18s ease, background 0.18s ease;
}
.search-input:focus {
  outline: none;
  border-color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.04);
}
</style>
