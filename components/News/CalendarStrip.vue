<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface CalendarEvent {
  id: string
  title: string
  category: 'macro' | 'central_bank' | 'crypto' | 'earnings' | string
  starts_at: string
  impact: 'high' | 'medium' | 'low'
  consensus?: string
  actual?: string | null
}

const events = ref<CalendarEvent[]>([])

onMounted(async () => {
  try {
    const res = await fetch('/data/global/events.json')
    if (res.ok) events.value = await res.json()
  } catch (e) { /* silent */ }
})

const now = Date.now()

const sorted = computed(() => {
  return [...events.value]
    .map(e => ({ ...e, ts: new Date(e.starts_at).getTime() }))
    .sort((a, b) => a.ts - b.ts)
})

const upcoming = computed(() => sorted.value.filter(e => e.ts >= now).slice(0, 6))
const recent = computed(() => sorted.value.filter(e => e.ts < now).slice(-2).reverse())

const formatWhen = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const hourMin = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today · ${hourMin}`
  if (isTomorrow) return `Tomorrow · ${hourMin}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + hourMin
}

const catLabel = (c: string) => ({
  macro: 'MACRO',
  central_bank: 'CB',
  crypto: 'CRYPTO',
  earnings: 'EARN'
}[c] || c.slice(0, 5).toUpperCase())
</script>

<template>
  <section v-if="events.length" class="calendar-strip" aria-label="Upcoming events">
    <header class="cal-head">
      <span class="cal-title">Calendar</span>
      <span class="cal-meta">{{ upcoming.length }} upcoming</span>
    </header>

    <div class="cal-row">
      <article
        v-for="ev in [...recent, ...upcoming]"
        :key="ev.id"
        :class="['ev', `impact-${ev.impact}`, { past: ev.ts < now }]"
      >
        <div class="ev-when">{{ formatWhen(ev.ts) }}</div>
        <div class="ev-body">
          <span class="ev-title">{{ ev.title }}</span>
          <span :class="['ev-cat', `cat-${ev.category}`]">{{ catLabel(ev.category) }}</span>
        </div>
        <div class="ev-numbers">
          <span v-if="ev.consensus" class="ev-consensus">{{ ev.consensus }}</span>
          <span v-if="ev.actual" class="ev-actual">→ {{ ev.actual }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.calendar-strip {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}
.cal-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.4rem;
}
.cal-title {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.cal-meta {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
}

.cal-row {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
  scroll-snap-type: x proximity;
}
.cal-row::-webkit-scrollbar { display: none; }

.ev {
  flex: 0 0 auto;
  width: 180px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.9), rgba(14,14,18,0.9));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  min-width: 0;
}
.ev::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2.5px;
  background: rgba(255,255,255,0.15);
}
.ev.impact-high::before { background: var(--error-red, #ff4d6a); }
.ev.impact-medium::before { background: var(--warning-orange, #ffaa00); }
.ev.past { opacity: 0.55; }

.ev-when {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
}
.ev-body {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
}
.ev-title {
  font-size: 0.78rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: #fff;
}
.ev-cat {
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  flex-shrink: 0;
}
.cat-macro { background: rgba(74,144,226,0.18); color: #4A90E2; }
.cat-central_bank { background: rgba(245,166,35,0.18); color: #F5A623; }
.cat-crypto { background: rgba(0,255,136,0.18); color: var(--primary-green, #00ff88); }
.cat-earnings { background: rgba(126,211,33,0.18); color: #7ED321; }

.ev-numbers {
  display: flex; align-items: baseline;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.65);
}
.ev-actual { color: var(--primary-green, #00ff88); font-weight: 700; }
</style>
