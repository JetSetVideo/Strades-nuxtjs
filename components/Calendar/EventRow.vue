<script setup lang="ts">
import { computed } from 'vue'
import UIPill from '@/components/UI/Pill.vue'

interface CalendarEvent {
  id: string
  title: string
  category: string
  ts: number
  impact: 'high' | 'medium' | 'low' | string
  consensus?: string
  actual?: string | null
  isPast?: boolean
  isWatched?: boolean
}

const props = defineProps<{ event: CalendarEvent }>()
defineEmits<{ (e: 'toggleWatch', id: string): void }>()

const CATEGORY_LABEL: Record<string, string> = {
  macro: 'MACRO',
  central_bank: 'CB',
  crypto: 'CRYPTO',
  earnings: 'EARN'
}

const categoryLabel = computed(() =>
  CATEGORY_LABEL[props.event.category] ?? props.event.category.slice(0, 5).toUpperCase()
)

const impactTone = computed(() => {
  if (props.event.impact === 'high') return 'danger'
  if (props.event.impact === 'medium') return 'warning'
  return 'neutral'
})

const surprise = computed<'beat' | 'miss' | 'inline' | null>(() => {
  if (!props.event.consensus || !props.event.actual) return null
  const c = parseFloat(props.event.consensus.replace(/[^\d.-]/g, ''))
  const a = parseFloat(props.event.actual.replace(/[^\d.-]/g, ''))
  if (Number.isNaN(c) || Number.isNaN(a)) return null
  if (Math.abs(a - c) < 0.0001) return 'inline'
  return a > c ? 'beat' : 'miss'
})

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <li
    :class="[
      'ev',
      `impact-${event.impact}`,
      { past: event.isPast, watched: event.isWatched }
    ]"
  >
    <div class="ev-time">
      <span class="time">{{ fmtTime(event.ts) }}</span>
      <span :class="['cat', `cat-${event.category}`]">{{ categoryLabel }}</span>
    </div>

    <div class="ev-body">
      <strong class="title">{{ event.title }}</strong>
      <div class="meta">
        <UIPill :tone="impactTone" show-dot>{{ event.impact }} impact</UIPill>
        <span v-if="event.consensus" class="consensus">
          Consensus: <strong>{{ event.consensus }}</strong>
        </span>
        <span v-if="event.actual" :class="['actual', surprise]">
          → {{ event.actual }}
          <span v-if="surprise" class="surprise">{{ surprise }}</span>
        </span>
      </div>
    </div>

    <button
      class="watch-btn"
      :class="{ on: event.isWatched }"
      :title="event.isWatched ? 'Stop watching' : 'Watch this event'"
      @click="$emit('toggleWatch', event.id)"
    >
      {{ event.isWatched ? '◉ Watching' : '◯ Watch' }}
    </button>
  </li>
</template>

<style scoped>
.ev {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.7rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
  position: relative;
  overflow: hidden;
  transition: border-color 0.18s ease;
}
.ev::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: rgba(255,255,255,0.15);
}
.ev.impact-high::before    { background: #ff4d6a; }
.ev.impact-medium::before  { background: #ffaa00; }
.ev.impact-low::before     { background: var(--primary-blue, #00aaff); }
.ev.past    { opacity: 0.55; }
.ev.watched { border-color: rgba(0,170,255,0.4); box-shadow: 0 0 16px rgba(0,170,255,0.08); }

.ev-time {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: flex-start;
  min-width: 0;
}
.time {
  font-size: 0.95rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  font-family: ui-monospace, Menlo, monospace;
}
.cat {
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
.cat-macro        { background: rgba(74,144,226,0.18);  color: #4A90E2; }
.cat-central_bank { background: rgba(245,166,35,0.18);  color: #F5A623; }
.cat-crypto       { background: rgba(0,255,136,0.18);   color: var(--primary-green, #00ff88); }
.cat-earnings     { background: rgba(126,211,33,0.18);  color: #7ED321; }

.ev-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.title {
  font-size: 0.85rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.7);
  font-variant-numeric: tabular-nums;
  min-width: 0;
}
.consensus { color: rgba(255,255,255,0.55); }
.consensus strong { color: rgba(255,255,255,0.8); font-weight: 700; }

.actual {
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.actual.beat   { color: var(--success-green, #00ff88); }
.actual.miss   { color: #ff4d6a; }
.actual.inline { color: rgba(255,255,255,0.55); }
.surprise {
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
  background: currentColor;
  color: #000;
  font-weight: 800;
}
.actual.inline .surprise {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
}

.watch-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.65);
  padding: 0.35rem 0.65rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.watch-btn:hover {
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
}
.watch-btn.on {
  background: rgba(0,170,255,0.1);
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
}

@media (max-width: 640px) {
  .ev { grid-template-columns: 70px minmax(0, 1fr); gap: 0.45rem; }
  .watch-btn { grid-column: 1 / -1; justify-self: end; }
  .time { font-size: 0.82rem; }
  .title {
    white-space: normal;
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }
}
</style>
