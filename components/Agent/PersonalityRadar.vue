<script setup lang="ts">
import { computed } from 'vue'
import type { PersonalityMatrix } from '~/stores/agents'

/**
 * Agent/PersonalityRadar.vue — 5-axis spider chart for the avatar personality matrix.
 *
 * Axes: risk, aggression, reaction_speed, patience, contrarian (all 0–1).
 * The avatar's shape literally encodes how it trades: a wide, sharp shape means
 * aggressive + fast; a tall, narrow shape means patient + contrarian.
 *
 * Optional `compare` prop overlays a second matrix (e.g. swarm average) in a
 * ghosted color so users can see divergence at a glance.
 */

const props = defineProps<{
  matrix: PersonalityMatrix
  compare?: PersonalityMatrix | null
  /** Size of the SVG viewport (square) */
  size?: number
  /** Accent color for the primary polygon */
  color?: string
}>()

const SZ = props.size ?? 200
const CENTER = SZ / 2
const RADIUS = SZ / 2 - 18

const AXES: Array<{ key: keyof PersonalityMatrix; label: string }> = [
  { key: 'risk',           label: 'Risk' },
  { key: 'aggression',     label: 'Aggr' },
  { key: 'reaction_speed', label: 'Speed' },
  { key: 'patience',       label: 'Patience' },
  { key: 'contrarian',     label: 'Contrarian' }
]

const angleFor = (i: number) => (Math.PI * 2 * i) / AXES.length - Math.PI / 2

const pointFor = (i: number, v: number) => {
  const a = angleFor(i)
  const r = RADIUS * Math.max(0.02, Math.min(1, v))
  return { x: CENTER + Math.cos(a) * r, y: CENTER + Math.sin(a) * r }
}

const axisEnd = (i: number) => {
  const a = angleFor(i)
  return { x: CENTER + Math.cos(a) * RADIUS, y: CENTER + Math.sin(a) * RADIUS }
}

const labelPos = (i: number) => {
  const a = angleFor(i)
  const r = RADIUS + 12
  return { x: CENTER + Math.cos(a) * r, y: CENTER + Math.sin(a) * r }
}

const polygonPoints = (m: PersonalityMatrix) =>
  AXES.map((ax, i) => {
    const p = pointFor(i, m[ax.key] ?? 0)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')

const primaryPoints = computed(() => polygonPoints(props.matrix))
const comparePoints = computed(() => (props.compare ? polygonPoints(props.compare) : ''))

// Center of gravity of the primary shape — used for the "balance" read-out
const cog = computed(() => {
  const pts = AXES.map((ax, i) => pointFor(i, props.matrix[ax.key] ?? 0))
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return { x, y }
})

const dominantAxis = computed(() => {
  let best = AXES[0]
  let bestVal = -1
  for (const ax of AXES) {
    const v = props.matrix[ax.key] ?? 0
    if (v > bestVal) { bestVal = v; best = ax }
  }
  return { key: best.key, label: best.label, value: bestVal }
})
</script>

<template>
  <div class="radar-wrap" :style="{ width: `${SZ}px` }">
    <svg :viewBox="`0 0 ${SZ} ${SZ}`" class="radar">
      <!-- Concentric grid rings -->
      <circle
        v-for="r in [0.25, 0.5, 0.75, 1]"
        :key="r"
        :cx="CENTER" :cy="CENTER" :r="RADIUS * r"
        class="ring"
      />
      <!-- Axis spokes -->
      <line
        v-for="(ax, i) in AXES"
        :key="ax.key"
        :x1="CENTER" :y1="CENTER"
        :x2="axisEnd(i).x" :y2="axisEnd(i).y"
        class="spoke"
      />
      <!-- Axis labels -->
      <text
        v-for="(ax, i) in AXES"
        :key="`lbl-${ax.key}`"
        :x="labelPos(i).x" :y="labelPos(i).y"
        class="axis-label"
        :class="{ dominant: dominantAxis.key === ax.key }"
        text-anchor="middle"
        dominant-baseline="middle"
      >{{ ax.label }}</text>
      <!-- Comparison polygon (ghost) -->
      <polygon
        v-if="comparePoints"
        :points="comparePoints"
        class="poly compare"
      />
      <!-- Primary polygon -->
      <polygon
        :points="primaryPoints"
        class="poly primary"
        :style="{ fill: color ?? 'var(--primary-blue, #00aaff)' }"
      />
      <!-- Vertices -->
      <circle
        v-for="(ax, i) in AXES"
        :key="`v-${ax.key}`"
        :cx="pointFor(i, matrix[ax.key] ?? 0).x"
        :cy="pointFor(i, matrix[ax.key] ?? 0).y"
        r="3"
        class="vertex"
        :class="{ dominant: dominantAxis.key === ax.key }"
      />
      <!-- Center of gravity marker -->
      <circle :cx="cog.x" :cy="cog.y" r="2" class="cog" />
    </svg>
    <div class="readout">
      <span class="readout-label">Dominant</span>
      <span class="readout-value">{{ dominantAxis.label }} {{ Math.round(dominantAxis.value * 100) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.radar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}
.radar { display: block; }
.ring {
  fill: none;
  stroke: rgba(255,255,255,0.06);
  stroke-width: 1;
}
.spoke {
  stroke: rgba(255,255,255,0.08);
  stroke-width: 1;
}
.axis-label {
  font-size: 0.6rem;
  fill: var(--text-gray, #999);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.axis-label.dominant { fill: var(--primary-blue, #00aaff); font-weight: 700; }
.poly {
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.poly.primary {
  fill-opacity: 0.25;
  stroke: currentColor;
  color: var(--primary-blue, #00aaff);
}
.poly.compare {
  fill: rgba(255,255,255,0.05);
  stroke: rgba(255,255,255,0.3);
  stroke-dasharray: 3 3;
}
.vertex {
  fill: var(--primary-blue, #00aaff);
}
.vertex.dominant {
  fill: #fff;
  stroke: var(--primary-blue, #00aaff);
  stroke-width: 2;
  r: 4;
}
.cog {
  fill: rgba(255,255,255,0.4);
}
.readout {
  display: flex;
  gap: 0.4rem;
  font-size: 0.7rem;
}
.readout-label { color: var(--text-gray); text-transform: uppercase; letter-spacing: 0.05em; }
.readout-value { font-weight: 600; color: var(--primary-blue); }
</style>
