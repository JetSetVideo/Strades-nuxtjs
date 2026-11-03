<script setup lang="ts">
/**
 * Card lab bench (swarm 2026-11-02 "cards"): renders the catalog sample strategies in one card design at a time,
 * so the swarm can screenshot, measure and blind-test each design. Open /test?lab=<variant> (public in dev builds).
 *
 * Round 1 variants (single card per slot): baseline, A, B, C, final.
 *   props: { strategy: summary row (strategyToSummary, has `sample`), full: catalog record, code: strategyToCodeView(full) }
 * Round 2 variants (list components own the GRID: per-device min/max width, equal card height): r2-D1, r2-D2, r2-D3, r2-Fin.
 *   CardLab/R2/<X>List.vue props: { items[{strategy, full, code}], variant, selectedIds? } — cards in .lab-card[data-idx].
 *   Item 6 is a SPARSE own strategy (summary only, no metrics, full = null): a card with little data must keep the same size.
 *   ?n=5 drops it (blind tests use the 5 samples only).
 * data-idx is the position, never the id or name, so wrappers leak nothing to blind guessers.
 */
import { computed, onMounted } from 'vue'
import { useStrategiesStore, strategyToSummary } from '~/stores/strategies'
import { strategyToCodeView } from '~/utils/strategyCode'
import CardLabA from '~/components/CardLab/A.vue'
import CardLabB from '~/components/CardLab/B.vue'
import CardLabC from '~/components/CardLab/C.vue'
import CardLabFinal from '~/components/CardLab/Final.vue'
import CardStrategy from '~/components/Card/Strategy.vue'
import R2D1List from '~/components/CardLab/R2/D1List.vue'
import R2D2List from '~/components/CardLab/R2/D2List.vue'
import R2D3List from '~/components/CardLab/R2/D3List.vue'
import R2FinList from '~/components/CardLab/R2/FinList.vue'

const props = defineProps<{ only: string; width?: number; n?: number }>()

const store = useStrategiesStore()
onMounted(() => { if (!store.strategies.length) store.fetchStrategies() })

const samples = computed(() => store.strategies.filter(s => s.sample).slice(0, 5).map(full => ({
  full,
  strategy: strategyToSummary(full),
  code: (() => { try { return strategyToCodeView(full as never) } catch { return null } })(),
})))

/** A user's own strategy as the Carousel sees it: summary fields only, never run (lab fixture, not anyone's data). */
const SPARSE_OWN = {
  id: 'lab_own_sparse', name: 'My RSI dip test', description: 'Buy BTC when RSI(14) < 30, sell when RSI > 55.',
  category: 'crypto', status: 'stopped', risk_level: 'medium', target_assets: ['BTC'], targetAssets: ['BTC'],
  creator: 'current_user', creator_id: 'current_user', sample: false, tags: [], numberOfTrades: 0,
}
const items = computed(() => (props.n === 5 || !samples.value.length)
  ? samples.value
  : [...samples.value, { strategy: SPARSE_OWN as Record<string, any>, full: null, code: null }])

const R1 = ['baseline', 'A', 'B', 'C', 'final'] as const
const R2: Record<string, unknown> = { 'r2-D1': R2D1List, 'r2-D2': R2D2List, 'r2-D3': R2D3List, 'r2-Fin': R2FinList }
const shownR1 = computed(() => props.only === 'all' ? [...R1] : R1.filter(v => v === props.only))
const shownR2 = computed(() => props.only === 'all-r2' ? Object.keys(R2) : Object.keys(R2).filter(v => v === props.only))
const COMPONENTS: Record<string, unknown> = { A: CardLabA, B: CardLabB, C: CardLabC, final: CardLabFinal }
</script>

<template>
  <section class="lab" aria-label="Strategy card lab">
    <p v-if="!samples.length" class="lab-empty">Loading the sample strategies…</p>
    <div v-for="v in shownR1" :key="v" class="lab-variant">
      <h2 class="lab-h">Variant {{ v }}</h2>
      <div class="lab-grid" :style="width ? { gridTemplateColumns: `repeat(auto-fill, ${width}px)` } : undefined">
        <div v-for="(s, i) in samples" :key="`${v}-${i}`" class="lab-card" :data-variant="v" :data-idx="i + 1">
          <CardStrategy v-if="v === 'baseline'" :strategy="s.strategy as any" variant="featured" />
          <component :is="COMPONENTS[v]" v-else :strategy="s.strategy" :full="s.full" :code="s.code" />
        </div>
      </div>
    </div>
    <div v-for="v in shownR2" :key="v" class="lab-variant lab-r2" :data-list="v">
      <h2 class="lab-h">Variant {{ v }}</h2>
      <component :is="R2[v]" v-if="samples.length" :items="items" :variant="v" />
    </div>
  </section>
</template>

<style scoped>
.lab { display: flex; flex-direction: column; gap: 1.5rem; }
.lab-h { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; margin: 0 0 0.5rem; }
.lab-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); align-items: start; }
.lab-card { min-width: 0; }
.lab-empty { opacity: 0.6; }
</style>
