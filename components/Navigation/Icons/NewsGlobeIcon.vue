<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({ size: { type: Number, default: 22 } })

// ── GMT clock (updates every 10 s) ────────────────────────────────────────
const utcH = ref(0)
const utcM = ref(0)
let timerId: ReturnType<typeof setInterval>

function tick() {
  const n = new Date()
  utcH.value = n.getUTCHours()
  utcM.value = n.getUTCMinutes()
}
onMounted(() => { tick(); timerId = setInterval(tick, 10_000) })
onUnmounted(() => clearInterval(timerId))

// 24-hour clock: 0 h = top, 12 h = bottom. −90° so 0 h points straight up.
const hourAngle = computed(() => ((utcH.value + utcM.value / 60) / 24) * 360 - 90)

const CX = 12; const CY = 12; const R = 9.5

// Full-diameter GMT bar: both endpoints on the circle edge
const bar = computed(() => {
  const rad = (hourAngle.value * Math.PI) / 180
  return {
    x1: (CX - R * Math.cos(rad)).toFixed(2),
    y1: (CY - R * Math.sin(rad)).toFixed(2),
    x2: (CX + R * Math.cos(rad)).toFixed(2),
    y2: (CY + R * Math.sin(rad)).toFixed(2),
  }
})

// ── Continent paths ────────────────────────────────────────────────────────
//
// The world is represented as a 20-px-wide Mercator strip (matching the globe
// diameter so one full translation = one "revolution").
// Paths are drawn TWICE side-by-side (x and x+20) so the CSS translateX loop
// is seamless.  The continent group is clipped to the globe circle.
//
// All coordinates are in the same 24×24 space as the SVG viewBox.
// y range: 2.5 … 21.5  (inside the r=9.5 globe)
//
// ─── First copy (x: 0 … 20) ───────────────────────────────────────────────
// North America
const NA  = 'M 2,7 C 3,5 5,4 7,5 C 8,6 8,8 7,10 C 6,12 5,13 4,12 C 2,11 1,9 2,7 Z'
// South America
const SA  = 'M 3,13 C 5,12 6,13 6,16 C 6,18 5,20 4,19 C 3,18 2,16 3,13 Z'
// Greenland (small)
const GR  = 'M 5,3 C 6,2 8,3 7,5 C 6,5 5,4 5,3 Z'
// Europe (compact)
const EU  = 'M 9,5 C 10,4 12,4 12,6 C 12,7 11,8 10,8 C 9,7 8,6 9,5 Z'
// Africa (tall)
const AF  = 'M 9,8 C 11,7 13,8 13,11 C 13,15 12,18 11,19 C 10,18 9,15 9,11 Z'
// Asia (wide)
const AS  = 'M 12,5 C 15,3 18,3 20,4 C 22,6 22,8 20,10 C 18,11 16,11 14,10 C 12,9 11,7 12,5 Z'
// Australia
const AU  = 'M 16,14 C 18,13 21,13 21,15 C 21,17 19,17 17,16 C 16,16 15,15 16,14 Z'

// ─── Second copy (x + 20) for seamless tiling ─────────────────────────────
function shiftX(path: string, dx: number): string {
  // Replace every numeric pair "x,y" with "(x+dx),y"
  return path.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
    `${(parseFloat(x) + dx).toFixed(1)},${y}`
  )
}
const DX = 20   // one world-width = 20 px (= globe diameter)

const continentPaths = [
  { d: NA }, { d: SA }, { d: GR }, { d: EU }, { d: AF }, { d: AS }, { d: AU },
  // Second copy, shifted right
  { d: shiftX(NA, DX) }, { d: shiftX(SA, DX) }, { d: shiftX(GR, DX) },
  { d: shiftX(EU, DX) }, { d: shiftX(AF, DX) }, { d: shiftX(AS, DX) },
  { d: shiftX(AU, DX) },
]

// Unique IDs per size instance
const clipId = computed(() => `globe-clip-${props.size}`)
</script>

<template>
  <div class="globe-wrap" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" fill="none" class="globe-svg">
      <defs>
        <!-- Clip to the globe circle -->
        <clipPath :id="clipId">
          <circle :cx="CX" :cy="CY" :r="R"/>
        </clipPath>
      </defs>

      <!-- Ocean fill -->
      <circle :cx="CX" :cy="CY" :r="R"
              fill="currentColor" opacity="0.06"
              stroke="currentColor" stroke-width="1.1"/>

      <!-- ── Rotating continent layer ─────────────────────────────────── -->
      <!--
        Two nested groups:
          • Outer g — carries the clipPath (stays fixed at globe boundary)
          • Inner g — carries the CSS translateX animation (slides continents)
        This keeps the clip circle stationary while the land mass scrolls inside.
      -->
      <g :clip-path="`url(#${clipId})`">
        <g class="continents">
          <!-- Continent silhouettes (two copies for seamless loop) -->
          <path
            v-for="(c, i) in continentPaths"
            :key="i"
            :d="c.d"
            fill="currentColor"
            opacity="0.30"
          />
        </g>
      </g>

      <!-- Globe outline (on top of continents) -->
      <circle :cx="CX" :cy="CY" :r="R"
              fill="none"
              stroke="currentColor" stroke-width="1.1"/>

      <!-- Equator guide -->
      <line x1="2.5" y1="12" x2="21.5" y2="12"
            stroke="currentColor" stroke-width="0.45" opacity="0.3"/>

      <!-- ── GMT hour bar — full diameter, red, fixed (not rotating) ─── -->
      <!-- Glow -->
      <line
        :x1="bar.x1" :y1="bar.y1" :x2="bar.x2" :y2="bar.y2"
        stroke="#ff4444" stroke-width="3" stroke-linecap="round"
        opacity="0.22"
      />
      <!-- Crisp bar -->
      <line
        :x1="bar.x1" :y1="bar.y1" :x2="bar.x2" :y2="bar.y2"
        stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"
        class="hour-bar"
      />

      <!-- Center pivot -->
      <circle :cx="CX" :cy="CY" r="1.3" fill="#ff4444"/>
    </svg>
  </div>
</template>

<style scoped>
.globe-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}
.globe-svg {
  width: 100%;
  height: 100%;
}

/* Continents scroll horizontally — one revolution = 20 px translateX */
.continents {
  animation: globe-spin 28s linear infinite;
}
@keyframes globe-spin {
  from { transform: translateX(0px);   }
  to   { transform: translateX(-20px); }
}

.hour-bar {
  transition: all 30s linear;
  filter: drop-shadow(0 0 2px rgba(255,68,68,0.75));
}
</style>
