<script setup lang="ts">
/**
 * Community hierarchy of trading styles: per dimension, two ranked columns ("Riskiest", "Most beneficial")
 * and a small risk-vs-benefit scatter. Benefit and risk are about paper call accuracy, never profit.
 * Click a row or a dot to read the style.
 */
import { computed, ref, watch } from 'vue'
import { describeStyle, groupHierarchy, intelSigned, scatterGeometry, type HierarchyPayload, type HierarchyStyle } from '~/utils/intelligence'

const props = defineProps<{
  hierarchy: HierarchyPayload | null
  status: 'idle' | 'loading' | 'ready' | 'error' | 'signed-out'
  error: string | null
  /** the user's own archetype, highlighted as "you" */
  myArchetype?: string | null
}>()
const emit = defineEmits<{ retry: [] }>()

const groups = computed(() => groupHierarchy(props.hierarchy?.styles))
const dim = ref<string | null>(null)
watch(groups, (g) => { if (!g.some(x => x.dimension === dim.value)) dim.value = g[0]?.dimension ?? null }, { immediate: true })
const cur = computed(() => groups.value.find(g => g.dimension === dim.value) ?? null)

const SW = 280
const SH = 170
const SP = 20
const sc = computed(() => scatterGeometry(cur.value?.styles ?? [], SW, SH, SP))
const pickedName = ref<string | null>(null)
watch(dim, () => { pickedName.value = null })
const picked = computed<HierarchyStyle | null>(() => cur.value?.styles.find(s => s.name === pickedName.value) ?? null)
const pick = (s: HierarchyStyle) => { pickedName.value = pickedName.value === s.name ? null : s.name }
const mine = (s: HierarchyStyle) => s.dimension === 'archetype' && !!props.myArchetype && s.name === props.myArchetype
const when = computed(() => (props.hierarchy?.computed_at ? new Date(props.hierarchy.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null))
const fmt2 = (v: number) => intelSigned(v, 2)
</script>

<template>
  <section class="hi" aria-labelledby="hi-title">
    <header class="hi-head">
      <div>
        <h2 id="hi-title" class="hi-t">Styles across the community</h2>
        <p class="hi-sub">
          Every user's calls grouped by style<template v-if="hierarchy?.window_days"> over the last {{ hierarchy.window_days }} days</template><template v-if="when"> · computed {{ when }}</template>.
          <b>Benefit</b> = edge of call accuracy over a coin flip plus mean score; <b>risk</b> = spread of scores, share of calls scored 0 and size of the moves called. Paper calls, not profit.
        </p>
      </div>
      <div v-if="groups.length > 1" class="tabs" role="tablist" aria-label="Dimension">
        <button v-for="g in groups" :key="g.dimension" type="button" role="tab" class="tab" :aria-selected="dim === g.dimension" @click="dim = g.dimension">{{ g.label }}</button>
      </div>
    </header>

    <div v-if="status === 'loading' || status === 'idle'" class="sk" aria-busy="true" aria-label="Loading hierarchy"><span v-for="i in 3" :key="i" /></div>
    <p v-else-if="status === 'error'" class="muted">{{ error }} <button type="button" class="link" @click="emit('retry')">Retry</button></p>
    <p v-else-if="!cur" class="muted">Not computed yet: the hierarchy is rebuilt from everyone's resolved calls once a week.</p>

    <template v-else>
      <div class="hi-grid">
        <div class="col">
          <h3 class="col-t" data-tone="warn">Riskiest</h3>
          <ol class="rank">
            <li v-for="s in cur.riskiest" :key="`r${s.name}`">
              <button type="button" class="r-row" :aria-pressed="pickedName === s.name" @click="pick(s)">
                <span class="r-n num">{{ s.risk_rank }}</span>
                <span class="r-name">{{ s.name }}<span v-if="mine(s)" class="you">you</span></span>
                <span class="r-bar" aria-hidden="true"><span data-tone="warn" :style="{ width: `${(s.risk / sc.maxRisk) * 100}%` }" /></span>
                <span class="r-v num">{{ s.risk.toFixed(2) }}</span>
              </button>
            </li>
          </ol>
        </div>
        <div class="col">
          <h3 class="col-t" data-tone="up">Most beneficial</h3>
          <ol class="rank">
            <li v-for="s in cur.beneficial" :key="`b${s.name}`">
              <button type="button" class="r-row" :aria-pressed="pickedName === s.name" @click="pick(s)">
                <span class="r-n num">{{ s.benefit_rank }}</span>
                <span class="r-name">{{ s.name }}<span v-if="mine(s)" class="you">you</span></span>
                <span class="r-bar diverge" aria-hidden="true">
                  <span :data-tone="s.benefit >= 0 ? 'up' : 'down'" :style="s.benefit >= 0 ? { left: '50%', width: `${(s.benefit / sc.maxB) * 50}%` } : { right: '50%', width: `${(-s.benefit / sc.maxB) * 50}%` }" />
                </span>
                <span class="r-v num">{{ fmt2(s.benefit) }}</span>
              </button>
            </li>
          </ol>
        </div>
        <figure class="scatter">
          <svg :viewBox="`0 0 ${SW} ${SH}`" role="img" :aria-label="`Risk (right) versus benefit (up) for ${cur.styles.length} styles. Dot size = number of calls.`">
            <line :x1="SP" :x2="SW - SP" :y1="sc.zeroY" :y2="sc.zeroY" class="axis" />
            <line :x1="SP" :x2="SP" :y1="SP / 2" :y2="SH - SP / 2" class="axis" />
            <text :x="SW - SP" :y="sc.zeroY - 4" text-anchor="end" class="lbl">risk →</text>
            <text :x="SP + 4" :y="SP" class="lbl">↑ benefit</text>
            <circle
              v-for="p in sc.points" :key="p.s.name" :cx="p.x" :cy="p.y" :r="p.r"
              class="pt" :data-tone="p.s.benefit >= 0 ? 'up' : 'down'" :data-picked="pickedName === p.s.name" :data-mine="mine(p.s)"
              @click="pick(p.s)"
            />
          </svg>
          <figcaption class="muted small">Top-left is the sweet spot: more benefit for less risk. Tap a dot or a row.</figcaption>
        </figure>
      </div>

      <div v-if="picked" class="pick" role="status">
        <p class="pick-t">{{ picked.name }} <span v-if="mine(picked)" class="you">you</span></p>
        <p class="pick-b">{{ describeStyle(picked) }}</p>
        <p class="muted">Benefit {{ fmt2(picked.benefit) }} (rank {{ picked.benefit_rank }}) · risk {{ picked.risk.toFixed(2) }} (rank {{ picked.risk_rank }}){{ picked.ratio !== null ? ` · benefit per unit of risk ${fmt2(picked.ratio)}` : '' }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hi { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; }
.hi-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem; align-items: flex-end; }
.hi-t { margin: 0; font-size: 1rem; color: var(--text-white); }
.hi-sub { margin: 0.15rem 0 0; font-size: 0.72rem; color: var(--text-gray); max-width: 46rem; }
.hi-sub b { color: var(--text-light-gray); font-weight: 600; }
.tabs { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); }
.tab { all: unset; cursor: pointer; font-size: 0.72rem; color: var(--text-gray); padding: 0.3rem 0.6rem; border-radius: var(--radius-sm); min-height: 24px; display: inline-flex; align-items: center; }
.tab[aria-selected='true'] { color: var(--text-white); background: rgba(255,255,255,0.1); }
.tab:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.hi-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 18rem); gap: var(--card-gap) 1rem; align-items: start; }
@media (max-width: 1100px) { .hi-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .scatter { grid-column: 1 / -1; max-width: 22rem; } }
@media (max-width: 640px) { .hi-grid { grid-template-columns: minmax(0, 1fr); } }
.col { min-width: 0; }
.col-t { margin: 0 0 0.3rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.col-t[data-tone='warn'] { color: var(--warning-orange); }
.col-t[data-tone='up'] { color: var(--primary-green); }
.rank { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.r-row {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%;
  display: grid; grid-template-columns: 1.1rem minmax(0, 1fr) minmax(0, 4.5rem) 2.8rem; gap: 0.45rem; align-items: center;
  padding: 0.28rem 0.3rem; border-radius: var(--radius-sm); min-height: 24px;
}
.r-row:hover { background: var(--nav-hover-bg); }
.r-row[aria-pressed='true'] { background: color-mix(in oklch, var(--primary-blue) 12%, transparent); }
.r-row:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.r-n { font-size: 0.66rem; color: var(--text-gray); }
.r-name { font-size: 0.76rem; color: var(--text-light-gray); overflow-wrap: anywhere; text-transform: none; }
.you { margin-left: 0.3rem; font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.02rem 0.3rem; border-radius: var(--radius-sm); color: var(--primary-blue); background: color-mix(in oklch, var(--primary-blue) 15%, transparent); }
.r-bar { position: relative; height: 0.35rem; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
.r-bar > span { position: absolute; top: 0; bottom: 0; left: 0; }
.r-bar.diverge > span { left: auto; }
.r-bar.diverge > span[data-tone='up'] { left: 50%; }
.r-bar.diverge::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--edge-lit); }
.r-bar [data-tone='warn'] { background: var(--warning-orange); }
.r-bar [data-tone='up'] { background: var(--app-color-up); }
.r-bar [data-tone='down'] { background: var(--app-color-down); }
.r-v { font-size: 0.7rem; color: var(--text-white); text-align: right; }
.scatter { margin: 0; min-width: 0; }
.scatter svg { width: 100%; height: auto; display: block; }
.axis { stroke: var(--edge-lit); stroke-width: 1; }
.lbl { font-size: 9px; fill: var(--text-gray); font-family: var(--font-chrome); }
.pt { cursor: pointer; fill-opacity: 0.55; stroke-width: 1.5; }
.pt[data-tone='up'] { fill: var(--app-color-up); stroke: var(--app-color-up); }
.pt[data-tone='down'] { fill: var(--app-color-down); stroke: var(--app-color-down); }
.pt[data-mine='true'] { stroke: var(--primary-blue); stroke-width: 2.5; }
.pt[data-picked='true'] { fill-opacity: 1; stroke: var(--text-white); }
.pick { padding: 0.55rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--edge-raised); background: var(--surface-raised); display: flex; flex-direction: column; gap: 0.2rem; }
.pick-t { margin: 0; font-size: 0.82rem; color: var(--text-white); }
.pick-b { margin: 0; font-size: 0.74rem; color: var(--text-light-gray); }
.muted { color: var(--text-gray); font-size: 0.72rem; margin: 0; }
.small { font-size: 0.64rem; }
.link { all: unset; cursor: pointer; color: var(--primary-blue); }
.link:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.sk { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--card-gap); }
.sk span { height: 7rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
