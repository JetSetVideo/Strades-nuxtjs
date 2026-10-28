<script setup lang="ts">
/**
 * /historic — you across time. Past · Now · Next in one view:
 *   You card   who you are as a trader, now (calls, money, agents, opinions, when you're active)
 *   River      every lane on one time axis, NOW fixed, the future hatched
 *   Book       one panel, three tabs: Past · Present · Future
 * Data: composables/useHistoryTimeline.ts (server GET /api/v1/history/ + this browser's stores).
 */
import { computed, nextTick, ref, watch } from 'vue'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import UISectionTabs from '@/components/UI/SectionTabs.vue'
import {
  HISTORY_LANES, OPEN_ENDED, historyDay, historySections, matchesHistoryFilter,
  type HistoryEvent, type HistoryFilter, type Lane,
} from '~/utils/historyTimeline'

definePageMeta({ title: 'History', description: 'Your calls, trades, agents and opinions — past, now and next.', layout: 'default' })

const h = useHistoryTimeline()
const { status, error, now, events, summary, payload } = h

const filter = ref<HistoryFilter>({
  lanes: new Set(HISTORY_LANES.map(l => l.id)),
  modes: new Set(['real', 'paper', 'backtest']),
  q: '',
  range: '90d',
  showSample: true,
})

const visible = computed(() => events.value.filter(e => matchesHistoryFilter(e, filter.value, now.value)))
const secs = computed(() => historySections(visible.value))

// NEXT is an agenda of moments still ahead: scheduled events AND the end of every open span (a call's
// target, the demo clock). Open-ended spans (running agents, positions) have no "next" moment.
const agenda = computed(() => visible.value
  .filter(e => !OPEN_ENDED.has(e.kind) && Date.parse(e.at) > now.value)
  .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)))

// the user's own scored calls; only when there are none, the (chipped) sample ones
const scored = computed(() => {
  const all = events.value.filter(e => e.kind === 'call_resolved' && typeof e.score === 'number')
  const own = all.filter(e => !e.sample)
  return (own.length ? own : filter.value.showSample ? all : [])
  .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  .slice(-60)
  .map(e => ({ id: e.id, at: e.at, score: e.score as number, right: (e.data?.direction_correct ?? e.status === 'accurate') === true, asset: e.asset, sample: e.sample }))
})

const laneCounts = computed(() => {
  const c: Record<string, number> = {}
  for (const e of events.value) if (matchesHistoryFilter(e, { ...filter.value, lanes: new Set([e.lane]) }, now.value)) c[e.lane] = (c[e.lane] ?? 0) + 1
  return c
})
const modeCounts = computed(() => {
  const c: Record<string, number> = {}
  for (const e of events.value) if (e.mode && matchesHistoryFilter(e, { ...filter.value, modes: new Set([e.mode]) }, now.value)) c[e.mode] = (c[e.mode] ?? 0) + 1
  return c
})
const sampleCount = computed(() => events.value.filter(e => e.sample).length)

// One expanded row at a time; the river selects and scrolls to it.
const expandedId = ref<string | null>(null)
const selectedId = ref<string | null>(null)
function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
  selectedId.value = id
}
function selectFromRiver(id: string) {
  // a span and its dot share an id; activity bars too — open the row and bring it into view
  const e = events.value.find(x => x.id === id)
  if (!e) return
  // widen the range only when the range is what hides it (not a lane, a search or the Sample toggle)
  if (!matchesHistoryFilter(e, filter.value, now.value) && matchesHistoryFilter(e, { ...filter.value, range: 'all' }, now.value)) {
    keepLimit = true
    filter.value = { ...filter.value, range: 'all' }
  }
  selectedId.value = id
  expandedId.value = id
  tab.value = e.tense
  nextTick(() => {
    ensurePastVisible(id)
  }).then(() => nextTick()).then(() => {
    // instant jump (smooth scrolling is unreliable in throttled tabs); the row flashes to orient the eye
    document.getElementById(`ev-${cssId(id)}`)?.scrollIntoView({ behavior: 'auto', block: 'center' })
  })
}
const cssId = (id: string) => id.replace(/[^\w-]/g, '_')

// Past paging: days are cheap to render, hundreds of rows are not.
const PAGE = 40
const pastLimit = ref(PAGE)
let keepLimit = false   // a river/strip pick widens the range AND needs its row rendered: skip one reset
watch(filter, () => {
  if (keepLimit) { keepLimit = false; return }
  pastLimit.value = PAGE
}, { deep: true })
const pastShown = computed(() => {
  let n = 0
  const out: { day: string; events: HistoryEvent[] }[] = []
  for (const g of secs.value.past) {
    if (n >= pastLimit.value) break
    const take = g.events.slice(0, pastLimit.value - n)
    n += take.length
    out.push({ day: g.day, events: take })
  }
  return out
})
const pastTotal = computed(() => secs.value.past.reduce((s, g) => s + g.events.length, 0))
function ensurePastVisible(id: string) {
  let idx = 0
  for (const g of secs.value.past) for (const e of g.events) { idx++; if (e.id === id && idx > pastLimit.value) pastLimit.value = idx + 5 }
}

const tab = ref('present')
const tabs = computed(() => [
  { id: 'past', label: 'Past', count: pastTotal.value },
  { id: 'present', label: 'Present', count: secs.value.present.length },
  { id: 'future', label: 'Future', count: agenda.value.length },
])

const today = computed(() => historyDay(new Date(now.value).toISOString()))
const yesterday = computed(() => historyDay(new Date(now.value - 86_400_000).toISOString()))
function dayLabel(day: string) {
  if (day === today.value) return 'Today'
  if (day === yesterday.value) return 'Yesterday'
  const d = new Date(`${day}T12:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === new Date(now.value).getFullYear() ? undefined : 'numeric' })
}
/** Realised paper P&L of the user's own closes that day (sample rows and other modes excluded). */
function dayTotal(evs: HistoryEvent[]) {
  const pnl = evs.reduce((s, e) => s + (!e.sample && e.mode === 'paper' && typeof e.pnl_usd === 'number' && ['agent_closed', 'paper_closed', 'trade_sell'].includes(e.kind) ? e.pnl_usd : 0), 0)
  return pnl ? pnl : null
}

const riverLanes = computed<Lane[]>(() => HISTORY_LANES.map(l => l.id).filter(id => filter.value.lanes.has(id)))
const isDemo = computed(() => !!payload.value?.profile?.is_demo)
</script>

<template>
  <div class="historic">
    <UIPageHeader title="History" subtitle="Your calls, trades, agents and opinions — what printed, what's running, what's next.">
      <template #actions>
        <button type="button" class="hd-refresh" :disabled="h.refreshing.value" @click="h.load()">
          {{ h.refreshing.value ? 'Loading…' : 'Refresh' }}
        </button>
      </template>
    </UIPageHeader>

    <UIEmptyState
      v-if="status === 'signed-out'"
      icon="⌖"
      title="Sign in to see your timeline"
      message="Your history lives on your account: calls, agents, paper trades and backtests."
    />

    <!-- Client only: the timeline merges this browser's stores (localStorage) with the server feed,
         so a server render could never match the first client paint. -->
    <ClientOnly v-else>
      <template #fallback>
        <div class="skeleton" aria-busy="true" aria-label="Loading your history"><span v-for="i in 4" :key="i" class="sk-tile" /></div>
      </template>
      <p v-if="status === 'error'" class="hd-banner" data-tone="error" role="alert">
        Server history unavailable ({{ error }}). Showing what this device knows. <button type="button" class="hd-link" @click="h.load()">Retry</button>
      </p>
      <p v-if="h.foreignLocal.value" class="hd-banner" data-tone="warn" role="status">
        {{ h.foreignLocal.value }} paper bet{{ h.foreignLocal.value === 1 ? '' : 's' }} / call{{ h.foreignLocal.value === 1 ? '' : 's' }} saved in this browser belong to another account and are hidden.
      </p>
      <p v-if="payload?.window?.clipped" class="hd-banner" data-tone="warn" role="status">
        Showing up to {{ new Date(payload.window.to).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }}: events further out are not loaded.
      </p>
      <p v-for="f in h.failedSources.value" :key="f.source" class="hd-banner" data-tone="warn" role="status">{{ f.note }}</p>
      <p v-if="sampleCount && payload?.profile?.sample_before" class="hd-banner" data-tone="sample">
        {{ isDemo ? 'Demo account: e' : 'E' }}verything before “{{ isDemo ? 'Demo session started' : 'Joined Strades' }}” is <b>sample history</b>, replayed on real daily closes so you can explore. It is chipped <i>Sample</i> and can be hidden with the Sample filter.
      </p>

      <UICard padding="normal" depth="raised">
        <div v-if="status === 'loading' && !payload" class="skeleton" aria-busy="true" aria-label="Loading your history">
          <span v-for="i in 4" :key="i" class="sk-tile" />
        </div>
        <HistoryYouCard
          v-else
          :profile="payload?.profile ?? null"
          :summary="summary"
          :sample-summary="h.sampleSummary.value"
          :heatmap="payload?.heatmap ?? []"
          :reading="h.readingProfile.value"
          :personal-agent="h.personalAgent.value"
          :followed="h.followed.value"
          :now="now"
          :scored="scored"
          @select="selectFromRiver"
        />
      </UICard>

      <UICard padding="tight" class="river-card">
        <HistoryFilters v-model="filter" :lane-counts="laneCounts" :mode-counts="modeCounts" :sample-count="sampleCount" />
        <HistoryRiver
            v-if="riverLanes.length"
            :events="visible"
            :lanes="riverLanes"
            :range="filter.range"
            :now="now"
            :selected-id="selectedId"
            @select="selectFromRiver"
          />
      </UICard>

      <UICard padding="tight" depth="raised" class="book">
        <UISectionTabs v-model="tab" :tabs="tabs" />

        <section v-if="tab === 'past'" id="panel-past" role="tabpanel" aria-label="Past" class="sec">
          <UIEmptyState
            v-if="status !== 'loading' && !pastTotal"
            size="sm"
            icon="◯"
            title="Nothing in this window"
            message="Widen the range, switch lanes back on, or clear the search."
          />
          <div v-for="g in pastShown" :key="g.day" class="day">
            <h3 class="day-h">
              <span>{{ dayLabel(g.day) }}</span>
              <span class="day-meta">
                {{ g.events.length }} event{{ g.events.length === 1 ? '' : 's' }}
                <b v-if="dayTotal(g.events) !== null" class="num" :data-tone="dayTotal(g.events)! >= 0 ? 'up' : 'down'" title="Realised paper P&L that day">
                  {{ dayTotal(g.events)! >= 0 ? '+' : '−' }}${{ Math.abs(dayTotal(g.events)!).toFixed(2) }}
                </b>
              </span>
            </h3>
            <div class="list">
              <div v-for="e in g.events" :id="`ev-${cssId(e.id)}`" :key="e.id">
                <HistoryEventRow :event="e" :now="now" :expanded="expandedId === e.id" :selected="selectedId === e.id" @toggle="toggle" />
              </div>
            </div>
          </div>
          <button v-if="pastTotal > pastLimit" type="button" class="more" @click="pastLimit += PAGE">
            Show {{ Math.min(PAGE, pastTotal - pastLimit) }} more of {{ pastTotal - pastLimit }}
          </button>
        </section>

        <section v-else-if="tab === 'present'" id="panel-present" role="tabpanel" aria-label="Present" class="sec">
          <HistoryNowPanel
            :events="secs.present"
            :now="now"
            :expanded-id="expandedId"
            :selected-id="selectedId"
            :engine-note="h.engineNote.value"
            :live-state="h.liveState.value"
            @toggle="toggle"
            @load-live="h.loadLiveAgents()"
          />
        </section>

        <section v-else id="panel-future" role="tabpanel" aria-label="Future" class="sec">
          <p v-if="!agenda.length" class="sec-empty">Nothing scheduled. A call you make gets its target date here.</p>
          <div class="list">
            <div v-for="e in agenda" :id="`ev-${cssId(e.id)}`" :key="e.id">
              <HistoryEventRow :event="e" :now="now" :expanded="expandedId === e.id" :selected="selectedId === e.id" @toggle="toggle" />
            </div>
          </div>
        </section>
      </UICard>
    </ClientOnly>
  </div>
</template>

<style scoped>
.historic { display: flex; flex-direction: column; gap: var(--page-gap, 0.6rem); min-width: 0; }
.hd-refresh, .hd-link, .more {
  all: unset; cursor: pointer; font-size: 0.76rem; color: var(--primary-blue);
  padding: 0.3rem 0.6rem; border-radius: var(--radius-md, 8px); border: 1px solid var(--edge-raised); min-height: 24px;
}
.hd-link { border: 0; padding: 0; }
.hd-refresh:disabled { opacity: 0.6; cursor: progress; }
.hd-refresh:focus-visible, .hd-link:focus-visible, .more:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.hd-banner { margin: 0; font-size: 0.76rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-md, 8px); color: var(--text-light-gray); background: rgba(255,255,255,0.03); border: 1px solid var(--edge-raised); }
.hd-banner[data-tone='error'] { border-color: color-mix(in oklch, var(--error-red) 60%, transparent); }
.hd-banner[data-tone='warn'] { border-color: color-mix(in oklch, var(--warning-orange) 50%, transparent); }
.hd-banner[data-tone='sample'] { border-style: dashed; border-color: color-mix(in oklch, var(--warning-orange) 45%, transparent); }

.skeleton { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--card-gap); }
.sk-tile { height: 6.5rem; border-radius: var(--radius-md, 8px); background: rgba(255,255,255,0.04); }
@media (max-width: 560px) { .skeleton { grid-template-columns: 1fr 1fr; } }

.river-card :deep(.hf) { margin-bottom: 0.5rem; }

/* Sticky offsets follow the fixed bars of layouts/default.vue (same tokens, same breakpoints). */
.historic { --hist-top: var(--nav-top-height, 3.25rem); --hist-bottom: var(--nav-bottom-height, 4.1rem); }
@media (min-width: 640px) { .historic { --hist-top: var(--nav-top-height-md, 3.5rem); } }
@media (min-width: 768px) { .historic { --hist-bottom: var(--nav-bottom-height-md, 4.4rem); } }
@media (min-width: 1024px) { .historic { --hist-top: var(--nav-top-height-lg, 3.75rem); } }

.book.pad-tight { padding-top: 0 !important; }
.book :deep(.card-body) { gap: 0.35rem; }
.book :deep(.section-tabs) {
  position: sticky; top: 0; z-index: 2;
  display: flex; gap: 0;
  margin: 0 -0.65rem 0.15rem; padding: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(8, 9, 14, 0.88);
  backdrop-filter: blur(12px);
}
.book :deep(.section-tabs button) {
  flex: 1 1 0; justify-content: center; border-radius: 0; border: 0;
  border-bottom: 2px solid transparent; padding: 0.62rem 0.4rem; background: transparent;
}
.book :deep(.section-tabs button.active) {
  color: #fff;
  background: rgba(255,255,255,0.07);
  border-bottom-color: #fff;
  box-shadow: none;
}
.book :deep(.section-tabs button.active .tab-count) {
  color: #fff;
  background: rgba(255,255,255,0.16);
}
.list { display: flex; flex-direction: column; gap: 0.22rem; }
.sec { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.sec-empty { margin: 0; font-size: 0.76rem; color: var(--text-gray); }

.day { display: flex; flex-direction: column; gap: 0.1rem; }
.day + .day { margin-top: 0.35rem; }
.day-h {
  margin: 0; display: flex; justify-content: space-between; align-items: baseline;
  padding: 0.4rem 0.1rem 0.15rem; font-size: 0.74rem; font-weight: 600; color: var(--text-light-gray);
}
.day-meta { font-size: 0.68rem; color: var(--text-gray); font-weight: 400; display: inline-flex; gap: 0.5rem; }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.num[data-tone='up'] { color: var(--app-color-up); }
.num[data-tone='down'] { color: var(--app-color-down); }
.more { align-self: center; margin-top: 0.4rem; }
</style>
