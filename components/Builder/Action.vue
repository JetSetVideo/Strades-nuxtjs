<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface ActionData {
  type: string
  allocation: number
  fromAsset?: string
  toAsset?: string
  timing: string
  limitPrice?: number
  slippage?: number
}

const props = defineProps<{ modelValue: ActionData }>()
const emit  = defineEmits<{ 'update:modelValue': [v: ActionData] }>()

const ACTION_TYPES = [
  { id: 'shift',      label: 'Shift Capital',  icon: '↔',  description: 'Move X% from one asset to another' },
  { id: 'increase',   label: 'Increase',       icon: '↑',  description: 'Increase allocation by X%' },
  { id: 'decrease',   label: 'Decrease',       icon: '↓',  description: 'Decrease allocation by X%' },
  { id: 'rebalance',  label: 'Rebalance',      icon: '⚖',  description: 'Set target allocation to X%' },
  { id: 'exit',       label: 'Full Exit',      icon: '⏹',  description: 'Move 100% to safe asset (fiat)' },
  { id: 'hold',       label: 'Hold',           icon: '⏸',  description: 'Maintain current allocation' },
]

const TIMINGS = [
  { id: 'immediate',   label: 'Immediately' },
  { id: 'next_candle', label: 'Next candle' },
  { id: 'limit',       label: 'Limit price' },
]

const local = ref<ActionData>({
  type: 'shift',
  allocation: 25,
  timing: 'next_candle',
  slippage: 0.1,
  ...props.modelValue,
})

watch(() => props.modelValue, v => { if (v) local.value = { ...local.value, ...v } }, { deep: true })

function emit_() { emit('update:modelValue', { ...local.value }) }

function setType(id: string) {
  local.value.type = id
  emit_()
}

const typeColor = (id: string): string => {
  const m: Record<string, string> = {
    shift:     'var(--primary-blue)',
    increase:  'var(--success-green)',
    decrease:  'var(--error-red)',
    rebalance: 'var(--warning-orange)',
    exit:      '#9e9e9e',
    hold:      '#607d8b',
  }
  return m[id] ?? 'var(--primary-green)'
}

const currentColor = computed(() => typeColor(local.value.type))

// Computed gradient backgrounds for the sliders
const allocGradient = computed(() =>
  `linear-gradient(to right, ${currentColor.value} ${local.value.allocation}%, rgba(255,255,255,0.1) ${local.value.allocation}%)`
)

const slippageGradient = computed(() => {
  const pct = ((local.value.slippage ?? 0.1) / 3) * 100
  return `linear-gradient(to right, ${currentColor.value} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`
})
</script>

<template>
  <div class="action-builder" :style="{ '--act-color': currentColor }">

    <!-- Action type picker -->
    <div class="section-row">
      <label class="row-label">Action</label>
      <div class="type-grid">
        <button
          v-for="at in ACTION_TYPES"
          :key="at.id"
          type="button"
          class="type-btn"
          :class="{ active: local.type === at.id }"
          :title="at.description"
          @click="setType(at.id)"
        >
          <span class="type-icon">{{ at.icon }}</span>
          <span class="type-label">{{ at.label }}</span>
        </button>
      </div>
    </div>

    <!-- Allocation slider (not for hold) -->
    <div v-if="local.type !== 'hold'" class="section-row compact">
      <label class="row-label">
        {{ local.type === 'shift' ? 'Capital to shift' : local.type === 'rebalance' ? 'Target allocation' : 'Amount' }}
      </label>
      <div class="alloc-wrap">
        <span class="alloc-min">1%</span>
        <input
          type="range"
          v-model.number="local.allocation"
          min="1"
          max="100"
          step="1"
          class="alloc-slider"
          :style="{ background: allocGradient }"
          @input="emit_()"
        />
        <span class="alloc-max">100%</span>
        <span class="alloc-val">{{ local.allocation }}%</span>
      </div>
      <div class="alloc-desc">
        <span v-if="local.type === 'shift'">Shift {{ local.allocation }}% of portfolio value</span>
        <span v-else-if="local.type === 'increase'">Add {{ local.allocation }}% to current position</span>
        <span v-else-if="local.type === 'decrease'">Remove {{ local.allocation }}% from position</span>
        <span v-else-if="local.type === 'rebalance'">Target {{ local.allocation }}% portfolio weight</span>
        <span v-else-if="local.type === 'exit'">Exit entire position → fiat</span>
      </div>
    </div>

    <!-- Timing -->
    <div class="section-row compact">
      <label class="row-label">Execution timing</label>
      <div class="chip-row">
        <button
          v-for="t in TIMINGS"
          :key="t.id"
          type="button"
          class="chip"
          :class="{ active: local.timing === t.id }"
          @click="local.timing = t.id; emit_()"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- Limit price -->
    <div v-if="local.timing === 'limit'" class="section-row compact">
      <label class="row-label">Limit price</label>
      <input
        type="number"
        v-model.number="local.limitPrice"
        step="0.01"
        placeholder="e.g. 65000"
        class="num-input"
        @input="emit_()"
      />
    </div>

    <!-- Slippage slider -->
    <div class="section-row compact">
      <label class="row-label">Slippage tolerance</label>
      <div class="alloc-wrap">
        <span class="alloc-min">0.05%</span>
        <input
          type="range"
          v-model.number="local.slippage"
          min="0.05"
          max="3"
          step="0.05"
          class="alloc-slider"
          :style="{ background: slippageGradient }"
          @input="emit_()"
        />
        <span class="alloc-max">3%</span>
        <span class="alloc-val">{{ (local.slippage ?? 0.1).toFixed(2) }}%</span>
      </div>
    </div>

    <!-- Preview -->
    <div class="preview-line">
      <span class="preview-text">
        <span class="act-icon-preview">{{ ACTION_TYPES.find(a=>a.id===local.type)?.icon }}</span>
        <strong>{{ ACTION_TYPES.find(a=>a.id===local.type)?.label }}</strong>
        <span v-if="local.type !== 'hold'" class="prev-alloc">{{ local.allocation }}%</span>
        <span class="prev-timing">→ {{ TIMINGS.find(t=>t.id===local.timing)?.label }}</span>
        <span v-if="local.slippage" class="prev-slip">±{{ local.slippage?.toFixed(2) }}% slip</span>
      </span>
    </div>

  </div>
</template>

<style scoped>
.action-builder {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-row { display: flex; flex-direction: column; gap: 6px; }
.section-row.compact { gap: 4px; }

.row-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

/* Type grid */
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  background: rgba(0,0,0,0.2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.type-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--border-primary); }
.type-btn.active {
  border-color: var(--act-color);
  background: color-mix(in srgb, var(--act-color) 15%, transparent);
}

.type-icon { font-size: 1rem; }
.type-label { font-size: 0.55rem; font-weight: 700; color: var(--text-light-gray); text-align: center; }
.type-btn.active .type-label { color: var(--act-color); }

/* Sliders */
.alloc-wrap {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.alloc-min, .alloc-max {
  font-size: 0.58rem;
  color: var(--text-gray);
  flex-shrink: 0;
  min-width: 28px;
}
.alloc-max { text-align: right; }

.alloc-slider {
  flex: 1;
  -webkit-appearance: none;
  height: 5px;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  transition: background 0.1s ease;
}

.alloc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--act-color);
  cursor: pointer;
  box-shadow: 0 0 8px color-mix(in srgb, var(--act-color) 60%, transparent);
  border: 2px solid rgba(0,0,0,0.3);
  transition: transform 0.1s ease;
}

.alloc-slider:active::-webkit-slider-thumb { transform: scale(1.2); }

.alloc-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--act-color);
  cursor: pointer;
  border: 2px solid rgba(0,0,0,0.3);
}

.alloc-val {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--act-color);
  min-width: 42px;
  text-align: right;
  flex-shrink: 0;
}

.alloc-desc {
  font-size: 0.62rem;
  color: var(--text-gray);
  font-style: italic;
  padding-left: 2px;
}

/* Chips */
.chip-row { display: flex; gap: 4px; flex-wrap: wrap; }

.chip {
  font-size: 0.65rem;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
}

.chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.chip.active {
  border-color: var(--act-color);
  background: color-mix(in srgb, var(--act-color) 15%, transparent);
  color: var(--text-white);
}

.num-input {
  width: 100%;
  padding: 6px 10px;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.78rem;
  font-family: inherit;
}

.num-input:focus { outline: none; border-color: var(--act-color); }

/* Preview */
.preview-line {
  background: rgba(0,0,0,0.3);
  border-left: 3px solid var(--act-color);
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

.act-icon-preview { font-size: 0.85rem; }
.prev-alloc  { font-weight: 700; color: var(--act-color); }
.prev-timing { color: var(--text-gray); font-size: 0.65rem; }
.prev-slip   { color: var(--text-gray); font-size: 0.6rem; }
</style>
