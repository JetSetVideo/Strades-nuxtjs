<script setup lang="ts">
/**
 * Lab tab icon — a small 3-D globe; every trading agent is a glowing dot.
 *   colour    ← run state (green running, orange waiting, red error)
 *   placement ← agentSphere(): latitude = risk, longitude = patience/contrarian
 *   size      ← activity (√trades)
 * Pure CSS 3-D, zero per-frame JS: each dot is translated once, one container
 * spins (rotateY) and every dot face counter-rotates so it keeps facing the
 * viewer. A translucent, non-spinning body disc at the centre plane dims the
 * dots on the far side. Presentational only: all data comes in props.
 */
import { computed } from 'vue'
import type { SpherePoint } from '~/utils/navIcons'
import { ACTIVE_ZOOM, SPHERE_PERSPECTIVE, globeRadius, rimColor, rosterKey, sphereDots } from '~/utils/navSphere'

const props = withDefaults(defineProps<{
  size?: number
  active?: boolean
  ready?: boolean
  points?: SpherePoint[]
  running?: number
  waiting?: number
}>(), { size: 40, active: false, ready: false, points: () => [], running: 0, waiting: 0 })

/** Depends on `size` only, so the SSR placeholder is byte-identical on server and client. */
const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  '--r': `${globeRadius(props.size)}px`,
  '--persp': `${Math.round(props.size * SPHERE_PERSPECTIVE)}px`,
  '--zoom': String(ACTIVE_ZOOM),
}))

const live = computed(() => props.ready && props.points.length > 0)
const dots = computed(() => (live.value ? sphereDots(props.points, props.size) : []))
/** New/removed agents re-create the spinning subtree so every animation restarts in sync. */
const spinKey = computed(() => (live.value ? rosterKey(dots.value) : 'placeholder'))
const rim = computed(() => (live.value ? rimColor(props.running, props.waiting) : 'rgba(255, 255, 255, 0.35)'))
</script>

<template>
  <span
    class="nav-icon lab-sphere"
    :class="{ 'is-live': live, 'is-active': active }"
    :style="boxStyle"
    aria-hidden="true"
  >
    <span class="scene">
      <span class="world">
        <!-- Globe body: faces the viewer, never spins; the far half of the globe sits behind it. -->
        <span class="body" :style="{ '--rim': rim }" />
        <span :key="spinKey" class="spin">
            <span class="ring meridian" />
            <span class="ring equator" />
            <span
              v-for="dot in dots"
              :key="dot.id"
              class="dot"
              :style="{ transform: dot.transform }"
            >
              <span class="face">
                <span
                  class="core"
                  :class="dot.state"
                  :style="{
                    '--d': `${dot.d}px`,
                    '--c': dot.color,
                    '--breathe-delay': `${dot.breatheDelay}s`,
                  }"
                />
              </span>
            </span>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.lab-sphere {
  --tilt: 16deg;
  --spin-s: 18s;
  position: relative;
  display: inline-block;
  flex: none;
  vertical-align: middle;
}

/* Camera + clip. Clipping lives here: overflow/contain on a preserve-3d element would flatten it.
   The clip box is 15% larger than the icon so rim-dot glows survive the active zoom. */
.scene {
  position: absolute;
  inset: -15%;
  perspective: var(--persp);
  contain: layout paint;
}

.world {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform: rotateX(calc(-1 * var(--tilt))) scale3d(1, 1, 1);
  transition: transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.is-active .world {
  transform: rotateX(calc(-1 * var(--tilt))) scale3d(var(--zoom), var(--zoom), var(--zoom));
}

.spin {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  will-change: transform;
}
/* The globe turns only on the selected tab. Elsewhere the animation is PAUSED (not removed),
   so it holds its angle — no snap back on deselect, and no compositor work on every page. */
.is-live .spin { animation: lab-spin var(--spin-s) linear infinite paused; }
.is-live.is-active .spin { animation-play-state: running; }

/* Translucent sphere body; counter-tilted so it stays a circle facing the viewer. */
.body {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(2 * var(--r));
  height: calc(2 * var(--r));
  margin: calc(-1 * var(--r)) 0 0 calc(-1 * var(--r));
  border-radius: 50%;
  transform: rotateX(var(--tilt));
  background: radial-gradient(circle at 36% 30%, rgba(70, 92, 120, 0.55), rgba(14, 20, 32, 0.58) 62%, rgba(4, 6, 12, 0.62) 100%);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.14);
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.14),
    0 0 3px 0 color-mix(in srgb, var(--rim) 35%, transparent);
}

/* Wireframe: three meridians + the equator, spinning with the dots so the rotation reads as 3-D. */
.ring {
  position: absolute;
  left: 50%;
  top: 50%;
  box-sizing: border-box;
  width: calc(2 * var(--r));
  height: calc(2 * var(--r));
  margin: calc(-1 * var(--r)) 0 0 calc(-1 * var(--r));
  border: 0.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}
.meridian { transform: rotateY(0deg); }
.equator {
  transform: rotateX(90deg);
  border-color: rgba(255, 255, 255, 0.18);
}

/* Agent dot: a 0×0 anchor at the globe centre, translated once to its place. */
.dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}
/* Billboard: undoes the spin (.face) and the world tilt (.core) so a dot always faces the viewer. */
.face {
  position: absolute;
  left: 0;
  top: 0;
  transform-style: preserve-3d;
}
.is-live .face { animation: lab-unspin var(--spin-s) linear infinite paused; }
.is-live.is-active .face { animation-play-state: running; }

.core {
  position: absolute;
  /* Centred on the anchor with margins (not a translate) so the billboard rotations pivot on the dot centre. */
  left: 0;
  top: 0;
  width: var(--d);
  height: var(--d);
  margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2);
  border-radius: 50%;
  background: var(--c);
  transform: rotateX(var(--tilt));
  /* Static glow — box-shadow is never animated. */
  box-shadow: 0 0 2px 0.5px var(--c);
  box-shadow: 0 0 1.5px 0.5px var(--c), 0 0 4px 0.5px color-mix(in srgb, var(--c) 55%, transparent);
}
.core.waiting {
  opacity: 0.85;
  box-shadow: 0 0 1.5px 0.5px var(--c);
}
.core.error {
  box-shadow: 0 0 2px 0.75px var(--c);
  box-shadow: 0 0 1.5px 0.75px var(--c), 0 0 5px 1px color-mix(in srgb, var(--c) 65%, transparent);
}

/* Running + active: a slow breathing halo (opacity only). */
.core.running::after {
  content: '';
  position: absolute;
  inset: -60%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--c) 0%, transparent 70%);
  background: radial-gradient(circle, color-mix(in srgb, var(--c) 70%, transparent) 0%, transparent 70%);
  opacity: 0;
}
.is-live.is-active .core.running::after {
  animation: lab-breathe 2.6s ease-in-out infinite;
  animation-delay: var(--breathe-delay, 0s);
}

@keyframes lab-spin {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}
@keyframes lab-unspin {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(-360deg); }
}
@keyframes lab-breathe {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
  .world { transition: none; }
  .is-live .spin,
  .is-live .face,
  .is-live.is-active .core.running::after { animation: none; }
}
</style>
