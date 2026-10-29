<script setup lang="ts">
/**
 * Every strategy on one board, under the desk.
 * Performance reuses the return path from the equip sheet.
 * Spread places the same books on two axes.
 * Calendar draws each book's window and the moves inside it.
 */
import { computed, ref } from 'vue'
import type { CompareInput } from '~/utils/strategyCompare'
import { dayLabel, samplePath } from '~/utils/strategyCompare'
import {
  BOARD_AXES, axisText, boardFrame, boardSeries, calendarLanes, monthTicks, spreadPoints,
  type BoardAxis,
} from '~/utils/strategyBoard'

const props = withDefaults(defineProps<{ strategies: CompareInput[]; focusIds?: string[] }>(), {
  focusIds: () => [],
})

const mode = ref<'performance' | 'spread' | 'calendar'>('performance')
const xAxis = ref<BoardAxis>('return')
const yAxis = ref<BoardAxis>('drawdown')
const hover = ref<number | null>(null)
const spreadId = ref<string | null>(null)
const laneId = ref<string | null>(null)

const focused = computed(() => new Set(props.focusIds))
function dim(id: string): boolean {
  return focused.value.size > 0 && !focused.value.has(id)
}

const series = computed(() => boardSeries(props.strategies))
const frame = computed(() => boardFrame(series.value))
const spread = computed(() => spreadPoints(props.strategies, xAxis.value, yAxis.value))
const calendar = computed(() => calendarLanes(series.value))
const months = computed(() => calendar.value ? monthTicks(calendar.value.t0, calendar.value.t1) : [])

const W = 640
const H = 168
const LEFT = 36
const RIGHT = 12
const TOP = 12
const BOTTOM = 22

function yOf(pct: number): number {
  const box = frame.value
  if (!box) return H / 2
  const span = box.y1 - box.y0 || 1
  return TOP + (1 - (pct - box.y0) / span) * (H - TOP - BOTTOM)
}

function lineOf(side: { start: number; end: number; path: { t: number; pct: number }[] }): string {
  const span = side.end - side.start || 1
  return side.path.map(point => {
    const u = Math.min(1, Math.max(0, (point.t - side.start) / span))
    const x = LEFT + u * (W - LEFT - RIGHT)
    return `${x.toFixed(1)},${yOf(point.pct).toFixed(1)}`
  }).join(' ')
}

const zeroY = computed(() => yOf(0))
const yTicks = computed(() => {
  const box = frame.value
  if (!box) return []
  const values = box.series.flatMap(row => row.side.path.map(point => point.pct))
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
const readout = computed(() => {
  const box = frame.value
  if (!box || hover.value == null) return null
  const u = hover.value
  const rows = box.series.map(row => {
    const span = row.side.end - row.side.start || 1
    return { id: row.id, name: row.name, color: row.color, pct: samplePath(row.side.path, row.side.start + u * span) }
  }).filter(row => row.pct != null)
  const label = u < 0.04 ? 'Open' : u > 0.96 ? 'Close' : `${Math.round(u * 100)}% through`
  return { label, x: LEFT + u * (W - LEFT - RIGHT), rows }
})
const spreadPick = computed(() => spread.value.find(point => point.id === spreadId.value) ?? null)
const laneDetail = computed(() => calendar.value?.lanes.find(lane => lane.id === laneId.value) ?? null)

function onMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * W
  const span = W - LEFT - RIGHT
  hover.value = Math.min(1, Math.max(0, (x - LEFT) / span))
}

function pctText(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
}

const axisLabel = (id: BoardAxis) => BOARD_AXES.find(axis => axis.id === id)?.label || id

function place(n: number, pad: number, span: number) {
  return pad + n * span
}

function retText(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(n >= 10 || n <= -10 ? 0 : 1)}%`
}

function pickLane(id: string) {
  laneId.value = laneId.value === id ? null : id
}
</script>

<template>
  <section v-if="series.length" class="board" aria-label="Strategy performance">
    <div class="modes" role="group" aria-label="How to read the books">
      <button type="button" :class="{ on: mode === 'performance' }" :aria-pressed="mode === 'performance'" @click="mode = 'performance'">Performance</button>
      <button type="button" :class="{ on: mode === 'spread' }" :aria-pressed="mode === 'spread'" @click="mode = 'spread'">Spread</button>
      <button type="button" :class="{ on: mode === 'calendar' }" :aria-pressed="mode === 'calendar'" @click="mode = 'calendar'">Calendar</button>
    </div>

    <div v-if="mode === 'performance' && frame" class="pane">
      <svg
        class="plot"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        aria-label="Return of every strategy from the day its book opened"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <line class="zero" :x1="LEFT" :x2="W - RIGHT" :y1="zeroY" :y2="zeroY" />
        <text v-for="tick in yTicks" :key="tick.label" class="tick" :x="LEFT - 4" :y="tick.y + 3" text-anchor="end">{{ tick.label }}</text>
        <text class="tick" :x="LEFT" :y="H - 4">Open</text>
        <text class="tick" :x="W - RIGHT" :y="H - 4" text-anchor="end">Close</text>
        <g v-for="row in frame.series" :key="row.id" :opacity="dim(row.id) ? 0.28 : 1">
          <polyline class="series" :points="lineOf(row.side)" :stroke="row.color" />
          <circle class="end" :cx="W - RIGHT" :cy="yOf(row.side.returnPct)" r="2.6" :fill="row.color" />
          <circle
            v-if="readout && readout.rows.find(item => item.id === row.id)"
            class="probe-dot"
            :cx="readout.x"
            :cy="yOf(readout.rows.find(item => item.id === row.id)!.pct!)"
            r="3"
            :fill="row.color"
          />
        </g>
        <line v-if="readout" class="probe" :x1="readout.x" :x2="readout.x" :y1="TOP" :y2="H - BOTTOM" />
      </svg>
      <p class="legend">
        <template v-if="readout">
          <b>{{ readout.label }}</b>
          <span v-for="row in readout.rows" :key="row.name" :style="{ color: row.color }">{{ row.name }} {{ pctText(row.pct!) }}</span>
        </template>
        <template v-else>
          <span v-for="row in frame.series" :key="row.id" :style="{ color: row.color }">{{ row.name }} {{ pctText(row.side.returnPct) }}</span>
        </template>
      </p>
    </div>

    <div v-else-if="mode === 'spread'" class="pane">
      <div class="axes">
        <label>X
          <select v-model="xAxis">
            <option v-for="axis in BOARD_AXES" :key="axis.id" :value="axis.id">{{ axis.label }}</option>
          </select>
        </label>
        <label>Y
          <select v-model="yAxis">
            <option v-for="axis in BOARD_AXES" :key="axis.id" :value="axis.id">{{ axis.label }}</option>
          </select>
        </label>
      </div>
      <svg class="plot spread" viewBox="0 0 100 76" role="img" :aria-label="`${axisLabel(xAxis)} across, ${axisLabel(yAxis)} up`">
        <line class="zero" x1="8" y1="58" x2="94" y2="58" />
        <line class="zero" x1="8" y1="58" x2="8" y2="8" />
        <text class="tick spread-label" x="8" y="72">{{ axisText(xAxis, Math.min(...spread.map(point => point.xValue))) }}</text>
        <text class="tick spread-label" x="94" y="72" text-anchor="end">{{ axisText(xAxis, Math.max(...spread.map(point => point.xValue))) }}</text>
        <text class="tick spread-label" x="10" y="6">{{ axisText(yAxis, Math.max(...spread.map(point => point.yValue))) }}</text>
        <text class="tick spread-label" x="10" y="54">{{ axisText(yAxis, Math.min(...spread.map(point => point.yValue))) }}</text>
        <g v-for="point in spread" :key="point.id" :opacity="dim(point.id) ? 0.28 : 1" @click="spreadId = spreadId === point.id ? null : point.id">
          <circle :cx="place(point.x, 12, 76)" :cy="place(1 - point.y, 10, 44)" r="2.1" :fill="point.color" style="cursor: pointer">
            <title>{{ point.name }}</title>
          </circle>
          <text
            class="name"
            :x="point.x > 0.68 ? place(point.x, 12, 76) - 2.8 : place(point.x, 12, 76) + 2.8"
            :y="point.y > 0.78 ? place(1 - point.y, 10, 44) + 4.4 : place(1 - point.y, 10, 44) - 1.6"
            :text-anchor="point.x > 0.68 ? 'end' : 'start'"
          >{{ point.name }}</text>
        </g>
      </svg>
      <p v-if="spreadPick" class="legend">
        <b>{{ spreadPick.name }}</b>
        <span>{{ axisLabel(xAxis) }} {{ axisText(xAxis, spreadPick.xValue) }}</span>
        <span>{{ axisLabel(yAxis) }} {{ axisText(yAxis, spreadPick.yValue) }}</span>
      </p>
    </div>

    <div v-else-if="calendar" class="pane">
      <svg
        class="plot calendar"
        :viewBox="`0 0 640 ${28 + calendar.lanes.length * 22}`"
        role="img"
        aria-label="Each strategy across the months it was open"
      >
        <text
          v-for="tick in months"
          :key="tick.t"
          class="tick"
          :x="168 + 450 * ((tick.t - calendar.t0) / (calendar.t1 - calendar.t0 || 1))"
          y="14"
        >{{ tick.label }}</text>
        <g
          v-for="(lane, index) in calendar.lanes"
          :key="lane.id"
          class="lane-row"
          :class="{ on: laneId === lane.id }"
          :opacity="dim(lane.id) ? 0.28 : 1"
          @click="pickLane(lane.id)"
        >
          <rect class="hit" x="0" :y="20 + index * 22" width="640" height="22" />
          <text class="lane" x="8" :y="36 + index * 22">{{ lane.name }}</text>
          <line
            class="bar"
            :stroke="lane.color"
            :x1="168 + 450 * lane.start"
            :x2="168 + 450 * lane.end"
            :y1="32 + index * 22"
            :y2="32 + index * 22"
          />
          <circle
            v-for="(mark, markIndex) in lane.marks"
            :key="markIndex"
            :cx="168 + 450 * mark.u"
            :cy="32 + index * 22"
            r="2.4"
            :fill="mark.up ? '#7dffb3' : '#ff7b8a'"
          />
          <text
            class="ret"
            :x="lane.end - lane.start < 0.1 ? 168 + 450 * lane.start - 6 : 168 + 450 * lane.end + 6"
            :y="36 + index * 22"
            :text-anchor="lane.end - lane.start < 0.1 ? 'end' : 'start'"
            :fill="lane.returnPct >= 0 ? '#7dffb3' : '#ff7b8a'"
          >{{ retText(lane.returnPct) }}</text>
        </g>
      </svg>
      <div v-if="laneDetail" class="lane-read">
        <b>{{ laneDetail.name }}</b>
        <span>{{ dayLabel(laneDetail.startAt) }} → {{ dayLabel(laneDetail.endAt) }}</span>
        <span :class="laneDetail.returnPct >= 0 ? 'up' : 'down'">{{ retText(laneDetail.returnPct) }}</span>
      </div>
      <svg v-if="laneDetail" class="plot strip" viewBox="0 0 640 36" role="img" :aria-label="`Moves inside ${laneDetail.name}`">
        <line class="bar" :stroke="laneDetail.color" x1="16" x2="624" y1="14" y2="14" />
        <circle
          v-for="(mark, markIndex) in laneDetail.marks"
          :key="markIndex"
          :cx="16 + 608 * mark.along"
          cy="14"
          r="4"
          :fill="mark.up ? '#7dffb3' : '#ff7b8a'"
        />
        <text class="tick" x="16" y="32">Open</text>
        <text class="tick" x="624" y="32" text-anchor="end">Close</text>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.18);
}
.modes { display: flex; gap: 6px; }
.modes button, .axes select {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font: inherit;
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.22rem 0.55rem;
  cursor: pointer;
}
.modes button.on { color: #07140c; background: #7dffb3; border-color: #7dffb3; font-weight: 700; }
.axes { display: flex; gap: 10px; margin-bottom: 4px; }
.axes label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}
.plot { width: 100%; height: auto; display: block; background: #101114; border-radius: 8px; }
.zero { stroke: rgba(255, 255, 255, 0.16); stroke-width: 1; }
.tick { fill: rgba(255, 255, 255, 0.48); font-size: 10px; }
.spread-label { font-size: 3.4px; }
.series { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.probe { stroke: rgba(255, 255, 255, 0.4); stroke-width: 1; }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 6px 0 0;
  font-size: 0.66rem;
}
.legend b { color: #fff; font-weight: 700; }
.name { fill: rgba(255, 255, 255, 0.78); font-size: 2.6px; }
.lane { fill: rgba(255, 255, 255, 0.72); font-size: 10px; }
.lane-row { cursor: pointer; }
.lane-row.on .lane { fill: #fff; font-weight: 700; }
.hit { fill: transparent; }
.ret { font-size: 10px; font-weight: 700; }
.lane-read {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 6px 0 0;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.72);
}
.lane-read b { color: #fff; }
.lane-read .up { color: #7dffb3; font-weight: 700; }
.lane-read .down { color: #ff7b8a; font-weight: 700; }
.strip { margin-top: 4px; }
.bar { stroke-width: 2; }
.calendar { background: #101114; }
</style>
