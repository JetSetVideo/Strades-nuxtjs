<script setup lang="ts">
import { computed } from 'vue'
import { strategyDesk, type DeskStrategy } from '~/utils/strategyDesk'

const props = defineProps<{ strategies: DeskStrategy[] }>()

const desk = computed(() => strategyDesk(props.strategies))

function money(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : n > 0 ? '+' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`
  return `${sign}$${Math.round(abs).toLocaleString(APP_LOCALE)}`
}

function pct(n: number) {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`
}
</script>

<template>
  <section v-if="strategies.length" class="desk" aria-label="What is running">
    <span class="stat"><b>{{ desk.active }}</b><small>Running</small></span>
    <span class="stat"><b class="warn">{{ desk.paused }}</b><small>Paused</small></span>
    <span class="stat"><b class="dim">{{ desk.stopped }}</b><small>Stopped</small></span>
    <span class="stat"><b>{{ money(desk.capital).replace(/^[+−]/, '') }}</b><small>Capital</small></span>
    <span class="stat"><b :class="desk.pnl >= 0 ? 'up' : 'down'">{{ money(desk.pnl) }}</b><small>P&amp;L</small></span>
    <span class="stat"><b>{{ desk.winRate.toFixed(0) }}%</b><small>Win rate</small></span>
    <span v-if="desk.best" class="extreme up">
      <small>Best</small>
      <NuxtLink :to="`/strategy/${desk.best.id}`">{{ desk.best.name }}</NuxtLink>
      <b>{{ pct(desk.best.pct) }}</b>
    </span>
    <span v-if="desk.worst" class="extreme down">
      <small>Worst</small>
      <NuxtLink :to="`/strategy/${desk.worst.id}`">{{ desk.worst.name }}</NuxtLink>
      <b>{{ pct(desk.worst.pct) }}</b>
    </span>
  </section>
</template>

<style scoped>
.desk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 6px 8px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: rgba(0,0,0,0.18);
}
.stat, .extreme {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
.stat { flex-direction: column; gap: 0; align-items: flex-start; }
.stat b, .extreme b {
  font-size: 0.82rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--text-white);
}
.stat small, .extreme small {
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-gray);
}
.extreme {
  margin-left: auto;
  gap: 6px;
  min-width: min(100%, 180px);
}
.extreme + .extreme { margin-left: 0; }
.extreme a {
  color: var(--text-white);
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 14rem;
}
.extreme a:hover { color: var(--primary-green); }
.up, .up b { color: var(--app-color-up, var(--success-green)); }
.down, .down b { color: var(--app-color-down, var(--error-red)); }
.warn { color: var(--warning-orange); }
.dim { color: var(--text-gray); }

@media (max-width: 720px) {
  .desk { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 8px; }
  .extreme { grid-column: 1 / -1; margin-left: 0; }
}
</style>
