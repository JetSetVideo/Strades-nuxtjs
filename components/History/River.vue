<script setup lang="ts">
/**
 * The river: one row per lane, time left -> right, NOW fixed at 70 % of the width.
 * Points = instants, bars = spans (a call from made to target, an agent from launch to now, a held
 * position). Paper = hollow + dashed, backtest = diamond, real = solid; sample rows are faded.
 * Mouse picks an event (emits `select`); the list below is the keyboard/screen-reader path, so the
 * SVG itself is one labelled image.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  LANE_META, HISTORY_LANES, riverDomain, riverTicks, riverX,
  type HistoryEvent, type Lane, type RangeId,
} from '~/utils/historyTimeline'

const props = defineProps<{
  events: HistoryEvent[]
  lanes: Lane[]
  range: RangeId
  now: number
  selectedId?: string | null
}>()
const emit = defineEmits<{ select: [id: string] }>()

const NOW_SHARE = 0.7
const ROW = 26
const TOP = 18

const host = ref<HTMLElement | null>(null)
const width = ref(960)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!host.value) return
  // measure now: ResizeObserver only fires on a rendering step, which a throttled tab may delay
  width.value = Math.max(280, Math.round(host.value.clientWidth || width.value))
  ro = new ResizeObserver(([entry]) => { width.value = Math.max(280, Math.round(entry.contentRect.width)) })
  ro.observe(host.value)
})
onBeforeUnmount(() => ro?.disconnect())

const rows = computed(() => HISTORY_LANES.filter(l => props.lanes.includes(l.id)))
// narrow screens: glyph-only lane labels so the plot keeps its width
const narrow = computed(() => width.value < 520)
const LABEL_W_WIDE = 78
const labelW = computed(() => (narrow.value ? 22 : LABEL_W_WIDE))
const plotW = computed(() => Math.max(120, width.value - labelW.value - 8))
const height = computed(() => TOP + rows.value.length * ROW + 22)
const domain = computed(() => riverDomain(props.events, props.range, props.now, NOW_SHARE))
const x = (t: number) => labelW.value + riverX(t, domain.value, plotW.value, NOW_SHARE)
const nowX = computed(() => x(props.now))
const rowY = (lane: Lane) => TOP + rows.value.findIndex(r => r.id === lane) * ROW + ROW / 2

// narrow screens: smaller marks so a busy lane stays a row of dots, not a smear
const dotR = computed(() => (narrow.value ? 3.2 : 4.5))
// labels clamped inside the canvas so the last date is never cut at the right edge
const ticks = computed(() => riverTicks(domain.value, narrow.value ? 2 : 4).map(t => ({ ...t, x: x(t.t), lx: Math.min(width.value - 22, Math.max(labelW.value + 18, x(t.t))) })))

interface Mark { id: string; lane: Lane; kind: 'dot' | 'diamond' | 'bar' | 'over'; x1: number; x2: number; y: number; mode: string | null; sample: boolean; tense: string; label: string; h?: number }

const marks = computed<Mark[]>(() => {
  const out: Mark[] = []
  const lanes = new Set(props.lanes)
  // activity digests become a tiny histogram: height ∝ actions that day
  const digests = props.events.filter(e => e.kind === 'day_digest')
  const maxCount = Math.max(1, ...digests.map(e => Object.values(e.data?.counts ?? {}).reduce((a: number, b: any) => a + Number(b), 0)))
  for (const e of props.events) {
    if (!lanes.has(e.lane)) continue
    const at = Date.parse(e.at)
    const start = e.start_at ? Date.parse(e.start_at) : null
    if (at < domain.value.from && (start === null || start < domain.value.from) && e.tense === 'past') continue
    const y = rowY(e.lane)
    const label = `${e.title} — ${new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    if (e.kind === 'day_digest') {
      const n = Object.values(e.data?.counts ?? {}).reduce((a: number, b: any) => a + Number(b), 0)
      out.push({ id: e.id, lane: e.lane, kind: 'bar', x1: x(at) - 1.5, x2: x(at) + 1.5, y, mode: null, sample: e.sample, tense: e.tense, label, h: 4 + 14 * (n / maxCount) })
      continue
    }
    if (start !== null && Number.isFinite(start)) {
      out.push({ id: e.id, lane: e.lane, kind: 'bar', x1: x(Math.max(start, domain.value.from)), x2: x(at), y, mode: e.mode, sample: e.sample, tense: e.tense, label })
    }
    if (e.kind === 'agent_running' || e.kind === 'position_open' || e.kind === 'paper_open' || e.kind === 'agent_followed') continue
    // beyond the right edge: an arrow at the edge, never two far dates collapsed onto one point
    const kind = at > domain.value.to ? 'over' : e.mode === 'backtest' ? 'diamond' : 'dot'
    out.push({ id: e.id, lane: e.lane, kind, x1: x(at), x2: x(at), y, mode: e.mode, sample: e.sample, tense: e.tense, label: kind === 'over' ? `${label} (beyond this view)` : label })
  }
  // spans first so dots draw on top
  return out.sort((a, b) => (a.kind === 'bar' ? 0 : 1) - (b.kind === 'bar' ? 0 : 1))
})

const summary = computed(() => {
  const past = props.events.filter(e => e.tense === 'past').length
  const present = props.events.filter(e => e.tense === 'present').length
  const future = props.events.filter(e => e.tense === 'future').length
  return `Timeline of ${props.events.length} events across ${rows.value.length} lanes: ${past} past, ${present} in progress, ${future} upcoming. The list below has every event.`
})

function pick(id: string) { emit('select', id) }
</script>

<template>
  <div ref="host" class="river">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="summary">
      <defs>
        <pattern id="river-future" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.05)" stroke-width="2" />
        </pattern>
      </defs>
      <!-- future side is hatched: nothing there has happened yet -->
      <rect :x="nowX" :y="TOP - 6" :width="Math.max(0, width - nowX - 2)" :height="rows.length * ROW + 6" fill="url(#river-future)" />
      <g v-for="(r, i) in rows" :key="r.id">
        <line :x1="labelW" :x2="width - 2" :y1="TOP + i * ROW + ROW / 2" :y2="TOP + i * ROW + ROW / 2" class="lane-line" />
        <text :x="4" :y="TOP + i * ROW + ROW / 2 + 4" class="lane-label" :style="{ fill: LANE_META[r.id].color }">{{ LANE_META[r.id].glyph }}<tspan v-if="!narrow"> {{ r.label }}</tspan></text>
      </g>
      <g v-for="t in ticks" :key="t.t">
        <line :x1="t.x" :x2="t.x" :y1="TOP - 6" :y2="TOP + rows.length * ROW" class="tick-line" />
        <text :x="t.lx" :y="height - 6" class="tick-label" text-anchor="middle">{{ t.label }}</text>
      </g>
      <g class="marks">
        <template v-for="m in marks" :key="`${m.id}:${m.kind}`">
          <g
            class="mark"
            :class="{ 'is-sample': m.sample, 'is-selected': m.id === selectedId }"
            :data-mode="m.mode || undefined"
            :data-tense="m.tense"
            :style="{ '--lane': LANE_META[m.lane].color }"
            @click="pick(m.id)"
          >
            <title>{{ m.label }}</title>
            <rect
              v-if="m.kind === 'bar' && m.h"
              :x="m.x1" :y="m.y + 8 - m.h" :width="Math.max(2, m.x2 - m.x1)" :height="m.h" rx="1" class="m-hist"
            />
            <rect
              v-else-if="m.kind === 'bar'"
              :x="Math.min(m.x1, m.x2)" :y="m.y - 3" :width="Math.max(3, Math.abs(m.x2 - m.x1))" height="6" rx="3" class="m-bar"
            />
            <rect
              v-else-if="m.kind === 'diamond'"
              :x="m.x1 - 4" :y="m.y - 4" width="8" height="8" :transform="`rotate(45 ${m.x1} ${m.y})`" class="m-dot"
            />
            <polygon v-else-if="m.kind === 'over'" :points="`${width - 9},${m.y - 5} ${width - 2},${m.y} ${width - 9},${m.y + 5}`" class="m-dot m-over" />
            <circle v-else :cx="m.x1" :cy="m.y" :r="dotR" class="m-dot" />
          </g>
        </template>
      </g>
      <line :x1="nowX" :x2="nowX" :y1="TOP - 10" :y2="TOP + rows.length * ROW + 2" class="now-line" />
      <text :x="nowX" :y="TOP - 10" class="now-label" text-anchor="middle">NOW</text>
    </svg>
    <div class="river-legend" aria-hidden="true">
      <span><svg width="10" height="10"><circle cx="5" cy="5" r="4" class="lg-solid" /></svg>real / event</span>
      <span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" class="lg-paper" /></svg>paper</span>
      <span><svg width="10" height="10"><rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" class="lg-bt" /></svg>backtest</span>
      <span><svg width="18" height="10"><rect x="1" y="2" width="16" height="6" rx="3" class="lg-span" /></svg>open span</span>
      <span class="lg-hatch">future</span>
    </div>
  </div>
</template>

<style scoped>
.river { width: 100%; min-width: 0; overflow: hidden; }
svg { display: block; max-width: 100%; }
/* only marks take the pointer: the NOW line sits exactly on today's dots */
svg > :not(.marks) { pointer-events: none; }
.lane-line { stroke: rgba(255,255,255,0.06); stroke-width: 1; }
.lane-label { font-family: var(--font-chrome); font-size: 10.5px; font-weight: 600; }
.tick-line { stroke: rgba(255,255,255,0.04); stroke-dasharray: 2 4; }
.tick-label { fill: var(--text-gray); font-size: 9.5px; font-variant-numeric: tabular-nums; }
.now-line { stroke: var(--text-white); stroke-width: 1.5; opacity: 0.85; }
.now-label { fill: var(--text-white); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; }

.mark { cursor: pointer; }
.m-dot { fill: var(--lane); stroke: rgba(0,0,0,0.6); stroke-width: 1; }
.m-bar { fill: color-mix(in oklch, var(--lane) 35%, transparent); stroke: var(--lane); stroke-width: 1; }
.m-hist { fill: color-mix(in oklch, var(--lane) 70%, transparent); }
.mark[data-mode='paper'] .m-dot { fill: transparent; stroke: var(--lane); stroke-width: 1.6; stroke-dasharray: 2 1.5; }
.mark[data-mode='paper'] .m-bar { stroke-dasharray: 3 2; }
.mark[data-tense='future'] .m-dot { fill: transparent; stroke: var(--lane); stroke-width: 1.5; }
.mark.is-sample { opacity: 0.55; }
.mark.is-selected .m-dot, .mark.is-selected .m-bar { stroke: var(--text-white); stroke-width: 2; }
.mark:hover .m-dot { stroke: var(--text-white); }

.river-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.66rem; color: var(--text-gray); padding: 0.2rem 0 0 0.2rem; }
.river-legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.lg-solid { fill: var(--text-light-gray); }
.lg-paper { fill: none; stroke: var(--text-light-gray); stroke-dasharray: 2 1.5; }
.lg-bt { fill: var(--text-light-gray); }
.lg-span { fill: rgba(255,255,255,0.15); stroke: var(--text-light-gray); }
.lg-hatch { padding: 0 0.35rem; background: repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px); border-radius: 2px; }
</style>
