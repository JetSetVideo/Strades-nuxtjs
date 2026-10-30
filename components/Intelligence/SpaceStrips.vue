<script setup lang="ts">
/**
 * "You vs everyone": the 11 behaviour axes, each as the community histogram with your marker (and ticks for
 * the people in your entourage). Click a row for what the axis measures, the theory and your numbers.
 */
import { computed, ref } from 'vue'
import {
  intelAxisRows, intelStripGeometry, intelStripMarkers,
  type IntelCommunity, type IntelEntourageItem, type IntelSpace,
} from '~/utils/intelligenceV2'

const props = defineProps<{
  space: IntelSpace | null | undefined
  community: IntelCommunity | null | undefined
  /** measured people around you (entourage items) — drawn as small ticks */
  people?: IntelEntourageItem[]
}>()

const W = 300
const H = 34
const rows = computed(() => intelAxisRows(props.space, props.community).map(r => ({
  r,
  markers: intelStripMarkers(r.key, r.z, props.people ?? [], 6),
})).map(x => ({ ...x, g: intelStripGeometry(x.r.dist, { raw: x.r.raw, z: x.r.z, pct: x.r.pct }, x.markers, W, H, 3) })))
const measured = computed(() => rows.value.filter(x => x.r.pct !== null).length)
const open = ref<string | null>(null)
const toggle = (k: string) => { open.value = open.value === k ? null : k }
const fmt = (v: number | null, d = 2) => (v === null ? '—' : v.toFixed(d))
const gapWords = (z: number, myZ: number | null, neg: string, pos: string) => {
  if (myZ === null) return ''
  const g = z - myZ
  return Math.abs(g) < 0.25 ? 'about where you are' : `more ${(g > 0 ? pos : neg).toLowerCase()} than you`
}
</script>

<template>
  <div class="ss">
    <p class="ss-lead">
      Where your behaviour sits among <b class="num">{{ community?.n ?? 0 }}</b> measured traders.
      Bars = how many people sit at each level; <i class="lg-you" /> you<template v-if="people?.length">, <i class="lg-pal" /> people around you</template>.
      Tap an axis for what it measures.
    </p>
    <p v-if="!measured" class="ss-empty">
      Not measured yet. Make a few calls with a target date and come back after they resolve: we place you once
      there is enough of you to compare.
    </p>
    <ul class="ss-list">
      <li v-for="x in rows" :key="x.r.key" class="ss-row">
        <button type="button" class="ss-btn" :aria-expanded="open === x.r.key" @click="toggle(x.r.key)">
          <span class="ss-name">{{ x.r.label }}</span>
          <span class="ss-words" :data-known="x.r.pct !== null">{{ x.r.words }}</span>
          <span class="ss-chev" aria-hidden="true">{{ open === x.r.key ? '−' : '+' }}</span>
        </button>
        <svg
          v-if="!x.g.empty" :viewBox="`0 0 ${W} ${H}`" class="ss-svg" role="img"
          :aria-label="`${x.r.label}: ${x.r.words}`" @click="toggle(x.r.key)"
        >
          <rect v-for="(b, i) in x.g.bars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="bar" rx="1" />
          <line v-if="x.g.meanX !== null" :x1="x.g.meanX" :x2="x.g.meanX" y1="2" :y2="H - 2" class="mean" />
          <line v-for="m in x.g.markers" :key="m.key" :x1="m.x" :x2="m.x" :y1="H - 12" :y2="H" class="pal" />
          <g v-if="x.g.you">
            <line :x1="x.g.you.x" :x2="x.g.you.x" y1="6" :y2="H" class="you" />
            <path :d="`M${x.g.you.x - 5},0 L${x.g.you.x + 5},0 L${x.g.you.x},7 Z`" class="you-tri" />
          </g>
        </svg>
        <p v-else class="ss-nodist">Not enough people measured on this axis yet.</p>
        <div class="ss-poles" aria-hidden="true"><span>{{ x.r.neg }}</span><span>{{ x.r.pos }}</span></div>
        <div v-if="open === x.r.key" class="ss-x">
          <p>{{ x.r.how }}</p>
          <p v-if="x.r.note" class="ss-note">{{ x.r.note }}</p>
          <p class="muted">Theory: {{ x.r.theory }}</p>
          <p class="num muted">
            Percentile {{ x.r.pct === null ? '—' : Math.round(x.r.pct) }} · {{ fmt(x.r.z) }} sd from the average
            <template v-if="x.r.dist"> · community n = {{ x.r.dist.n }}</template>
          </p>
          <ul v-if="x.markers.length" class="ss-pals">
            <li v-for="m in x.markers" :key="m.key">
              <i class="lg-pal" /> {{ m.label }}: {{ gapWords(m.z, x.r.z, x.r.neg, x.r.pos) }}
              <span class="muted num">({{ (m.z - (x.r.z ?? 0)) >= 0 ? '+' : '−' }}{{ Math.abs(m.z - (x.r.z ?? 0)).toFixed(1) }} sd)</span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ss { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.ss-lead { margin: 0; font-size: 0.74rem; color: var(--text-light-gray); }
.ss-empty { margin: 0; padding: 0.6rem 0.75rem; border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-light-gray); }
.ss-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); gap: 0.7rem 1.1rem; }
.ss-row { min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.ss-btn { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.45rem; align-items: baseline; min-height: 24px; padding: 0.1rem 0.2rem; border-radius: var(--radius-sm); }
.ss-btn:hover { background: var(--nav-hover-bg); }
.ss-btn:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.ss-name { font-size: 0.76rem; font-weight: 600; color: var(--text-white); }
.ss-words { font-size: 0.7rem; color: var(--text-gray); min-width: 0; overflow-wrap: anywhere; }
.ss-words[data-known='true'] { color: var(--text-light-gray); }
.ss-chev { font-size: 0.8rem; color: var(--text-gray); }
.ss-svg { width: 100%; height: auto; display: block; cursor: pointer; }
.bar { fill: rgba(255, 255, 255, 0.13); }
.mean { stroke: var(--edge-lit); stroke-width: 1; stroke-dasharray: 2 2; }
.pal { stroke: var(--domain-social); stroke-width: 2; }
.you { stroke: var(--primary-blue); stroke-width: 2; }
.you-tri { fill: var(--primary-blue); }
.ss-nodist { margin: 0; font-size: 0.68rem; color: var(--text-gray); }
.ss-poles { display: flex; justify-content: space-between; font-size: 0.62rem; color: var(--text-gray); }
.ss-x { font-size: 0.7rem; color: var(--text-light-gray); padding: 0.35rem 0.5rem; border-left: 2px solid var(--edge-raised); }
.ss-x p { margin: 0 0 0.25rem; }
.ss-note { color: var(--warning-orange); }
.ss-pals { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.lg-you, .lg-pal { display: inline-block; width: 0.6rem; height: 0.18rem; vertical-align: middle; border-radius: 1px; }
.lg-you { background: var(--primary-blue); }
.lg-pal { background: var(--domain-social); }
</style>
