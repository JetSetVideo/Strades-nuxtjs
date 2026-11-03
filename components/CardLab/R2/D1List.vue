<script setup lang="ts">
/**
 * Card lab ROUND 2 — D1 list. Owns the GRID: per device class a FIXED column count, a card min/max width and ONE card
 * height shared by every card of the list (whatever its data). Contract (components/CardLab/Bench.vue): props
 * items[{strategy, full, code}], variant, selectedIds?; every card sits in .lab-card[data-variant][data-idx] (1-based).
 *
 * SIZE SYSTEM (single source: utils/cardLabR2D1.ts; tests/cardlab-r2-d1.test.ts checks this CSS against it):
 * | class  | viewport    | columns | card min-w | card max-w | gap | card height (all cards of the list identical)   |
 * |--------|-------------|---------|------------|------------|-----|--------------------------------------------------|
 * | mobile | < 600       | 1       | 296        | 400        | 12  | 625 @360 · 606 @390 · 550 @599 (max-w reached)   |
 * | tablet | 600 – 1023  | 2       | 256        | 440        | 12  | 704 @600 · 586 @820 · 534 @1023                  |
 * | laptop | 1024 – 1439 | 3       | 296        | 420        | 14  | 635 @1024 · 561 @1280 · 534 @1439                |
 * | large  | ≥ 1440      | 4       | 320        | 400        | 16  | 614 @1440 · 559 @1920 · 559 @2560 (row centred)  |
 * Height H(W) = max(534, 708 − 1.537·(W − 258), min(622 − 0.558·(W − 313), 598 − 1.1·(W − 356))) of the card width W, the same for every card of
 * the list (it never reads the data): the measured envelope of the densest sample + ≥ 5 px. Rows are `1fr`, so even if real
 * data ever outgrew H, every card of the list would grow together (equal, nothing cut). The grid never stretches a card
 * past max-w: the row is centred instead.
 */
import D1Card from './D1Card.vue'
defineProps<{ items: Array<{ strategy: Record<string, any>; full: Record<string, any> | null; code: Record<string, any> | null }>; variant: string; selectedIds?: string[] }>()
const emit = defineEmits<{ select: [i: number]; copy: [i: number]; share: [i: number]; view: [i: number]; toggle: [i: number]; delete: [i: number] }>()
</script>

<template>
  <div class="r2-grid d1-grid">
    <div v-for="(it, i) in items" :key="String(it.strategy.id ?? i)" class="lab-card" :data-variant="variant" :data-idx="i + 1">
      <D1Card :strategy="it.strategy" :full="it.full" :code="it.code" :selected="(selectedIds ?? []).includes(String(it.strategy.id))"
        @select="emit('select', i)" @copy="emit('copy', i)" @share="emit('share', i)" @view="emit('view', i)" @toggle="emit('toggle', i)" @delete="emit('delete', i)" />
    </div>
  </div>
</template>

<style scoped>
/* mobile (< 600) */
.d1-grid {
  --d1-cols: 1; --d1-min-w: 296px; --d1-max-w: 400px; --d1-gap: 12px;
  display: grid; gap: var(--d1-gap);
  grid-template-columns: repeat(var(--d1-cols), minmax(0, var(--d1-max-w)));
  grid-auto-rows: 1fr;
  justify-content: center; align-items: stretch;
}
/* tablet (600 – 1023) */
@media (min-width: 600px) { .d1-grid { --d1-cols: 2; --d1-min-w: 256px; --d1-max-w: 440px; --d1-gap: 12px; } }
/* laptop (1024 – 1439) */
@media (min-width: 1024px) { .d1-grid { --d1-cols: 3; --d1-min-w: 296px; --d1-max-w: 420px; --d1-gap: 14px; } }
/* large (≥ 1440) */
@media (min-width: 1440px) { .d1-grid { --d1-cols: 4; --d1-min-w: 320px; --d1-max-w: 400px; --d1-gap: 16px; } }
/* each cell is a width container: the card computes its height from 100cqw (= its own width, the same for all) */
.lab-card { min-width: 0; display: flex; container-type: inline-size; }
</style>
