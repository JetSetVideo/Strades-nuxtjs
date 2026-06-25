<template>
  <div class="news-globe-wrap" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="globe-bg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#1a1a2e" />
          <stop offset="100%" stop-color="#0a0a16" />
        </radialGradient>
        <radialGradient id="globe-pulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--primary-green, #00ff88)" stop-opacity="0.6" />
          <stop offset="100%" stop-color="var(--primary-green, #00ff88)" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- News-pulse halo (frequency from macro.newsPulseHz) -->
      <circle cx="12" cy="12" r="11" fill="url(#globe-pulse)" class="pulse" :style="{ animationDuration: pulseDuration }" />

      <!-- Globe body -->
      <circle cx="12" cy="12" r="9.5" fill="url(#globe-bg)" stroke="rgba(255,255,255,0.35)" stroke-width="0.75" />

      <!-- Rotating meridian/parallel layer (driven by news coords) -->
      <g class="rotor" :style="{ transform: rotorTransform }">
        <!-- Equator -->
        <ellipse cx="12" cy="12" rx="9.5" ry="3" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.5" />
        <!-- Prime meridian -->
        <ellipse cx="12" cy="12" rx="3" ry="9.5" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.5" />
        <!-- Continent-ish blob -->
        <path d="M 9 8 Q 11 7 13 9 T 16 11 Q 15 13 13 13 T 10 12 Q 8 10 9 8 Z" fill="rgba(0,255,136,0.6)" />
        <path d="M 7 14 Q 9 14 10 15 T 13 16 Q 12 17 10 17 T 8 16 Z" fill="rgba(0,170,255,0.45)" />
      </g>

      <!-- Hotspot marker — pulses red where the latest news pointer is -->
      <circle :cx="hotspot.x" :cy="hotspot.y" r="1.4" fill="var(--error-red, #ff4444)" class="hotspot" />

      <!-- Count badge -->
      <g v-if="count > 0" class="count-badge">
        <circle cx="19" cy="5" r="3.5" fill="var(--primary-green, #00ff88)" />
        <text x="19" y="6.5" text-anchor="middle" font-size="3.5" font-weight="700" fill="#000" font-family="Poppins, sans-serif">
          {{ countLabel }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePrefetchStore } from '~/stores/prefetch'
import { useMacroStore } from '~/stores/macro'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 24 })

const prefetch = usePrefetchStore()
const macro = useMacroStore()

const rotorTransform = computed(() => {
  const { lat, lng } = prefetch.latestNewsCoords
  // Reverse mapping to feel like the globe is "looking at" the geo origin
  return `rotate(${(-lat * 0.6).toFixed(1)}deg) skewX(${(lng * 0.15).toFixed(1)}deg)`
})

const hotspot = computed(() => {
  // Project lat/lng to a small offset inside the circle
  const { lat, lng } = prefetch.latestNewsCoords
  const x = 12 + (lng / 180) * 6
  const y = 12 - (lat / 90) * 6
  return { x: x.toFixed(2), y: y.toFixed(2) }
})

const pulseDuration = computed(() => {
  // Higher news_pulse_count = faster pulse
  const hz = macro.newsPulseHz || 0.1
  return `${(2.2 - hz * 1.6).toFixed(2)}s`
})

const count = computed(() => macro.news_pulse_count)
const countLabel = computed(() => count.value > 9 ? '9+' : String(count.value))
</script>

<style scoped>
.news-globe-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}
svg { overflow: visible; }

.rotor {
  transform-origin: 12px 12px;
  transition: transform 1.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.pulse {
  transform-origin: 12px 12px;
  animation: globe-pulse infinite ease-in-out;
}
@keyframes globe-pulse {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}

.hotspot {
  transform-origin: 12px 12px;
  animation: hotspot-pulse 1.4s infinite ease-out;
}
@keyframes hotspot-pulse {
  0% { r: 1; opacity: 1; }
  100% { r: 3; opacity: 0; }
}

.count-badge text { user-select: none; }
</style>
