<script setup lang="ts">
import type { CalendarDay } from '@/stores/users'

const props = defineProps<{
  calendar: CalendarDay[]
  title?: string
  showUpcoming?: boolean
}>()

const days = computed(() =>
  props.calendar.filter(d =>
    props.showUpcoming ? d.is_upcoming : !d.is_upcoming
  )
)

/** PnL color: saturation proportional to magnitude (Design.md) */
const pnlColor = (pct: number): string => {
  if (pct === 0) return 'var(--text-gray)'
  const sat = Math.min(1, Math.abs(pct) / 20)
  return pct > 0
    ? `oklch(${0.55 + sat * 0.2} ${0.1 + sat * 0.25} 145)`
    : `oklch(${0.45 + sat * 0.15} ${0.1 + sat * 0.2} 25)`
}

const pnlBg = (pct: number): string => {
  if (pct === 0) return 'rgba(255,255,255,0.03)'
  const a = Math.min(0.18, Math.abs(pct) / 80)
  return pct > 0 ? `rgba(0,255,136,${a})` : `rgba(255,68,68,${a})`
}

const formatEur = (v: number): string => {
  const abs = Math.abs(v)
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}K€` : `${abs}€`
  return v >= 0 ? `+${s}` : `-${s}`
}

const formatPct = (v: number): string => {
  if (v === 0) return '0%'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}
</script>

<template>
  <section class="calendar-section">
    <h3 class="section-title">{{ title ?? (showUpcoming ? 'Up Coming' : 'Past Trades') }}</h3>

    <div class="calendar-scroll">
      <div
        v-for="d in days"
        :key="d.day"
        class="day-col"
        :style="{ background: pnlBg(d.pnl_pct) }"
        :class="{ 'is-upcoming': d.is_upcoming }"
      >
        <!-- Day number -->
        <div class="day-num" :class="{ 'upcoming-day': d.is_upcoming }">{{ d.day }}</div>

        <!-- P&L in € -->
        <div
          class="day-pnl-eur"
          :style="{ color: pnlColor(d.pnl_pct) }"
        >{{ formatEur(d.pnl_eur) }}</div>

        <!-- P&L % -->
        <div
          class="day-pnl-pct"
          :style="{ color: pnlColor(d.pnl_pct) }"
        >{{ formatPct(d.pnl_pct) }}</div>

        <!-- Trade count (won / total) -->
        <div class="day-trades">
          {{ d.trades_total === 0 ? '—' : `${d.trades_total} trades (${d.trades_won})` }}
        </div>

        <!-- Mini bar showing win ratio -->
        <div v-if="d.trades_total > 0" class="win-bar-wrap">
          <div
            class="win-bar"
            :style="{ width: `${(d.trades_won / d.trades_total) * 100}%` }"
          />
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="days.length === 0" class="empty-state">
        No {{ showUpcoming ? 'upcoming' : 'past' }} trades in this period.
      </div>
    </div>
  </section>
</template>

<style scoped>
.calendar-section {
  margin-bottom: var(--spacing-md);
}

.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-gray);
  margin: 0 0 var(--spacing-sm);
  padding-left: 2px;
}

.calendar-scroll {
  display: flex;
  gap: var(--spacing-sm);
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: var(--spacing-xs);
}

.calendar-scroll::-webkit-scrollbar { display: none; }

.day-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding: var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  gap: 4px;
  flex-shrink: 0;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.day-col.is-upcoming {
  border-style: dashed;
  border-color: rgba(255,255,255,0.2);
}

.day-num {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-white);
}

.day-num.upcoming-day {
  color: var(--text-gray);
}

.day-pnl-eur {
  font-size: 0.75rem;
  font-weight: 700;
}

.day-pnl-pct {
  font-size: 0.7rem;
  font-weight: 600;
}

.day-trades {
  font-size: 0.62rem;
  color: var(--text-gray);
  text-align: center;
  line-height: 1.2;
}

.win-bar-wrap {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.1);
  border-radius: 999px;
  overflow: hidden;
}

.win-bar {
  height: 100%;
  background: var(--success-green);
  border-radius: 999px;
  transition: width 0.5s ease;
}

.empty-state {
  color: var(--text-gray);
  font-size: 0.8rem;
  padding: var(--spacing-md);
}
</style>
