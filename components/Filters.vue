<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface FilterState {
  status: string
  profitMin: number
  profitMax: number
  drawdownMin: number
  drawdownMax: number
  winRateMin: number
  winRateMax: number
  assets: string[]
  categories: string[]
  frequency: string[]
  search: string
}

const ASSETS = ['BTC','ETH','SOL','TSLA','AAPL','NVDA','MSFT','EUR/USD','XAU','WTI','USD','USDC','USDT','WBTC']

const CATEGORIES = ['crypto','stocks','forex','commodities','multi-asset']

const FREQUENCIES = ['1m','5m','15m','1h','4h','1D','1W','1M']

const STATUSES = [
  { id: 'all',     label: 'All',     color: '#607d8b' },
  { id: 'active',  label: 'Active',  color: '#4caf50' },
  { id: 'paused',  label: 'Paused',  color: '#ff9800' },
  { id: 'stopped', label: 'Stopped', color: '#9e9e9e' },
  { id: 'draft',   label: 'Draft',   color: '#0052b4' },
]

const TABS = [
  { id: 'status',      label: 'Status',     icon: '●' },
  { id: 'performance', label: 'Performance', icon: '📈' },
  { id: 'assets',      label: 'Assets',     icon: '₿' },
  { id: 'category',    label: 'Category',   icon: '🗂' },
]

const expanded = ref(false)
const activeTab = ref('status')

const filters = ref<FilterState>({
  status: 'all',
  profitMin: -100,
  profitMax: 100,
  drawdownMin: -100,
  drawdownMax: 0,
  winRateMin: 0,
  winRateMax: 100,
  assets: [],
  categories: [],
  frequency: [],
  search: '',
})

const emit = defineEmits<{ 'filter-changed': [f: FilterState] }>()

function update() { emit('filter-changed', { ...filters.value }) }

watch(filters, update, { deep: true })

// Active filter count (for badge)
const activeCount = computed(() => {
  let n = 0
  if (filters.value.status !== 'all') n++
  if (filters.value.profitMin > -100 || filters.value.profitMax < 100) n++
  if (filters.value.drawdownMin > -100 || filters.value.drawdownMax < 0) n++
  if (filters.value.winRateMin > 0 || filters.value.winRateMax < 100) n++
  if (filters.value.assets.length) n++
  if (filters.value.categories.length) n++
  if (filters.value.frequency.length) n++
  if (filters.value.search.trim()) n++
  return n
})

function reset() {
  filters.value = {
    status: 'all', profitMin: -100, profitMax: 100,
    drawdownMin: -100, drawdownMax: 0,
    winRateMin: 0, winRateMax: 100,
    assets: [], categories: [], frequency: [], search: '',
  }
}

function toggleArr(arr: string[], val: string) {
  const i = arr.indexOf(val)
  if (i > -1) arr.splice(i, 1)
  else arr.push(val)
  update()
}

// Dual range gradient helper
function dualGradient(min: number, max: number, absMin: number, absMax: number, color: string): string {
  const range = absMax - absMin || 1
  const l = ((min - absMin) / range) * 100
  const r = ((max - absMin) / range) * 100
  return `linear-gradient(to right, rgba(255,255,255,0.07) ${l}%, ${color} ${l}%, ${color} ${r}%, rgba(255,255,255,0.07) ${r}%)`
}

// Enforce min ≤ max when user drags
function clampProfit() {
  if (filters.value.profitMin > filters.value.profitMax) filters.value.profitMax = filters.value.profitMin
}
function clampDD() {
  if (filters.value.drawdownMin > filters.value.drawdownMax) filters.value.drawdownMax = filters.value.drawdownMin
}
function clampWR() {
  if (filters.value.winRateMin > filters.value.winRateMax) filters.value.winRateMax = filters.value.winRateMin
}

const ASSET_COLOR: Record<string, string> = {
  BTC:'#f7931a', ETH:'#627eea', SOL:'#9945ff', TSLA:'#cc0000',
  AAPL:'#555', NVDA:'#76b900', MSFT:'#00a4ef',
  'EUR/USD':'#0052b4', XAU:'#ffd700', WTI:'#704214',
  USD:'#4caf50', USDC:'#2775ca', USDT:'#26a17b', WBTC:'#e8a100',
}
const CAT_COLOR: Record<string, string> = {
  crypto:'#f7931a', stocks:'#2196f3', forex:'#4caf50',
  commodities:'#ffd700', 'multi-asset':'#9c27b0',
}
</script>

<template>
  <div class="filters-root">
    <!-- ── Header bar (always visible) ── -->
    <div class="filter-bar">
      <!-- Search input -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="filters.search"
          class="search-input"
          placeholder="Search strategies…"
        />
        <button v-if="filters.search" class="search-clear" @click="filters.search = ''">✕</button>
      </div>

      <!-- Expand toggle -->
      <button class="expand-btn" :class="{ active: expanded }" @click="expanded = !expanded">
        <span>Filters</span>
        <span v-if="activeCount" class="filter-badge">{{ activeCount }}</span>
        <span class="chevron" :class="{ open: expanded }">▾</span>
      </button>

      <!-- Reset -->
      <button v-if="activeCount" class="reset-btn" @click="reset">Reset</button>
    </div>

    <!-- ── Expanded panel ── -->
    <div v-if="expanded" class="filter-panel">
      <!-- Tab strip -->
      <div class="tab-strip">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.icon }} {{ tab.label }}
          <span v-if="tab.id === 'assets' && filters.assets.length" class="tab-count">{{ filters.assets.length }}</span>
          <span v-if="tab.id === 'category' && filters.categories.length" class="tab-count">{{ filters.categories.length }}</span>
        </button>
      </div>

      <!-- ── Status tab ── -->
      <div v-if="activeTab === 'status'" class="tab-body">
        <div class="status-chips">
          <button
            v-for="s in STATUSES"
            :key="s.id"
            class="status-chip"
            :class="{ active: filters.status === s.id }"
            :style="filters.status === s.id ? { borderColor: s.color, background: s.color + '22', color: s.color } : {}"
            @click="filters.status = s.id; update()"
          >
            <span class="status-dot-sm" :style="{ background: s.color }" />
            {{ s.label }}
          </button>
        </div>

        <!-- Frequency filter in status tab -->
        <div class="sub-section">
          <span class="sub-label">Execution frequency</span>
          <div class="freq-chips">
            <button
              v-for="f in FREQUENCIES"
              :key="f"
              class="freq-chip"
              :class="{ active: filters.frequency.includes(f) }"
              @click="toggleArr(filters.frequency, f)"
            >{{ f }}</button>
          </div>
        </div>
      </div>

      <!-- ── Performance tab ── -->
      <div v-if="activeTab === 'performance'" class="tab-body">

        <!-- Monthly Gain -->
        <div class="range-block">
          <div class="range-head">
            <span class="range-label">Monthly Gain</span>
            <span class="range-vals">
              <span class="range-v" :class="{ pos: filters.profitMin >= 0, neg: filters.profitMin < 0 }">{{ filters.profitMin > 0 ? '+' : '' }}{{ filters.profitMin }}%</span>
              <span>→</span>
              <span class="range-v" :class="{ pos: filters.profitMax > 0, neg: filters.profitMax < 0 }">{{ filters.profitMax > 0 ? '+' : '' }}{{ filters.profitMax }}%</span>
            </span>
          </div>
          <div class="dual-range-wrap">
            <div class="dual-track" :style="{ background: dualGradient(filters.profitMin, filters.profitMax, -100, 100, 'var(--primary-green)') }" />
            <input type="range" class="dual-input" v-model.number="filters.profitMin" min="-100" max="100" step="0.5" @input="clampProfit(); update()" />
            <input type="range" class="dual-input" v-model.number="filters.profitMax" min="-100" max="100" step="0.5" @input="clampProfit(); update()" />
          </div>
        </div>

        <!-- Max Drawdown -->
        <div class="range-block">
          <div class="range-head">
            <span class="range-label">Max Drawdown</span>
            <span class="range-vals">
              <span class="range-v neg">{{ filters.drawdownMin }}%</span>
              <span>→</span>
              <span class="range-v neg">{{ filters.drawdownMax }}%</span>
            </span>
          </div>
          <div class="dual-range-wrap">
            <div class="dual-track" :style="{ background: dualGradient(filters.drawdownMin, filters.drawdownMax, -100, 0, 'var(--error-red)') }" />
            <input type="range" class="dual-input" v-model.number="filters.drawdownMin" min="-100" max="0" step="0.5" @input="clampDD(); update()" />
            <input type="range" class="dual-input" v-model.number="filters.drawdownMax" min="-100" max="0" step="0.5" @input="clampDD(); update()" />
          </div>
        </div>

        <!-- Win Rate -->
        <div class="range-block">
          <div class="range-head">
            <span class="range-label">Win Rate</span>
            <span class="range-vals">
              <span class="range-v">{{ filters.winRateMin }}%</span>
              <span>→</span>
              <span class="range-v">{{ filters.winRateMax }}%</span>
            </span>
          </div>
          <div class="dual-range-wrap">
            <div class="dual-track" :style="{ background: dualGradient(filters.winRateMin, filters.winRateMax, 0, 100, 'var(--primary-blue)') }" />
            <input type="range" class="dual-input" v-model.number="filters.winRateMin" min="0" max="100" step="1" @input="clampWR(); update()" />
            <input type="range" class="dual-input" v-model.number="filters.winRateMax" min="0" max="100" step="1" @input="clampWR(); update()" />
          </div>
        </div>

      </div>

      <!-- ── Assets tab ── -->
      <div v-if="activeTab === 'assets'" class="tab-body">
        <div class="asset-grid">
          <button
            v-for="asset in ASSETS"
            :key="asset"
            class="asset-chip"
            :class="{ active: filters.assets.includes(asset) }"
            :style="filters.assets.includes(asset)
              ? { borderColor: ASSET_COLOR[asset] ?? '#607d8b', background: (ASSET_COLOR[asset] ?? '#607d8b') + '22', color: ASSET_COLOR[asset] ?? '#fff' }
              : {}"
            @click="toggleArr(filters.assets, asset)"
          >
            <span class="a-dot" :style="{ background: ASSET_COLOR[asset] ?? '#607d8b' }" />
            {{ asset }}
          </button>
        </div>
        <button v-if="filters.assets.length" class="clear-selection" @click="filters.assets = []; update()">
          Clear asset filter
        </button>
      </div>

      <!-- ── Category tab ── -->
      <div v-if="activeTab === 'category'" class="tab-body">
        <div class="cat-chips">
          <button
            v-for="cat in CATEGORIES"
            :key="cat"
            class="cat-chip"
            :class="{ active: filters.categories.includes(cat) }"
            :style="filters.categories.includes(cat)
              ? { borderColor: CAT_COLOR[cat], background: CAT_COLOR[cat] + '22', color: CAT_COLOR[cat] }
              : {}"
            @click="toggleArr(filters.categories, cat)"
          >{{ cat }}</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.filters-root {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Header bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: 7px 12px;
  transition: border-color 0.15s;
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
  font-family: inherit;
}

.search-input::placeholder { color: var(--text-gray); }

.search-clear {
  background: transparent; border: none;
  color: var(--text-gray); cursor: pointer;
  font-size: 0.6rem; flex-shrink: 0;
}
.search-clear:hover { color: var(--text-white); }

.expand-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.72rem;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.expand-btn:hover, .expand-btn.active {
  background: rgba(255,255,255,0.06);
  border-color: var(--border-primary);
  color: var(--text-white);
}

.filter-badge {
  background: var(--primary-green);
  color: #000;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 999px;
  min-width: 16px;
  text-align: center;
}

.chevron {
  font-size: 0.6rem;
  transition: transform 0.2s ease;
}
.chevron.open { transform: rotate(180deg); }

.reset-btn {
  font-size: 0.65rem;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(244,67,54,0.3);
  background: rgba(244,67,54,0.08);
  color: var(--error-red);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.reset-btn:hover { background: rgba(244,67,54,0.16); }

/* ── Expanded panel ── */
.filter-panel {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
  animation: panel-open 0.2s ease;
}

@keyframes panel-open {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Tabs */
.tab-strip {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--border-primary);
}
.tab-strip::-webkit-scrollbar { display: none; }

.tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 9px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s ease;
  font-family: inherit;
  justify-content: center;
}

.tab-btn:hover { color: var(--text-white); background: rgba(255,255,255,0.04); }
.tab-btn.active { color: var(--primary-green); border-bottom-color: var(--primary-green); }

.tab-count {
  background: var(--primary-green);
  color: #000;
  font-size: 0.5rem;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 999px;
}

/* Tab body */
.tab-body {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* Status */
.status-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  transition: all 0.12s ease;
  font-family: inherit;
}

.status-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.status-dot-sm {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Sub-section (frequency in status tab) */
.sub-section { display: flex; flex-direction: column; gap: 6px; }
.sub-label {
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}

.freq-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.freq-chip {
  font-size: 0.62rem;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}
.freq-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.freq-chip.active {
  border-color: var(--primary-green);
  background: rgba(0,255,136,0.1);
  color: var(--primary-green);
}

/* Range blocks */
.range-block { display: flex; flex-direction: column; gap: 6px; }

.range-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.range-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}

.range-vals {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  color: var(--text-light-gray);
}

.range-v { font-weight: 700; }
.range-v.pos { color: var(--success-green); }
.range-v.neg { color: var(--error-red); }

/* ── Dual range slider ── */
.dual-range-wrap {
  position: relative;
  height: 22px;
  display: flex;
  align-items: center;
}

.dual-track {
  position: absolute;
  left: 0; right: 0;
  height: 4px;
  border-radius: 999px;
  pointer-events: none;
  transition: background 0.1s ease;
}

.dual-input {
  position: absolute;
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  height: 4px;
  outline: none;
  top: 50%;
  transform: translateY(-50%);
}

.dual-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-white);
  cursor: pointer;
  pointer-events: all;
  border: 2px solid rgba(0,0,0,0.4);
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  transition: transform 0.1s ease;
}

.dual-input::-webkit-slider-thumb:hover { transform: scale(1.2); }

.dual-input::-moz-range-thumb {
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--text-white);
  cursor: pointer;
  pointer-events: all;
  border: 2px solid rgba(0,0,0,0.4);
}

/* Assets */
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 5px;
}

.asset-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  transition: all 0.12s ease;
  font-family: inherit;
}

.asset-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }

.a-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.clear-selection {
  align-self: flex-start;
  font-size: 0.6rem;
  color: var(--text-gray);
  background: transparent;
  border: 1px dashed var(--border-secondary);
  border-radius: 999px;
  padding: 3px 10px;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}
.clear-selection:hover { border-color: var(--error-red); color: var(--error-red); }

/* Category */
.cat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cat-chip {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: capitalize;
  transition: all 0.12s ease;
  font-family: inherit;
}
.cat-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
</style>
