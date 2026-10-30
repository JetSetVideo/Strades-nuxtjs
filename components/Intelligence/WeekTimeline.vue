<script setup lang="ts">
/**
 * Week timeline of a relation: weeks −8..+13 around now. Past weeks are shaded, now is marked, the
 * future is hatched. Line = share of shared calls on the same side; bars = how many questions you shared.
 * Click a week to read it (no hover-only info).
 */
import { computed, ref, useId, watch } from 'vue'
import { intelPct, timelineGeometry, timelineSummary, weekDate, weekOffsetLabel, type TimelineWeek } from '~/utils/intelligence'

const props = defineProps<{ weeks: TimelineWeek[] }>()

const W = 440
const H = 120
const PAD = 10
const g = computed(() => timelineGeometry(props.weeks, W, H, PAD))
const nowWeek = computed(() => props.weeks.find(w => w.phase === 'now')?.week ?? null)
const picked = ref<number | null>(null)
watch(() => props.weeks, () => { picked.value = nowWeek.value }, { immediate: true })
const sel = computed(() => props.weeks.find(w => w.week === picked.value) ?? null)
const colW = computed(() => Math.max(6, g.value.step || W))
const summary = computed(() => timelineSummary(props.weeks))
const patternId = `tl-hatch-${useId()}`
</script>

<template>
  <figure class="tl">
    <svg :viewBox="`0 0 ${W} ${H}`" class="tl-svg" role="img" :aria-label="summary">
      <defs>
        <pattern :id="patternId" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="hatch" />
        </pattern>
      </defs>
      <rect v-if="g.pastEnd !== null" x="0" y="0" :width="g.pastEnd" :height="H" class="band-past" />
      <rect v-if="g.futureStart !== null" :x="g.futureStart" y="0" :width="W - g.futureStart" :height="H" :fill="`url(#${patternId})`" class="band-future" />
      <line :x1="PAD" :x2="W - PAD" :y1="H / 2" :y2="H / 2" class="grid" />
      <line :x1="PAD" :x2="W - PAD" :y1="PAD" :y2="PAD" class="grid faint" />
      <line :x1="PAD" :x2="W - PAD" :y1="H - PAD" :y2="H - PAD" class="grid faint" />
      <rect v-for="b in g.bars" :key="`b${b.w.week}`" :x="b.x - Math.min(6, colW / 3)" :y="b.y" :width="Math.min(12, (colW * 2) / 3)" :height="b.h" class="bar" :data-phase="b.w.phase" />
      <path :d="g.path" class="line" />
      <circle v-for="p in g.points.filter(q => q.y !== null)" :key="`p${p.w.week}`" :cx="p.x" :cy="p.y!" r="3" class="dot" :data-phase="p.w.phase" />
      <line v-if="g.nowX !== null" :x1="g.nowX" :x2="g.nowX" y1="0" :y2="H" class="now" />
      <rect
        v-for="p in g.points" :key="`h${p.w.week}`"
        :x="p.x - colW / 2" y="0" :width="colW" :height="H"
        class="hit" :data-picked="picked === p.w.week"
        @click="picked = p.w.week"
      />
    </svg>
    <div class="tl-axis" aria-hidden="true">
      <span>{{ weeks[0] ? weekOffsetLabel(weeks[0].week, nowWeek) : '' }}</span>
      <span class="tl-now">now</span>
      <span>{{ weeks.length ? weekOffsetLabel(weeks[weeks.length - 1]!.week, nowWeek) : '' }}</span>
    </div>
    <div class="tl-weeks" role="group" aria-label="Pick a week">
      <button
        v-for="w in weeks" :key="w.week" type="button" class="wk" :data-phase="w.phase" :data-has="w.shared > 0"
        :aria-pressed="picked === w.week" :aria-label="`${weekOffsetLabel(w.week, nowWeek)}: ${w.shared} shared`"
        @click="picked = w.week"
      />
    </div>
    <figcaption class="tl-cap">
      <template v-if="sel">
        <b>{{ weekOffsetLabel(sel.week, nowWeek) }}</b> <span class="muted">(week of {{ weekDate(sel.week) }}, {{ sel.phase }})</span> ·
        <template v-if="sel.shared">
          {{ sel.shared }} shared question{{ sel.shared === 1 ? '' : 's' }}
          <template v-if="sel.agreement !== null"> · {{ intelPct(sel.agreement) }} on the same side</template>
          <template v-if="sel.assets.length"> · <span class="num">{{ sel.assets.join(', ') }}</span></template>
          <template v-if="sel.phase === 'future'"> <span class="muted">(open calls whose targets fall that week)</span></template>
        </template>
        <template v-else>no shared calls</template>
      </template>
      <span class="legend"><i class="lg-line" />agreement <i class="lg-bar" />shared questions <i class="lg-past" />past <i class="lg-fut" />future</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.tl { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.tl-svg { width: 100%; height: auto; display: block; }
.band-past { fill: rgba(255,255,255,0.035); }
.hatch { stroke: rgba(255,255,255,0.07); stroke-width: 2; }
.grid { stroke: var(--edge-raised); stroke-width: 1; stroke-dasharray: 3 3; }
.grid.faint { stroke: var(--edge-soft); }
.bar { fill: color-mix(in oklch, var(--domain-agent) 45%, transparent); }
.bar[data-phase='future'] { fill: color-mix(in oklch, var(--domain-agent) 25%, transparent); }
.line { fill: none; stroke: var(--primary-blue); stroke-width: 2; stroke-linejoin: round; }
.dot { fill: var(--primary-blue); }
.dot[data-phase='future'] { fill: var(--secondary-darker); stroke: var(--primary-blue); stroke-width: 1.5; }
.now { stroke: var(--text-white); stroke-width: 1.5; }
.hit { fill: transparent; cursor: pointer; }
.hit[data-picked='true'] { fill: rgba(255,255,255,0.07); }
.tl-axis { display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--text-gray); }
.tl-now { color: var(--text-white); }
.tl-weeks { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; }
.wk { all: unset; cursor: pointer; height: 0.5rem; border-radius: 2px; background: rgba(255,255,255,0.06); min-width: 0; }
.wk[data-has='true'] { background: color-mix(in oklch, var(--primary-blue) 45%, transparent); }
.wk[data-phase='now'] { box-shadow: inset 0 0 0 1px var(--text-white); }
.wk[aria-pressed='true'] { background: var(--primary-blue); }
.wk:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.tl-cap { font-size: 0.72rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
.muted { color: var(--text-gray); }
.legend { font-size: 0.62rem; color: var(--text-gray); display: inline-flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; }
.legend i { display: inline-block; width: 0.7rem; height: 0.45rem; margin-right: 0.2rem; vertical-align: middle; border-radius: 1px; }
.lg-line { background: var(--primary-blue); height: 2px !important; }
.lg-bar { background: color-mix(in oklch, var(--domain-agent) 45%, transparent); }
.lg-past { background: rgba(255,255,255,0.08); }
.lg-fut { background: repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 4px); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
