<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppearanceStore } from '~/stores/appearance'

const appearance = useAppearanceStore()
appearance.hydrate()

const now = ref(new Date())
let timerId: ReturnType<typeof setInterval>

onMounted(() => { timerId = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timerId))

// Short label shown next to the time — 'GMT' only when the resolved zone actually is UTC.
const zoneLabel = computed(() => {
  if (appearance.timezone === 'UTC') return 'GMT'
  const short = appearance.resolvedTimezone.split('/').pop()?.replace(/_/g, ' ') ?? appearance.resolvedTimezone
  return short.toUpperCase()
})

const timeStr = computed(() => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: appearance.resolvedTimezone,
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(now.value)
  } catch {
    // Unknown/unsupported IANA zone — fall back to UTC rather than showing garbage.
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now.value)
  }
})
</script>

<template>
  <NuxtLink to="/settings" class="gmt-clock" :title="`${appearance.timezoneLabel} — click to change in Settings`">
    <span class="lbl">{{ zoneLabel }}</span>
    <span class="time">{{ timeStr }}</span>
  </NuxtLink>
</template>

<style scoped>
.gmt-clock {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  transition: border-color var(--transition-fast, 0.2s ease),
              background var(--transition-fast, 0.2s ease);
}
.gmt-clock:hover {
  border-color: rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.06);
}
.lbl {
  font-family: var(--font-chrome, var(--font-family-secondary, 'Kanit', sans-serif));
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--primary-green, #00ff88);
}
.time {
  font-family: var(--font-market-data, var(--font-family-secondary, 'Kanit', sans-serif));
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
}
@media (min-width: 768px) {
  .time { font-size: 0.82rem; }
}
</style>
