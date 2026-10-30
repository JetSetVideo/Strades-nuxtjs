<script setup lang="ts">
/**
 * Forms of intelligence read from your paper calls (0.5 ≈ a coin flip, i.e. no edge), each with the
 * community median as a tick and your percentile; and your financial personality on the Bailard, Biehl &
 * Kaiser 2×2 (confidence × method). Behavioural reads, never a diagnosis. Click a row for the theory.
 */
import { computed, ref } from 'vue'
import {
  INTEL_FINANCE_BLURB, intelFinanceQuadrant, intelIntelligenceRows, intelRadarGeometry,
  type IntelCommunity, type IntelFinance, type IntelIntelligence,
} from '~/utils/intelligenceV2'

const props = defineProps<{
  intelligences: IntelIntelligence[] | null | undefined
  finance: IntelFinance | null | undefined
  community: IntelCommunity | null | undefined
}>()

const rows = computed(() => intelIntelligenceRows(props.intelligences, props.community))
const known = computed(() => rows.value.filter(r => r.known).length)
const radar = computed(() => intelRadarGeometry(rows.value, 260, 70))
const open = ref<string | null>(null)
const QS = 200
const quad = computed(() => intelFinanceQuadrant(props.finance, QS, 16))
const fin = computed(() => props.finance ?? null)
const typed = computed(() => !!fin.value?.type)
const anchor = (x: number, c: number) => (Math.abs(x - c) < 4 ? 'middle' : x > c ? 'start' : 'end')
const pickType = ref<string | null>(null)
const shownType = computed(() => pickType.value ?? fin.value?.type ?? null)
</script>

<template>
  <div class="iq">
    <p v-if="!known" class="empty">
      Not enough data yet. Each form of intelligence needs resolved calls of a certain kind (long-dated, against
      the crowd, right after a miss…). Make a few calls with a target date and come back after they resolve.
    </p>
    <div class="grid2">
      <section>
        <h3 class="sub">Forms of intelligence <span class="muted">· tap a row</span></h3>
        <ul class="rows">
          <li v-for="r in rows" :key="r.key">
            <button type="button" class="row" :aria-expanded="open === r.key" @click="open = open === r.key ? null : r.key">
              <span class="row-l">{{ r.label }}</span>
              <span class="track" role="img" :aria-label="`${r.label}: ${r.known ? r.display : 'not enough data'}; ${r.words}`">
                <span class="coin" />
                <span v-if="r.known" class="fill" :style="{ width: `${r.bar * 100}%` }" />
                <span v-if="r.tick !== null" class="tick" :style="{ left: `${r.tick * 100}%` }" />
              </span>
              <span class="row-v num">{{ r.display }}</span>
              <span class="row-w">{{ r.words }}<template v-if="r.known"> · n {{ r.n }}</template></span>
            </button>
            <div v-if="open === r.key" class="row-x">
              <p>{{ r.how }}</p>
              <p class="muted">Theory: {{ r.theory }}</p>
              <p v-if="r.known" class="muted">{{ r.edge === 'edge' ? 'A real edge over a coin flip.' : r.edge === 'below a coin flip' ? 'Below a coin flip on this kind of call.' : 'Close to a coin flip: no clear edge yet.' }} Based on {{ r.n }} calls.</p>
            </div>
          </li>
        </ul>
        <p class="legend"><i class="lg-fill" />you <i class="lg-tick" />community median <i class="lg-coin" />coin flip (50)</p>
      </section>
      <section v-if="rows.length >= 3" class="radar-wrap">
        <svg :viewBox="`0 0 ${radar.size} ${radar.size}`" class="radar" role="img" :aria-label="`Radar of ${rows.length} forms of intelligence: ${rows.map(r => `${r.label} ${r.display}`).join(', ')}`">
          <polygon v-for="(p, i) in radar.rings" :key="i" :points="p" class="ring" :data-half="i === 1" />
          <line v-for="s in radar.spokes" :key="s.key" :x1="radar.c" :y1="radar.c" :x2="s.end.x" :y2="s.end.y" class="spoke" />
          <polygon v-if="radar.community" :points="radar.community" class="comm" />
          <polygon v-if="known" :points="radar.you" class="you" />
          <text v-for="s in radar.spokes" :key="`t${s.key}`" :x="s.lab.x" :y="s.lab.y + 3" :text-anchor="anchor(s.lab.x, radar.c)" class="lab" @click="open = s.key">{{ s.label }}</text>
        </svg>
      </section>
    </div>

    <section class="fin">
      <h3 class="sub">Financial personality <span class="muted">· {{ fin?.theory ?? 'Bailard, Biehl & Kaiser' }}</span></h3>
      <p v-if="!typed" class="empty">Not enough of your calls and activity yet to place you. Come back after a few calls resolve.</p>
      <div v-else class="fin-grid">
        <svg :viewBox="`0 0 ${QS} ${QS}`" class="quad" role="img" :aria-label="`Reads as ${fin!.type}: confidence ${fin!.confidence ?? '—'}, method ${fin!.method ?? '—'}`">
          <g v-for="c in quad.cells" :key="c.type" class="cell" :data-active="c.active" @click="pickType = c.type">
            <rect :x="c.x" :y="c.y" :width="c.w" :height="c.h" />
            <text :x="c.x + c.w / 2" :y="c.y + (c.y < QS / 2 ? 14 : c.h - 8)" text-anchor="middle">{{ c.type }}</text>
          </g>
          <g class="cell centre" :data-active="quad.centre.active" @click="pickType = quad.centre.type">
            <rect :x="quad.centre.x" :y="quad.centre.y" :width="quad.centre.w" :height="quad.centre.h" rx="4" />
          </g>
          <text :x="QS / 2" :y="QS / 2 + 3" text-anchor="middle" class="centre-t" @click="pickType = 'Straight Arrow'">Straight Arrow</text>
          <circle v-if="quad.dot" :cx="quad.dot.x" :cy="quad.dot.y" r="6" class="dot" />
          <text x="4" :y="QS / 2 - 4" class="ax">impetuous</text>
          <text :x="QS - 4" :y="QS / 2 - 4" text-anchor="end" class="ax">careful</text>
          <text :x="QS / 2 + 4" y="10" class="ax">confident</text>
          <text :x="QS / 2 + 4" :y="QS - 3" class="ax">anxious</text>
        </svg>
        <div class="fin-txt">
          <p class="fin-t">Reads as <b>{{ fin!.type }}</b></p>
          <p>{{ INTEL_FINANCE_BLURB[fin!.type] ?? '' }}</p>
          <div class="types" role="group" aria-label="The five types">
            <button v-for="t in Object.keys(INTEL_FINANCE_BLURB)" :key="t" type="button" class="type" :aria-pressed="shownType === t" @click="pickType = t">{{ t }}</button>
          </div>
          <p v-if="shownType && shownType !== fin!.type" class="muted"><b>{{ shownType }}</b>: {{ INTEL_FINANCE_BLURB[shownType] }}</p>
          <ul v-if="fin!.traits.length" class="traits">
            <li v-for="t in fin!.traits" :key="t.key"><b>{{ t.label }}</b> <span class="muted">· {{ t.theory }}</span></li>
          </ul>
          <p v-if="typeof fin!.overconfidence === 'number'" class="muted">
            Overconfidence: <span class="num">{{ fin!.overconfidence > 0 ? '+' : '' }}{{ (fin!.overconfidence * 100).toFixed(0) }} pts</span>
            ({{ Math.abs(fin!.overconfidence) < 0.05 ? 'your confidence matches your hit rate' : fin!.overconfidence > 0 ? 'you claim more than you hit' : 'you hit more than you claim' }}).
          </p>
          <p class="muted small">Your dot: method {{ fin!.method ?? '—' }} (− impetuous … + careful), confidence {{ fin!.confidence ?? '—' }} (− anxious … + confident). A read of how you call on paper, not a diagnosis.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.iq { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.empty { margin: 0; padding: 0.6rem 0.75rem; border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-light-gray); }
.grid2 { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1rem 1.25rem; align-items: start; }
@media (max-width: 760px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
section { min-width: 0; }
.sub { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.sub .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.row { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr) 2rem; gap: 0.1rem 0.5rem; align-items: center; padding: 0.25rem 0.3rem; border-radius: var(--radius-sm); min-height: 24px; }
.row:hover { background: var(--nav-hover-bg); }
.row:focus-visible, .type:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.row-l { font-size: 0.76rem; color: var(--text-light-gray); }
.track { position: relative; height: 0.45rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
.fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: color-mix(in oklch, var(--primary-blue) 80%, transparent); }
.coin { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.tick { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--domain-agent); }
.row-v { font-size: 0.74rem; color: var(--text-white); text-align: right; }
.row-w { grid-column: 1 / -1; font-size: 0.64rem; color: var(--text-gray); }
.row-x { font-size: 0.7rem; color: var(--text-light-gray); padding: 0.3rem 0.5rem; border-left: 2px solid var(--edge-raised); margin: 0 0 0.3rem 0.3rem; }
.row-x p { margin: 0 0 0.2rem; }
.legend { margin: 0.35rem 0 0; font-size: 0.62rem; color: var(--text-gray); display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; }
.legend i { display: inline-block; vertical-align: middle; margin-right: 0.2rem; }
.lg-fill { width: 0.7rem; height: 0.4rem; border-radius: 999px; background: var(--primary-blue); }
.lg-tick { width: 2px; height: 0.7rem; background: var(--domain-agent); }
.lg-coin { width: 1px; height: 0.7rem; background: var(--edge-lit); }
.radar-wrap { display: flex; justify-content: center; }
.radar { width: 100%; max-width: 20rem; height: auto; display: block; overflow: visible; }
.ring { fill: none; stroke: var(--edge-soft); }
.ring[data-half='true'] { stroke: var(--edge-lit); stroke-dasharray: 3 3; }
.spoke { stroke: var(--edge-soft); }
.comm { fill: color-mix(in oklch, var(--domain-agent) 12%, transparent); stroke: var(--domain-agent); stroke-width: 1; stroke-dasharray: 4 3; }
.you { fill: color-mix(in oklch, var(--primary-blue) 25%, transparent); stroke: var(--primary-blue); stroke-width: 2; }
.lab { font-size: 9px; fill: var(--text-light-gray); cursor: pointer; }
.fin-grid { display: grid; grid-template-columns: minmax(0, 14rem) minmax(0, 1fr); gap: 1rem; align-items: start; }
@media (max-width: 640px) { .fin-grid { grid-template-columns: minmax(0, 1fr); } }
.quad { width: 100%; max-width: 16rem; height: auto; display: block; }
.cell rect { fill: rgba(255, 255, 255, 0.03); stroke: var(--edge-soft); cursor: pointer; }
.cell[data-active='true'] rect { fill: color-mix(in oklch, var(--primary-blue) 18%, transparent); stroke: var(--primary-blue); }
.cell text { font-size: 9px; fill: var(--text-light-gray); cursor: pointer; }
.cell.centre rect { fill: rgba(255, 255, 255, 0.05); stroke: var(--edge-lit); stroke-dasharray: 3 2; }
.centre-t { font-size: 8px; fill: var(--text-gray); cursor: pointer; }
.ax { font-size: 7.5px; fill: var(--text-gray); pointer-events: none; }
.dot { fill: var(--primary-blue); stroke: var(--text-white); stroke-width: 2; }
.fin-txt { font-size: 0.76rem; color: var(--text-light-gray); min-width: 0; }
.fin-txt p { margin: 0 0 0.35rem; }
.fin-t { color: var(--text-white); font-size: 0.9rem; }
.types { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0 0 0.35rem; }
.type { all: unset; cursor: pointer; font-size: 0.66rem; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--edge-raised); color: var(--text-light-gray); min-height: 24px; box-sizing: border-box; display: inline-flex; align-items: center; }
.type[aria-pressed='true'] { border-color: var(--primary-blue); color: var(--text-white); }
.traits { margin: 0 0 0.35rem; padding-left: 1rem; display: flex; flex-direction: column; gap: 0.15rem; }
.small { font-size: 0.66rem; }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
