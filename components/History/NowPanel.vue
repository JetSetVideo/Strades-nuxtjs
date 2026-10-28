<script setup lang="ts">
/** NOW: everything in progress, grouped by what it asks of you — calls to watch, agents at work,
 *  money in the market, opinions you follow, account clocks. */
import { computed } from 'vue'
import type { HistoryEvent } from '~/utils/historyTimeline'

const props = defineProps<{ events: HistoryEvent[]; now: number; expandedId: string | null; selectedId: string | null; engineNote: string | null; liveState: string }>()
const emit = defineEmits<{ toggle: [id: string]; 'load-live': [] }>()

const GROUPS: { id: string; label: string; kinds: string[] }[] = [
  { id: 'calls', label: 'Calls in play', kinds: ['call_awaiting', 'call_due'] },
  { id: 'agents', label: 'Agents at work', kinds: ['agent_running'] },
  { id: 'money', label: 'In the market', kinds: ['position_open', 'paper_open'] },
  { id: 'opinions', label: 'Opinions you follow', kinds: ['agent_followed'] },
  { id: 'account', label: 'Account', kinds: ['demo_ends'] },
]

const groups = computed(() => {
  const used = new Set<string>()
  const out = GROUPS.map((g) => {
    const items = props.events.filter(e => g.kinds.includes(e.kind))
    items.forEach(e => used.add(e.id))
    return { ...g, items }
  })
  const rest = props.events.filter(e => !used.has(e.id))
  if (rest.length) out.push({ id: 'other', label: 'Other', kinds: [], items: rest })
  return out.filter(g => g.items.length)
})
const hasAgents = computed(() => props.events.some(e => e.kind === 'agent_running'))
</script>

<template>
  <section class="now">
    <p v-if="!events.length" class="sec-empty">Nothing in progress. Open calls, running agents and open positions show up here.</p>
    <div v-for="g in groups" :key="g.id" class="grp">
      <h3 class="grp-title">{{ g.label }} <span class="sec-n">{{ g.items.length }}</span></h3>
      <p v-if="g.id === 'agents' && hasAgents && engineNote" class="grp-note">
        {{ engineNote }}
        <button type="button" class="grp-btn" :disabled="liveState === 'loading'" @click="emit('load-live')">
          {{ liveState === 'loading' ? 'Loading live numbers…' : liveState === 'error' ? 'Retry live numbers' : 'Load live numbers' }}
        </button>
      </p>
      <div class="grp-list">
        <div v-for="e in g.items" :id="`ev-${e.id.replace(/[^\w-]/g, '_')}`" :key="e.id">
          <HistoryEventRow
            :event="e"
            :now="now"
            compact
            :expanded="expandedId === e.id"
            :selected="selectedId === e.id"
            @toggle="emit('toggle', $event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.now { display: flex; flex-direction: column; gap: 0.4rem; }
.sec-n { font-family: var(--font-market-data); font-size: 0.68rem; color: var(--text-gray); letter-spacing: 0; }
.sec-empty { margin: 0; font-size: 0.76rem; color: var(--text-gray); }
.grp { display: flex; flex-direction: column; gap: 0.15rem; }
.grp-title { margin: 0; font-size: 0.7rem; font-weight: 600; color: var(--text-light-gray); }
.grp-list { display: flex; flex-direction: column; gap: 0; }
.grp-note { margin: 0; font-size: 0.7rem; color: var(--text-gray); display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.grp-btn { all: unset; cursor: pointer; color: var(--primary-blue); font-size: 0.7rem; }
.grp-btn:disabled { opacity: 0.6; cursor: progress; }
.grp-btn:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
</style>
