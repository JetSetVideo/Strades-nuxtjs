<script setup lang="ts">
import { cycleTriState, type FilterTriState } from '~/utils/priceFilters'

export interface OpOption {
  id: string
  label: string
  tone?: 'bet'
}

const props = defineProps<{
  label: string
  options: OpOption[]
  states: Record<string, FilterTriState | undefined>
  tone?: 'bet'
  uppercase?: boolean
  nowrap?: boolean
}>()

const emit = defineEmits<{ cycle: [id: string] }>()

function stateOf(id: string): FilterTriState {
  return props.states[id] ?? 'neutral'
}

function nextVerb(state: FilterTriState): string {
  const next = cycleTriState(state)
  if (next === 'include') return 'highlight'
  if (next === 'exclude') return 'exclude'
  return 'clear'
}

function title(opt: OpOption): string {
  const state = stateOf(opt.id)
  return `${opt.label} is ${state}. Click to ${nextVerb(state)}.`
}

function pressed(id: string): 'true' | 'false' | 'mixed' {
  const state = stateOf(id)
  if (state === 'include') return 'true'
  if (state === 'exclude') return 'mixed'
  return 'false'
}
</script>

<template>
  <div class="op-chips" role="group" :aria-label="label" :class="{ caps: uppercase, 'tone-bet': tone === 'bet', nowrap }">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="op-chip"
      :class="[stateOf(opt.id), opt.tone ?? tone]"
      :aria-pressed="pressed(opt.id)"
      :title="title(opt)"
      @click="emit('cycle', opt.id)"
    >
      <span v-if="stateOf(opt.id) === 'include'" class="op-mark" aria-hidden="true">+</span>
      <span v-else-if="stateOf(opt.id) === 'exclude'" class="op-mark" aria-hidden="true">−</span>
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.op-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.op-chips.nowrap { flex-wrap: nowrap; }

.op-chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.68rem;
  font-weight: 650;
  font-family: var(--font-family-secondary, inherit);
  letter-spacing: 0.01em;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: none;
}

.caps .op-chip { text-transform: uppercase; letter-spacing: 0.04em; }

.op-chip:hover {
  border-color: rgba(255, 255, 255, 0.32);
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.04);
}

.op-mark {
  font-weight: 800;
  margin-right: 4px;
  font-size: 0.78rem;
  line-height: 1;
}

/* Highlight: lighter face, bright border, dark text. */
.op-chip.include {
  background: linear-gradient(180deg, #f3fff8 0%, #3dffb0 38%, #00c26e 100%);
  border-color: #b8ffdf;
  color: #04210f;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 3px 8px rgba(0, 0, 0, 0.55);
}
.op-chip.include:hover {
  color: #04210f;
  background: linear-gradient(180deg, #f3fff8 0%, #3dffb0 38%, #00c26e 100%);
}

/* Low-light: sunken face, dim border, dim text. */
.op-chip.exclude {
  background: #090b10;
  border-color: rgba(255, 120, 136, 0.38);
  color: rgba(255, 176, 184, 0.48);
  box-shadow:
    inset 0 3px 7px rgba(0, 0, 0, 0.88),
    0 1px 0 rgba(255, 255, 255, 0.14);
}
.op-chip.exclude:hover {
  color: rgba(255, 196, 202, 0.72);
  background: #090b10;
}

/* Bets stay hot pink, never the equity green. */
.op-chip.bet {
  color: #ff4d9d;
  border-color: rgba(255, 77, 157, 0.45);
}
.op-chip.bet:hover { color: #ff4d9d; background: rgba(255, 77, 157, 0.08); }
.op-chip.bet.include {
  background: linear-gradient(180deg, #ffe8f3 0%, #ff4d9d 42%, #d41474 100%);
  border-color: #ffd0e6;
  color: #1a0a12;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    0 3px 8px rgba(0, 0, 0, 0.55);
}
.op-chip.bet.include:hover {
  color: #1a0a12;
  background: linear-gradient(180deg, #ffe8f3 0%, #ff4d9d 42%, #d41474 100%);
}
.op-chip.bet.exclude {
  background: #12060c;
  border-color: rgba(255, 77, 157, 0.32);
  color: rgba(255, 77, 157, 0.45);
  box-shadow:
    inset 0 3px 7px rgba(0, 0, 0, 0.88),
    0 1px 0 rgba(255, 77, 157, 0.22);
}
.op-chip.bet.exclude:hover { color: rgba(255, 140, 190, 0.75); background: #12060c; }
</style>
