<script setup lang="ts">
/**
 * Card lab ROUND 2 — D2 list (lane d2). Owns the GRID. Size system per device class (viewport width), mirrored in
 * utils/cardLabR2D2.ts `cardLabR2D2Sizes` (tests/cardlab-r2-d2.test.ts checks this CSS against it):
 *
 * | class  | viewport     | columns                              | card min | card max | card height (every card) |
 * |--------|--------------|--------------------------------------|----------|----------|--------------------------|
 * | mobile | < 600        | 1                                    | 308 px   | 440 px   | 600 px                   |
 * | tablet | 600 – 1023   | 1–2 (auto-fill: 2 from a 736 px list)| 362 px   | 480 px   | 552 px                   |
 * | laptop | 1024 – 1439  | 2–3 (3 from a 1110 px list)          | 362 px   | 440 px   | 552 px                   |
 * | large  | ≥ 1440       | 3–4 (4 from a 1604 px list)          | 392 px   | 440 px   | 524 px                   |
 *
 * Heights = the natural-height envelope (max over the 6 cards, densest = SPX) at the class's min width, measured every 2 px
 * of card width (shots-r2/D2/v3-envelope.json): 308 → 590 · 362 → 543 · 392 → 514; + ~10 px margin.
 *
 * Tracks = repeat(auto-fill, minmax(min, 1fr)) (mobile: one track); the card is capped at max and centred in its track, so a card never
 * exceeds its max on wide screens and every card of a row has the same box. The height is ONE value per class
 * (`--d2-h`), the same for a dense sample and the sparse own strategy; Details opens as a layer inside the card.
 * Contract (components/CardLab/Bench.vue): props items[{strategy, full, code}], variant, selectedIds?; every card sits in
 * .lab-card[data-variant][data-idx] (idx = 1-based position). Emits card events with the item index.
 */
import D2Card from './D2Card.vue'
defineProps<{ items: Array<{ strategy: Record<string, any>; full: Record<string, any> | null; code: Record<string, any> | null }>; variant: string; selectedIds?: string[] }>()
const emit = defineEmits<{ select: [i: number]; copy: [i: number]; share: [i: number]; view: [i: number]; toggle: [i: number]; delete: [i: number] }>()
</script>

<template>
  <div class="r2-grid d2-grid">
    <div v-for="(it, i) in items" :key="String(it.strategy.id ?? i)" class="lab-card" :data-variant="variant" :data-idx="i + 1">
      <D2Card :strategy="it.strategy" :full="it.full" :code="it.code" :selected="(selectedIds ?? []).includes(String(it.strategy.id))"
        @select="emit('select', i)" @copy="emit('copy', i)" @share="emit('share', i)" @view="emit('view', i)" @toggle="emit('toggle', i)" @delete="emit('delete', i)" />
    </div>
  </div>
</template>

<style scoped>
/* Sizes: keep in sync with cardLabR2D2Sizes (utils/cardLabR2D2.ts). mobile (< 600): one column */
.d2-grid {
  --d2-min: 308px; --d2-max: 440px; --d2-h: 600px;
  display: grid; gap: 12px; justify-items: center; align-items: start;
  grid-template-columns: minmax(0, 1fr);
}
/* tablet (600–1023) */
@media (min-width: 600px) { .d2-grid { --d2-min: 362px; --d2-max: 480px; --d2-h: 552px; } }
/* laptop (1024–1439) */
@media (min-width: 1024px) { .d2-grid { --d2-min: 362px; --d2-max: 440px; --d2-h: 552px; } }
/* large (≥ 1440) */
@media (min-width: 1440px) { .d2-grid { --d2-min: 392px; --d2-max: 440px; --d2-h: 524px; } }
@media (min-width: 600px) { .d2-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--d2-min)), 1fr)); } }
.lab-card { width: 100%; min-width: 0; max-width: var(--d2-max); height: var(--d2-h); }
</style>
