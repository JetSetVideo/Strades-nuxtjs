<script setup lang="ts">
/**
 * "Your factors" (profile mirror): what separates traders here (scree of the community's eigenvalues), where
 * you sit on each retained factor (click a card for the axes that make it), how typical your profile is,
 * your influence, and the people who behave most like you. Everything opens on click; no hover-only info.
 *
 * Data (props from IntelligenceMirror): community.eigen, profile.space.factors/typicality, profile.influence
 * (GET /me/) and /similar/?k=8. Maths in utils/intelligenceV3.ts.
 */
import { computed, ref, watch } from 'vue'
import {
  intelEigenEmpty, intelEigenSentence, intelFactorRows, intelInfluenceWords, intelLoadingRows, intelScreeGeometry, intelScreeLine,
  intelSimilarRows, intelTypicalityWords,
  type IntelCommunityV3, type IntelInfluence, type IntelSimilarPayload, type IntelSpaceV3,
} from '~/utils/intelligenceV3'

const props = defineProps<{
  community: IntelCommunityV3 | null | undefined
  space: IntelSpaceV3 | null | undefined
  influence: IntelInfluence | null | undefined
  similar: IntelSimilarPayload | null
  similarStatus: string
  similarError: string | null
}>()
const emit = defineEmits<{ retry: [] }>()

const eigen = computed(() => props.community?.eigen ?? null)
const empty = computed(() => intelEigenEmpty(eigen.value))
const sentence = computed(() => intelEigenSentence(eigen.value))
const W = 320
const H = 160
const scree = computed(() => intelScreeGeometry(eigen.value, W, H))
const bar = ref<number | null>(null)
const barSel = computed(() => scree.value.bars.find(b => b.i === bar.value) ?? null)

const rows = computed(() => intelFactorRows(eigen.value, props.space?.factors))
const placed = computed(() => rows.value.some(r => r.score !== null))
const open = ref<number | null>(null)
watch(eigen, () => { open.value = null; bar.value = null })
const openRow = computed(() => rows.value.find(r => r.i === open.value) ?? null)
const loadings = computed(() => intelLoadingRows(openRow.value?.factor, props.community?.axes ?? []))
const toggle = (i: number) => { open.value = open.value === i ? null : i }
function pickBar(i: number) {
  bar.value = bar.value === i ? null : i
  if (rows.value.some(r => r.i === i)) open.value = i
}

const typical = computed(() => intelTypicalityWords(props.space?.typicality))
const infl = computed(() => intelInfluenceWords(props.influence))
const people = computed(() => intelSimilarRows(props.similar))
const fmtPct = (v: number) => `${Math.round(v * 100)}%`
</script>

<template>
  <div class="eg">
    <!-- 1. What separates traders here -->
    <section class="blk" aria-labelledby="eg-scree">
      <h3 id="eg-scree" class="sub">What separates traders here</h3>
      <p v-if="empty" class="msg">The community analysis has not run on enough traders yet. The factors appear after the next full analysis.</p>
      <template v-else>
        <p class="lead">{{ sentence }}</p>
        <figure class="fig">
          <svg
            :viewBox="`0 0 ${W} ${H}`" class="svg" role="img"
            :aria-label="`Scree chart: ${scree.bars.length} directions, ${scree.bars.filter(b => b.retained).length} kept. ${sentence}`"
          >
            <line :x1="scree.left" :x2="scree.right" :y1="scree.bottom" :y2="scree.bottom" class="base" />
            <line v-if="scree.kaiserY !== null" :x1="scree.left" :x2="scree.right" :y1="scree.kaiserY" :y2="scree.kaiserY" class="kaiser" />
            <text v-if="scree.kaiserY !== null" :x="scree.right - 2" :y="scree.kaiserY - 3" class="klbl" text-anchor="end">keep line</text>
            <g
              v-for="b in scree.bars" :key="b.i" class="bar" :class="{ kept: b.retained }" :data-picked="bar === b.i"
              role="button" tabindex="0" :aria-label="`${b.key}: explains ${fmtPct(b.explained)}`"
              @click="pickBar(b.i)" @keydown.enter.prevent="pickBar(b.i)" @keydown.space.prevent="pickBar(b.i)"
            >
              <rect :x="b.x - 2" :y="scree.top" :width="b.w + 4" :height="scree.bottom - scree.top" class="hit" />
              <rect :x="b.x" :y="b.y" :width="b.w" :height="Math.max(1, b.h)" rx="2" class="fill" />
              <text :x="b.cx" :y="H - 5" text-anchor="middle" class="xl">{{ b.key }}</text>
            </g>
            <path :d="scree.path" class="cum" />
            <circle v-for="d in scree.dots" :key="d.i" :cx="d.x" :cy="d.y" r="2" class="cumdot" />
          </svg>
          <figcaption class="legend">
            <span><i class="sw kept" />kept factor</span><span><i class="sw" />dropped</span><span><i class="ln" />running total (top = 100%)</span><span><i class="ln dash" />keep line</span>
          </figcaption>
        </figure>
        <p class="readout" aria-live="polite">{{ barSel ? intelScreeLine(barSel) : 'Click a bar for what it explains.' }}</p>
      </template>
    </section>

    <!-- 2. Your factor cards -->
    <section v-if="!empty" class="blk" aria-labelledby="eg-you">
      <h3 id="eg-you" class="sub">Where you sit</h3>
      <p v-if="!placed" class="msg">You are not placed on the factors yet: make a few paper calls first.</p>
      <div class="cards">
        <button
          v-for="r in rows" :key="r.i" type="button" class="card" :aria-expanded="open === r.i" :aria-controls="`eg-load-${r.i}`"
          @click="toggle(r.i)"
        >
          <span class="c-k"><b class="num">{{ r.key }}</b> · {{ fmtPct(r.explained) }} of the differences</span>
          <span class="c-n">{{ r.name }}</span>
          <span class="track" aria-hidden="true">
            <span class="tick mid" /><span class="tick" style="left: 16.67%" /><span class="tick" style="left: 83.33%" />
            <span v-if="r.at !== null" class="dot" :style="{ left: `${r.at * 100}%` }" />
          </span>
          <span class="poles" aria-hidden="true"><span>{{ r.neg }}</span><span>{{ r.pos }}</span></span>
          <span class="c-w">You: {{ r.words }}<template v-if="r.z !== null"> <span class="num muted">({{ r.z >= 0 ? '+' : '−' }}{{ Math.abs(r.z).toFixed(1) }} sd)</span></template></span>
          <span class="c-more">{{ open === r.i ? 'Hide the axes' : 'Which axes make it →' }}</span>
        </button>
      </div>
      <div v-if="openRow" :id="`eg-load-${openRow.i}`" class="load" aria-live="polite">
        <p class="load-t"><b>{{ openRow.key }}</b>: what it is made of</p>
        <p class="muted">Bars to the right go with <b>{{ openRow.pos }}</b>, to the left with <b>{{ openRow.neg }}</b>. Longer = weighs more.</p>
        <ul class="lrows">
          <li v-for="l in loadings" :key="l.key" :class="{ strong: l.strong }">
            <span class="l-l">{{ l.label }}</span>
            <span class="l-bar" aria-hidden="true"><span class="l-mid" /><span class="l-fill" :data-side="l.side" :style="{ left: `${l.left}%`, width: `${l.width}%` }" /></span>
            <span class="l-w">{{ l.pole }} <span class="num muted">{{ l.loading >= 0 ? '+' : '−' }}{{ Math.abs(l.loading).toFixed(2) }}</span></span>
          </li>
        </ul>
        <p class="muted small">Paper capital only, never real money. Collective/Capitalist is how you trade, not politics.</p>
      </div>
    </section>

    <!-- 3. Typicality + influence -->
    <section class="blk" aria-labelledby="eg-mini">
      <h3 id="eg-mini" class="sub">Your profile as a whole</h3>
      <div class="minis">
        <article class="mini" :data-level="typical.level">
          <p class="m-k">How typical you are</p>
          <p class="m-t">{{ typical.title }}</p>
          <span v-if="typical.pct !== null" class="meter" aria-hidden="true"><span :style="{ width: `${typical.pct}%` }" /></span>
          <p class="m-l">{{ typical.line }}</p>
        </article>
        <article class="mini" :data-level="infl.level">
          <p class="m-k">Influence</p>
          <p class="m-t">{{ infl.title }}</p>
          <span v-if="infl.pct !== null" class="meter" aria-hidden="true"><span :style="{ width: `${infl.pct}%` }" /></span>
          <p class="m-l">{{ infl.line }}<template v-if="infl.pct !== null"> <span class="num muted">Score {{ infl.rank }}.</span></template></p>
        </article>
      </div>
    </section>

    <!-- 4. People who behave like you -->
    <section class="blk" aria-labelledby="eg-sim">
      <h3 id="eg-sim" class="sub">People who behave like you</h3>
      <div v-if="similarStatus === 'loading' || similarStatus === 'idle'" class="skel" aria-busy="true"><span /><span /></div>
      <p v-else-if="similarStatus === 'error'" class="msg err" role="alert">{{ similarError }} <button type="button" class="lnk" @click="emit('retry')">Retry</button></p>
      <p v-else-if="similarStatus === 'signed-out'" class="msg">Sign in to see who behaves like you.</p>
      <p v-else-if="!people.length" class="msg">{{ similar?.detail || 'Nobody close enough yet. Come back after a few of your calls resolve.' }}</p>
      <ul v-else class="ppl">
        <li v-for="p in people" :key="p.key" class="pp">
          <div class="pp-h">
            <NuxtLink v-if="p.href" :to="p.href" class="pp-n">{{ p.title }}</NuxtLink>
            <span v-else class="pp-n anon">{{ p.title }}</span>
            <span v-if="p.bot" class="chip">bot</span>
            <span v-else-if="p.demo" class="chip">demo</span>
            <span class="muted">{{ p.kindLabel }}<template v-if="p.code"> · <span class="num">{{ p.code }}</span></template></span>
          </div>
          <p class="pp-l">{{ p.line }}</p>
          <NuxtLink v-if="p.href" :to="p.href" class="lnk small">Compare with them →</NuxtLink>
        </li>
      </ul>
    </section>

    <details class="how">
      <summary>How this is computed</summary>
      <p>Each trader is measured on 11 behaviour axes. Many of them move together, so we look at how every axis correlates with every other one. The <b>eigenvectors</b> of that correlation table are independent directions (the factors); each <b>eigenvalue</b> says how much of the differences between traders that direction explains. All eigenvalues add up to 11, one per axis.</p>
      <p>We keep the factors with an eigenvalue of at least 1 (the <b>Kaiser rule</b>): each kept factor carries more than a single axis would. A factor is named after the axes that weigh most in it.</p>
      <p><b>How typical</b> uses the Mahalanobis distance: your distance from the community centre, measured in each factor's own spread, then read as a percentile. <b>People like you</b> are the nearest by that same distance.</p>
      <p><b>Influence</b> is PageRank: the principal eigenvector of who ends up on whose side after a call. Being followed by people who are themselves followed counts more.</p>
      <p class="muted">Behavioural reads from paper calls and activity, never a diagnosis.</p>
    </details>
  </div>
</template>

<style scoped>
.eg { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.blk { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; }
.sub { margin: 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.lead { margin: 0; font-size: 0.82rem; color: var(--text-white); }
.msg { margin: 0; font-size: 0.76rem; color: var(--text-light-gray); }
.msg.err { color: var(--warning-orange); }
.muted { color: var(--text-gray); }
.small { font-size: 0.66rem; }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.fig { margin: 0; display: flex; flex-direction: column; gap: 0.25rem; max-width: 30rem; width: 100%; }
.svg { width: 100%; height: auto; display: block; }
.base { stroke: var(--edge-raised); }
.kaiser { stroke: var(--warning-orange); stroke-dasharray: 4 3; }
.klbl { font-size: 8px; fill: var(--warning-orange); }
.bar { cursor: pointer; outline: none; }
.bar .hit { fill: transparent; }
.bar .fill { fill: rgba(255, 255, 255, 0.16); }
.bar.kept .fill { fill: var(--primary-blue); }
.bar[data-picked='true'] .fill { stroke: var(--text-white); stroke-width: 1.5; }
.bar:focus-visible .hit { stroke: var(--primary-blue); stroke-width: 1.5; }
.xl { font-size: 8px; fill: var(--text-gray); }
.cum { fill: none; stroke: var(--domain-agent); stroke-width: 1.5; }
.cumdot { fill: var(--domain-agent); pointer-events: none; }
.legend { display: flex; flex-wrap: wrap; gap: 0.15rem 0.7rem; font-size: 0.62rem; color: var(--text-gray); }
.sw { display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 2px; margin-right: 0.25rem; vertical-align: middle; background: rgba(255, 255, 255, 0.16); }
.sw.kept { background: var(--primary-blue); }
.ln { display: inline-block; width: 0.9rem; height: 0; border-top: 2px solid var(--domain-agent); margin-right: 0.25rem; vertical-align: middle; }
.ln.dash { border-top: 2px dashed var(--warning-orange); }
.readout { margin: 0; font-size: 0.72rem; color: var(--text-light-gray); min-height: 1.1rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: 0.5rem; }
.card { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem 0.7rem; border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: var(--surface-raised); min-width: 0; }
.card:hover { border-color: var(--edge-lit); }
.card[aria-expanded='true'] { border-color: var(--primary-blue); }
.card:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.c-k { font-size: 0.66rem; color: var(--text-gray); }
.c-k b { color: var(--text-white); }
.c-n { font-size: 0.8rem; color: var(--text-white); font-weight: 600; overflow-wrap: anywhere; }
.track { position: relative; height: 0.5rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); margin-top: 0.15rem; }
.tick { position: absolute; top: -2px; bottom: -2px; width: 1px; background: var(--edge-raised); }
.tick.mid { left: 50%; background: var(--edge-lit); }
.dot { position: absolute; top: 50%; width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--primary-blue); border: 2px solid var(--text-white); transform: translate(-50%, -50%); box-sizing: border-box; }
.poles { display: flex; justify-content: space-between; gap: 0.4rem; font-size: 0.6rem; color: var(--text-gray); }
.poles span:last-child { text-align: right; }
.c-w { font-size: 0.72rem; color: var(--text-light-gray); }
.c-more { font-size: 0.68rem; color: var(--primary-blue); }
.load { padding: 0.6rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: rgba(255, 255, 255, 0.02); display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.load p { margin: 0; font-size: 0.72rem; }
.load-t { color: var(--text-white); }
.lrows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.lrows li { display: grid; grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) minmax(0, 7.5rem); gap: 0.45rem; align-items: center; font-size: 0.7rem; color: var(--text-gray); }
.lrows li.strong { color: var(--text-white); }
.l-l { overflow-wrap: anywhere; }
.l-bar { position: relative; height: 0.4rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
.l-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.l-fill { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: color-mix(in oklch, var(--primary-blue) 60%, transparent); }
.l-fill[data-side='neg'] { background: color-mix(in oklch, var(--domain-agent) 60%, transparent); }
.strong .l-fill { opacity: 1; }
.lrows li:not(.strong) .l-fill { opacity: 0.55; }
.l-w { overflow-wrap: anywhere; }
.minis { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: 0.5rem; }
.mini { padding: 0.6rem 0.7rem; border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: var(--surface-raised); display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.mini p { margin: 0; }
.m-k { font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-gray); }
.m-t { font-size: 0.84rem; color: var(--text-white); font-weight: 600; }
.m-l { font-size: 0.72rem; color: var(--text-light-gray); }
.meter { display: block; height: 0.35rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
.meter span { display: block; height: 100%; background: var(--primary-blue); }
.mini[data-level='unknown'] .m-t { color: var(--text-light-gray); }
.skel { display: flex; flex-direction: column; gap: 0.4rem; }
.skel span { height: 2.6rem; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.04); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) { .skel span { animation: none; } }
.ppl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.pp { padding: 0.5rem 0.7rem; border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: var(--surface-raised); display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.pp-h { display: flex; flex-wrap: wrap; gap: 0.2rem 0.45rem; align-items: baseline; font-size: 0.72rem; }
.pp-n { font-size: 0.8rem; color: var(--text-white); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
a.pp-n { color: var(--primary-blue); }
.pp-n.anon { font-weight: 400; color: var(--text-light-gray); }
.pp-l { margin: 0; font-size: 0.72rem; color: var(--text-light-gray); }
.chip { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.35rem; border-radius: 999px; border: 1px solid var(--edge-lit); color: var(--text-light-gray); }
.lnk { all: unset; cursor: pointer; color: var(--primary-blue); font-size: 0.74rem; }
a.lnk { text-decoration: none; }
.lnk:focus-visible, .pp-n:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.how { border-top: 1px solid var(--edge-soft); padding-top: 0.5rem; font-size: 0.72rem; color: var(--text-light-gray); }
.how summary { cursor: pointer; font-size: 0.74rem; color: var(--primary-blue); min-height: 24px; display: flex; align-items: center; }
.how summary:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.how p { margin: 0.4rem 0 0; }
</style>
