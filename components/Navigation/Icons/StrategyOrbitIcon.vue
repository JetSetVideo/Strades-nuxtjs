<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import type { AgentStatus } from '~/types/agent'

const props = defineProps({ size: { type: Number, default: 22 } })
const agentsStore = useAgentsStore()

// Hydrate lazily so the orbit reflects the real agent roster
onMounted(() => {
  if (!agentsStore.hydrated && !agentsStore.loading) {
    agentsStore.fetchAgents().catch(() => {/* fallback dots below */})
  }
})

// Orbit ring radii
const INNER_R = computed(() => props.size * 0.27)
const OUTER_R = computed(() => props.size * 0.43)

// Dot physical size (px, for positioning math)
const DOT_R = 2.5   // radius = half the 5px dot

// Hub geometry
const HUB_RING = computed(() => props.size * 0.155)

// Activity → color: what each agent is doing right now
const STATUS_COLOR: Record<AgentStatus, string> = {
  live:     '#00ff88',   // trading live
  training: '#00aaff',   // learning
  paused:   '#ffaa00',   // on hold
  idle:     'rgba(255,255,255,0.4)',
  error:    '#ff4444',
}

// Activity → orbit period: busier agents orbit faster
const STATUS_SPEED: Record<AgentStatus, number> = {
  live: 8, training: 12, paused: 22, idle: 26, error: 18,
}

interface OrbitDot {
  id: string
  color: string
  opacity: number
  r: number
  dur: number
  delay: number
  pulsing: boolean
}

const MAX_DOTS = 8

const liveDots = computed<OrbitDot[]>(() => {
  const agents = agentsStore.ids
    .map(id => agentsStore.byId[id])
    .filter(Boolean)
    .slice(0, MAX_DOTS)
  if (!agents.length) return []

  const inner = agents.filter((_, i) => i % 2 === 0)
  const outer = agents.filter((_, i) => i % 2 !== 0)

  const build = (list: typeof agents, r: number) =>
    list.map((a, i) => {
      const status = a.training_state?.status ?? 'idle'
      const dur = STATUS_SPEED[status] ?? 18
      return {
        id: a.id,
        color: STATUS_COLOR[status] ?? STATUS_COLOR.idle,
        opacity: status === 'idle' || status === 'paused' ? 0.45 : 1,
        r,
        dur,
        delay: -(i / Math.max(list.length, 1)) * dur,
        pulsing: status === 'training',
      }
    })

  return [...build(inner, INNER_R.value), ...build(outer, OUTER_R.value)]
})

// Fallback before hydration: one calm dot per activity kind
const fallbackDots = computed<OrbitDot[]>(() => [
  { id: 'f-live',  color: STATUS_COLOR.live,     opacity: 1,    r: INNER_R.value, dur: 16, delay: 0,    pulsing: false },
  { id: 'f-train', color: STATUS_COLOR.training, opacity: 1,    r: OUTER_R.value, dur: 11, delay: -2.8, pulsing: true  },
  { id: 'f-pause', color: STATUS_COLOR.paused,   opacity: 0.45, r: INNER_R.value, dur: 16, delay: -8,   pulsing: false },
  { id: 'f-idle',  color: STATUS_COLOR.idle,     opacity: 0.45, r: OUTER_R.value, dur: 11, delay: -6,   pulsing: false },
])

const activeDots = computed(() => liveDots.value.length ? liveDots.value : fallbackDots.value)

/** Number of agents actually working (live or training) — shown in the hub. */
const runningCount = computed(() => {
  return agentsStore.ids.reduce((n, id) => {
    const s = agentsStore.byId[id]?.training_state?.status
    return n + (s === 'live' || s === 'training' ? 1 : 0)
  }, 0)
})

const hubColor = computed(() => runningCount.value > 0 ? '#00ff88' : 'rgba(255,255,255,0.65)')
</script>

<template>
  <div
    class="orbit-icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- SVG layer: orbit guide rings + hub counter -->
    <svg :viewBox="`0 0 ${size} ${size}`" fill="none" class="hub-svg">
      <!-- Outer dashed guide ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="OUTER_R"
        stroke="rgba(255,255,255,0.16)" stroke-width="0.65"
        stroke-dasharray="2.2 2.8"
      />
      <!-- Inner dashed guide ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="INNER_R"
        stroke="rgba(255,255,255,0.12)" stroke-width="0.55"
        stroke-dasharray="1.6 2.2"
      />
      <!-- Hub ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="HUB_RING"
        fill="rgba(0,0,0,0.45)"
        :stroke="hubColor" stroke-width="0.75"
        :class="{ working: runningCount > 0 }"
        class="hub-ring"
      />
      <!-- Running agent count -->
      <text
        :x="size / 2"
        :y="size / 2 + size * 0.115"
        text-anchor="middle"
        :font-size="size * 0.3"
        font-weight="700"
        font-family="Poppins, sans-serif"
        :fill="hubColor"
      >{{ runningCount }}</text>
    </svg>

    <!--
      Orbiting agent dots — color = what the agent is doing right now
      (green live, blue training, amber paused, grey idle, red error).
    -->
    <span
      v-for="dot in activeDots"
      :key="dot.id"
      class="orbit-dot"
      :class="{ pulsing: dot.pulsing }"
      :style="{
        '--dot-color': dot.color,
        opacity:             dot.opacity,
        top:                 `calc(50% - ${DOT_R}px - ${dot.r}px)`,
        left:                `calc(50% - ${DOT_R}px)`,
        transformOrigin:     `${DOT_R}px ${dot.r + DOT_R}px`,
        animationDuration:   `${dot.dur}s`,
        animationDelay:      `${dot.delay}s`,
      }"
    />
  </div>
</template>

<style scoped>
.orbit-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.hub-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hub-ring.working {
  animation: hub-glow 2.4s ease-in-out infinite;
}
@keyframes hub-glow {
  0%, 100% { filter: drop-shadow(0 0 0px rgba(0,255,136,0)); }
  50%      { filter: drop-shadow(0 0 3px rgba(0,255,136,0.7)); }
}

.orbit-dot {
  position: absolute;
  width:  5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dot-color, #00ff88);
  box-shadow:
    0 0 3px 1px var(--dot-color, #00ff88),
    0 0 7px 2px var(--dot-color, #00ff88);
  animation: orbit-spin linear infinite;
  will-change: transform;
  transition: opacity 0.5s ease;
}
.orbit-dot.pulsing {
  animation: orbit-spin linear infinite, dot-pulse 1.4s ease-in-out infinite;
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 3px 1px var(--dot-color), 0 0 7px 2px var(--dot-color); }
  50%      { box-shadow: 0 0 5px 2px var(--dot-color), 0 0 11px 4px var(--dot-color); }
}
</style>
