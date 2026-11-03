<script setup lang="ts">
import type { StrategySummary } from '~/types/strategy'
import { computed } from 'vue'
// Strategy card list (swarm 2026-11-02 "cards", round 2): the final list owns the grid — one card height per device class,
// min/max card widths, equal sizes whatever the data — and renders FinCard (CardLab/R2). It gets the full catalog/server
// record and its code view from the store when they exist, and the summary alone otherwise.
import FinList from '@/components/CardLab/R2/FinList.vue'
import { useStrategiesStore } from '~/stores/strategies'
import { strategyToCodeView } from '~/utils/strategyCode'

const store = useStrategiesStore()
const fullOf = (s: StrategySummary) => store.strategies.find(x => x.id === s.id) ?? null
const codeOf = (s: StrategySummary) => {
  const f = fullOf(s)
  if (!f) return null
  try { return strategyToCodeView(f as never) } catch { return null }
}

const props = defineProps<{
  strategies: StrategySummary[]
  selectedStrategies?: StrategySummary[]
}>()

const emit = defineEmits<{
  'select-strategy': [s: StrategySummary]
  'copy': [s: StrategySummary]
  'share': [s: StrategySummary]
  'view': [s: StrategySummary]
  'toggle': [s: StrategySummary]
  'delete': [s: StrategySummary]
}>()

const items = computed(() => props.strategies.map(s => ({ strategy: s as Record<string, any>, full: fullOf(s), code: codeOf(s) })))
const selectedIds = computed(() => (props.selectedStrategies ?? []).map(s => String(s.id)))
const at = (i: number) => props.strategies[i]!
</script>

<template>
  <div class="carousel-root">
    <!-- ── Strategy card wall — every strategy gets the full "trading card" treatment, all cards one size ── -->
    <FinList
      v-if="strategies.length"
      :items="items"
      variant="strategies"
      :selected-ids="selectedIds"
      @select="i => emit('select-strategy', at(i))"
      @copy="i => emit('copy', at(i))"
      @share="i => emit('share', at(i))"
      @view="i => emit('view', at(i))"
      @toggle="i => emit('toggle', at(i))"
      @delete="i => emit('delete', at(i))"
    />

    <!-- Empty state -->
    <div v-else class="empty-carousel">
      <span class="empty-icon">📊</span>
      <p>No strategies match your filters.</p>
      <NuxtLink to="/creator" class="create-link">+ Create your first strategy →</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.carousel-root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── Card wall — a responsive grid of dense "trading card" strategy tiles ── */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: var(--spacing-sm);
  align-items: start;
}

.card-slot {
  animation: card-enter 0.25s ease;
}

@keyframes card-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Empty ── */
.empty-carousel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background: rgba(0,0,0,0.15);
  border: 1px dashed var(--border-primary);
  border-radius: var(--radius-md);
}

.empty-icon { font-size: 2.5rem; opacity: 0.3; }

.empty-carousel p {
  font-size: 0.82rem;
  color: var(--text-gray);
  margin: 0;
}

.create-link {
  font-size: 0.75rem;
  color: var(--primary-green);
  text-decoration: none;
  font-weight: 700;
}

.create-link:hover { text-decoration: underline; }
</style>
