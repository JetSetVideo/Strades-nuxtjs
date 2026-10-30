<script setup lang="ts">
/**
 * Entourage: the measured people around you, sorted into who completes you (together you call better),
 * who mirrors you and who opposes you; the rest sit in "No strong pattern". Each card shows how far they
 * sit from you in the 11-axis space and the two closest / two farthest axes as diverging gap bars
 * (centre = you). Click a card to open the relation on /insights.
 */
import { computed, ref } from 'vue'
import {
  intelDistanceWords, intelEntourageColumns, intelEntourageEmpty, intelGapRows,
  type IntelEntourage, type IntelEntourageItem,
} from '~/utils/intelligenceV2'

const props = defineProps<{ entourage: IntelEntourage | null; status: string; error: string | null }>()
const emit = defineEmits<{ retry: [] }>()

const cols = computed(() => intelEntourageColumns(props.entourage))
const main = computed(() => cols.value.filter(c => c.kind !== 'differs'))
const rest = computed(() => cols.value.find(c => c.kind === 'differs')!)
const empty = computed(() => intelEntourageEmpty(props.entourage))
const showRest = ref(false)
const axes = computed(() => props.entourage?.axes ?? [])
const gaps = (it: IntelEntourageItem) => ({
  close: intelGapRows(it, axes.value, it.closest_axes.slice(0, 2)),
  far: intelGapRows(it, axes.value, it.farthest_axes.slice(0, 2)),
})
const score = (v: number | null) => (typeof v === 'number' ? Math.round(v) : '—')
</script>

<template>
  <div class="en">
    <div v-if="status === 'loading' && !entourage" class="skel" aria-busy="true">Reading your entourage…</div>
    <p v-else-if="status === 'error' && !entourage" class="err" role="alert">{{ error }} <button type="button" class="lnk" @click="emit('retry')">Retry</button></p>
    <div v-else-if="empty" class="empty">
      <p class="empty-t">Nobody around you is measured enough yet.</p>
      <p>Add a few friends, join a room and make a few calls with a target date. Once your calls and theirs resolve, we can tell who completes, mirrors or opposes you.</p>
    </div>
    <template v-else>
      <p class="lead">
        Distance = how far apart you sit across the 11 axes (in community standard deviations). Bars: centre = you,
        the bar goes toward the pole they lean to.
        <template v-if="entourage?.unmeasured_friends"> {{ entourage.unmeasured_friends }} friend{{ entourage.unmeasured_friends === 1 ? ' is' : 's are' }} not measured yet.</template>
      </p>
      <div class="cols">
        <section v-for="c in main" :key="c.kind" class="col" :data-kind="c.kind">
          <h3 class="col-t">{{ c.title }} <span class="num muted">{{ c.items.length }}</span></h3>
          <p class="col-x">{{ c.explain }}</p>
          <p v-if="!c.items.length" class="none">Nobody yet.</p>
          <ul class="cards">
            <li v-for="it in c.items" :key="it.relation_id">
              <NuxtLink :to="`/insights?relation=${encodeURIComponent(it.relation_id)}`" class="card">
                <span class="card-t">
                  <b>{{ it.user.name }}</b>
                  <span v-if="it.user.is_bot" class="chip">bot</span>
                  <span v-else-if="it.user.is_demo" class="chip">demo</span>
                  <span v-if="it.user.code_inferred" class="num muted">{{ it.user.code_inferred }}</span>
                </span>
                <span class="card-m">
                  {{ intelDistanceWords(it.distance) }}<template v-if="it.distance !== null"> · <span class="num">{{ it.distance.toFixed(2) }}</span></template>
                  · compatibility <span class="num">{{ score(it.compatibility) }}</span>
                  <template v-if="it.complementarity_pts !== null"> · together <span class="num">{{ it.complementarity_pts > 0 ? '+' : '' }}{{ it.complementarity_pts.toFixed(1) }} pts</span></template>
                </span>
                <span v-for="grp in [{ k: 'Closest', rows: gaps(it).close }, { k: 'Farthest', rows: gaps(it).far }]" :key="grp.k" class="gaps">
                  <span class="gaps-k">{{ grp.k }}</span>
                  <span v-for="r in grp.rows" :key="r.key" class="gap">
                    <span class="gap-l">{{ r.label }}</span>
                    <span class="gap-track" aria-hidden="true"><span class="gap-mid" /><span class="gap-fill" :data-side="r.side" :style="{ left: `${r.left}%`, width: `${Math.max(r.width, 1)}%` }" /></span>
                    <span class="gap-w">{{ r.words }}</span>
                  </span>
                </span>
                <span class="open">Open relation →</span>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
      <section v-if="rest.items.length" class="rest">
        <button type="button" class="rest-b" :aria-expanded="showRest" @click="showRest = !showRest">
          {{ showRest ? '−' : '+' }} {{ rest.title }} ({{ rest.items.length }})
        </button>
        <template v-if="showRest">
          <p class="col-x">{{ rest.explain }}</p>
          <ul class="rest-l">
            <li v-for="it in rest.items" :key="it.relation_id">
              <NuxtLink :to="`/insights?relation=${encodeURIComponent(it.relation_id)}`" class="rest-a">
                <b>{{ it.user.name }}</b>
                <span v-if="it.user.is_bot" class="chip">bot</span>
                <span v-else-if="it.user.is_demo" class="chip">demo</span>
                <span class="muted">{{ intelDistanceWords(it.distance) }} · compatibility {{ score(it.compatibility) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.en { display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
.skel { height: 8rem; border-radius: var(--radius-md); background: var(--surface-raised); display: grid; place-items: center; font-size: 0.74rem; color: var(--text-gray); }
.err { margin: 0; font-size: 0.76rem; color: var(--warning-orange); }
.empty { border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); padding: var(--card-pad); font-size: 0.8rem; color: var(--text-light-gray); }
.empty p { margin: 0 0 0.3rem; }
.empty-t { color: var(--text-white); }
.lead { margin: 0; font-size: 0.72rem; color: var(--text-gray); }
.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; }
@media (max-width: 900px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.col { min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; padding-top: 0.4rem; border-top: 2px solid var(--edge-raised); }
.col[data-kind='completes'] { border-top-color: var(--primary-green); }
.col[data-kind='mirrors'] { border-top-color: var(--primary-blue); }
.col[data-kind='opposes'] { border-top-color: var(--domain-social); }
.col-t { margin: 0; font-size: 0.8rem; color: var(--text-white); }
.col-x { margin: 0; font-size: 0.68rem; color: var(--text-gray); }
.none { margin: 0; font-size: 0.72rem; color: var(--text-gray); font-style: italic; }
.cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.card { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.55rem 0.65rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); color: inherit; text-decoration: none; min-width: 0; }
.card:hover { border-color: var(--edge-lit); }
.card:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.card-t { display: flex; flex-wrap: wrap; gap: 0.2rem 0.4rem; align-items: baseline; font-size: 0.8rem; color: var(--text-white); }
.chip { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.35rem; border-radius: 999px; border: 1px solid var(--edge-lit); color: var(--text-light-gray); }
.card-m { font-size: 0.68rem; color: var(--text-light-gray); }
.gaps { display: flex; flex-direction: column; gap: 0.15rem; }
.gaps-k { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-gray); }
.gap { display: grid; grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr); gap: 0 0.45rem; align-items: center; }
.gap-l { font-size: 0.66rem; color: var(--text-light-gray); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gap-track { position: relative; height: 0.4rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
.gap-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.gap-fill { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: var(--domain-social); }
.gap-fill[data-side='same'] { background: var(--text-gray); }
.gap-w { grid-column: 1 / -1; font-size: 0.6rem; color: var(--text-gray); }
.open { font-size: 0.66rem; color: var(--primary-blue); }
.rest { display: flex; flex-direction: column; gap: 0.35rem; }
.rest-b { all: unset; cursor: pointer; font-size: 0.74rem; color: var(--text-light-gray); min-height: 24px; }
.rest-b:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.rest-l { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr)); gap: 0.3rem; }
.rest-a { display: flex; flex-wrap: wrap; gap: 0.15rem 0.4rem; align-items: baseline; font-size: 0.72rem; color: var(--text-white); text-decoration: none; padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--edge-soft); min-height: 24px; }
.rest-a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.rest-a .muted { font-size: 0.64rem; }
.lnk { all: unset; cursor: pointer; color: var(--primary-blue); }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
