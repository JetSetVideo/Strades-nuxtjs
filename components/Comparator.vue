<script setup lang="ts">
/**
 * Equip sheet. The first selected book is the one already in the slot.
 * The second is the one in hand. The chart is the return on each transfer
 * across the days that book was open.
 */
import { computed, ref } from 'vue'
import {
  comparePlot, compareSide, dayLabel, equipCall, gapIsBetter, gapLabel,
  samplePath, statRows, type CompareInput,
} from '~/utils/strategyCompare'

const props = defineProps<{
  strategies: CompareInput[]
  onClose?: () => void
}>()

const emit = defineEmits<{ clone: [id: string]; swap: [] }>()

const equipped = computed(() => compareSide(props.strategies[0] || {}))
const candidate = computed(() => compareSide(props.strategies[1] || {}))
const call = computed(() => equipCall(equipped.value, candidate.value))
const rows = computed(() => statRows(equipped.value, candidate.value))
const plot = computed(() => comparePlot(equipped.value, candidate.value))

const W = 640
const H = 168
const LEFT = 36
const RIGHT = 8
const TOP = 14
const BOTTOM = 22

function yOf(pct: number): number {
  const span = plot.value.y1 - plot.value.y0 || 1
  return TOP + (1 - (pct - plot.value.y0) / span) * (H - TOP - BOTTOM)
}

function lineOf(side: { start: number; end: number; path: { t: number; pct: number }[] }): string {
  const span = side.end - side.start || 1
  return side.path.map(point => {
    const u = Math.min(1, Math.max(0, (point.t - side.start) / span))
    const x = LEFT + u * (W - LEFT - RIGHT)
    return `${x.toFixed(1)},${yOf(point.pct).toFixed(1)}`
  }).join(' ')
}

const equippedLine = computed(() => lineOf(equipped.value))
const candidateLine = computed(() => lineOf(candidate.value))
const zeroY = computed(() => yOf(0))
const yTicks = computed(() => {
  const values = [0, ...equipped.value.path.map(point => point.pct), ...candidate.value.path.map(point => point.pct)]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return [hi, 0, lo]
    .filter((value, index, all) => all.findIndex(other => Math.abs(other - value) < 0.4) === index)
    .map(value => ({
      value,
      y: yOf(value),
      label: value === 0 ? '0' : `${value > 0 ? '+' : '−'}${Math.abs(Math.round(value))}%`,
    }))
})

const hover = ref<number | null>(null)

const readout = computed(() => {
  if (hover.value == null) return null
  const u = hover.value
  const equippedSpan = equipped.value.end - equipped.value.start || 1
  const candidateSpan = candidate.value.end - candidate.value.start || 1
  const equippedAt = equipped.value.start + u * equippedSpan
  const candidateAt = candidate.value.start + u * candidateSpan
  const label = u < 0.04 ? 'Open' : u > 0.96 ? 'Close' : `${Math.round(u * 100)}% through`
  return {
    label,
    x: LEFT + u * (W - LEFT - RIGHT),
    equipped: samplePath(equipped.value.path, equippedAt),
    candidate: samplePath(candidate.value.path, candidateAt),
    equippedWhen: dayLabel(equippedAt),
    candidateWhen: dayLabel(candidateAt),
  }
})

function onMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * W
  const span = W - LEFT - RIGHT
  hover.value = Math.min(1, Math.max(0, (x - LEFT) / span))
}

function pctText(value: number | null): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

function windowText(side: { start: number; end: number }): string {
  return `${dayLabel(side.start)} → ${dayLabel(side.end)}`
}
</script>

<template>
  <section class="equip-sheet" aria-label="Compare the two selected strategies">
    <header class="head">
      <p class="verdict" :class="call.verb">
        <b>{{ call.verb === 'equip' ? 'Equip' : 'Keep' }} {{ call.name }}</b>
        <span>{{ call.detail }}</span>
      </p>
      <div class="actions">
        <button v-if="call.verb === 'equip'" type="button" class="do equip" @click="emit('swap')">Equip</button>
        <button v-else type="button" class="do kept" disabled>Kept</button>
        <button type="button" class="swap" @click="emit('swap')">Swap</button>
        <button type="button" class="close" @click="onClose">Close</button>
      </div>
    </header>

    <div class="chart-wrap">
      <svg
        class="chart"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        aria-label="Return of each asset transfer over the days that book was open"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <line class="zero" :x1="LEFT" :x2="W - RIGHT" :y1="zeroY" :y2="zeroY" />
        <text v-for="tick in yTicks" :key="tick.label" class="tick" :x="LEFT - 4" :y="tick.y + 3" text-anchor="end">{{ tick.label }}</text>
        <text class="tick" :x="LEFT" :y="H - 4">Open</text>
        <text class="tick" :x="W - RIGHT" :y="H - 4" text-anchor="end">Close</text>
        <polyline class="series equipped" :points="equippedLine" />
        <polyline class="series candidate" :points="candidateLine" />
        <line v-if="readout" class="probe" :x1="readout.x" :x2="readout.x" :y1="TOP" :y2="H - BOTTOM" />
        <circle v-if="readout && readout.equipped != null" class="dot equipped" :cx="readout.x" :cy="yOf(readout.equipped)" r="3.2" />
        <circle v-if="readout && readout.candidate != null" class="dot candidate" :cx="readout.x" :cy="yOf(readout.candidate)" r="3.2" />
      </svg>
      <p class="legend">
        <span class="swatch equipped" /> {{ equipped.name }}
        <span class="swatch candidate" /> {{ candidate.name }}
        <template v-if="readout">
          · {{ readout.label }}
          · equipped {{ readout.equippedWhen }} {{ pctText(readout.equipped) }}
          · in hand {{ readout.candidateWhen }} {{ pctText(readout.candidate) }}
        </template>
        <template v-else>
          · each line is that book's return, from the day it opened
        </template>
      </p>
    </div>

    <div class="pair">
      <article class="card equipped">
        <small>Equipped</small>
        <h3>{{ equipped.name }}</h3>
        <p class="transfer">{{ equipped.transfer }}</p>
        <p class="when">{{ windowText(equipped) }}</p>
        <dl>
          <div v-for="row in rows" :key="row.id">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.equipped }}</dd>
          </div>
        </dl>
        <button v-if="equipped.id" type="button" class="fork" @click="emit('clone', equipped.id)">Fork</button>
      </article>

      <article class="card candidate">
        <small>In hand</small>
        <h3>{{ candidate.name }}</h3>
        <p class="transfer">{{ candidate.transfer }}</p>
        <p class="when">{{ windowText(candidate) }}</p>
        <dl>
          <div v-for="row in rows" :key="row.id">
            <dt>{{ row.label }}</dt>
            <dd>
              {{ row.candidate }}
              <em v-if="row.scored && Math.abs(row.gap) >= 0.05" :class="gapIsBetter(row) ? 'up' : 'down'">{{ gapLabel(row) }}</em>
            </dd>
          </div>
        </dl>
        <button v-if="candidate.id" type="button" class="fork" @click="emit('clone', candidate.id)">Fork</button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.equip-sheet {
  position: fixed;
  z-index: 90;
  left: 50%;
  bottom: 112px;
  transform: translateX(-50%);
  width: min(920px, calc(100vw - 20px));
  max-height: min(560px, calc(100vh - 180px));
  overflow: auto;
  padding: 12px 14px 14px;
  border: 1px solid rgba(255, 214, 120, 0.35);
  border-radius: 12px;
  background: #0c0c0e;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.72);
}
.head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}
.verdict {
  margin: 0;
  min-width: 0;
}
.verdict b {
  display: block;
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}
.verdict.equip b { color: #7dffb3; }
.verdict.keep b { color: #ffd56a; }
.verdict span {
  display: block;
  margin-top: 3px;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.72);
}
.actions { display: flex; gap: 6px; flex: 0 0 auto; }
.actions button {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 999px;
  font: inherit;
  font-size: 0.68rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}
.actions .equip { color: #07140c; background: #7dffb3; border-color: #7dffb3; font-weight: 700; }
.actions .kept { color: #ffd56a; border-color: rgba(255, 213, 106, 0.45); cursor: default; }
.actions .swap { color: rgba(255, 255, 255, 0.8); }
.chart-wrap { margin-top: 8px; }
.chart {
  width: 100%;
  height: auto;
  display: block;
  background: #101114;
  border-radius: 8px;
  touch-action: none;
}
.zero { stroke: rgba(255, 255, 255, 0.16); stroke-width: 1; }
.tick { fill: rgba(255, 255, 255, 0.45); font-size: 10px; }
.series { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.series.equipped { stroke: #ffd56a; }
.series.candidate { stroke: #7dffb3; }
.probe { stroke: rgba(255, 255, 255, 0.35); stroke-width: 1; }
.dot.equipped { fill: #ffd56a; }
.dot.candidate { fill: #7dffb3; }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  margin: 6px 0 0;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.62);
}
.swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  display: inline-block;
}
.swatch.equipped { background: #ffd56a; }
.swatch.candidate { background: #7dffb3; }
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.card {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}
.card.equipped { box-shadow: inset 2px 0 0 #ffd56a; }
.card.candidate { box-shadow: inset 2px 0 0 #7dffb3; }
.card small {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}
.card h3 {
  margin: 2px 0 0;
  font-size: 0.86rem;
  font-weight: 700;
}
.transfer, .when {
  margin: 2px 0 0;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.62);
}
dl { margin: 8px 0 0; }
dl div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}
dt { color: rgba(255, 255, 255, 0.5); }
dd { margin: 0; font-weight: 700; }
em {
  margin-left: 6px;
  font-style: normal;
  font-size: 0.68rem;
}
em.up { color: #7dffb3; }
em.down { color: #ff7b8a; }
.fork {
  margin-top: 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  font: inherit;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0;
}
@media (max-width: 700px) {
  .pair { grid-template-columns: 1fr; }
}
</style>
