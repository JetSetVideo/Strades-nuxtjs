<script setup lang="ts">
/**
 * The agent directive your profile produces: the strategy mix your personal agent starts from, where
 * that mix comes from (own profile / allies / swarm, with shares) and the risk budget. Paper only.
 */
import { computed, ref } from 'vue'
import { intelPct, sourceColor, weightRows, type IntelDirective } from '~/utils/intelligence'

const props = defineProps<{ directive: IntelDirective | null }>()

const SOURCE_KEY: Record<string, string> = { 'own profile': 'own', allies: 'allies', swarm: 'swarm' }

const rows = computed(() => {
  const d = props.directive
  if (!d) return []
  return weightRows(d.weights).map((r) => {
    // stacked segments: each source's share × that source's weight for this strategy
    const segs = (d.sources ?? []).map((s) => {
      const comp = d.components?.[SOURCE_KEY[s.source] ?? s.source]
      return { source: s.source, w: comp && typeof comp[r.key] === 'number' ? s.share * (comp[r.key] as number) : 0 }
    }).filter(s => s.w > 0)
    const sum = segs.reduce((t, s) => t + s.w, 0)
    return { ...r, segs: sum > 0 ? segs.map(s => ({ ...s, frac: s.w / sum })) : [] }
  })
})
const max = computed(() => Math.max(0.01, ...rows.value.map(r => r.share)))
const openRow = ref<string | null>(null)
const budget = computed(() => props.directive
  ? [
      { k: 'Max position', v: intelPct(props.directive.max_position_pct, 1), x: 'Largest share of the paper wallet one position may take.' },
      { k: 'Stop loss', v: intelPct(props.directive.stop_loss_pct, 1), x: 'A position is closed when it falls this far.' },
      { k: 'Take profit', v: intelPct(props.directive.take_profit_pct, 1), x: 'A position is closed when it gains this much (on paper).' },
    ]
  : [])
</script>

<template>
  <section class="dir" aria-labelledby="dir-title">
    <header class="dir-head">
      <h2 id="dir-title" class="dir-t">Your agent's directive</h2>
      <p class="dir-sub">The strategy mix your personal agent starts from, built from your behaviour read. Paper trading only.</p>
    </header>

    <p v-if="!directive" class="muted">No directive yet. It appears after your first analysis: press <b>Re-analyse me now</b> above.</p>

    <template v-else>
      <div class="dir-grid">
        <div>
          <h3 class="sub">Strategy weights <span class="muted">· tap a row</span></h3>
          <ul class="w">
            <li v-for="r in rows" :key="r.key">
              <button type="button" class="w-row" :aria-expanded="openRow === r.key" @click="openRow = openRow === r.key ? null : r.key">
                <span class="w-l">{{ r.label }}</span>
                <span class="w-track" aria-hidden="true">
                  <span class="w-bar" :style="{ width: `${(r.share / max) * 100}%` }">
                    <span v-for="s in r.segs" :key="s.source" class="w-seg" :style="{ flexGrow: s.frac, background: sourceColor(s.source) }" />
                  </span>
                </span>
                <span class="w-v num">{{ intelPct(r.share) }}</span>
              </button>
              <p v-if="openRow === r.key" class="w-x">
                {{ r.explain }}
                <template v-if="r.segs.length"> Made of: <span v-for="(s, i) in r.segs" :key="s.source">{{ i ? ', ' : '' }}{{ s.source }} {{ intelPct(s.frac) }}</span>.</template>
              </p>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="sub">Where it comes from</h3>
          <div class="src-bar" role="img" :aria-label="directive.sources.map(s => `${s.source} ${intelPct(s.share)}`).join(', ')">
            <span v-for="s in directive.sources" :key="s.source" :style="{ flexGrow: s.share, background: sourceColor(s.source) }" />
          </div>
          <ul class="src">
            <li v-for="s in directive.sources" :key="s.source">
              <span class="src-k"><i :style="{ background: sourceColor(s.source) }" />{{ s.source }} <b class="num">{{ intelPct(s.share) }}</b></span>
              <span class="src-why">{{ s.why }}</span>
            </li>
          </ul>

          <h3 class="sub">Risk budget</h3>
          <dl class="budget">
            <div v-for="b in budget" :key="b.k" class="bud">
              <dt>{{ b.k }}</dt>
              <dd class="num">{{ b.v }}</dd>
              <dd class="bud-x">{{ b.x }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.dir { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; }
.dir-t { margin: 0; font-size: 1rem; color: var(--text-white); }
.dir-sub { margin: 0.15rem 0 0; font-size: 0.72rem; color: var(--text-gray); }
.dir-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--card-gap) 1.25rem; }
@media (max-width: 760px) { .dir-grid { grid-template-columns: minmax(0, 1fr); } }
.sub { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.sub .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.muted { color: var(--text-gray); font-size: 0.76rem; }
.w { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.w-row { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 8rem) minmax(0, 1fr) 3rem; gap: 0.5rem; align-items: center; padding: 0.25rem 0.3rem; border-radius: var(--radius-sm); min-height: 24px; }
.w-row:hover { background: var(--nav-hover-bg); }
.w-row:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.w-l { font-size: 0.76rem; color: var(--text-light-gray); }
.w-track { height: 0.6rem; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
.w-bar { display: flex; height: 100%; gap: 1px; }
.w-seg { flex-basis: 0; min-width: 2px; }
.w-v { font-size: 0.74rem; color: var(--text-white); text-align: right; }
.w-x { margin: 0 0.3rem 0.3rem; font-size: 0.7rem; color: var(--text-gray); }
.src-bar { display: flex; height: 0.6rem; border-radius: 999px; overflow: hidden; gap: 2px; margin-bottom: 0.4rem; }
.src-bar span { flex-basis: 0; min-width: 3px; }
.src { list-style: none; margin: 0 0 0.75rem; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.src li { display: flex; flex-direction: column; gap: 0.05rem; }
.src-k { font-size: 0.76rem; color: var(--text-white); text-transform: capitalize; display: inline-flex; align-items: center; gap: 0.35rem; }
.src-k i { width: 0.55rem; height: 0.55rem; border-radius: 2px; display: inline-block; }
.src-why { font-size: 0.7rem; color: var(--text-gray); padding-left: 0.9rem; }
.budget { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--card-gap); }
@media (max-width: 420px) { .budget { grid-template-columns: minmax(0, 1fr); } }
.bud { padding: 0.45rem 0.6rem; border-radius: var(--radius-md); border: 1px solid var(--edge-raised); background: var(--surface-raised); min-width: 0; }
.bud dt { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-gray); }
.bud dd { margin: 0; }
.bud .num { font-size: 1rem; font-weight: 700; color: var(--text-white); }
.bud-x { font-size: 0.66rem; color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
