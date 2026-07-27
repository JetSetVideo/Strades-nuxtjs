<script setup lang="ts">
import { computed } from 'vue'
import { useMacroStore } from '~/stores/macro'
import { useAssetsStore } from '~/stores/assets'

const props = defineProps({ size: { type: Number, default: 22 } })
const macro = useMacroStore()
const assetsStore = useAssetsStore()

// Class → color, matching the rest of the app
const CLASS_COLOR: Record<string, string> = {
  cryptocurrency: '#F5A623',
  stock:          '#00ff88',
  fiat_currency:  '#4A90E2',
  commodity:      '#F8E71C',
}

// Fixed per-class noise seeds — deterministic, no re-render jitter
const CLASS_NOISE: Record<string, number[]> = {
  cryptocurrency: [0.34, -0.52, 0.44, -0.20, 0.58, -0.38, 0.25, -0.44, 0.10],
  stock:          [0.10, -0.30, 0.22, -0.12, 0.34, -0.18, 0.15, -0.26, 0.05],
  fiat_currency:  [0.05, -0.12, 0.08, -0.05, 0.12, -0.08, 0.06, -0.10, 0.02],
  commodity:      [0.20, -0.36, 0.28, -0.16, 0.40, -0.24, 0.18, -0.32, 0.08],
}

// Icon tint follows the live average % change of the whole market
const colorRGB = computed(() => {
  const a = macro.avg_change_pct
  if (a >  0.4) return '0,255,136'
  if (a < -0.4) return '255,68,68'
  return '0,180,255'
})
const color = computed(() => `rgb(${colorRGB.value})`)

const pulseDur = computed(() => {
  const v = macro.global_volatility_index
  return Math.max(3.5, 6.0 - v * 3.5)
})

// ── One sparkline per asset class, from the real asset universe ─────────
interface ClassLine {
  key: string
  color: string
  points: string
  opacity: number
  width: number
  tip: [string, string]
  avg: number
}

const N_POINTS = 9

const buildLine = (key: string, avgChangePct: number, avgVelocity: number, share: number): ClassLine => {
  const w   = props.size - 3
  const h   = props.size * 0.62
  const top = props.size * 0.04
  const mid = top + h / 2
  const xs  = w / (N_POINTS - 1)
  const noise = CLASS_NOISE[key] ?? CLASS_NOISE.stock

  // ±3% daily change spans the full band height
  const slopeNorm = Math.max(-1, Math.min(1, avgChangePct / 3))
  const slope     = slopeNorm * h * 0.6
  const minSlope  = Math.max(Math.abs(slope), h * 0.08) * (slopeNorm >= 0 ? 1 : -1)
  const amp       = Math.max(0.18, avgVelocity) * h * 0.22

  const pts: string[] = []
  for (let i = 0; i < N_POINTS; i++) {
    const x = 1.5 + i * xs
    const trend = mid + minSlope / 2 - (minSlope * i / (N_POINTS - 1))
    const y = Math.max(top + 0.5, Math.min(top + h - 0.5, trend + noise[i] * amp))
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const tipParts = pts[pts.length - 1].split(',')
  return {
    key,
    color: CLASS_COLOR[key] ?? '#00aaff',
    points: pts.join(' '),
    opacity: 0.45 + share * 0.55,
    width: 0.8 + share * 0.5,
    tip: [tipParts[0], tipParts[1]],
    avg: avgChangePct
  }
}

const classLines = computed<ClassLine[]>(() => {
  const assets = assetsStore.assets
  if (!assets || assets.length === 0) {
    // Fallback before the store hydrates: one macro-driven line
    return [buildLine('stock', macro.market_sentiment * 2, macro.global_volatility_index, 1)]
  }
  const groups: Record<string, { sum: number; vel: number; n: number }> = {}
  for (const a of assets) {
    const key = (a as { type?: string }).type ?? 'stock'
    const g = groups[key] ?? (groups[key] = { sum: 0, vel: 0, n: 0 })
    g.sum += (a as { change_24h_pct?: number }).change_24h_pct ?? 0
    g.vel += (a as { fluctuation_velocity?: number }).fluctuation_velocity ?? 0.3
    g.n++
  }
  const total = assets.length
  return Object.entries(groups)
    .map(([key, g]) => buildLine(key, g.sum / g.n, g.vel / g.n, g.n / total))
    .sort((a, b) => a.opacity - b.opacity)   // strongest class drawn last (on top)
})

// Live dot rides the strongest (most represented) class line
const leadLine = computed(() => classLines.value[classLines.value.length - 1])

const volLabel = computed(() => `${(macro.global_volatility_index * 100).toFixed(0)}%`)
</script>

<template>
  <div
    class="prices-icon"
    :style="{
      width:         `${size}px`,
      height:        `${size}px`,
      '--clr':       color,
      '--pulse-dur': `${pulseDur}s`,
    }"
  >
    <svg :viewBox="`0 0 ${size} ${size}`" fill="none" overflow="visible">

      <!-- One sparkline per asset class: the whole market at a glance -->
      <template v-for="line in classLines" :key="line.key">
        <!-- Soft glow underlay -->
        <polyline
          :points="line.points"
          :stroke="line.color"
          :stroke-width="line.width * 2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="line.opacity * 0.16"
        />
        <!-- Crisp line -->
        <polyline
          :points="line.points"
          :stroke="line.color"
          :stroke-width="line.width"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="line.opacity"
          fill="none"
        />
      </template>

      <!-- Live dot + pulse ring at the tip of the dominant class -->
      <circle
        v-if="leadLine"
        :cx="leadLine.tip[0]"
        :cy="leadLine.tip[1]"
        r="1.5"
        :fill="leadLine.color"
        class="live-dot"
      />
      <circle
        v-if="leadLine"
        :cx="leadLine.tip[0]"
        :cy="leadLine.tip[1]"
        r="2.8"
        :stroke="leadLine.color"
        stroke-width="0.5"
        fill="none"
        class="live-ring"
      />

      <!-- Global volatility — tiny label at the bottom -->
      <text
        :x="size / 2"
        :y="size - 0.5"
        :fill="color"
        text-anchor="middle"
        dominant-baseline="auto"
        :font-size="size * 0.2"
        font-family="'Poppins', monospace"
        font-weight="600"
        opacity="0.85"
      >{{ volLabel }}</text>

    </svg>
  </div>
</template>

<style scoped>
.prices-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: spark-pulse var(--pulse-dur, 5s) ease-in-out infinite;
}
@keyframes spark-pulse {
  0%, 100% { filter: drop-shadow(0 0 0px   var(--clr)); opacity: 0.84; }
  50%       { filter: drop-shadow(0 0 2px var(--clr));   opacity: 1.0;  }
}

.live-dot {
  animation: dot-blink 2.5s ease-in-out infinite;
}
.live-ring {
  animation: dot-blink 2.5s ease-in-out infinite reverse;
}
@keyframes dot-blink {
  0%, 100% { opacity: 1;    }
  50%       { opacity: 0.15; }
}
</style>
