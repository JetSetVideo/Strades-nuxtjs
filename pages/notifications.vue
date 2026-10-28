<script setup lang="ts">
/**
 * /notifications — one feed for everything that happened to you, your calls, bots and agents.
 * Data: stores/notifications.ts (server feed + what this device can prove), utils/notifications.ts.
 * SSR: the store fills on the client only; the server renders the shell + skeleton, and every
 * time-dependent text waits for `ready` (mounted) and uses `store.now`.
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { AppNotification, NotificationDomain } from '~/types/notification'
import type { BotLike, CalendarItem, MarketEventLike, PredictionLike, TriggerLike } from '~/utils/notifications'
import {
  botCalendarItems, countByDomain, eventCalendarItems, filterNotifications, groupByDay,
  notificationCalendarItems, predictionCalendarItems,
} from '~/utils/notifications'
import { useNotificationsStore } from '~/stores/notifications'
import { usePredictionsStore } from '~/stores/predictions'
import { useBotsStore } from '~/stores/bots'
import { useAssetsStore } from '~/stores/assets'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { indexLivePrices } from '~/utils/priceApproach'
import { publicAssetUrl } from '~/composables/useLocalJson'

import UIEmptyState from '@/components/UI/EmptyState.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import NotificationRow from '@/components/Notification/Row.vue'
import NotificationFilters from '@/components/Notification/Filters.vue'
import NotificationCalendar from '@/components/Notification/Calendar.vue'
import NotificationDigest from '@/components/Notification/Digest.vue'
import NotificationUpcoming from '@/components/Notification/Upcoming.vue'

definePageMeta({ title: 'Notifications', layout: 'default' })

const RENDER_STEP = 200

const store = useNotificationsStore()
const predictions = usePredictionsStore()
const bots = useBotsStore()
const assetsStore = useAssetsStore()
const annotations = useAssetAnnotationsStore()
const live = computed(() => indexLivePrices(assetsStore.assets ?? []))
const armedLevels = computed(() => Object.values(annotations.triggersById ?? {}).filter(t => t.status === 'armed') as TriggerLike[])

const ready = ref(false)
const view = ref<string>('feed') // 'feed' | 'calendar' (UISectionTabs emits a string)
const events = ref<MarketEventLike[]>([])
const limit = ref(RENDER_STEP)
const announce = ref('')

const filter = reactive<{ domains: NotificationDomain[]; unopenedOnly: boolean; day: string | null; q: string }>({
  domains: [], unopenedOnly: false, day: null, q: '',
})

/** Rows the user marked unseen during this visit. A reload marks them seen again. */
const heldUnread = new Set<string>()

function markSeen(list: AppNotification[]) {
  const keys = list.filter(n => !n.state.read_at && !heldUnread.has(n.key)).map(n => n.key)
  if (keys.length) store.markRead(keys, false)
}

onMounted(async () => {
  store.init()
  // Seen as soon as the page has them, before the list paints, so the badge clears
  // and a second visit already shows every row as read.
  markSeen(store.items)
  ready.value = true
  try {
    // Static file URL: plain fetch typing, not Nitro's route-typed overload (as in useLocalJson).
    const list = await ($fetch as (u: string) => Promise<unknown>)(publicAssetUrl('/data/global/events.json'))
    events.value = Array.isArray(list) ? (list as MarketEventLike[]) : []
  } catch { events.value = [] }
})

// ── Feed ──────────────────────────────────────────────────────────────────
const items = computed<AppNotification[]>(() => (ready.value ? store.items : []))
const now = computed(() => store.now)
const total = computed(() => items.value.length)
const counts = computed(() => countByDomain(items.value))

const filtered = computed(() => filterNotifications(items.value, {
  domains: filter.domains, unopenedOnly: filter.unopenedOnly, day: filter.day, q: filter.q,
}))
const visible = computed(() => filtered.value.slice(0, limit.value))
const groups = computed(() => groupByDay(visible.value, now.value))
const hasFilter = computed(() => !!(filter.domains.length || filter.unopenedOnly || filter.day || filter.q.trim()))
const canShowMore = computed(() => filtered.value.length > limit.value || !!store.nextBefore)

const loadingShell = computed(() => !ready.value || (store.loading && !items.value.length))

// Reset the render cap when the filter changes (primitives only — never a deep watch on the feed).
watch(() => `${filter.domains.join(',')}|${filter.unopenedOnly}|${filter.day}|${filter.q}`, () => { limit.value = RENDER_STEP })

// Rows that arrive while the page is open (server refresh, load more) are seen too.
watch(
  () => (ready.value ? store.items.map(n => `${n.key}:${n.state.read_at ? 1 : 0}`).join('|') : ''),
  () => { if (ready.value) markSeen(store.items) },
)

function showMore() {
  if (filtered.value.length > limit.value) limit.value += RENDER_STEP
  else void store.loadMore()
}
function clearFilters() {
  filter.domains = []
  filter.unopenedOnly = false
  filter.day = null
  filter.q = ''
}

// ── Calendar ──────────────────────────────────────────────────────────────
const calendarItems = computed<CalendarItem[]>(() => {
  if (!ready.value) return []
  const mine = predictions.predictions as unknown as PredictionLike[]
  return [
    ...predictionCalendarItems(mine),
    // calls made on another device are only known through their server rows
    ...notificationCalendarItems(items.value, new Set(mine.map(p => p.id))),
    ...botCalendarItems(bots.list as any, now.value),
    ...eventCalendarItems(events.value),
  ]
})
const callsPending = computed(() => calendarItems.value.filter(i => i.kind === 'call_due' && i.tone === 'pending').length)

const tabs = computed<TabItem[]>(() => [
  { id: 'feed', label: 'Feed', count: ready.value ? total.value : null },
  { id: 'calendar', label: 'Calendar', count: ready.value ? callsPending.value : null },
])

// ── Actions ───────────────────────────────────────────────────────────────
async function onOpen(n: AppNotification) {
  const rank = visible.value.findIndex(x => x.key === n.key)
  const loc = store.open(n, { surface: view.value === 'calendar' ? 'calendar' : 'page', rank: rank >= 0 ? rank : undefined, listLen: visible.value.length })
  await navigateTo(loc)
}
function onToggleRead(n: AppNotification) {
  if (n.state.read_at) {
    heldUnread.add(n.key)
    store.markUnread(n.key)
    announce.value = 'Marked as unread'
  } else {
    heldUnread.delete(n.key)
    store.markRead([n.key], false)
    announce.value = 'Marked as read'
  }
}
async function onArchive(n: AppNotification) {
  const list = visible.value
  const i = list.findIndex(x => x.key === n.key)
  const next = list[i + 1] ?? list[i - 1]
  store.archive(n.key)
  announce.value = `Archived: ${n.title}`
  await nextTick()
  // Keep keyboard users in place: focus the neighbouring row's link.
  if (next && typeof document !== 'undefined') {
    const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(next.key) : next.key
    document.querySelector<HTMLElement>(`[data-nkey="${sel}"] .nr-link`)?.focus()
  }
}
</script>

<template>
  <div class="notif-page">
    <h1 class="sr-only">Notifications</h1>
    <NotificationUpcoming
      :items="items"
      :calls="(predictions.predictions as unknown as PredictionLike[])"
      :bots="(bots.list as unknown as BotLike[])"
      :levels="armedLevels"
      :prices="live.prices"
      :symbols="live.symbols"
      :now="now"
      :ready="ready"
    />

    <NotificationDigest :items="items" :now="now" :ready="ready" />

    <p v-if="store.error" class="np-error" role="status">{{ store.error }}</p>

    <UISectionTabs v-model="view" :tabs="tabs" />

    <section v-if="view === 'calendar'" class="np-cal">
      <ClientOnly>
        <NotificationCalendar v-model="filter.day" :items="calendarItems" :now="now" />
        <template #fallback>
          <div class="cal-fallback" aria-hidden="true">
            <AppSkeletonLoader height="100%" />
          </div>
        </template>
      </ClientOnly>
      <p v-if="!filter.day" class="np-hint">Pick a day to see its notifications below.</p>
    </section>

    <section v-if="view === 'feed' || filter.day" class="np-feed" aria-label="Notifications">
      <NotificationFilters
        v-model:domains="filter.domains"
        v-model:unopenedOnly="filter.unopenedOnly"
        v-model:q="filter.q"
        v-model:day="filter.day"
        :counts="counts"
      />

      <div v-if="loadingShell" class="np-loading" aria-busy="true" aria-label="Loading notifications">
        <AppSkeletonLoader height="64px" />
        <AppSkeletonLoader height="64px" />
        <AppSkeletonLoader height="64px" />
      </div>

      <UIEmptyState
        v-else-if="total === 0"
        icon="◔"
        title="No notifications yet"
        message="Calls you record, your bots and agents, price alerts and paper trades will report here."
      />

      <UIEmptyState
        v-else-if="filtered.length === 0"
        icon="◯"
        title="Nothing for this filter"
        :message="hasFilter ? 'Try another domain, day or search.' : 'Nothing to show.'"
        size="sm"
      >
        <template v-if="hasFilter" #action>
          <button type="button" class="np-btn" @click="clearFilters">Clear filters</button>
        </template>
      </UIEmptyState>

      <template v-else>
        <div v-for="g in groups" :key="g.day" class="day-group">
          <h2 class="day-head">
            <span class="day-label">{{ g.label }}</span>
            <span class="day-sub">
              {{ g.items.length }} item{{ g.items.length === 1 ? '' : 's' }}<template v-if="g.items.some(n => !n.state.read_at)">
                · {{ g.items.filter(n => !n.state.read_at).length }} new</template>
            </span>
          </h2>
          <ul class="np-list">
            <NotificationRow
              v-for="n in g.items"
              :key="n.key"
              :n="n"
              :now="now"
              @open="onOpen"
              @toggle-read="onToggleRead"
              @archive="onArchive"
            />
          </ul>
        </div>

        <div v-if="canShowMore" class="np-more">
          <span class="np-count">Showing {{ visible.length }} of {{ filtered.length }}{{ store.nextBefore ? '+' : '' }}</span>
          <button type="button" class="np-btn" :disabled="store.loading" @click="showMore">
            {{ store.loading ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>
    </section>

    <p class="sr-only" aria-live="polite">{{ announce }}</p>
  </div>
</template>

<style scoped>
.notif-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  min-width: 0;
}

.np-btn {
  min-height: 28px;
  padding: 0 0.7rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--edge-raised, rgba(255,255,255,0.09));
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.8);
  font-family: var(--font-chrome, inherit);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.np-btn:hover:not(:disabled) { color: var(--primary-blue, #00aaff); border-color: var(--primary-blue, #00aaff); }
.np-btn:disabled { opacity: 0.4; cursor: default; }
.np-btn:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }

.np-error { margin: 0; font-size: 0.65rem; color: var(--text-gray, #888888); }
.np-hint { margin: 0.3rem 0 0; font-size: 0.65rem; color: rgba(255,255,255,0.45); }

.np-cal { min-width: 0; }
.cal-fallback { height: 440px; }
.cal-fallback :deep(.skeleton-loader) { margin: 0; }

.np-feed { display: flex; flex-direction: column; gap: var(--page-gap, 0.6rem); min-width: 0; }
.np-loading { display: flex; flex-direction: column; gap: 0.4rem; }
.np-loading :deep(.skeleton-loader) { margin-bottom: 0; }

.day-group { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.day-head {
  position: sticky;
  top: var(--nav-top-height, 3.25rem);
  z-index: 2;
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  background: var(--surface-overlay, linear-gradient(180deg, rgba(35,38,50,0.97), rgba(20,22,30,0.98)));
  border-left: 2px solid var(--primary-blue, #00aaff);
  border-radius: 3px;
  font-size: inherit;
}
.day-label { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; color: rgba(255,255,255,0.85); }
.day-sub {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.np-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }

.np-more { display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.3rem 0; }
.np-count { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.4); font-variant-numeric: tabular-nums; }

.sr-only {
  position: absolute !important;
  width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .np-btn { transition: none; }
  .np-loading :deep(.skeleton-loader), .cal-fallback :deep(.skeleton-loader) { animation: none; }
}
</style>
