<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface ConditionData {
  indicator: string
  indicatorParam?: number   // e.g. MA period, RSI level
  timeframe: string
  operator: string
  valueType: 'static' | 'indicator'
  value: number
  valueIndicator?: string
  conjunction?: 'AND' | 'OR'
}

const props = defineProps<{ modelValue: ConditionData }>()
const emit  = defineEmits<{ 'update:modelValue': [v: ConditionData] }>()

const INDICATORS = [
  { id: 'PRICE',      label: 'Price',              icon: '💲', param: false },
  { id: 'SMA',        label: 'SMA (Moving Avg)',   icon: '〰', param: true,  paramLabel: 'Period', defaultParam: 20 },
  { id: 'EMA',        label: 'EMA (Exp. MA)',      icon: '⟿',  param: true,  paramLabel: 'Period', defaultParam: 20 },
  { id: 'RSI',        label: 'RSI',                icon: '📡', param: true,  paramLabel: 'Period', defaultParam: 14 },
  { id: 'MACD',       label: 'MACD',               icon: '🌊', param: false },
  { id: 'BOLL',       label: 'Bollinger Bands',    icon: '📎', param: true,  paramLabel: 'Period', defaultParam: 20 },
  { id: 'VOLUME',     label: 'Volume',             icon: '📊', param: false },
  { id: 'SENTIMENT',  label: 'Social Sentiment',   icon: '💬', param: false },
  { id: 'FEAR_GREED', label: 'Fear & Greed',       icon: '😱', param: false },
  { id: 'VOLATILITY', label: 'Volatility (ATR)',   icon: '⚡', param: true,  paramLabel: 'Period', defaultParam: 14 },
  { id: 'ONCHAIN',    label: 'On-chain Flow',      icon: '⛓', param: false },
  { id: 'SPREAD',     label: 'Bid-Ask Spread',     icon: '↔',  param: false },
]

const TIMEFRAMES = ['1m','5m','15m','1h','4h','1D','1W','1M']

const OPERATORS = [
  { id: 'gt',         label: 'is above',         symbol: '>' },
  { id: 'lt',         label: 'is below',         symbol: '<' },
  { id: 'gte',        label: '≥',                symbol: '≥' },
  { id: 'lte',        label: '≤',                symbol: '≤' },
  { id: 'eq',         label: 'equals',           symbol: '=' },
  { id: 'crosses_up', label: 'crosses above ↑',  symbol: '↑×' },
  { id: 'crosses_dn', label: 'crosses below ↓',  symbol: '↓×' },
]

const local = ref<ConditionData>({
  indicator: 'PRICE',
  timeframe: '1D',
  operator: 'gt',
  valueType: 'static',
  value: 0,
  ...props.modelValue,
})

watch(() => props.modelValue, v => { if (v) local.value = { ...local.value, ...v } }, { deep: true })

function emit_() { emit('update:modelValue', { ...local.value }) }

function setIndicator(id: string) {
  const ind = INDICATORS.find(i => i.id === id)
  local.value.indicator = id
  if (ind?.param && !local.value.indicatorParam) {
    local.value.indicatorParam = ind.defaultParam
  }
  emit_()
}

const currentIndicator = computed(() => INDICATORS.find(i => i.id === local.value.indicator))

// Colour based on selected indicator
const indicatorColor = computed(() => {
  const m: Record<string, string> = {
    PRICE: '#4caf50', SMA: '#2196f3', EMA: '#00bcd4', RSI: '#ff9800',
    MACD: '#9c27b0', BOLL: '#f44336', VOLUME: '#009688', SENTIMENT: '#e91e63',
    FEAR_GREED: '#ff5722', VOLATILITY: '#ffc107', ONCHAIN: '#8bc34a', SPREAD: '#607d8b',
  }
  return m[local.value.indicator] ?? 'var(--primary-green)'
})
</script>

<template>
  <div class="cond-builder" :style="{ '--ind-color': indicatorColor }">

    <!-- Indicator picker -->
    <div class="section-row">
      <label class="row-label">Indicator</label>
      <div class="indicator-grid">
        <button
          v-for="ind in INDICATORS"
          :key="ind.id"
          type="button"
          class="ind-btn"
          :class="{ active: local.indicator === ind.id }"
          @click="setIndicator(ind.id)"
          :title="ind.label"
        >
          <span class="ind-icon">{{ ind.icon }}</span>
          <span class="ind-name">{{ ind.id }}</span>
        </button>
      </div>
    </div>

    <!-- Indicator param (period etc) -->
    <div v-if="currentIndicator?.param" class="section-row compact">
      <label class="row-label">{{ currentIndicator.paramLabel }}</label>
      <input
        type="number"
        v-model.number="local.indicatorParam"
        :min="2"
        :max="200"
        class="num-input small"
        @input="emit_()"
      />
    </div>

    <!-- Timeframe -->
    <div class="section-row compact">
      <label class="row-label">Timeframe</label>
      <div class="chip-row">
        <button
          v-for="tf in TIMEFRAMES"
          :key="tf"
          type="button"
          class="chip"
          :class="{ active: local.timeframe === tf }"
          @click="local.timeframe = tf; emit_()"
        >{{ tf }}</button>
      </div>
    </div>

    <!-- Operator -->
    <div class="section-row compact">
      <label class="row-label">Condition</label>
      <div class="chip-row wrap">
        <button
          v-for="op in OPERATORS"
          :key="op.id"
          type="button"
          class="chip"
          :class="{ active: local.operator === op.id }"
          @click="local.operator = op.id; emit_()"
        >
          <span class="op-sym">{{ op.symbol }}</span>
          <span class="op-lbl">{{ op.label }}</span>
        </button>
      </div>
    </div>

    <!-- Value -->
    <div class="section-row compact">
      <label class="row-label">Value</label>
      <div class="value-row">
        <div class="toggle-type">
          <button
            type="button"
            :class="{ active: local.valueType === 'static' }"
            @click="local.valueType = 'static'; emit_()"
          >Threshold</button>
          <button
            type="button"
            :class="{ active: local.valueType === 'indicator' }"
            @click="local.valueType = 'indicator'; emit_()"
          >vs Indicator</button>
        </div>
        <input
          v-if="local.valueType === 'static'"
          type="number"
          v-model.number="local.value"
          step="0.01"
          class="num-input"
          @input="emit_()"
        />
        <select
          v-else
          v-model="local.valueIndicator"
          class="num-input"
          @change="emit_()"
        >
          <option v-for="ind in INDICATORS" :key="ind.id" :value="ind.id">
            {{ ind.icon }} {{ ind.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Human-readable preview -->
    <div class="preview-line">
      <span class="preview-text">
        <span :style="{ color: indicatorColor }">{{ currentIndicator?.icon }} {{ local.indicator }}<template v-if="currentIndicator?.param">({{ local.indicatorParam }})</template></span>
        <span class="prev-tf">[{{ local.timeframe }}]</span>
        <span>{{ OPERATORS.find(o => o.id === local.operator)?.label }}</span>
        <span class="prev-val">
          <template v-if="local.valueType === 'static'">{{ local.value }}</template>
          <template v-else>{{ local.valueIndicator }}</template>
        </span>
      </span>
    </div>

  </div>
</template>

<style scoped>
.cond-builder {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px;
}

.section-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-row.compact { gap: 4px; }

.row-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

/* Indicator grid */
.indicator-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.ind-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 5px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: rgba(0,0,0,0.2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ind-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--border-primary); }
.ind-btn.active {
  border-color: var(--ind-color);
  background: color-mix(in srgb, var(--ind-color) 15%, transparent);
}

.ind-icon { font-size: 0.9rem; }
.ind-name { font-size: 0.5rem; font-weight: 700; color: var(--text-light-gray); }
.ind-btn.active .ind-name { color: var(--ind-color); }

/* Chips */
.chip-row {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.chip-row.wrap { flex-wrap: wrap; }
.chip-row::-webkit-scrollbar { display: none; }

.chip {
  font-size: 0.65rem;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: all 0.12s ease;
}

.chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.chip.active {
  border-color: var(--ind-color);
  background: color-mix(in srgb, var(--ind-color) 15%, transparent);
  color: var(--text-white);
}

.op-sym { font-weight: 700; }
.op-lbl { opacity: 0.8; }

/* Value row */
.value-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toggle-type {
  display: flex;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.toggle-type button {
  flex: 1;
  font-size: 0.65rem;
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
}

.toggle-type button.active {
  background: var(--ind-color);
  color: #000;
  font-weight: 700;
}

.num-input {
  width: 100%;
  padding: 6px 10px;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.78rem;
}

.num-input.small { width: 80px; }

.num-input:focus { outline: none; border-color: var(--ind-color); }

/* Preview */
.preview-line {
  background: rgba(0,0,0,0.3);
  border-left: 3px solid var(--ind-color);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 6px 10px;
}

.preview-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: var(--text-white);
}

.prev-tf { color: var(--text-gray); font-size: 0.65rem; }
.prev-val { font-weight: 700; color: var(--ind-color); }
</style>
