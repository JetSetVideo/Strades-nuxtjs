<script setup lang="ts">
/**
 * News tab — the Earth as a dot-matrix globe, turned so the meridian where it
 * is noon right now faces the viewer. The red vertical bar is that line: the
 * central meridian, i.e. the sun's longitude at `now` (12:00 GMT → Greenwich).
 *
 * Land: Natural Earth 110m sampled on a 4° grid (utils/navGlobeLand.ts),
 * projected by utils/navGlobe.ts into three depth-banded dot paths.
 * Rotation is not animated: the Earth turns 0.25°/min and the parent's 30-s
 * clock (`now`) re-renders; geometry only recomputes when the view longitude
 * moves by a quarter degree. Presentational only — no store, no timers.
 */
import { computed, useId } from 'vue'
import { subsolarLongitude } from '~/utils/navIcons'
import { globeDots, landPoints, parallelPath } from '~/utils/navGlobe'

const props = withDefaults(defineProps<{
  size?: number
  active?: boolean
  ready?: boolean
  /** epoch ms; the parent's shared clock */
  now?: number
  /** unread news items */
  unread?: number
}>(), { size: 40, active: false, ready: false, now: 0, unread: 0 })

const uid = useId()

const C = 12
const R = 9.5
/** Selected tab: the globe zooms to this radius (pure transform, geometry unchanged). */
const R_ACTIVE = 10.8
const ZOOM = R_ACTIVE / R
/** View tilt: look down 18° so the globe reads as 3-D. */
const TILT = 18

// Static graticule: parallels don't depend on the view longitude.
const GRATICULE = [0, 40, -40].map(lat => parallelPath(lat, TILT, R, C, C)).join('')
// Central meridian (the noon line) from the visible north pole down to the limb.
const POLE_Y = Math.round((C - Math.cos((TILT * Math.PI) / 180) * R) * 100) / 100
const LIMB_Y = C + R
// Unread ping sits on the rim at 1:30 o'clock.
const PING = { x: Math.round((C + R * Math.SQRT1_2) * 100) / 100, y: Math.round((C - R * Math.SQRT1_2) * 100) / 100 }

/** Noon longitude, snapped to 0.25° so a re-render inside the same quarter degree is free. */
const lon0 = computed(() => Math.round(subsolarLongitude(new Date(props.now)) * 4) / 4)
const dots = computed(() => (props.ready ? globeDots(landPoints(), lon0.value, TILT, R, C, C) : null))
const hasUnread = computed(() => props.ready && props.unread > 0)
</script>

<template>
  <span
    class="nav-icon news-globe"
    :class="{ active, unread: hasUnread, small: size < 40 }"
    aria-hidden="true"
    :style="{ width: `${size}px`, height: `${size}px`, '--zoom': ZOOM }"
  >
    <svg viewBox="0 0 24 24" :width="size" :height="size" fill="none">
      <defs>
        <radialGradient :id="`${uid}-ocean`" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0%" stop-color="#00aaff" stop-opacity="0.30" />
          <stop offset="70%" stop-color="#0077cc" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#003a66" stop-opacity="0.22" />
        </radialGradient>
      </defs>

      <g class="globe">
        <circle :cx="C" :cy="C" :r="R" :fill="`url(#${uid}-ocean)`" />

        <template v-if="dots">
          <path :d="GRATICULE" class="graticule" />
          <path :d="dots.rim" class="land rim" />
          <path :d="dots.mid" class="land mid" />
          <path :d="dots.front" class="land front" />
        </template>

        <circle :cx="C" :cy="C" :r="R" class="outline" />

        <!-- Noon line: the meridian where it is 12:00 now (GMT time line on Earth) -->
        <line :x1="C" :x2="C" :y1="POLE_Y" :y2="LIMB_Y" class="noon-glow" />
        <line :x1="C" :x2="C" :y1="POLE_Y" :y2="LIMB_Y" class="noon" />
        <circle :cx="C" :cy="POLE_Y" r="0.7" class="noon-cap" />
        <circle :cx="C" :cy="LIMB_Y" r="0.7" class="noon-cap" />

        <template v-if="hasUnread">
          <circle :cx="PING.x" :cy="PING.y" r="1.5" class="ping" />
          <circle :cx="PING.x" :cy="PING.y" r="1.5" class="unread-dot" />
        </template>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.nav-icon { display: inline-flex; align-items: center; justify-content: center; }
svg { display: block; overflow: visible; }

/* Zoom in when selected: scale around the centre, geometry is not recomputed. */
.globe {
  transform-box: view-box;
  transform-origin: 12px 12px;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.active .globe { transform: scale(var(--zoom, 1.137)); }

.outline { stroke: rgba(255, 255, 255, 0.55); stroke-width: 0.8; }
.active .outline { stroke: rgba(255, 255, 255, 0.8); }
.graticule { stroke: rgba(255, 255, 255, 0.1); stroke-width: 0.35; }

/* One <path> per depth band; round caps turn each `h0` into a dot. */
.land { stroke: #dff1ff; stroke-linecap: round; transition: opacity 0.3s ease; }
.front { stroke-width: 0.7; opacity: 0.9; }
.mid   { stroke-width: 0.56; opacity: 0.6; }
.rim   { stroke-width: 0.42; opacity: 0.3; }
/* At phone sizes the dots grow so the continents read as shapes, not texture. */
.small .front { stroke-width: 0.95; opacity: 0.95; }
.small .mid   { stroke-width: 0.8;  opacity: 0.7; }
.small .rim   { stroke-width: 0.6;  opacity: 0.38; }
.active .front { opacity: 1; }
.active .mid   { opacity: 0.72; }
.active .rim   { opacity: 0.42; }

.noon, .noon-glow { stroke: var(--app-color-down, #ff4444); stroke-linecap: round; }
.noon { stroke-width: 0.85; }
.noon-glow { stroke-width: 2.1; opacity: 0.2; }
.noon-cap { fill: var(--app-color-down, #ff4444); }

/* Unread news: an accent dot on the rim with a slow ping (transform + opacity only). */
.unread-dot { fill: var(--primary-blue, #00aaff); stroke: #0a0a0a; stroke-width: 0.5; }
.ping {
  fill: none;
  stroke: var(--primary-blue, #00aaff);
  stroke-width: 0.5;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}
/* The unread dot is always shown; it pings only on the selected tab. */
.active .ping { animation: news-ping 2.4s ease-out infinite; }
@keyframes news-ping {
  0%   { transform: scale(1);   opacity: 0.85; }
  100% { transform: scale(2.4); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .globe { transition: none; }
  .ping { animation: none; }
}
</style>
