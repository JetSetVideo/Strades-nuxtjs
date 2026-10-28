<script setup lang="ts">
/**
 * Month calendar of your calls, notification deadlines and market events.
 * Props in, `update:modelValue` (selected day 'YYYY-MM-DD' | null) out — no store, no fetch.
 * Client-only (the page wraps it in <ClientOnly>): it reads `now` for "today".
 * Keyboard: one tab stop in the grid (roving tabindex); arrows move by day/week,
 * Home/End to week start/end, PageUp/PageDown by month; Enter/Space selects.
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { CalendarItem } from '~/utils/notifications'
import { DOMAIN_META, dayKey, monthGrid, notificationLocation } from '~/utils/notifications'
import { APP_LOCALE } from '~/utils/locale'

const props = defineProps<{ items: CalendarItem[]; now: number; modelValue: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_MARKS = 3

function parseDay(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
function shortDay(k: string): string {
  return parseDay(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const initial = props.modelValue ? parseDay(props.modelValue) : new Date(props.now)
const view = ref({ y: initial.getFullYear(), m: initial.getMonth() })
const focusDay = ref<string>(props.modelValue ?? dayKey(props.now))

// Selection made outside (feed day chip removed / set) → follow it.
watch(() => props.modelValue, (v) => {
  if (!v) return
  const d = parseDay(v)
  view.value = { y: d.getFullYear(), m: d.getMonth() }
  focusDay.value = v
})

const monthDate = computed(() => new Date(view.value.y, view.value.m, 1))
const monthTitle = computed(() => monthDate.value.toLocaleDateString(APP_LOCALE, { month: 'long', year: 'numeric' }))
const weeks = computed(() => monthGrid(monthDate.value, props.items, props.now))
const isCurrentMonth = computed(() => {
  const t = new Date(props.now)
  return t.getFullYear() === view.value.y && t.getMonth() === view.value.m
})

type Mark = 'pending' | 'up' | 'down' | 'neutral' | 'event' | 'deadline'
function markOf(it: CalendarItem): Mark {
  if (it.kind === 'event') return 'event'
  if (it.kind === 'notification') return 'deadline'
  if (it.kind === 'call_scored') return it.tone === 'down' ? 'down' : 'up'
  return it.tone === 'pending' ? 'pending' : 'neutral'
}
function markColor(it: CalendarItem): string | undefined {
  return it.kind === 'notification' && it.domain !== 'market' ? DOMAIN_META[it.domain]?.color : undefined
}
function toneText(it: CalendarItem): string {
  const m = markOf(it)
  return m === 'pending' ? 'Due' : m === 'up' ? 'Hit' : m === 'down' ? 'Missed' : m === 'neutral' ? 'Not scored'
    : m === 'event' ? 'Event' : (it.domain !== 'market' ? DOMAIN_META[it.domain]?.label : '') || 'Deadline'
}

function cellLabel(day: string, items: CalendarItem[], isToday: boolean): string {
  const c = { due: 0, hit: 0, miss: 0, other: 0, ev: 0, dl: 0 }
  for (const it of items) {
    const m = markOf(it)
    if (m === 'pending') c.due++
    else if (m === 'up') c.hit++
    else if (m === 'down') c.miss++
    else if (m === 'neutral') c.other++
    else if (m === 'event') c.ev++
    else c.dl++
  }
  const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const parts = [
    c.due && pl(c.due, 'call due', 'calls due'),
    c.hit && pl(c.hit, 'call hit', 'calls hit'),
    c.miss && pl(c.miss, 'call missed', 'calls missed'),
    c.other && pl(c.other, 'call not scored', 'calls not scored'),
    c.dl && pl(c.dl, 'deadline', 'deadlines'),
    c.ev && pl(c.ev, 'event', 'events'),
  ].filter(Boolean)
  return `${shortDay(day)}${isToday ? ' (today)' : ''}: ${parts.length ? parts.join(', ') : 'nothing scheduled'}`
}

const gridEl = ref<HTMLElement | null>(null)

function select(day: string, inMonth: boolean) {
  focusDay.value = day
  if (!inMonth) {
    const d = parseDay(day)
    view.value = { y: d.getFullYear(), m: d.getMonth() }
  }
  emit('update:modelValue', props.modelValue === day ? null : day)
}

function shiftMonth(delta: number) {
  const d = new Date(view.value.y, view.value.m + delta, 1)
  view.value = { y: d.getFullYear(), m: d.getMonth() }
  // keep the roving focus inside the visible month
  const f = parseDay(focusDay.value)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  focusDay.value = dayKey(new Date(d.getFullYear(), d.getMonth(), Math.min(f.getDate(), last)).getTime())
}
function goToday() {
  const t = new Date(props.now)
  view.value = { y: t.getFullYear(), m: t.getMonth() }
  focusDay.value = dayKey(props.now)
}

async function moveFocus(to: Date) {
  focusDay.value = dayKey(to.getTime())
  if (to.getFullYear() !== view.value.y || to.getMonth() !== view.value.m) view.value = { y: to.getFullYear(), m: to.getMonth() }
  await nextTick()
  gridEl.value?.querySelector<HTMLButtonElement>(`button[data-day="${focusDay.value}"]`)?.focus()
}
function onKey(e: KeyboardEvent) {
  const d = parseDay(focusDay.value)
  const dow = (d.getDay() + 6) % 7
  const add = (n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  let to: Date | null = null
  switch (e.key) {
    case 'ArrowLeft': to = add(-1); break
    case 'ArrowRight': to = add(1); break
    case 'ArrowUp': to = add(-7); break
    case 'ArrowDown': to = add(7); break
    case 'Home': to = add(-dow); break
    case 'End': to = add(6 - dow); break
    case 'PageUp': to = new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28)); break
    case 'PageDown': to = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28)); break
    default: return
  }
  e.preventDefault()
  void moveFocus(to)
}

// Visible cell days, to make sure exactly one cell is tabbable.
const tabDay = computed(() => {
  const all = weeks.value.flat()
  return all.some(c => c.day === focusDay.value) ? focusDay.value : (all.find(c => c.inMonth)?.day ?? '')
})

// ── Agenda (selected day, else today) ─────────────────────────────────────
const agendaDay = computed(() => props.modelValue ?? dayKey(props.now))
const agenda = computed(() =>
  props.items.filter(i => i.day === agendaDay.value).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)))
const agendaTitle = computed(() => (props.modelValue ? shortDay(props.modelValue) : `Today · ${shortDay(agendaDay.value)}`))

function timeOf(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString(APP_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '—'
}
function linkOf(it: CalendarItem) {
  // Same validation as a notification click (in-app routes only, query + anchor checked).
  return notificationLocation({ where: { route: it.route ?? '/notifications', anchor: it.anchor ?? null, query: it.query ?? null, label: '' } } as any)
}
</script>

<template>
  <section class="ncal" aria-label="Calendar of calls and deadlines">
    <header class="ncal-head">
      <h2 class="ncal-title" aria-live="polite">{{ monthTitle }}</h2>
      <div class="ncal-nav">
        <button type="button" class="nb" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
        <button type="button" class="nb today" :disabled="isCurrentMonth" @click="goToday">Today</button>
        <button type="button" class="nb" aria-label="Next month" @click="shiftMonth(1)">›</button>
      </div>
    </header>

    <div class="ncal-wd" aria-hidden="true">
      <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
    </div>

    <div ref="gridEl" class="ncal-grid" role="group" :aria-label="monthTitle" @keydown="onKey">
      <template v-for="week in weeks" :key="week[0]!.day">
        <button
          v-for="cell in week"
          :key="cell.day"
          type="button"
          class="cell"
          :class="{ out: !cell.inMonth, today: cell.isToday, sel: modelValue === cell.day, has: cell.items.length }"
          :data-day="cell.day"
          :tabindex="cell.day === tabDay ? 0 : -1"
          :aria-pressed="modelValue === cell.day"
          :aria-current="cell.isToday ? 'date' : undefined"
          :aria-label="cellLabel(cell.day, cell.items, cell.isToday)"
          @click="select(cell.day, cell.inMonth)"
        >
          <span class="cell-d">{{ cell.date }}</span>
          <span v-if="cell.items.length" class="cell-marks" aria-hidden="true">
            <span
              v-for="it in cell.items.slice(0, MAX_MARKS)"
              :key="it.id"
              class="mk"
              :class="`mk-${markOf(it)}`"
              :style="markColor(it) ? { '--mk-c': markColor(it) } : undefined"
            />
            <span v-if="cell.items.length > MAX_MARKS" class="mk-more">+{{ cell.items.length - MAX_MARKS }}</span>
          </span>
          <span v-if="cell.items[0]?.symbol" class="cell-sym" aria-hidden="true">{{ cell.items[0].symbol }}</span>
        </button>
      </template>
    </div>

    <ul class="ncal-legend" aria-label="Legend">
      <li><span class="mk mk-pending" aria-hidden="true" />Call due</li>
      <li><span class="mk mk-up" aria-hidden="true" />Call hit</li>
      <li><span class="mk mk-down" aria-hidden="true" />Call missed</li>
      <li><span class="mk mk-deadline" aria-hidden="true" />Other deadline</li>
      <li><span class="mk mk-event" aria-hidden="true" />Market event</li>
    </ul>

    <div class="agenda">
      <header class="day-head">
        <span class="day-label">{{ agendaTitle }}</span>
        <span class="day-sub">{{ agenda.length }} item{{ agenda.length === 1 ? '' : 's' }}</span>
      </header>
      <p v-if="!agenda.length" class="agenda-empty">Nothing scheduled on this day.</p>
      <ul v-else class="agenda-list">
        <li v-for="it in agenda" :key="it.id" class="ag">
          <span class="mk" :class="`mk-${markOf(it)}`" :style="markColor(it) ? { '--mk-c': markColor(it) } : undefined" aria-hidden="true" />
          <time class="ag-t" :datetime="it.at">{{ timeOf(it.at) }}</time>
          <span v-if="it.symbol" class="ag-sym">{{ it.symbol }}</span>
          <NuxtLink class="ag-l" :to="linkOf(it)">{{ it.label }}</NuxtLink>
          <span class="ag-tone" :class="markOf(it)">{{ toneText(it) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.ncal {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: var(--card-pad, 0.75rem);
  background: var(--surface-raised, linear-gradient(180deg, rgba(27,29,38,0.92), rgba(16,17,24,0.95)));
  border: 1px solid var(--edge-raised, rgba(255,255,255,0.09));
  border-radius: var(--app-border-radius, 6px);
  min-width: 0;
}
.ncal-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.ncal-title {
  margin: 0;
  font-family: var(--font-chrome, inherit);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.85);
}
.ncal-nav { display: flex; gap: 0.25rem; }
.nb {
  min-width: 28px; min-height: 28px;
  padding: 0 0.45rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.75);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}
.nb.today { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; }
.nb:hover:not(:disabled) { color: var(--text-white, #ffffff); border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
.nb:disabled { opacity: 0.4; cursor: default; }
.nb:focus-visible, .cell:focus-visible, .ag-l:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }

.ncal-wd, .ncal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.ncal-wd span {
  text-align: center;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
}

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 46px;
  min-width: 0;
  padding: 3px 4px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: 4px;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  text-align: left;
  font: inherit;
  overflow: hidden;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.cell:hover { border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
.cell.out { opacity: 0.4; }
.cell.has { background: rgba(255,255,255,0.04); }
.cell.today { box-shadow: inset 0 0 0 1.5px var(--primary-blue, #00aaff); }
.cell.today .cell-d { color: var(--primary-blue, #00aaff); font-weight: 900; }
.cell.sel { background: rgba(0,170,255,0.14); border-color: var(--primary-blue, #00aaff); }
.cell.sel .cell-d { text-decoration: underline; text-underline-offset: 2px; }
.cell-d {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
}
.cell-marks { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
.cell-sym {
  font-family: var(--font-market-data, monospace);
  font-size: 0.5rem;
  color: rgba(255,255,255,0.5);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mk-more { font-size: 0.5rem; font-weight: 700; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }

/* Markers — shape differs as well as colour */
.mk { display: inline-block; flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; }
.mk-pending { border: 1.5px solid var(--primary-blue, #00aaff); background: transparent; }
.mk-up { background: var(--app-color-up, #00ff88); }
.mk-down { background: var(--app-color-down, #ff4444); border-radius: 1px; transform: rotate(45deg) scale(0.85); }
.mk-neutral { border: 1.5px dashed var(--text-gray, #888888); background: transparent; }
.mk-event { width: 6px; height: 6px; border-radius: 1px; background: var(--text-gray, #888888); }
.mk-deadline { --mk-c: var(--warning-orange, #ffa500); background: var(--mk-c); width: 9px; height: 4px; border-radius: 2px; }

.ncal-legend {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem;
  font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
  color: rgba(255,255,255,0.5);
}
.ncal-legend li { display: inline-flex; align-items: center; gap: 0.3rem; }

.agenda { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.2rem; }
.day-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border-left: 2px solid var(--primary-blue, #00aaff);
  border-radius: 3px;
}
.day-label { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; color: rgba(255,255,255,0.85); }
.day-sub { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); font-weight: 700; }
.agenda-empty { margin: 0; font-size: 0.7rem; color: rgba(255,255,255,0.45); padding: 0 0.55rem; }
.agenda-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.ag {
  display: grid;
  grid-template-columns: 9px 3.2rem auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.55rem;
  border-bottom: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  font-size: 0.72rem;
  min-width: 0;
}
.ag:last-child { border-bottom: 0; }
.ag-t { font-family: var(--font-market-data, monospace); font-variant-numeric: tabular-nums; font-size: 0.68rem; color: rgba(255,255,255,0.6); }
.ag-sym { font-family: var(--font-market-data, monospace); font-weight: 700; color: var(--text-white, #ffffff); }
.ag-l { color: rgba(255,255,255,0.85); text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-l:hover { color: var(--primary-blue, #00aaff); text-decoration: underline; }
.ag-tone { font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; color: rgba(255,255,255,0.5); white-space: nowrap; }
.ag-tone.pending { color: var(--primary-blue, #00aaff); }
.ag-tone.up { color: var(--app-color-up, #00ff88); }
.ag-tone.down { color: var(--app-color-down, #ff4444); }

@media (max-width: 640px) {
  .cell { min-height: 44px; padding: 2px 3px; }
  .cell-sym { display: none; }
  .ag { grid-template-columns: 9px 2.9rem minmax(0, 1fr) auto; }
  .ag-sym { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .cell { transition: none; }
}
</style>
