<script setup lang="ts">
import { computed, ref } from 'vue'

interface Trade {
  id: string
  type: 'buy' | 'sell' | string
  asset_id?: string
  asset_symbol?: string
  amount?: number
  price?: number
  total_value?: number
  fee?: number
  timestamp?: string
  status?: string
}

const props = defineProps<{
  trades: Trade[]
}>()

const filter = ref<'all' | 'buy' | 'sell'>('all')
const expanded = ref(false)

const sorted = computed(() => {
  return [...props.trades].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return tb - ta
  })
})

const filtered = computed(() => {
  if (filter.value === 'all') return sorted.value
  return sorted.value.filter(t => t.type === filter.value)
})

const visible = computed(() => expanded.value ? filtered.value : filtered.value.slice(0, 5))

const totals = computed(() => {
  const buys = sorted.value.filter(t => t.type === 'buy')
  const sells = sorted.value.filter(t => t.type === 'sell')
  const fees = sorted.value.reduce((s, t) => s + (t.fee ?? 0), 0)
  const buyVolume = buys.reduce((s, t) => s + (t.total_value ?? 0), 0)
  const sellVolume = sells.reduce((s, t) => s + (t.total_value ?? 0), 0)
  return { buys: buys.length, sells: sells.length, fees, buyVolume, sellVolume }
})

const formatTime = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
</script>

<template>
  <div class="trades">
    <header class="head">
      <div class="title-row">
        <h3>Recent Trades</h3>
        <span class="meta">{{ sorted.length }} total · ${{ fmt(totals.fees) }} fees</span>
      </div>
      <div class="filter-row">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
        <button :class="{ active: filter === 'buy' }" @click="filter = 'buy'">Buy <em>{{ totals.buys }}</em></button>
        <button :class="{ active: filter === 'sell' }" @click="filter = 'sell'">Sell <em>{{ totals.sells }}</em></button>
      </div>
    </header>

    <div v-if="filtered.length === 0" class="empty">No trades match this filter.</div>

    <ul v-else class="list">
      <li v-for="t in visible" :key="t.id" class="row" :class="[`type-${t.type}`, t.status === 'completed' ? 'done' : 'pending']">
        <span class="type-pill">{{ t.type === 'buy' ? '+ BUY' : '− SELL' }}</span>
        <span class="asset">
          <strong>{{ t.asset_symbol }}</strong>
          <small>{{ formatTime(t.timestamp) }}</small>
        </span>
        <span class="amount">
          {{ fmt(t.amount ?? 0) }} <em>{{ t.asset_symbol }}</em>
        </span>
        <span class="price">@ ${{ fmt(t.price ?? 0) }}</span>
        <span class="total">${{ fmt(t.total_value ?? 0) }}</span>
        <span class="fee">fee ${{ fmt(t.fee ?? 0) }}</span>
        <span :class="['status', t.status]">{{ t.status }}</span>
      </li>
    </ul>

    <button
      v-if="filtered.length > 5"
      class="show-more"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : `Show ${filtered.length - 5} more` }}
    </button>
  </div>
</template>

<style scoped>
.trades {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}
.title-row h3 {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.meta {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.4);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.filter-row { display: inline-flex; gap: 0.2rem; }
.filter-row button {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.65);
  font-size: 0.62rem;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: inherit;
  font-weight: 700;
}
.filter-row button em {
  font-style: normal;
  margin-left: 0.25rem;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
}
.filter-row button.active {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.06);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 0.7fr) minmax(0, 0.5fr);
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: var(--app-border-radius, 6px);
  min-width: 0;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 0;
  border-radius: 3px;
  text-transform: uppercase;
  text-align: center;
}
.row.type-buy .type-pill {
  background: rgba(0,255,136,0.12);
  color: var(--success-green, #00ff88);
  border: 1px solid rgba(0,255,136,0.3);
}
.row.type-sell .type-pill {
  background: rgba(255,77,106,0.12);
  color: #ff4d6a;
  border: 1px solid rgba(255,77,106,0.3);
}

.asset { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; }
.asset strong { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.04em; }
.asset small { font-size: 0.6rem; color: rgba(255,255,255,0.45); }

.amount {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.amount em {
  font-style: normal;
  color: rgba(255,255,255,0.5);
  font-weight: 500;
  font-size: 0.7rem;
}

.price {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.75);
  white-space: nowrap;
}

.total {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.fee {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.status {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  text-align: center;
  white-space: nowrap;
}
.status.completed {
  background: rgba(0,255,136,0.1);
  color: var(--success-green, #00ff88);
}
.status.pending {
  background: rgba(255,170,0,0.12);
  color: #ffaa00;
}
.status.failed {
  background: rgba(255,77,106,0.12);
  color: #ff4d6a;
}

.show-more {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  font-size: 0.7rem;
  padding: 0.4rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: inherit;
  font-weight: 700;
  align-self: center;
}
.show-more:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}

.empty {
  padding: 1rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.4);
  text-align: center;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
}

/* ─── Responsive ─── */
@media (max-width: 960px) {
  .row {
    grid-template-columns: 56px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.55fr);
  }
  .price, .fee { display: none; }
}

@media (max-width: 600px) {
  .row {
    grid-template-columns: 50px minmax(0, 1fr) minmax(0, auto) minmax(0, auto);
    gap: 0.4rem;
  }
  .amount { display: none; }
  .status { display: none; }
}
</style>
