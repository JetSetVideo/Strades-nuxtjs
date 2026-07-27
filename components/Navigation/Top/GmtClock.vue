<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const timeStr = ref('--:--:--')
let timerId: ReturnType<typeof setInterval>

function tick() {
  const n = new Date()
  const hh = String(n.getUTCHours()).padStart(2, '0')
  const mm = String(n.getUTCMinutes()).padStart(2, '0')
  const ss = String(n.getUTCSeconds()).padStart(2, '0')
  timeStr.value = `${hh}:${mm}:${ss}`
}

onMounted(() => { tick(); timerId = setInterval(tick, 1000) })
onUnmounted(() => clearInterval(timerId))
</script>

<template>
  <div class="gmt-clock" title="Current UTC / GMT time">
    <span class="lbl">GMT</span>
    <span class="time">{{ timeStr }}</span>
  </div>
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
  cursor: default;
  user-select: none;
  transition: border-color var(--transition-fast, 0.2s ease),
              background var(--transition-fast, 0.2s ease);
}
.gmt-clock:hover {
  border-color: rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.06);
}
.lbl {
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--primary-green, #00ff88);
}
.time {
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
}
@media (min-width: 768px) {
  .time { font-size: 0.82rem; }
}
</style>
