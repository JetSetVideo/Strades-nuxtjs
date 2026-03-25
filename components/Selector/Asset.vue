<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{ modelValue: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

// ─── Asset catalogue ─────────────────────────────────────────────────────────
const ASSETS = [
  // Crypto
  { id: 'BTC',      label: 'Bitcoin',    symbol: 'BTC',      cat: 'crypto',      color: '#f7931a' },
  { id: 'ETH',      label: 'Ethereum',   symbol: 'ETH',      cat: 'crypto',      color: '#627eea' },
  { id: 'SOL',      label: 'Solana',     symbol: 'SOL',      cat: 'crypto',      color: '#9945ff' },
  { id: 'BNB',      label: 'BNB',        symbol: 'BNB',      cat: 'crypto',      color: '#f3ba2f' },
  { id: 'ADA',      label: 'Cardano',    symbol: 'ADA',      cat: 'crypto',      color: '#0033ad' },
  { id: 'DOGE',     label: 'Dogecoin',   symbol: 'DOGE',     cat: 'crypto',      color: '#c2a633' },
  // Stocks
  { id: 'AAPL',     label: 'Apple',      symbol: 'AAPL',     cat: 'stocks',      color: '#555555' },
  { id: 'TSLA',     label: 'Tesla',      symbol: 'TSLA',     cat: 'stocks',      color: '#cc0000' },
  { id: 'NVDA',     label: 'NVIDIA',     symbol: 'NVDA',     cat: 'stocks',      color: '#76b900' },
  { id: 'MSFT',     label: 'Microsoft',  symbol: 'MSFT',     cat: 'stocks',      color: '#00a4ef' },
  { id: 'AMZN',     label: 'Amazon',     symbol: 'AMZN',     cat: 'stocks',      color: '#ff9900' },
  { id: 'GOOGL',    label: 'Alphabet',   symbol: 'GOOGL',    cat: 'stocks',      color: '#4285f4' },
  { id: 'SPY',      label: 'S&P 500 ETF',symbol: 'SPY',      cat: 'stocks',      color: '#1565c0' },
  // Forex
  { id: 'EUR/USD',  label: 'Euro / USD', symbol: 'EUR/USD',  cat: 'forex',       color: '#0052b4' },
  { id: 'GBP/USD',  label: 'GBP / USD',  symbol: 'GBP/USD',  cat: 'forex',       color: '#00247d' },
  { id: 'USD/JPY',  label: 'USD / JPY',  symbol: 'USD/JPY',  cat: 'forex',       color: '#bc002d' },
  { id: 'USD/CHF',  label: 'USD / CHF',  symbol: 'USD/CHF',  cat: 'forex',       color: '#d52b1e' },
  { id: 'AUD/USD',  label: 'AUD / USD',  symbol: 'AUD/USD',  cat: 'forex',       color: '#009b77' },
  // Commodities
  { id: 'XAU',      label: 'Gold',       symbol: 'XAU/USD',  cat: 'commodities', color: '#ffd700' },
  { id: 'XAG',      label: 'Silver',     symbol: 'XAG/USD',  cat: 'commodities', color: '#c0c0c0' },
  { id: 'WTI',      label: 'Crude Oil',  symbol: 'WTI',      cat: 'commodities', color: '#704214' },
  { id: 'GAS',      label: 'Nat. Gas',   symbol: 'NATGAS',   cat: 'commodities', color: '#5c85d6' },
  // Fiat / Cash
  { id: 'USD',      label: 'US Dollar',  symbol: 'USD',      cat: 'fiat',        color: '#4caf50' },
  { id: 'EUR',      label: 'Euro',       symbol: 'EUR',      cat: 'fiat',        color: '#0052b4' },
  { id: 'USDT',     label: 'Tether',     symbol: 'USDT',     cat: 'fiat',        color: '#26a17b' },
]

const CATEGORIES = [
  { id: 'all',        label: 'All',         icon: '🌐' },
  { id: 'crypto',     label: 'Crypto',      icon: '₿' },
  { id: 'stocks',     label: 'Stocks',      icon: '📈' },
  { id: 'forex',      label: 'Forex',       icon: '💱' },
  { id: 'commodities',label: 'Commodities', icon: '🥇' },
  { id: 'fiat',       label: 'Fiat/Cash',   icon: '💵' },
]

const open   = ref(false)
const search = ref('')
const activecat = ref('all')

const filtered = computed(() => {
  let list = ASSETS
  if (activecat.value !== 'all') list = list.filter(a => a.cat === activecat.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(a => a.label.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q))
  }
  return list
})

const selected = computed(() => ASSETS.find(a => a.id === props.modelValue))

const pick = (id: string) => {
  emit('update:modelValue', id)
  open.value = false
  search.value = ''
}

const catColor = (cat: string): string => {
  const m: Record<string,string> = { crypto:'var(--asset-btc)', stocks:'var(--primary-blue)', forex:'var(--warning-orange)', commodities:'#ffd700', fiat:'var(--success-green)' }
  return m[cat] ?? 'var(--text-gray)'
}
</script>

<template>
  <div class="asset-sel" :class="{ open }">
    <!-- Trigger -->
    <button type="button" class="trigger" @click="open = !open">
      <span v-if="selected" class="sel-badge" :style="{ background: selected.color + '22', borderColor: selected.color }">
        <span class="sel-symbol" :style="{ color: selected.color }">{{ selected.symbol }}</span>
        <span class="sel-label">{{ selected.label }}</span>
        <span class="cat-tag" :style="{ color: catColor(selected.cat) }">{{ selected.cat }}</span>
      </span>
      <span v-else class="placeholder">{{ label ?? 'Select asset…' }}</span>
      <span class="chevron" :class="{ rotated: open }">▾</span>
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="dropdown">
      <!-- Search -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="search"
          class="search-input"
          placeholder="Search assets…"
          autofocus
        />
      </div>

      <!-- Category tabs -->
      <div class="cat-tabs">
        <button
          v-for="c in CATEGORIES"
          :key="c.id"
          class="cat-tab"
          :class="{ active: activecat === c.id }"
          @click="activecat = c.id"
        >
          {{ c.icon }} {{ c.label }}
        </button>
      </div>

      <!-- Asset list -->
      <div class="asset-list">
        <button
          v-for="asset in filtered"
          :key="asset.id"
          type="button"
          class="asset-item"
          :class="{ picked: modelValue === asset.id }"
          @click="pick(asset.id)"
        >
          <span class="item-dot" :style="{ background: asset.color }" />
          <span class="item-symbol">{{ asset.symbol }}</span>
          <span class="item-label">{{ asset.label }}</span>
          <span class="item-cat" :style="{ color: catColor(asset.cat) }">{{ asset.cat }}</span>
        </button>

        <div v-if="!filtered.length" class="no-results">No assets match "{{ search }}"</div>
      </div>
    </div>

    <!-- Backdrop -->
    <div v-if="open" class="backdrop" @click="open = false" />
  </div>
</template>

<style scoped>
.asset-sel {
  position: relative;
  width: 100%;
}

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 14px;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast);
}

.trigger:hover,
.asset-sel.open .trigger {
  border-color: var(--border-accent);
}

.sel-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid;
  flex: 1;
}

.sel-symbol { font-weight: 700; font-size: 0.85rem; }
.sel-label  { font-size: 0.78rem; color: var(--text-light-gray); }
.cat-tag    { font-size: 0.6rem; margin-left: auto; text-transform: capitalize; opacity: 0.8; }

.placeholder {
  flex: 1;
  font-size: 0.82rem;
  color: var(--text-gray);
}

.chevron {
  font-size: 0.7rem;
  color: var(--text-gray);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.chevron.rotated { transform: rotate(180deg); }

/* ── Dropdown ─── */
.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius-md);
  z-index: var(--z-dropdown);
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  max-height: 320px;
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-primary);
}

.search-icon { font-size: 0.8rem; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-white);
  font-size: 0.82rem;
  outline: none;
}

.cat-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-primary);
}

.cat-tabs::-webkit-scrollbar { display: none; }

.cat-tab {
  white-space: nowrap;
  font-size: 0.62rem;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.cat-tab:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.cat-tab.active {
  background: rgba(0,255,136,0.12);
  border-color: rgba(0,255,136,0.4);
  color: var(--primary-green);
}

.asset-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}

.asset-item:hover { background: rgba(255,255,255,0.06); }
.asset-item.picked { background: rgba(0,255,136,0.1); }

.item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-symbol {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-white);
  min-width: 52px;
}

.item-label {
  font-size: 0.75rem;
  color: var(--text-light-gray);
  flex: 1;
}

.item-cat {
  font-size: 0.6rem;
  text-transform: capitalize;
  opacity: 0.7;
}

.no-results {
  padding: var(--spacing-md);
  font-size: 0.78rem;
  color: var(--text-gray);
  text-align: center;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-dropdown) - 1);
}
</style>
