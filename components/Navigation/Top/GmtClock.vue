<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppearanceStore } from '~/stores/appearance'

const appearance = useAppearanceStore()
appearance.hydrate()
const { playHover, playClick } = useNavSound()

const now = ref(new Date())
let timerId: ReturnType<typeof setInterval>
// Server and client clocks differ by the render latency; show the time only after mount.
const mounted = ref(false)

onMounted(() => { mounted.value = true; now.value = new Date(); timerId = setInterval(() => { now.value = new Date() }, 1000) })
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
  <NuxtLink
    to="/calendar"
    class="gmt-clock"
    title="Trading Calendar"
    @mouseenter="playHover"
    @click="playClick"
  >
    <span class="lbl">{{ zoneLabel }}</span>
    <span class="time">{{ mounted ? timeStr : '--:--:--' }}</span>
    <svg class="cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  </NuxtLink>
</template>

<style scoped>
.gmt-clock {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: var(--nav-icon-btn-size, 2rem);
  padding: 0 0.55rem 0 0.6rem;
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  flex-shrink: 0;
  transition: border-color var(--transition-fast, 0.2s ease),
              background var(--transition-fast, 0.2s ease),
              color var(--transition-fast, 0.2s ease);
}
.gmt-clock:hover {
  border-color: rgba(255, 165, 0, 0.45);
  background: rgba(255, 165, 0, 0.08);
}
.gmt-clock:active { transform: scale(0.98); transition-duration: 0.08s; }
.router-link-active.gmt-clock {
  border-color: rgba(255, 165, 0, 0.5);
  background: rgba(255, 165, 0, 0.1);
}
.lbl {
  font-family: var(--font-chrome, var(--font-family-secondary, 'Kanit', sans-serif));
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--warning-orange, #ffa500);
}
.time {
  font-family: var(--font-market-data, var(--font-family-secondary, 'Kanit', sans-serif));
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
}
.cal {
  width: 1.05rem;
  height: 1.05rem;
  color: rgba(255,255,255,0.55);
  flex-shrink: 0;
}
@media (min-width: 768px) {
  .time { font-size: 0.82rem; }
}
</style>
