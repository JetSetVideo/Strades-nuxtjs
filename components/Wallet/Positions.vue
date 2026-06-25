<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAssetTone } from '~/composables/useAssetTone'

interface Position {
  asset_id: string
  symbol: string
  amount: number
  average_price: number
  current_price: number
  current_value: number
  return_amount: number
  return_percentage: number
  allocation_percentage: number
}

const props = withDefaults(defineProps<{
  positions: Position[]
  totalValue?: number
  todayPctMap?: Record<string, number>
}>(), {
  todayPctMap: () => ({}) as Record<string, number>
})

const emit = defineEmits<{ (e: 'open-asset', id: string): void }>()

type SortKey = 'allocation' | 'pnl' | 'today' | 'value'
const sortKey = ref<SortKey>('allocation')

const sorted = computed(() => {
  const arr = [...props.positions]
  switch (sortKey.value) {
    case 'pnl':
      return arr.sort((a, b) => b.return_percentage - a.return_percentage)
    case 'today':
      return arr.sort((a, b) => (props.todayPctMap[b.asset_id] ?? 0) - (props.todayPctMap[a.asset_id] ?? 0))
    case 'value':
      return arr.sort((a, b) => b.current_value - a.current_value)
    default:
      return arr.sort((a, b) => b.allocation_percentage - a.allocation_percentage)
  }
})

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}$${fmt(Math.abs(n))}`

const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  AAPL: 'Apple',
  TSLA: 'Tesla',
  AMZN: 'Amazon',
  USD: 'US Dollar',
  EUR: 'Euro',
  CNY: 'Chinese Yuan'
}

const ASSET_CLASS: Record<string, string> = {
  BTC: 'crypto', ETH: 'crypto', SOL: 'crypto',
  AAPL: 'stocks', TSLA: 'stocks', AMZN: 'stocks',
  USD: 'fiat', EUR: 'fiat', CNY: 'fiat'
}
const classOf = (sym: string) => ASSET_CLASS[sym] || 'stocks'

const COLORS: Record<string, string> = {
  BTC: '#F5A623',
  ETH: '#627eea',
  SOL: '#9945ff',
  AAPL: '#a0a0a0',
  TSLA: '#cc0000',
  AMZN: '#ff9900',
  USD: '#4A90E2',
  EUR: '#003399',
  CNY: '#e3022a'
}
const colorOf = (sym: string) => COLORS[sym] || '#666'
</script>

<template>
  <div class="positions">
    <header class="head">
      <h3>Positions</h3>
      <div class="sort-row">
        <button :class="{ active: sortKey === 'allocation' }" @click="sortKey = 'allocation'">Weight</button>
        <button :class="{ active: sortKey === 'pnl' }" @click="sortKey = 'pnl'">PnL</button>
        <button :class="{ active: sortKey === 'today' }" @click="sortKey = 'today'">Today</button>
        <button :class="{ active: sortKey === 'value' }" @click="sortKey = 'value'">Value</button>
      </div>
    </header>

    <!-- Column legend (visible on tablet+ only) -->
    <div class="row legend" aria-hidden="true">
      <span class="c-icon" />
      <span class="c-name">Asset</span>
      <span class="c-amount">Amount · Avg</span>
      <span class="c-price">Mark</span>
      <span class="c-value">Value · Weight</span>
      <span class="c-pnl">Unrealized</span>
      <span class="c-today">Today</span>
    </div>

    <ul class="list">
      <li
        v-for="p in sorted"
        :key="p.asset_id"
        class="row pos"
        @click="emit('open-asset', p.asset_id)"
      >
        <span class="c-icon" :style="{ background: colorOf(p.symbol) }">
          {{ p.symbol.slice(0, 2) }}
        </span>

        <span class="c-name">
          <strong>{{ p.symbol }}</strong>
          <em :class="['cls', `cls-${classOf(p.symbol)}`]">{{ classOf(p.symbol) }}</em>
          <small>{{ ASSET_NAMES[p.symbol] || p.symbol }}</small>
        </span>

        <span class="c-amount">
          <span class="amt-line">{{ p.amount.toLocaleString('en-US', { maximumFractionDigits: 4 }) }} <em>{{ p.symbol }}</em></span>
          <small>avg ${{ p.average_price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</small>
        </span>

        <span class="c-price">
          ${{ p.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
        </span>

        <span class="c-value">
          <span class="val-line">${{ fmt(p.current_value) }}</span>
          <span class="weight-bar" :title="`${p.allocation_percentage.toFixed(1)}% of portfolio`">
            <span class="weight-fill" :style="{ width: `${Math.min(100, p.allocation_percentage)}%`, background: colorOf(p.symbol) }" />
          </span>
          <small>{{ p.allocation_percentage.toFixed(1) }}%</small>
        </span>

        <span :class="['c-pnl', p.return_amount >= 0 ? 'pos' : 'neg']">
          <span class="pnl-amt">{{ fmtSigned(p.return_amount) }}</span>
          <small>{{ p.return_percentage >= 0 ? '+' : '' }}{{ p.return_percentage.toFixed(2) }}%</small>
        </span>

        <span :class="['c-today', (todayPctMap[p.asset_id] ?? 0) >= 0 ? 'pos' : 'neg']">
          {{ (todayPctMap[p.asset_id] ?? 0) >= 0 ? '+' : '' }}{{ (todayPctMap[p.asset_id] ?? 0).toFixed(2) }}%
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.positions {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}
.head h3 {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.sort-row { display: inline-flex; gap: 0.15rem; }
.sort-row button {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  font-size: 0.6rem;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sort-row button.active {
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
  gap: 0.3rem;
  min-width: 0;
}

/* Grid: 7 columns. Hide some on mobile. */
.row {
  display: grid;
  grid-template-columns:
    28px              /* icon */
    minmax(0, 1.6fr)  /* name */
    minmax(0, 1.4fr)  /* amount */
    minmax(0, 0.9fr)  /* mark */
    minmax(0, 1.6fr)  /* value + weight */
    minmax(0, 1fr)    /* unrealized */
    minmax(0, 0.7fr); /* today */
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.18s ease;
  min-width: 0;
}
.row.legend {
  cursor: default;
  background: none;
  border: none;
  padding: 0.2rem 0.55rem 0 0.55rem;
}
.row.legend > * {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  font-weight: 700;
}
.row.pos:hover {
  background: rgba(0,255,136,0.04);
  border-color: rgba(0,255,136,0.18);
  transform: translateY(-1px);
}

.c-icon {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 800;
  color: #000;
  letter-spacing: 0.04em;
}

.c-name {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  position: relative;
}
.c-name strong {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.c-name small {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.45);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.c-name .cls {
  font-style: normal;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
  width: fit-content;
  margin-top: -0.05rem;
}
.cls-crypto { background: rgba(245,166,35,0.15); color: #F5A623; }
.cls-stocks { background: rgba(126,211,33,0.15); color: #7ED321; }
.cls-fiat { background: rgba(74,144,226,0.15); color: #4A90E2; }
.cls-commodities { background: rgba(248,231,28,0.15); color: #F8E71C; }

.c-amount {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.amt-line {
  font-size: 0.78rem;
  font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.amt-line em {
  font-style: normal;
  font-weight: 500;
  color: rgba(255,255,255,0.5);
  font-size: 0.7rem;
}
.c-amount small {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.02em;
}

.c-price {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.c-value {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.val-line {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.c-value small {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.04em;
}
.weight-bar {
  display: block;
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.weight-fill {
  display: block;
  height: 100%;
  transition: width 0.3s ease;
}

.c-pnl {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  min-width: 0;
}
.pnl-amt {
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
}
.c-pnl small { font-size: 0.7rem; font-weight: 600; }
.c-pnl.pos { color: var(--success-green, #00ff88); }
.c-pnl.neg { color: #ff4d6a; }

.c-today {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
  justify-self: end;
}
.c-today.pos { color: var(--success-green, #00ff88); background: rgba(0,255,136,0.08); }
.c-today.neg { color: #ff4d6a; background: rgba(255,77,106,0.08); }

/* ─── Tablet ─── */
@media (max-width: 960px) {
  .row.legend { display: none; }
  .row {
    grid-template-columns:
      28px
      minmax(0, 1.4fr)
      minmax(0, 1fr)
      minmax(0, 1.2fr)
      minmax(0, 0.9fr)
      minmax(0, 0.7fr);
  }
  .c-price { display: none; }
}

/* ─── Mobile ─── */
@media (max-width: 640px) {
  .row {
    grid-template-columns: 28px minmax(0, 1fr) minmax(0, auto) minmax(0, auto);
    gap: 0.4rem;
  }
  .c-amount, .c-pnl { display: none; }
  .c-name small { display: none; }
  .c-value { align-items: flex-end; }
  .val-line { font-size: 0.85rem; }
  .weight-bar { width: 60px; }
  .c-value small { display: none; }
}
</style>
