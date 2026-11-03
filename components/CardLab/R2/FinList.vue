<script setup lang="ts">
/**
 * Card lab ROUND 2 — FINAL list (combine lane). Owns the GRID. Also the production list for /strategies (same contract).
 * Size system per device class (viewport width), mirrored in utils/cardLabR2Fin.ts `cardLabR2FinSizes`
 * (tests/cardlab-r2-fin.test.ts checks this CSS against it):
 *
 * | class  | viewport     | columns                               | card min | card max | card height (every card) | leaf  |
 * |--------|--------------|---------------------------------------|----------|----------|--------------------------|-------|
 * | mobile | < 600        | 1                                     | 312 px   | 440 px   | 580 px                   | 52 px |
 * | tablet | 600 – 1023   | 1–2 (2 only once both cards ≥ 362 px) | 362 px   | 480 px   | 520 px                   | 56 px |
 * | laptop | 1024 – 1439  | 2–3                                   | 362 px   | 440 px   | 520 px                   | 56 px |
 * | large  | ≥ 1440       | 3–4                                   | 392 px   | 440 px   | 500 px                   | 58 px |
 *
 * ONE height per class (D3's method): the natural-height envelope of the lab's 6 cards (densest = card 3) at the class's
 * narrowest card width + a few px (312 → 572 · 362 → 513 · 392 → 493); the sparse never-run card gets the same box (its spare height goes to the springs
 * between sections, never above the buttons). Tracks = repeat(auto-fill, minmax(min, 1fr)); a card is capped at max and
 * centred in its track (wide screens add columns). Details opens as a layer INSIDE the card: sizes never change.
 *
 * Contract (components/CardLab/Bench.vue and /strategies): props items[{strategy, full, code}], variant?, selectedIds?;
 * every card sits in .lab-card[data-variant][data-idx] (idx = 1-based position). Emits select|copy|share|view|toggle|delete
 * with the item index.
 */
import FinCard from './FinCard.vue'
withDefaults(defineProps<{
  items: Array<{ strategy: Record<string, any>; full: Record<string, any> | null; code: Record<string, any> | null }>
  variant?: string
  selectedIds?: string[]
}>(), { variant: 'r2-Fin', selectedIds: () => [] })
const emit = defineEmits<{ select: [i: number]; copy: [i: number]; share: [i: number]; view: [i: number]; toggle: [i: number]; delete: [i: number] }>()
</script>

<template>
  <div class="r2-grid fin-grid">
    <div v-for="(it, i) in items" :key="String(it.strategy.id ?? i)" class="lab-card" :data-variant="variant" :data-idx="i + 1">
      <FinCard :strategy="it.strategy" :full="it.full" :code="it.code" :selected="selectedIds.includes(String(it.strategy.id))"
        @select="emit('select', i)" @copy="emit('copy', i)" @share="emit('share', i)" @view="emit('view', i)" @toggle="emit('toggle', i)" @delete="emit('delete', i)" />
    </div>
  </div>
</template>

<style scoped>
/* Sizes: keep in sync with cardLabR2FinSizes (utils/cardLabR2Fin.ts). mobile (< 600): one column */
.fin-grid {
  --fin-min: 312px; --fin-max: 440px; --fin-h: 580px; --fin-leaf: 52px;
  display: grid; gap: 12px; justify-items: center; align-items: start;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: var(--fin-h);
}
/* tablet (600–1023) */
@media (min-width: 600px) { .fin-grid { --fin-min: 362px; --fin-max: 480px; --fin-h: 520px; --fin-leaf: 56px; } }
/* laptop (1024–1439) */
@media (min-width: 1024px) { .fin-grid { --fin-min: 362px; --fin-max: 440px; --fin-h: 520px; --fin-leaf: 56px; } }
/* large (≥ 1440) */
@media (min-width: 1440px) { .fin-grid { --fin-min: 392px; --fin-max: 440px; --fin-h: 500px; --fin-leaf: 58px; } }
@media (min-width: 600px) { .fin-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--fin-min)), 1fr)); } }
.lab-card { width: 100%; min-width: 0; max-width: var(--fin-max); height: var(--fin-h); display: flex; }
</style>
