<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  activityRange,
  addDays,
  monthStamp,
  shiftActivity,
  type ActivitySpan,
  type DeskDay,
} from '~/utils/profileDesk'

const props = defineProps<{
  weeks: DeskDay[][]
  active: boolean
  today?: string
}>()

const SPANS: ActivitySpan[] = ['week', 'month', 'quarter', 'year']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const span = ref<ActivitySpan>('year')
const anchor = ref(props.today || '')
const pinned = ref<string | null>(null)
const hovered = ref<string | null>(null)
const coarse = ref(false)
const narrow = ref(false)
const dragging = ref(false)
const hostW = ref(0)
const wrap = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)

let scrub: { x: number; anchor: string; moved: boolean } | null = null
let observer: ResizeObserver | null = null
let pointerQuery: MediaQueryList | null = null
let narrowQuery: MediaQueryList | null = null

const byDate = computed(() => {
  const map = new Map<string, DeskDay>()
  for (const week of props.weeks) for (const day of week) map.set(day.date, day)
  return map
})

const bounds = computed(() => {
  const flat = props.weeks.flat()
  return { first: flat[0]?.date || '', last: flat.at(-1)?.date || '' }
})

function clamp(iso: string) {
  const { first, last } = bounds.value
  if (!iso) return props.today || first
  if (first && iso < first) return first
  if (last && iso > last) return last
  return iso
}

const range = computed(() => activityRange(clamp(anchor.value || props.today || bounds.value.first || '2026-01-01'), span.value))

function blank(date: string): DeskDay {
  return { date, pnlPct: null, pnlUsd: null, level: null, trades: 0, tone: 'idle', scheduled: false, marks: [] }
}

function daysFrom(start: string, end: string): DeskDay[] {
  const out: DeskDay[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(byDate.value.get(d) ?? blank(d))
  return out
}

const gridDays = computed(() => daysFrom(range.value.gridStart, range.value.gridEnd))

const boards = computed(() => {
  if (span.value !== 'quarter') return []
  const out: { key: string; label: string; short: string; focus: string; days: DeskDay[] }[] = []
  let cursor = range.value.start
  for (let i = 0; i < 3; i++) {
    const month = activityRange(cursor, 'month')
    out.push({
      key: month.start,
      label: month.label,
      short: monthStamp(month.start),
      focus: month.start.slice(0, 7),
      days: daysFrom(month.gridStart, month.gridEnd),
    })
    cursor = shiftActivity(cursor, 'month', 1)
  }
  return out
})

const yearTicks = computed(() => {
  const weeks: DeskDay[][] = []
  const days = gridDays.value
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  let prev = ''
  return weeks.map((week) => {
    const year = range.value.start.slice(0, 4)
    const first = week.find(d => d.date.startsWith(year) && d.date.endsWith('-01'))
      ?? week.find(d => d.date.startsWith(year))
    const label = first ? monthStamp(first.date) : ''
    const show = !!label && label !== prev
    if (label) prev = label
    return show ? label : ''
  })
})

const tickLabels = computed(() => {
  if (span.value === 'year') return yearTicks.value
  if (span.value === 'week') return gridDays.value.map(d => String(Number(d.date.slice(8))))
  if (span.value === 'quarter') return boards.value.map(b => b.short)
  return [range.value.label]
})

const tickStyle = computed(() => {
  if (span.value === 'year') return { gridTemplateColumns: `repeat(${Math.max(yearTicks.value.length, 1)}, minmax(0, 1fr))` }
  if (span.value === 'quarter') return { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
  if (span.value === 'week') return { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }
  return { gridTemplateColumns: '1fr' }
})

const scored = computed(() => {
  const { start, end } = range.value
  const out: DeskDay[] = []
  for (const week of props.weeks) {
    for (const day of week) {
      if (day.date >= start && day.date <= end && !day.scheduled && day.pnlPct != null && day.tone !== 'idle') out.push(day)
    }
  }
  return out
})

const best = computed(() => scored.value.reduce<DeskDay | null>((a, b) => (!a || (b.pnlPct ?? 0) > (a.pnlPct ?? 0) ? b : a), null))
const worst = computed(() => scored.value.reduce<DeskDay | null>((a, b) => (!a || (b.pnlPct ?? 0) < (a.pnlPct ?? 0) ? b : a), null))

const focusId = computed(() => pinned.value || hovered.value)
const focus = computed(() => (focusId.value ? byDate.value.get(focusId.value) ?? null : null))

const colW = computed(() => {
  const host = hostW.value
  if (span.value === 'year') return host / 54
  if (span.value === 'quarter' && !narrow.value) return host / 22
  return host / 7.4
})
const showNum = computed(() => span.value !== 'year' && colW.value >= 20)
const showPct = computed(() => span.value !== 'year' && colW.value >= 36)
const showMoney = computed(() => span.value !== 'year' && colW.value >= 62)

function measure() {
  hostW.value = wrap.value?.clientWidth || hostW.value
}

function ghost(day: DeskDay, focusKey?: string) {
  if (span.value === 'week') return false
  if (span.value === 'year') return day.date.slice(0, 4) !== range.value.start.slice(0, 4)
  return day.date.slice(0, 7) !== (focusKey || range.value.start.slice(0, 7))
}

function toneStyle(day: DeskDay) {
  if (day.tone === 'idle') return { background: 'rgba(255,255,255,0.07)' }
  if (day.tone === 'ahead') return { background: 'rgba(255,176,32,0.28)', boxShadow: 'inset 0 0 0 1px #ffb020' }
  const mag = Math.min(1, Math.abs(day.pnlPct ?? 0) / 8)
  const alpha = (0.38 + mag * 0.62).toFixed(2)
  const rgb = day.tone === 'green' ? '0,255,136' : day.tone === 'red' ? '255,68,68' : '255,176,32'
  return { background: `rgba(${rgb},${alpha})` }
}

function dateFrom(event: Event) {
  return (event.target as HTMLElement | null)?.closest?.('[data-date]')?.getAttribute('data-date') || ''
}

function onMove(event: PointerEvent) {
  if (coarse.value) return
  hovered.value = dateFrom(event) || null
}

function leave() {
  hovered.value = null
}

function onClick(event: MouseEvent) {
  const date = dateFrom(event)
  if (!date) return
  pinned.value = pinned.value === date ? null : date
}

function weekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

function fmtPct(v: number | null) {
  if (v == null) return 'No recorded move'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtPctShort(v: number) {
  const digits = Math.abs(v) >= 10 ? 0 : 1
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

function fmtUsd(v: number | null) {
  if (v == null) return ''
  const abs = Math.abs(v)
  const n = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `$${abs.toFixed(0)}`
  return v >= 0 ? `+${n}` : `−${n}`
}

function fmtLevel(v: number | null) {
  if (v == null) return ''
  const abs = Math.abs(v)
  const n = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `$${abs.toFixed(0)}`
  return v < 0 ? `−${n}` : n
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function tip(day: DeskDay) {
  const parts = [fmtDate(day.date)]
  if (day.pnlPct != null) parts.push(fmtPct(day.pnlPct))
  if (day.pnlUsd != null) parts.push(fmtUsd(day.pnlUsd))
  if (day.level != null) parts.push(fmtLevel(day.level))
  if (day.trades) parts.push(`${day.trades} trades`)
  if (day.scheduled) parts.push('scheduled')
  if (day.marks.length) parts.push(day.marks.join(', '))
  return parts.join(' · ')
}

function step(direction: -1 | 1) {
  anchor.value = clamp(shiftActivity(anchor.value || range.value.start, span.value, direction))
  pinned.value = null
  hovered.value = null
}

function spanDays(iso: string) {
  const window = activityRange(iso, span.value)
  const a = Date.parse(`${window.gridStart}T12:00:00Z`)
  const b = Date.parse(`${window.gridEnd}T12:00:00Z`)
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

function scrubDown(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement
  scrub = { x: event.clientX, anchor: anchor.value || range.value.start, moved: false }
  dragging.value = true
  try { el.setPointerCapture(event.pointerId) } catch { /* the drag still follows the pointer */ }
}

function scrubMove(event: PointerEvent) {
  if (!scrub) return
  const dx = event.clientX - scrub.x
  if (Math.abs(dx) > 3) scrub.moved = true
  if (!scrub.moved) return
  const width = track.value?.clientWidth || 1
  const shift = Math.round((-dx / width) * spanDays(scrub.anchor))
  anchor.value = clamp(addDays(scrub.anchor, shift))
}

function scrubUp() {
  scrub = null
  dragging.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'ArrowRight') step(1)
}

function syncPointer() {
  coarse.value = !!pointerQuery?.matches
  narrow.value = !!narrowQuery?.matches
}

watch(() => props.today, (today) => {
  if (today && !anchor.value) anchor.value = today
})

watch(span, () => {
  pinned.value = null
  hovered.value = null
  nextTick(measure)
})

watch(gridDays, () => nextTick(measure))

onMounted(() => {
  if (!anchor.value && props.today) anchor.value = props.today
  pointerQuery = window.matchMedia('(pointer: coarse)')
  narrowQuery = window.matchMedia('(max-width: 720px)')
  pointerQuery.addEventListener('change', syncPointer)
  narrowQuery.addEventListener('change', syncPointer)
  syncPointer()
  observer = new ResizeObserver(() => measure())
  if (wrap.value) observer.observe(wrap.value)
  nextTick(measure)
})

onUnmounted(() => {
  pointerQuery?.removeEventListener('change', syncPointer)
  narrowQuery?.removeEventListener('change', syncPointer)
  observer?.disconnect()
})
</script>

<template>
  <div ref="wrap" class="year-wrap">
    <div class="year-head">
      <span class="live" :class="{ on: active }">{{ active ? 'Active' : 'Quiet' }}</span>
      <span v-if="best">Best {{ fmtDate(best.date) }} {{ fmtPct(best.pnlPct) }}</span>
      <span v-if="worst">Worst {{ fmtDate(worst.date) }} {{ fmtPct(worst.pnlPct) }}</span>
      <span class="readout">
        <template v-if="focus">
          {{ fmtDate(focus.date) }} · {{ fmtPct(focus.pnlPct) }}
          <template v-if="focus.pnlUsd != null"> {{ fmtUsd(focus.pnlUsd) }}</template>
          <template v-if="focus.level != null"> · {{ fmtLevel(focus.level) }}</template>
          <template v-if="focus.trades"> · {{ focus.trades }} trades</template>
          <template v-if="focus.scheduled"> · scheduled</template>
          <template v-if="focus.marks.length"> · {{ focus.marks.join(' · ') }}</template>
        </template>
        <template v-else>{{ range.label }}</template>
      </span>
    </div>

    <div class="spans" role="group" aria-label="Activity window">
      <button
        v-for="key in SPANS"
        :key="key"
        type="button"
        :class="{ on: span === key }"
        :aria-pressed="span === key"
        @click="span = key"
      >{{ key }}</button>
    </div>

    <div
      class="scrub"
      :class="{ dragging }"
      role="group"
      :aria-label="`Date window ${range.label}`"
      tabindex="0"
      @keydown="onKey"
    >
      <button type="button" class="edge left" aria-label="Earlier" @click="step(-1)">‹</button>
      <div
        ref="track"
        class="track"
        @pointerdown="scrubDown"
        @pointermove="scrubMove"
        @pointerup="scrubUp"
        @pointercancel="scrubUp"
      >
        <div class="ticks" :class="span" :style="tickStyle">
          <span v-for="(label, i) in tickLabels" :key="`${span}-${i}`">{{ label }}</span>
        </div>
      </div>
      <button type="button" class="edge right" aria-label="Later" @click="step(1)">›</button>
    </div>

    <div v-if="span === 'month'" class="wdays" aria-hidden="true">
      <span v-for="day in WEEKDAYS" :key="day">{{ day }}</span>
    </div>

    <div
      v-if="span !== 'quarter'"
      class="grid"
      :class="span"
      @pointermove="onMove"
      @pointerleave="leave"
      @click="onClick"
    >
      <button
        v-for="day in gridDays"
        :key="day.date"
        type="button"
        class="cell"
        :class="[day.tone, { pin: pinned === day.date, mark: day.marks.length > 0, today: day.date === today, ghost: ghost(day) }]"
        :data-date="day.date"
        :style="toneStyle(day)"
        :aria-label="tip(day)"
        :aria-current="day.date === today ? 'date' : undefined"
        :title="showPct ? undefined : tip(day)"
      >
        <span v-if="span === 'week'" class="wd">{{ weekday(day.date) }}</span>
        <span v-if="showNum" class="num">{{ Number(day.date.slice(8)) }}</span>
        <span v-if="showPct && day.pnlPct != null" class="pct">{{ fmtPctShort(day.pnlPct) }}</span>
        <span v-if="showMoney && day.pnlUsd != null" class="lvl">{{ fmtUsd(day.pnlUsd) }}</span>
        <span v-if="span === 'week' && showMoney && day.level != null" class="lvl book">{{ fmtLevel(day.level) }}</span>
      </button>
    </div>

    <div v-else class="boards">
      <section v-for="board in boards" :key="board.key" class="board">
        <header>{{ board.short }}</header>
        <div class="wdays" aria-hidden="true">
          <span v-for="day in WEEKDAYS" :key="day">{{ day }}</span>
        </div>
        <div class="grid month" @pointermove="onMove" @pointerleave="leave" @click="onClick">
          <button
            v-for="day in board.days"
            :key="day.date"
            type="button"
            class="cell"
            :class="[day.tone, { pin: pinned === day.date, mark: day.marks.length > 0, today: day.date === today, ghost: ghost(day, board.focus) }]"
            :data-date="day.date"
            :style="toneStyle(day)"
            :aria-label="tip(day)"
            :aria-current="day.date === today ? 'date' : undefined"
            :title="showPct ? undefined : tip(day)"
          >
            <span v-if="showNum" class="num">{{ Number(day.date.slice(8)) }}</span>
            <span v-if="showPct && day.pnlPct != null" class="pct">{{ fmtPctShort(day.pnlPct) }}</span>
            <span v-if="showMoney && day.pnlUsd != null" class="lvl">{{ fmtUsd(day.pnlUsd) }}</span>
          </button>
        </div>
      </section>
    </div>

    <div class="legend">
      <span><i class="swatch idle" /> Quiet</span>
      <span><i class="swatch orange" /> Flat</span>
      <span><i class="swatch green" /> Up</span>
      <span><i class="swatch red" /> Down</span>
      <span><i class="swatch ahead" /> Scheduled</span>
      <span><i class="pip" /> Mark</span>
    </div>
  </div>
</template>

<style scoped>
.year-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  width: 100%;
  min-width: 0;
}
.year-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.7rem;
  align-items: baseline;
  width: 100%;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}
.year-head > span { flex: 1 1 auto; min-width: 0; }
.live {
  flex: 0 0 auto;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.live.on { color: var(--primary-green, #00ff88); }
.readout { flex: 2 1 8rem; margin-left: auto; text-align: right; color: rgba(255,255,255,0.62); }

.spans { display: flex; width: 100%; gap: 0.3rem; }
.spans button {
  flex: 1 1 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.75);
  border-radius: 999px;
  padding: 0.16rem 0.3rem;
  font: inherit;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}
.spans button.on { border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }

.scrub { position: relative; width: 100%; min-height: 1.2rem; outline: none; }
.track {
  width: 100%;
  min-height: 1.15rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.scrub.dragging .track { cursor: grabbing; }
.ticks { display: grid; gap: 2px; width: 100%; align-items: end; min-height: 0.9rem; }
.ticks span {
  font-size: 0.52rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  overflow: visible;
}
.ticks.week span, .ticks.quarter span, .ticks.month span { text-align: center; }
.edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.8rem;
  z-index: 1;
  border: 0;
  padding: 0;
  color: rgba(255,255,255,0.82);
  font-size: 1.05rem;
  line-height: 1;
  cursor: pointer;
}
.edge.left { left: 0; background: linear-gradient(90deg, rgba(10,12,16,0.92) 42%, rgba(10,12,16,0)); }
.edge.right { right: 0; background: linear-gradient(270deg, rgba(10,12,16,0.92) 42%, rgba(10,12,16,0)); }

.wdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  width: 100%;
  font-size: 0.52rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  text-align: center;
}

.grid { width: 100%; min-width: 0; }
.grid.year {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, auto);
  grid-auto-columns: minmax(0, 1fr);
  gap: 2px;
}
.grid.week, .grid.month {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
}
.grid.week { gap: 0.35rem; }

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.04rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 0;
  border-radius: 4px;
  padding: 0.16rem 0.28rem;
  font: inherit;
  color: #fff;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
}
.grid.week .cell { min-height: 5.2rem; justify-content: flex-start; padding-top: 0.35rem; }
.grid.month .cell { min-height: 3.35rem; }
.grid.year .cell {
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  height: auto;
  padding: 0;
  border-radius: 2px;
  cursor: crosshair;
}
.cell.ghost { opacity: 0.34; }
.cell.today { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.92); }
.cell.pin { outline: 1px solid #fff; outline-offset: 1px; }
.cell.mark::after {
  content: '';
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
}
.wd { font-size: 0.58rem; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.62); }
.num { font-size: 0.68rem; font-weight: 600; line-height: 1.1; }
.grid.week .num { font-size: 1.05rem; }
.pct { font-size: 0.64rem; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.1; }
.grid.week .pct { font-size: 0.78rem; }
.lvl { font-size: 0.58rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.78); line-height: 1.1; }
.lvl.book { color: rgba(255,255,255,0.55); }
.cell.green .pct { color: #e7fff3; }
.cell.red .pct { color: #ffd4d4; }
.cell.orange .pct, .cell.ahead .pct { color: #ffe6b0; }

.boards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  width: 100%;
}
.board { min-width: 0; }
.board header {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  margin: 0 0 0.15rem;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 0.2rem 0.35rem;
  align-items: center;
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}
.legend > span {
  flex: 1 1 4.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  min-width: 0;
}
.swatch, .legend .pip { width: 10px; height: 10px; border-radius: 2px; display: inline-block; flex: 0 0 auto; }
.legend .pip { background: rgba(255,255,255,0.08); position: relative; }
.legend .pip::after {
  content: '';
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
}
.swatch.idle { background: rgba(255,255,255,0.07); }
.swatch.orange { background: rgba(255,176,32,0.8); }
.swatch.green { background: rgba(0,255,136,0.85); }
.swatch.red { background: rgba(255,68,68,0.85); }
.swatch.ahead { background: rgba(255,176,32,0.28); box-shadow: inset 0 0 0 1px #ffb020; }

.cell:focus-visible, .spans button:focus-visible, .edge:focus-visible, .scrub:focus-visible {
  outline: 1px solid rgba(255,255,255,0.8);
  outline-offset: 1px;
}

@media (pointer: coarse) {
  .edge { width: 2.75rem; font-size: 1.25rem; }
  .scrub { min-height: 2.2rem; }
  .grid.year .cell { cursor: pointer; }
  .grid.month .cell { min-height: 2.9rem; }
}
@media (max-width: 720px) {
  .boards { grid-template-columns: 1fr; }
  .readout { margin-left: 0; text-align: left; flex-basis: 100%; }
  .edge { width: 2.5rem; }
}
</style>
