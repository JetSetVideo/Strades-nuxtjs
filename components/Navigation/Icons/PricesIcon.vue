<script setup lang="ts">
/**
 * Prices tab — today's live market as a sparkline over a fixed 00:00→24:00 GMT
 * axis, so the line also tells the time of day. Data: useNavPanels() prices
 * (intradayCurve of assets.liveMarket.history). Presentational only.
 */
import { computed, useId } from 'vue'
import { sparkline, type IntradayCurve } from '~/utils/navIcons'

const props = withDefaults(defineProps<{
  size?: number
  active?: boolean
  ready?: boolean
  curve?: IntradayCurve | null
  tone?: 'up' | 'down' | 'muted' | 'accent' | 'wait'
}>(), { size: 40, active: false, ready: false, curve: null, tone: 'muted' })

const uid = useId()
// Plot box inside the 24×24 viewBox: zoomed in (taller, tighter) when the tab is selected.
const box = computed(() => (props.active ? { x: 0.5, y: 2, w: 23, h: 18 } : { x: 1.5, y: 3.5, w: 21, h: 15.5 }))

const geo = computed(() => {
  if (!props.ready || !props.curve || props.curve.t.length < 2) return null
  // Selected: a tighter value span magnifies the day's moves.
  return sparkline(props.curve, box.value.w, box.value.h, 0.8, props.active ? 0.35 : 0.6)
})

const color = computed(() =>
  props.tone === 'up' ? 'var(--app-color-up, #00ff88)'
  : props.tone === 'down' ? 'var(--app-color-down, #ff4444)'
  : 'rgb(0,180,255)')

// 06:00 / 12:00 / 18:00 GMT ticks on the time axis
const ticks = computed(() => [6, 12, 18].map(hr => box.value.x + 0.8 + (hr / 24) * (box.value.w - 1.6)))
</script>

<template>
  <span class="nav-icon prices-icon" :class="{ active, [tone]: true }" aria-hidden="true" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" :width="size" :height="size" fill="none">
      <defs>
        <linearGradient :id="`${uid}-fill`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.3" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <line v-for="(x, i) in ticks" :key="i" :x1="x" :x2="x" :y1="box.y + box.h" :y2="box.y + box.h + 1.4" class="tick" />

      <!-- Placeholder (SSR + first paint, or no live quotes): a flat dashed day -->
      <line
        v-if="!geo"
        :x1="box.x + 0.8" :x2="box.x + box.w - 0.8" :y1="box.y + box.h / 2" :y2="box.y + box.h / 2"
        class="flat"
      />

      <g v-else :transform="`translate(${box.x} ${box.y})`" class="plot">
        <line x1="0" :x2="box.w" :y1="geo.zeroY" :y2="geo.zeroY" class="zero" />
        <path :d="geo.area" :fill="`url(#${uid}-fill)`" />
        <path :d="geo.line" :stroke="color" class="line" />
        <circle :cx="geo.end[0]" :cy="geo.end[1]" r="1.35" :fill="color" />
        <circle :cx="geo.end[0]" :cy="geo.end[1]" r="1.35" :stroke="color" class="ping" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.nav-icon { display: inline-flex; align-items: center; justify-content: center; }
svg { display: block; overflow: visible; }

.tick { stroke: rgba(255,255,255,0.22); stroke-width: 0.5; }
.flat { stroke: rgba(255,255,255,0.35); stroke-width: 1; stroke-dasharray: 1.4 1.6; stroke-linecap: round; }
.zero { stroke: rgba(255,255,255,0.22); stroke-width: 0.45; stroke-dasharray: 0.8 1.2; }
.line { stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; fill: none; }

/* The "now" ping runs only on the selected tab: transform + opacity, composited. */
.ping { fill: none; stroke-width: 0.5; opacity: 0; transform-box: fill-box; transform-origin: center; }
.active .ping { animation: ping 2.2s ease-out infinite; }
@keyframes ping {
  0%   { transform: scale(1);   opacity: 0.9; }
  100% { transform: scale(3.2); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .active .ping { animation: none; }
}
</style>
