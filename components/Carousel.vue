<script setup lang="ts">
import type { StrategySummary } from '~/types/strategy'
import StrategyCard from '@/components/Card/Strategy.vue'

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

const isSelected = (s: StrategySummary) =>
  (props.selectedStrategies ?? []).some(sel => sel.id === s.id)
</script>

<template>
  <div class="carousel-root">
    <!-- ── Strategy card wall — every strategy gets the full "trading card" treatment ── -->
    <div v-if="strategies.length" class="card-grid">
      <div v-for="s in strategies" :key="s.id" class="card-slot">
        <StrategyCard
          :strategy="s"
          variant="featured"
          :selected="isSelected(s)"
          @select="emit('select-strategy', s)"
          @copy="emit('copy', s)"
          @share="emit('share', s)"
          @view="emit('view', s)"
          @toggle="emit('toggle', s)"
          @delete="emit('delete', s)"
        />
      </div>
    </div>

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
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 10px;
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
