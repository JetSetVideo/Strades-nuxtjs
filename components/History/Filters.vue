<script setup lang="ts">
/** Lanes, modes, sample toggle, past range and search. v-model is the whole HistoryFilter. */
import { computed } from 'vue'
import { HISTORY_LANES, HISTORY_MODES, HISTORY_RANGES, LANE_META, type HistoryFilter, type Lane, type Mode, type RangeId } from '~/utils/historyTimeline'

const props = defineProps<{ modelValue: HistoryFilter; laneCounts: Record<string, number>; modeCounts: Record<string, number>; sampleCount: number }>()
const emit = defineEmits<{ 'update:modelValue': [v: HistoryFilter] }>()

const f = computed(() => props.modelValue)
const set = (patch: Partial<HistoryFilter>) => emit('update:modelValue', { ...f.value, ...patch })

function toggleLane(id: Lane) {
  const next = new Set(f.value.lanes)
  next.has(id) ? next.delete(id) : next.add(id)
  set({ lanes: next })
}
function soloLane(id: Lane) { set({ lanes: new Set([id]) }) }
function toggleMode(id: Mode) {
  const next = new Set(f.value.modes)
  next.has(id) ? next.delete(id) : next.add(id)
  set({ modes: next })
}
const allLanes = () => set({ lanes: new Set(HISTORY_LANES.map(l => l.id)) })
</script>

<template>
  <div class="hf" role="group" aria-label="Filter the timeline">
    <div class="hf-row">
      <div class="hf-seg" role="group" aria-label="How far back">
        <button
          v-for="r in HISTORY_RANGES"
          :key="r.id"
          type="button"
          :aria-pressed="f.range === r.id"
          class="hf-seg-b"
          @click="set({ range: r.id as RangeId })"
        >{{ r.label }}</button>
      </div>
      <label class="hf-search">
        <span class="sr-only">Search the timeline</span>
        <input :value="f.q" type="search" placeholder="Search asset, agent, note…" @input="set({ q: ($event.target as HTMLInputElement).value })">
      </label>
    </div>
    <div class="hf-row hf-chips">
      <button
        v-for="l in HISTORY_LANES"
        :key="l.id"
        type="button"
        class="hf-chip"
        :aria-pressed="f.lanes.has(l.id)"
        :title="`${l.hint} — Shift+click (or Shift+Enter) shows only this lane`"
        :aria-keyshortcuts="'Shift+Enter'"
        :style="{ '--lane': LANE_META[l.id].color }"
        @click="$event.shiftKey ? soloLane(l.id) : toggleLane(l.id)"
        @dblclick="soloLane(l.id)"
      >
        <span aria-hidden="true">{{ LANE_META[l.id].glyph }}</span> {{ l.label }}
        <span class="hf-n">{{ laneCounts[l.id] ?? 0 }}</span>
      </button>
      <button v-if="f.lanes.size < HISTORY_LANES.length" type="button" class="hf-link" @click="allLanes">All lanes</button>
      <span class="hf-sep" aria-hidden="true" />
      <button
        v-for="m in HISTORY_MODES"
        :key="m.id"
        type="button"
        class="hf-chip hf-mode"
        :data-mode="m.id"
        :aria-pressed="f.modes.has(m.id)"
        @click="toggleMode(m.id)"
      >{{ m.label }} <span class="hf-n">{{ modeCounts[m.id] ?? 0 }}</span></button>
      <button
        v-if="sampleCount"
        type="button"
        class="hf-chip hf-sample"
        :aria-pressed="f.showSample"
        title="Pre-filled demo history and catalog wallets"
        @click="set({ showSample: !f.showSample })"
      >Sample <span class="hf-n">{{ sampleCount }}</span></button>
    </div>
  </div>
</template>

<style scoped>
.hf { display: flex; flex-direction: column; gap: 0.45rem; }
.hf-row { display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; }
.hf-seg { display: inline-flex; border: 1px solid var(--edge-raised); border-radius: var(--radius-md, 8px); overflow: hidden; }
.hf-seg-b { all: unset; cursor: pointer; padding: 0.35rem 0.6rem; font-size: 0.74rem; color: var(--text-gray); font-variant-numeric: tabular-nums; min-height: 24px; }
.hf-seg-b[aria-pressed='true'] { background: rgba(255,255,255,0.09); color: var(--text-white); font-weight: 600; }
.hf-seg-b:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: -2px; }
.hf-search { flex: 1 1 12rem; min-width: 0; }
.hf-search input {
  width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.03); border: 1px solid var(--edge-raised);
  color: var(--text-white); padding: 0.4rem 0.6rem; border-radius: var(--radius-md, 8px); font: inherit; font-size: 0.78rem;
}
.hf-search input:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.hf-chip {
  all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; min-height: 24px;
  padding: 0.25rem 0.55rem; border-radius: 999px; font-size: 0.72rem; color: var(--text-gray);
  border: 1px solid var(--edge-raised);
}
.hf-chip[aria-pressed='true'] { color: var(--text-white); border-color: var(--lane, var(--text-light-gray)); background: color-mix(in oklch, var(--lane, #fff) 12%, transparent); }
.hf-chip[aria-pressed='false'] { text-decoration: line-through; text-decoration-color: rgba(255,255,255,0.25); }
.hf-chip:focus-visible, .hf-link:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.hf-mode[data-mode='paper'] { border-style: dashed; }
.hf-mode[data-mode='backtest'] { border-style: dotted; }
.hf-sample { --lane: var(--warning-orange); }
.hf-n { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; font-size: 0.66rem; opacity: 0.8; }
.hf-sep { width: 1px; height: 1.1rem; background: var(--edge-raised); margin: 0 0.15rem; }
.hf-link { all: unset; cursor: pointer; font-size: 0.72rem; color: var(--primary-blue); }
@media (max-width: 560px) {
  /* one swipeable strip instead of three ragged rows */
  .hf-chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 0.15rem; mask-image: linear-gradient(90deg, #000 88%, transparent); }
  .hf-chips > * { flex: 0 0 auto; }
}
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
