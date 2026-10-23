<script setup lang="ts">
import { computed } from 'vue'
import { donutArcPath, sharesToArcs } from '~/utils/navIcons'
import type { MixShare, StructureMark } from '~/utils/strategyDraft'

const props = defineProps<{
  start: MixShare[]
  end: MixShare[]
  marks: StructureMark[]
  allocation: number
  frequency: string
}>()

const C = 100
const inner = computed(() => sharesToArcs(props.start, 0.05).map(a => ({
  ...a, d: donutArcPath(C, C, 46, 30, a.a0, a.a1),
})))
const outer = computed(() => sharesToArcs(props.end, 0.045).map(a => ({
  ...a, d: donutArcPath(C, C, 78, 54, a.a0, a.a1),
})))

const ticks = computed(() => props.marks.map((mark, i) => {
  const a = (i / Math.max(1, props.marks.length)) * Math.PI * 2 - Math.PI / 2
  const r0 = mark.on ? 82 : 84
  const r1 = 90
  return {
    tone: mark.tone,
    x1: (C + r0 * Math.cos(a)).toFixed(2),
    y1: (C + r0 * Math.sin(a)).toFixed(2),
    x2: (C + r1 * Math.cos(a)).toFixed(2),
    y2: (C + r1 * Math.sin(a)).toFixed(2),
    w: mark.on ? 2.2 : 1,
  }
}))

const legend = computed(() => {
  const seen = new Map<string, MixShare>()
  for (const share of [...props.end, ...props.start]) seen.set(share.key, share)
  return [...seen.values()]
})
</script>

<template>
  <figure class="wheel">
    <svg viewBox="0 0 200 200" class="wheel-svg" role="img" aria-label="Starting allocation inside, strategy outcome outside">
      <circle cx="100" cy="100" r="38" class="track" />
      <circle cx="100" cy="100" r="66" class="track" />
      <path v-for="seg in inner" :key="'in-' + seg.key" :d="seg.d" :fill="seg.color" />
      <path v-for="seg in outer" :key="'out-' + seg.key" :d="seg.d" :fill="seg.color" />
      <line
        v-for="(tick, i) in ticks"
        :key="i"
        :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2"
        :stroke="tick.tone" :stroke-width="tick.w" stroke-linecap="round"
      />
      <circle cx="100" cy="100" r="22" class="hub" />
      <text x="100" y="98" class="hub-pct">{{ allocation }}%</text>
      <text x="100" y="112" class="hub-freq">{{ frequency }}</text>
    </svg>
    <figcaption>
      <span class="ring-key"><i class="swatch inner" /> Start</span>
      <span class="ring-key"><i class="swatch outer" /> Leads to</span>
      <span v-for="item in legend" :key="item.key" class="class-key">
        <i :style="{ background: item.color }" />{{ item.label }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.wheel {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.wheel-svg { width: min(100%, 196px); height: auto; }
.track { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 14; }
.hub { fill: #12141a; stroke: rgba(255,255,255,0.12); }
.hub-pct, .hub-freq { text-anchor: middle; fill: #f4f4f5; }
.hub-pct { font-size: 13px; font-weight: 800; }
.hub-freq { font-size: 8px; fill: #a1a1aa; letter-spacing: 0.08em; }
figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  width: 100%;
}
.ring-key, .class-key {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-gray);
}
.ring-key i, .class-key i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.swatch.inner { background: transparent; box-shadow: inset 0 0 0 2px #a1a1aa; }
.swatch.outer { background: transparent; box-shadow: inset 0 0 0 2px #f4f4f5; width: 10px; height: 10px; }
</style>
