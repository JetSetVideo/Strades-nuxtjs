<script setup lang="ts">
import { computed } from 'vue'
import { strategyDesk, type DeskStrategy } from '~/utils/strategyDesk'

const props = defineProps<{
  strategies: DeskStrategy[]
  running?: number
  paused?: number
  stopped?: number
  runFocus?: 'running' | 'paused' | 'stopped' | null
}>()

const emit = defineEmits<{ focus: [bucket: 'running' | 'paused' | 'stopped'] }>()

const desk = computed(() => strategyDesk(props.strategies))
const running = computed(() => props.running ?? desk.value.active)
const paused = computed(() => props.paused ?? desk.value.paused)
const stopped = computed(() => props.stopped ?? desk.value.stopped)

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
  <section class="desk" aria-label="What is running">
    <button type="button" class="run up" :class="{ on: runFocus === 'running' }" :aria-pressed="runFocus === 'running'" aria-label="Show running" @click="emit('focus', 'running')">
      <svg class="mark" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 1.2 L10.4 6 L2.2 10.8 Z" fill="currentColor" /></svg>
      <b>{{ running }}</b>
    </button>
    <button type="button" class="run wait" :class="{ on: runFocus === 'paused' }" :aria-pressed="runFocus === 'paused'" aria-label="Show paused" @click="emit('focus', 'paused')">
      <svg class="mark" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 1.4 H4.6 V10.6 H2.4 Z M7.4 1.4 H9.6 V10.6 H7.4 Z" fill="currentColor" /></svg>
      <b>{{ paused }}</b>
    </button>
    <button type="button" class="run stop" :class="{ on: runFocus === 'stopped' }" :aria-pressed="runFocus === 'stopped'" aria-label="Show stopped" @click="emit('focus', 'stopped')">
      <svg class="mark" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" fill="currentColor" /></svg>
      <b>{{ stopped }}</b>
    </button>
    <span class="stat money"><small>Capital</small><b>{{ money(desk.capital).replace(/^[+−]/, '') }}</b></span>
    <span class="stat money"><small>P&amp;L</small><b :class="desk.pnl >= 0 ? 'up' : 'down'">{{ money(desk.pnl) }}</b></span>
    <span class="stat money"><small>Win rate</small><b>{{ desk.winRate.toFixed(0) }}%</b></span>
    <span v-if="desk.worst" class="extreme down">
      <small>Worst</small>
      <NuxtLink :to="`/strategy/${desk.worst.id}`">{{ desk.worst.name }}</NuxtLink>
      <b>{{ pct(desk.worst.pct) }}</b>
    </span>
    <div class="desk-tools">
      <slot name="tools" />
    </div>
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
.stat.money { align-items: center; text-align: center; justify-content: center; }
.run {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  font: inherit;
}
.run.on { border-color: currentColor; }
.run .mark { width: 15px; height: 15px; flex: none; display: block; }
.run b { font-size: 0.82rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.run.up { color: #3dd68c; }
.run.wait { color: #ffb020; }
.run.stop { color: #ff7b8a; }
.desk-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
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
  .desk-tools { grid-column: 1 / -1; margin-left: 0; justify-content: flex-end; }
}
</style>
