<script setup lang="ts">
/**
 * Scatter of the community on the community map (2 principal axes of the 11) or on any two axes you pick.
 * You are highlighted; friends, room mates and bots are labelled; everybody else is an anonymous faint dot.
 * Click a labelled dot (or a name chip under the map) for a small card with a link to compare with them.
 * Data: GET /space/?x=&y= through the parent (cached per pair, the endpoint is throttled).
 * Community map mode: axes are the backend factors (community.eigen.factors, else community.map.axes) with the
 * share of differences they explain. /space/ only serves others on F1 × F2, so any other factor pair shows
 * your own dot alone (profile.space.factors, in community standard deviations).
 */
import { computed, onMounted, ref, watch } from 'vue'
import {
  intelAxisOptions, intelAxisPoles, intelPctWords, intelScatterGeometry, intelShortName,
  type IntelCommunity, type IntelScatterPoint, type IntelSpacePayload,
} from '~/utils/intelligenceV2'
import {
  intelFactorCaption, intelFactorOptions, intelFactorPairGeometry, type IntelCommunityV3, type IntelFactorScore,
} from '~/utils/intelligenceV3'

const props = defineProps<{
  community: IntelCommunity | null | undefined
  space: IntelSpacePayload | null
  status: string
  error: string | null
  /** your factor scores (profile.space.factors) for factor pairs other than F1 × F2 */
  factors?: IntelFactorScore[] | null
}>()
const emit = defineEmits<{ load: [x: string, y: string] }>()

const mode = ref<'map' | 'axes'>('map')
const ax = ref('risk')
const ay = ref('tempo')
const axisChoices = computed(() => intelAxisOptions(props.community).filter(o => o.key !== 'map'))
const want = computed(() => (mode.value === 'map' ? { x: 'map', y: 'map' } : { x: ax.value, y: ay.value }))
const request = () => emit('load', want.value.x, want.value.y)
onMounted(request)
watch(want, request)

/** only draw the payload that matches the current pick (a stale one may still be in flight) */
const data = computed(() => (props.space && props.space.x === want.value.x && props.space.y === want.value.y ? props.space : null))
const S = 320
const g = computed(() => intelScatterGeometry(data.value?.points ?? [], S, S, 22))

// factor axes for the community map (F1..Fkeep)
const c3 = computed(() => props.community as IntelCommunityV3 | null | undefined)
const fOpts = computed(() => intelFactorOptions(c3.value))
const fx = ref(0)
const fy = ref(1)
watch(fOpts, (o) => {
  if (!o.some(f => f.i === fx.value)) fx.value = o[0]?.i ?? 0
  if (!o.some(f => f.i === fy.value)) fy.value = o[1]?.i ?? 1
})
/** others' dots exist only for F1 × F2 */
const scatterPair = computed(() => mode.value !== 'map' || (fx.value === 0 && fy.value === 1))
const ox = computed(() => fOpts.value.find(o => o.i === fx.value) ?? null)
const oy = computed(() => fOpts.value.find(o => o.i === fy.value) ?? null)
const px = computed(() => (mode.value === 'map' && ox.value ? { key: 'map', label: ox.value.key, neg: ox.value.neg, pos: ox.value.pos } : intelAxisPoles(want.value.x, props.community, 0)))
const py = computed(() => (mode.value === 'map' && oy.value ? { key: 'map', label: oy.value.key, neg: oy.value.neg, pos: oy.value.pos } : intelAxisPoles(want.value.y, props.community, 1)))
const pair = computed(() => intelFactorPairGeometry(props.factors, c3.value?.eigen, fx.value, fy.value, S, 22))
const labelled = computed(() => g.value.points.filter(p => p.labelled))
const explained = computed(() => {
  if (ox.value?.explained != null && oy.value?.explained != null) return Math.round((ox.value.explained + oy.value.explained) * 100)
  const e = props.community?.map?.explained ?? []
  return e.length >= 2 ? Math.round((e[0]! + e[1]!) * 100) : null
})
const caption = computed(() => [intelFactorCaption(ox.value) && `X: ${intelFactorCaption(ox.value)}`, intelFactorCaption(oy.value) && `Y: ${intelFactorCaption(oy.value)}`].filter(Boolean).join(' · '))

const picked = ref<string | null>(null)
watch(data, () => { picked.value = data.value?.points.find(p => p.kind === 'me')?.id ?? null })
const sel = computed<IntelScatterPoint | null>(() => g.value.points.find(p => p.labelled && p.key === picked.value) ?? null)
const KIND: Record<string, string> = { me: 'You', friend: 'Friend', mate: 'Room mate', bot: 'Bot', other: 'Trader' }
const pick = (p: IntelScatterPoint) => { if (p.labelled) picked.value = p.key }
</script>

<template>
  <div class="sm">
    <div class="sm-ctl">
      <div class="seg" role="group" aria-label="Map type">
        <button type="button" :aria-pressed="mode === 'map'" @click="mode = 'map'">Community map</button>
        <button type="button" :aria-pressed="mode === 'axes'" @click="mode = 'axes'">Two axes</button>
      </div>
      <template v-if="mode === 'map' && fOpts.length > 2">
        <label class="sel">X <select v-model.number="fx"><option v-for="o in fOpts" :key="o.i" :value="o.i" :disabled="o.i === fy">{{ o.label }}</option></select></label>
        <label class="sel">Y <select v-model.number="fy"><option v-for="o in fOpts" :key="o.i" :value="o.i" :disabled="o.i === fx">{{ o.label }}</option></select></label>
      </template>
      <template v-if="mode === 'axes'">
        <label class="sel">X <select v-model="ax"><option v-for="o in axisChoices" :key="o.key" :value="o.key">{{ o.label }}</option></select></label>
        <label class="sel">Y <select v-model="ay"><option v-for="o in axisChoices" :key="o.key" :value="o.key">{{ o.label }}</option></select></label>
      </template>
    </div>
    <p v-if="mode === 'map'" class="sm-note">
      The 11 axes squeezed into independent directions (factors) that separate people the most<template v-if="explained !== null">; these two carry {{ explained }}% of the differences</template>.
      <template v-if="caption"><br><span class="num">{{ caption }}</span></template>
    </p>
    <p v-else class="sm-note">Each axis in community standard deviations: 0 is the average trader.</p>

    <template v-if="!scatterPair">
      <p class="sm-note">Other traders are only placed on F1 × F2, so this pair shows you alone. Rings: 1 and 2 standard deviations from the average trader.</p>
      <p v-if="!pair.me" class="sm-empty">You are not placed on these factors yet: make a few paper calls first.</p>
      <figure v-else class="sm-fig">
        <span class="pole pole-t">{{ py.pos }}</span>
        <svg :viewBox="`0 0 ${S} ${S}`" class="sm-svg" role="img" :aria-label="`Your position on ${px.label} and ${py.label}`">
          <rect x="0" y="0" :width="S" :height="S" class="frame" rx="8" />
          <line :x1="pair.zero" :x2="pair.zero" y1="10" :y2="S - 10" class="axis" />
          <line x1="10" :x2="S - 10" :y1="pair.zero" :y2="pair.zero" class="axis" />
          <circle v-for="(rr, k) in pair.rings" :key="k" :cx="pair.zero" :cy="pair.zero" :r="rr" class="ring" />
          <g class="pt k-me" data-picked="true">
            <circle :cx="pair.me.sx" :cy="pair.me.sy" r="6" />
            <text :x="pair.me.sx + 8" :y="pair.me.sy + 3" class="lbl">You</text>
          </g>
        </svg>
        <span class="pole pole-b">{{ py.neg }}</span>
        <div class="pole-x"><span>← {{ px.neg }}</span><span>{{ px.pos }} →</span></div>
      </figure>
      <div v-if="pair.me" class="card" aria-live="polite">
        <p class="card-t"><b>You</b></p>
        <p>{{ px.label }}: leans {{ pair.me.x >= 0 ? px.pos : px.neg }} ({{ Math.abs(pair.me.x).toFixed(1) }} sd)</p>
        <p>{{ py.label }}: leans {{ pair.me.y >= 0 ? py.pos : py.neg }} ({{ Math.abs(pair.me.y).toFixed(1) }} sd)</p>
      </div>
    </template>
    <template v-else>
    <div v-if="status === 'loading' && !data" class="sm-skel" aria-busy="true">Loading the map…</div>
    <p v-else-if="status === 'error' && !data" class="sm-err" role="alert">{{ error }} <button type="button" class="lnk" @click="request">Retry</button></p>
    <template v-else-if="data">
      <p v-if="data.points.length < 2" class="sm-empty">Too few traders measured to draw a map yet. Come back after a few of your calls resolve.</p>
      <figure v-else class="sm-fig">
        <span class="pole pole-t">{{ py.pos }}</span>
        <svg :viewBox="`0 0 ${S} ${S}`" class="sm-svg" role="img" :aria-label="`${data.points.length} traders by ${px.label} and ${py.label}. Your dot is highlighted.`">
          <rect x="0" y="0" :width="S" :height="S" class="frame" rx="8" />
          <line :x1="g.zeroX" :x2="g.zeroX" y1="10" :y2="S - 10" class="axis" />
          <line x1="10" :x2="S - 10" :y1="g.zeroY" :y2="g.zeroY" class="axis" />
          <g v-for="p in g.points" :key="p.key" :class="['pt', `k-${p.kind}`]" :data-picked="p.key === picked" @click="pick(p)">
            <circle :cx="p.sx" :cy="p.sy" :r="p.r" />
            <circle v-if="p.labelled" :cx="p.sx" :cy="p.sy" r="11" class="hit" />
            <text v-if="p.labelled" :x="p.sx + p.r + 2" :y="p.sy + 3" class="lbl">{{ p.kind === 'me' ? 'You' : intelShortName(p.name) }}</text>
          </g>
        </svg>
        <span class="pole pole-b">{{ py.neg }}</span>
        <div class="pole-x"><span>← {{ px.neg }}</span><span>{{ px.pos }} →</span></div>
      </figure>

      <div v-if="labelled.length" class="chips" role="group" aria-label="People on this map">
        <button
          v-for="p in labelled" :key="p.key" type="button" class="chip" :class="`k-${p.kind}`"
          :aria-pressed="p.key === picked" @click="pick(p)"
        >{{ p.kind === 'me' ? 'You' : p.name }}</button>
      </div>
      <p class="legend"><i class="d me" />you <i class="d friend" />friends <i class="d mate" />room mates <i class="d bot" />bots <i class="d other" />other traders (anonymous)</p>

      <div v-if="sel" class="card" aria-live="polite">
        <p class="card-t">
          <b>{{ sel.kind === 'me' ? 'You' : sel.name }}</b>
          <span v-if="sel.bot" class="chip-bot">bot</span>
          <span class="muted">{{ KIND[sel.kind] }}<template v-if="sel.code"> · <span class="num">{{ sel.code }}</span></template></span>
        </p>
        <p v-if="sel.archetype" class="muted">Reads as {{ sel.archetype }}</p>
        <template v-if="mode === 'axes'">
          <p>{{ px.label }}: {{ intelPctWords(sel.pct_x, px.neg, px.pos) }}</p>
          <p>{{ py.label }}: {{ intelPctWords(sel.pct_y, py.neg, py.pos) }}</p>
        </template>
        <p v-else>
          Leans {{ sel.x >= 0 ? px.pos : px.neg }} ({{ Math.abs(sel.x).toFixed(1) }}) and {{ sel.y >= 0 ? py.pos : py.neg }} ({{ Math.abs(sel.y).toFixed(1) }}).
        </p>
        <NuxtLink v-if="sel.kind !== 'me' && sel.id" :to="`/insights?compare=${encodeURIComponent(sel.id)}`" class="lnk">Compare with {{ intelShortName(sel.name) }} →</NuxtLink>
      </div>
    </template>
    </template>
  </div>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.sm-ctl { display: flex; flex-wrap: wrap; gap: 0.4rem 0.6rem; align-items: center; }
.seg { display: inline-flex; border: 1px solid var(--edge-raised); border-radius: var(--radius-md); overflow: hidden; }
.seg button { all: unset; cursor: pointer; font-size: 0.72rem; padding: 0.35rem 0.7rem; color: var(--text-light-gray); min-height: 24px; }
.seg button[aria-pressed='true'] { background: var(--primary-blue); color: var(--secondary-darker); font-weight: 600; }
.seg button:focus-visible { outline: 2px solid var(--text-white); outline-offset: -2px; }
.sel { font-size: 0.72rem; color: var(--text-gray); display: inline-flex; gap: 0.3rem; align-items: center; min-width: 0; }
.sel select { background: var(--surface-raised); color: var(--text-white); border: 1px solid var(--edge-raised); border-radius: var(--radius-sm); font-size: 0.74rem; padding: 0.25rem 0.35rem; max-width: 9.5rem; min-height: 24px; }
.sel select:focus-visible { outline: 2px solid var(--primary-blue); }
.sm-note { margin: 0; font-size: 0.7rem; color: var(--text-gray); }
.sm-skel { height: 14rem; border-radius: var(--radius-md); background: var(--surface-raised); display: grid; place-items: center; font-size: 0.74rem; color: var(--text-gray); }
.sm-err, .sm-empty { margin: 0; font-size: 0.76rem; color: var(--text-light-gray); }
.sm-err { color: var(--warning-orange); }
.sm-fig { margin: 0; display: flex; flex-direction: column; align-items: stretch; gap: 0.15rem; max-width: 30rem; width: 100%; align-self: center; }
.sm-svg { width: 100%; height: auto; display: block; }
.frame { fill: rgba(255, 255, 255, 0.02); stroke: var(--edge-soft); }
.axis { stroke: var(--edge-raised); stroke-dasharray: 3 3; }
.ring { fill: none; stroke: var(--edge-soft); }
.pole { font-size: 0.62rem; color: var(--text-gray); text-align: center; }
.pole-x { display: flex; justify-content: space-between; font-size: 0.62rem; color: var(--text-gray); gap: 0.5rem; }
.pt circle { fill: var(--text-gray); }
.pt.k-other circle { fill: rgba(255, 255, 255, 0.22); }
.pt.k-friend circle { fill: var(--domain-social); }
.pt.k-mate circle { fill: var(--domain-agent); }
.pt.k-bot circle { fill: var(--text-light-gray); }
.pt.k-me circle { fill: var(--primary-blue); stroke: var(--text-white); stroke-width: 1.5; }
.pt circle.hit { fill: transparent; stroke: none; cursor: pointer; }
.pt[data-picked='true'] circle:first-child { stroke: var(--text-white); stroke-width: 2; }
.lbl { font-size: 9px; fill: var(--text-light-gray); pointer-events: none; }
.k-me .lbl { fill: var(--text-white); font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.chip { all: unset; cursor: pointer; font-size: 0.68rem; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid var(--edge-raised); color: var(--text-light-gray); min-height: 24px; box-sizing: border-box; display: inline-flex; align-items: center; }
.chip[aria-pressed='true'] { border-color: var(--primary-blue); color: var(--text-white); }
.chip:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.legend { margin: 0; font-size: 0.62rem; color: var(--text-gray); display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; }
.d { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 50%; margin-right: 0.2rem; vertical-align: middle; }
.d.me { background: var(--primary-blue); }
.d.friend { background: var(--domain-social); }
.d.mate { background: var(--domain-agent); }
.d.bot { background: var(--text-light-gray); }
.d.other { background: rgba(255, 255, 255, 0.22); }
.card { padding: 0.6rem 0.75rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); font-size: 0.74rem; color: var(--text-light-gray); }
.card p { margin: 0 0 0.25rem; }
.card-t { display: flex; flex-wrap: wrap; gap: 0.2rem 0.45rem; align-items: baseline; color: var(--text-white); }
.chip-bot { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.35rem; border-radius: 999px; border: 1px solid var(--edge-lit); color: var(--text-light-gray); }
.lnk { all: unset; cursor: pointer; color: var(--primary-blue); font-size: 0.74rem; }
.lnk:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
