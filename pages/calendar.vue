<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import CalendarEventRow from '@/components/Calendar/EventRow.vue'

definePageMeta({ title: 'Calendar', description: 'Upcoming economic events.', layout: 'default' })

interface CalendarEvent {
  id: string
  title: string
  category: 'macro' | 'central_bank' | 'crypto' | 'earnings' | string
  starts_at: string
  impact: 'high' | 'medium' | 'low'
  consensus?: string
  actual?: string | null
}

const STORAGE_KEY = 'strades.calendar.watched'

const events = ref<CalendarEvent[]>([])
const loading = ref(true)
const watchedIds = ref<Set<string>>(new Set())
const filter = ref<'all' | 'upcoming' | 'today' | 'past' | 'high'>('upcoming')

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch('/data/global/events.json')
    if (res.ok) events.value = await res.json()
  } catch { /* silent */ }
  loading.value = false

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) watchedIds.value = new Set(JSON.parse(stored))
    } catch { /* ignore */ }
  }
})

function toggleWatch(id: string) {
  const next = new Set(watchedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  watchedIds.value = next
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  }
}

const now = Date.now()
const todayKey = new Date(now).toDateString()

const enriched = computed(() =>
  events.value.map(e => {
    const ts = new Date(e.starts_at).getTime()
    return {
      ...e,
      ts,
      isToday: new Date(ts).toDateString() === todayKey,
      isPast: ts < now,
      isWatched: watchedIds.value.has(e.id)
    }
  }).sort((a, b) => a.ts - b.ts)
)

const filtered = computed(() => {
  switch (filter.value) {
    case 'today':    return enriched.value.filter(e => e.isToday)
    case 'upcoming': return enriched.value.filter(e => !e.isPast)
    case 'past':     return enriched.value.filter(e => e.isPast)
    case 'high':     return enriched.value.filter(e => e.impact === 'high')
    default:         return enriched.value
  }
})

function dayLabel(d: Date) {
  const todayD = new Date()
  const tomorrow = new Date(); tomorrow.setDate(todayD.getDate() + 1)
  const yest = new Date(); yest.setDate(todayD.getDate() - 1)
  if (d.toDateString() === todayD.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

const grouped = computed(() => {
  const groups: { date: string; label: string; items: typeof filtered.value }[] = []
  for (const ev of filtered.value) {
    const d = new Date(ev.ts)
    const dayKey = d.toDateString()
    const last = groups[groups.length - 1]
    if (last && last.date === dayKey) last.items.push(ev)
    else groups.push({ date: dayKey, label: dayLabel(d), items: [ev] })
  }
  return groups
})

const tabs = computed<TabItem[]>(() => [
  { id: 'upcoming', label: 'Upcoming',    count: enriched.value.filter(e => !e.isPast).length },
  { id: 'today',    label: 'Today',       count: enriched.value.filter(e => e.isToday).length },
  { id: 'high',     label: 'High impact', count: enriched.value.filter(e => e.impact === 'high').length },
  { id: 'past',     label: 'Past',        count: enriched.value.filter(e => e.isPast).length },
  { id: 'all',      label: 'All',         count: enriched.value.length }
])

const stats = computed(() => ({
  watching: watchedIds.value.size,
  thisWeek: enriched.value.filter(e => {
    const diff = (e.ts - now) / 86_400_000
    return diff >= 0 && diff <= 7
  }).length,
  high: enriched.value.filter(e => e.impact === 'high').length,
  total: enriched.value.length
}))
</script>

<template>
  <div class="cal-page">
    <UIPageHeader title="Calendar" subtitle="Economic releases, central-bank decisions, earnings, network events.">
      <template #actions>
        <UIPill v-if="stats.watching" tone="info">{{ stats.watching }} watching</UIPill>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="This week"     :value="stats.thisWeek" size="md" />
      <UIStat label="High impact"   :value="stats.high"     tone="negative" size="md" />
      <UIStat label="Watching"      :value="stats.watching" tone="positive" size="md" />
      <UIStat label="Total tracked" :value="stats.total"    size="md" />
    </UIMetricRow>

    <UISectionTabs v-model="filter" :tabs="tabs" />

    <template v-if="loading">
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="80px" />
    </template>

    <UIEmptyState
      v-else-if="filtered.length === 0"
      icon="◯"
      title="Nothing scheduled"
      message="No events match this filter."
    />

    <template v-else>
      <div v-for="group in grouped" :key="group.date" class="day-group">
        <header class="day-head">
          <span class="day-label">{{ group.label }}</span>
          <span class="day-sub">{{ group.items.length }} event{{ group.items.length === 1 ? '' : 's' }}</span>
        </header>

        <ul class="event-list">
          <CalendarEventRow
            v-for="ev in group.items"
            :key="ev.id"
            :event="ev"
            @toggle-watch="toggleWatch"
          />
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cal-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.day-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border-left: 2px solid var(--primary-blue, #00aaff);
  border-radius: 3px;
}
.day-label {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.85);
}
.day-sub {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
</style>
