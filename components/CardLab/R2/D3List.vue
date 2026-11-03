<script setup lang="ts">
/**
 * Card lab ROUND 2 — D3 list (lane d3, folded corner). Owns the GRID and the SIZE SYSTEM; the card reads it from CSS vars.
 *
 *   class (viewport)          columns                          card min-w · max-w   card height (ALL cards)   corner tile
 *   mobile  < 600             1                                280 · 560            580                        58
 *   tablet  600–1023          1–2 (auto-fill, track ≥ 330)     300 · 560            580                        62
 *   laptop  1024–1439         2–3 (auto-fill, track ≥ 372)     330 · 480            560                        64
 *   large   ≥ 1440            3–4+ (auto-fill, track ≥ 380)    360 · 460            560                        66
 *   (heights = densest sample, card 3, at the narrowest card of the class + 5 px: 574 @≤360 · 555 @372–380 · 523 @440+)
 *
 * Same numbers in utils/cardLabR2D3.ts (CARD_LAB_R2D3_SIZES, tested). Every card of a list has the same width (grid
 * track) and the same height (fixed per class: sparse item 6 = dense item 3). A card never exceeds its max-width: a
 * wider track centres the card; wide screens add columns. Details opens as a layer INSIDE the card (no resize).
 * Contract (components/CardLab/Bench.vue): props items[{strategy, full, code}], variant, selectedIds?; every card sits
 * in .lab-card[data-variant][data-idx] (idx = 1-based position). Emits card events with the item index.
 */
import D3Card from './D3Card.vue'
defineProps<{ items: Array<{ strategy: Record<string, any>; full: Record<string, any> | null; code: Record<string, any> | null }>; variant: string; selectedIds?: string[] }>()
const emit = defineEmits<{ select: [i: number]; copy: [i: number]; share: [i: number]; view: [i: number]; toggle: [i: number]; delete: [i: number] }>()
</script>

<template>
  <div class="r2-grid">
    <div v-for="(it, i) in items" :key="String(it.strategy.id ?? i)" class="lab-card" :data-variant="variant" :data-idx="i + 1">
      <D3Card :strategy="it.strategy" :full="it.full" :code="it.code" :selected="(selectedIds ?? []).includes(String(it.strategy.id))"
        @select="emit('select', i)" @copy="emit('copy', i)" @share="emit('share', i)" @view="emit('view', i)" @toggle="emit('toggle', i)" @delete="emit('delete', i)" />
    </div>
  </div>
</template>

<style scoped>
/* mobile < 600 (default) */
.r2-grid {
  --d3-track: 280px; --d3-minw: 280px; --d3-maxw: 560px; --d3-h: 580px; --d3-tile: 58px;
  display: grid; gap: 12px; justify-content: center;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--d3-track)), 1fr));
  grid-auto-rows: var(--d3-h);
}
@media (min-width: 600px) { .r2-grid { --d3-track: 330px; --d3-minw: 300px; --d3-maxw: 560px; --d3-h: 580px; --d3-tile: 62px; } }
@media (min-width: 1024px) { .r2-grid { --d3-track: 372px; --d3-minw: 330px; --d3-maxw: 480px; --d3-h: 560px; --d3-tile: 64px; } }
@media (min-width: 1440px) { .r2-grid { --d3-track: 380px; --d3-minw: 360px; --d3-maxw: 460px; --d3-h: 560px; --d3-tile: 66px; } }
.lab-card { min-width: 0; display: flex; justify-content: center; }
</style>
