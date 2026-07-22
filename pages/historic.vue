<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { usePaperStore } from '@/stores/paper'

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
const paper = usePaperStore()

const tab = ref<'closed' | 'open' | 'upcoming' | 'paper'>('closed')
const search = ref('')
const loading = ref(true)

onMounted(async () => {
  if (!walletStore.hydrated) await walletStore.initializeStore()
  paper.hydrate()
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

/** Paper ledger rows, filtered by current search */
const paperFiltered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return paper.trades.filter(t => {
    if (!term) return true
    return t.asset_symbol.toLowerCase().includes(term) || t.asset_id.toLowerCase().includes(term)
  })
})

const tabs = computed<TabItem[]>(() => [
  { id: 'closed',   label: 'Closed',   count: allTrades.value.filter(t => statusOf(t) === 'closed').length },
  { id: 'open',     label: 'Open',     count: allTrades.value.filter(t => statusOf(t) === 'open').length },
  { id: 'upcoming', label: 'Upcoming', count: allTrades.value.filter(t => statusOf(t) === 'upcoming').length },
  { id: 'paper',    label: 'Paper',    count: paper.trades.length }
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

    <UICard v-if="tab !== 'paper'" :title="`${tab[0].toUpperCase() + tab.slice(1)} trades`">
      <UIEmptyState
        v-if="!loading && filtered.length === 0"
        icon="◯"
        title="No trades match this filter"
        message="Try another tab or clear the search box."
      />
      <WalletTrades v-else :trades="filtered" />
    </UICard>

    <UICard v-else title="Paper trades ledger" padding="tight">
      <UIEmptyState
        v-if="!loading && paperFiltered.length === 0"
        icon="P"
        title="No paper trades yet"
        message="Place a simulated bet from any asset page or strategy to see it here."
      />
      <div v-else class="paper-ledger">
        <div
          v-for="t in paperFiltered"
          :key="t.id"
          class="paper-row"
          :data-side="t.side"
          :data-status="t.status"
        >
          <div class="pr-left">
            <span class="pr-chip">P</span>
            <div class="pr-id">
              <span class="pr-symbol">{{ t.asset_symbol }}</span>
              <span class="pr-meta">
                {{ t.side.toUpperCase() }} · {{ t.wallet_pct.toFixed(1) }}% wallet · ${{ t.notional_value.toFixed(0) }} notional
              </span>
              <span class="pr-time">{{ new Date(t.timestamp).toLocaleString() }}</span>
              <span v-if="t.strategy_id || t.agent_id" class="pr-source">
                {{ t.strategy_id ? `strategy: ${t.strategy_id}` : '' }}
                {{ t.agent_id ? ` agent: ${t.agent_id}` : '' }}
              </span>
            </div>
          </div>
          <div class="pr-right">
            <template v-if="t.status === 'open'">
              <span class="pr-pnl" :data-tone="t.hypothetical_pnl_value >= 0 ? 'pos' : 'neg'">
                {{ t.hypothetical_pnl_value >= 0 ? '+' : '' }}${{ t.hypothetical_pnl_value.toFixed(2) }}
              </span>
              <span class="pr-tag open">open</span>
            </template>
            <template v-else>
              <span class="pr-pnl" :data-tone="(t.realized_pnl_value ?? 0) >= 0 ? 'pos' : 'neg'">
                {{ (t.realized_pnl_value ?? 0) >= 0 ? '+' : '' }}${{ (t.realized_pnl_value ?? 0).toFixed(2) }}
              </span>
              <span class="pr-tag closed">closed</span>
            </template>
          </div>
        </div>
      </div>
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

/* Paper ledger — dotted left border per Design.md §4 */
.paper-ledger { display: flex; flex-direction: column; gap: 0.4rem; }
.paper-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  background: rgba(255,255,255,0.02);
  border-radius: var(--app-border-radius, 6px);
  border-left: 2px dotted color-mix(in oklch, var(--primary-blue) 50%, transparent);
}
.paper-row[data-side="sell"] { border-left-color: oklch(0.65 0.2 25 / 0.5); }

.pr-left { display: flex; align-items: center; gap: 0.55rem; min-width: 0; flex: 1; }
.pr-chip {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--primary-blue) 50%, transparent);
  color: white;
  font-size: 0.7rem; font-weight: 700;
  flex-shrink: 0;
}
.pr-id { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.pr-symbol { font-weight: 600; font-size: 0.9rem; }
.pr-meta { font-size: 0.72rem; color: var(--text-gray); }
.pr-time { font-size: 0.65rem; color: var(--text-gray); opacity: 0.7; }
.pr-source { font-size: 0.65rem; color: var(--primary-blue); font-style: italic; }

.pr-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.pr-pnl { font-weight: 600; font-size: 0.9rem; }
.pr-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pr-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }
.pr-tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pr-tag.open { background: oklch(0.7 0.15 220 / 0.2); color: oklch(0.75 0.15 220); }
.pr-tag.closed { background: rgba(255,255,255,0.06); color: var(--text-gray); }
</style>
