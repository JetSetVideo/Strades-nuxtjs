<script setup lang="ts">
/**
 * Upcoming deadlines, in the space the page header used to take.
 * Cards for what is still ahead (calls, bots' next orders, other due dates), a seconds-level
 * countdown for the nearest, and a track record that opens on click.
 * The list is a training signal: on-device avatar delta plus the backend activity batch.
 * Until `ready`, it prints a placeholder so server and client HTML match.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AppNotification } from '~/types/notification'
import {
  DOMAIN_META, formatCountdown, formatCountdownMinutes, upcomingNotices,
  type BotLike, type PredictionLike, type TriggerLike, type UpcomingNotice,
} from '~/utils/notifications'
import { useAgentTracker } from '~/composables/useAgentTracker'

const props = defineProps<{
  items: AppNotification[]
  calls: PredictionLike[]
  bots: BotLike[]
  now: number
  ready: boolean
  /** Armed price alerts. Listed only while price is inside the last 20% of the gap. */
  levels?: TriggerLike[]
  prices?: Record<string, number>
  symbols?: Record<string, string>
}>()

const open = ref(false)
const clock = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  clock.value = Date.now()
  timer = setInterval(() => { clock.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
})

const nowMs = computed(() => (props.ready && clock.value ? clock.value : props.now))

const notices = computed(() => (
  props.ready
    ? upcomingNotices(props.items, props.calls, props.bots, nowMs.value, {
        prices: props.prices, levels: props.levels, symbols: props.symbols,
      })
    : []
))
/** The clock follows the soonest real deadline. A level with no measured pace does not take it. */
const next = computed(() => {
  const dated = notices.value.filter(n => n.paced !== false)
  const list = dated.length ? dated : notices.value
  if (!list.length) return null
  return list.reduce((a, b) => (a.at <= b.at ? a : b))
})
const cards = computed(() => notices.value.slice(0, 4))
const rest = computed(() => Math.max(0, notices.value.length - cards.value.length))

function left(n: UpcomingNotice): number {
  return n.at - nowMs.value
}

const tracker = useAgentTracker()
const signature = computed(() => notices.value.map(n => `${n.id}@${n.at}`).join('|'))

function schedulePayload(openedPanel: boolean) {
  const list = notices.value
  const head = list[0]
  return {
    id: head?.id ?? 'schedule',
    count: list.length,
    next_in_ms: head ? Math.max(0, head.at - nowMs.value) : null,
    domains: [...new Set(list.map(n => n.domain))].slice(0, 8),
    schedule: list.slice(0, 12).map(n => ({
      id: n.id, domain: n.domain, due_at: new Date(n.at).toISOString(),
    })),
    opened_panel: openedPanel,
    page: '/notifications',
    component: 'NotificationUpcoming',
    intent: openedPanel ? 'review_schedule' : 'schedule_seen',
  }
}

watch(signature, (sig) => {
  if (!props.ready || !sig || !import.meta.client) return
  tracker.track('notification_schedule', schedulePayload(false))
})

function toggle() {
  open.value = !open.value
  if (open.value && notices.value.length) tracker.track('notification_schedule', schedulePayload(true))
}

const buttonLabel = computed(() => {
  const n = notices.value.length
  if (!props.ready) return 'Upcoming notifications, loading'
  if (!n) return 'Upcoming notifications, nothing scheduled'
  const mins = Math.max(0, Math.round(left(next.value!) / 60_000))
  return `Upcoming notifications, ${n} scheduled, next in ${mins} minutes. ${open.value ? 'Hide' : 'Show'} the track record.`
})
</script>

<template>
  <section class="up" aria-label="Upcoming notifications">
    <div v-if="!ready" class="up-bar wait" aria-hidden="true">
      <span class="k">Upcoming</span>
      <span class="clock">—</span>
    </div>

    <template v-else>
      <button
        type="button"
        class="up-bar"
        :aria-expanded="open"
        aria-controls="upcoming-track"
        :aria-label="buttonLabel"
        @click="toggle"
      >
        <span class="summary">
          <span class="lead">
            <span class="k">Upcoming</span>
            <span v-if="notices.length" class="count">{{ notices.length }}</span>
          </span>
          <span v-if="next" class="clock" aria-hidden="true">{{ formatCountdown(left(next)) }}</span>
          <span v-else class="empty">Nothing scheduled</span>
          <span v-if="next" class="next" aria-hidden="true">{{ next.title }}</span>
        </span>

        <span
          v-if="cards.length"
          class="cards"
          :class="{ 'has-more': rest > 0 }"
          :style="{ '--n': String(cards.length) }"
          aria-hidden="true"
        >
          <span
            v-for="n in cards"
            :key="n.id"
            class="card"
            :class="{ nearest: n.id === next?.id, nearing: n.urgent }"
            :style="{ '--card-c': DOMAIN_META[n.domain].color }"
          >
            <span class="card-g">{{ DOMAIN_META[n.domain].glyph }}</span>
            <span class="card-t">{{ n.clock || formatCountdownMinutes(left(n)) }}</span>
            <span class="card-n">{{ n.title }}</span>
            <span class="card-d">{{ n.detail }}</span>
          </span>
          <span v-if="rest" class="more">+{{ rest }}</span>
        </span>
      </button>

      <div v-if="open" id="upcoming-track" class="track">
        <div class="track-head">
          <h2 class="track-title">Track record</h2>
          <p v-if="next" class="track-next">
            <span class="track-k">Next</span>
            <time class="track-clock" :datetime="new Date(next.at).toISOString()">{{ formatCountdown(left(next)) }}</time>
            <span class="track-name">{{ next.title }}</span>
          </p>
          <p v-else class="track-none">Nothing scheduled. A call you make, or a bot's next order, shows up here.</p>
        </div>
        <ol v-if="notices.length" class="track-list">
          <li v-for="n in notices" :key="n.id">
            <a class="row" :href="n.href" :style="{ '--card-c': DOMAIN_META[n.domain].color }">
              <time class="row-t" :datetime="new Date(n.at).toISOString()">{{ n.paced === false && n.clock ? n.clock : formatCountdown(left(n)) }}</time>
              <span class="row-g" aria-hidden="true">{{ DOMAIN_META[n.domain].glyph }}</span>
              <span class="row-main">
                <span class="row-title">{{ n.title }}</span>
                <span class="row-detail">{{ n.detail }}</span>
                <span v-if="n.more" class="row-more">{{ n.more }}</span>
              </span>
            </a>
          </li>
        </ol>
      </div>
    </template>
  </section>
</template>

<style scoped>
.up { min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }

.up-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0.45rem 0.6rem;
  text-align: left;
  cursor: pointer;
  color: inherit;
  background: var(--surface-raised, linear-gradient(180deg, rgba(27,29,38,0.92), rgba(16,17,24,0.95)));
  border: 1px solid var(--edge-raised, rgba(255,255,255,0.09));
  border-radius: var(--app-border-radius, 6px);
  font: inherit;
}
.up-bar.wait { cursor: default; }
.up-bar:hover:not(.wait) { border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
.up-bar:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; }

.summary {
  display: flex;
  align-items: center;
  gap: 0.45rem 0.7rem;
  width: 100%;
  min-width: 0;
}
.lead { display: inline-flex; align-items: center; gap: 0.35rem; flex: 0 0 auto; }
.k {
  font-family: var(--font-chrome, inherit);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.count {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.62rem;
  font-weight: 700;
  min-width: 1.1rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: var(--text-white, #fff);
  text-align: center;
}
.clock {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--warning-orange, #ffa500);
  white-space: nowrap;
}
.empty { font-size: 0.72rem; color: rgba(255,255,255,0.45); }
.next {
  flex: 1 1 auto;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255,255,255,0.82);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cards {
  display: grid;
  grid-template-columns: repeat(var(--n, 1), minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
  min-width: 0;
}
.cards.has-more { grid-template-columns: repeat(var(--n, 1), minmax(0, 1fr)) auto; }
.card {
  --card-c: var(--primary-blue, #00aaff);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.3rem;
  align-content: center;
  width: auto;
  min-width: 0;
  min-height: 2.6rem;
  padding: 0.28rem 0.4rem 0.28rem 0.45rem;
  border-radius: 5px;
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-left: 3px solid var(--card-c);
  background: rgba(255,255,255,0.03);
}
.card.nearest { border-color: color-mix(in srgb, var(--warning-orange, #ffa500) 55%, transparent); border-left-color: var(--card-c); }
.card.nearing { box-shadow: inset 0 0 0 1px rgba(255, 204, 128, 0.55); }
.card-g { grid-row: 1 / span 3; align-self: center; color: var(--card-c); font-size: 0.75rem; }
.card-t {
  grid-column: 2;
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.62rem;
  font-weight: 800;
  color: var(--warning-orange, #ffa500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-n, .card-d {
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-n { font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.88); }
.card-d {
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
}
.more {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0 0.35rem;
  font-family: var(--font-market-data, monospace);
  font-size: 0.68rem;
  font-weight: 800;
  color: rgba(255,255,255,0.55);
}

.track {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.55rem 0.65rem 0.65rem;
  background: var(--surface-overlay, rgba(20,22,30,0.98));
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
}
.track-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem 0.8rem; }
.track-title {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.track-next { margin: 0; display: inline-flex; align-items: baseline; gap: 0.45rem; min-width: 0; }
.track-k {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.track-clock {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--warning-orange, #ffa500);
  white-space: nowrap;
}
.track-name { font-size: 0.82rem; font-weight: 700; color: rgba(255,255,255,0.88); }
.track-none { margin: 0; font-size: 0.72rem; color: rgba(255,255,255,0.45); }

.track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: min(60vh, 28rem);
  overflow-y: auto;
}
.row {
  display: grid;
  grid-template-columns: 9.2rem auto minmax(0, 1fr);
  gap: 0.45rem;
  align-items: center;
  min-height: 36px;
  padding: 0.3rem 0.45rem;
  border-radius: 5px;
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-left: 3px solid var(--card-c, var(--primary-blue, #00aaff));
  color: inherit;
  text-decoration: none;
  background: rgba(255,255,255,0.02);
}
.row:hover { border-color: var(--edge-lit, rgba(255,255,255,0.14)); border-left-color: var(--card-c, var(--primary-blue, #00aaff)); }
.row:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }
.row-t {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--warning-orange, #ffa500);
  white-space: nowrap;
}
.row-g { color: var(--card-c, var(--primary-blue, #00aaff)); }
.row-main { display: flex; flex-direction: column; min-width: 0; }
.row-title, .row-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-title { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.88); }
.row-detail { font-size: 0.62rem; color: rgba(255,255,255,0.45); }
.row-more { font-size: 0.62rem; line-height: 1.35; color: rgba(255,255,255,0.62); white-space: normal; }

@media (max-width: 720px) {
  .card { padding: 0.22rem 0.28rem 0.22rem 0.32rem; column-gap: 0.2rem; }
  .card-t { font-size: 0.56rem; }
  .card-n { font-size: 0.6rem; }
  .card-d { letter-spacing: 0.02em; font-size: 0.5rem; }
  .clock { font-size: 0.92rem; }
}
@media (max-width: 420px) {
  .card-g { display: none; }
  .card-t, .card-n, .card-d { grid-column: 1; }
}
@media (max-width: 640px) {
  .row { grid-template-columns: minmax(0, 1fr); }
  .row-t { grid-column: 1 / -1; }
}

@media (prefers-reduced-motion: reduce) {
  .up-bar, .row { transition: none; }
}
</style>
