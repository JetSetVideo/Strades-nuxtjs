<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMacroStore } from '~/stores/macro'
import { useAssetsStore } from '~/stores/assets'
import { buildMarketTree } from '~/utils/marketTree'

const props = defineProps({ size: { type: Number, default: 22 } })
const macro = useMacroStore()
const assetsStore = useAssetsStore()

// The server render has no store data while the client's first paint does, so
// a data-driven SVG produced hydration mismatches (a different point set,
// stroke-width and node count) and the graph visibly jumped the moment the
// page settled. Render a stable placeholder until mounted, then the real
// lines — placeholder is identical on both sides, so nothing mismatches.
const ready = ref(false)

// The nav is on every page; don't depend on /prices having loaded the market.
onMounted(() => {
  ready.value = true
  if (!assetsStore.assets.length && !assetsStore.isRefreshing) assetsStore.initializeStore()
})

// Flat reference line — same geometry on the server and on the client's first
// paint, so hydration matches; the real curve replaces it after mount.
const placeholderPoints = computed(() => {
  const w = props.size - 3
  const y = (props.size * 0.35).toFixed(1)
  const step = w / (N_POINTS - 1)
  return Array.from({ length: N_POINTS }, (_, i) => `${(1.5 + i * step).toFixed(1)},${y}`).join(' ')
})

// Class → color, matching the rest of the app
const CLASS_COLOR: Record<string, string> = {
  cryptocurrency: '#F5A623',
  stock:          '#00ff88',
  fiat_currency:  '#4A90E2',
  commodity:      '#F8E71C',
}

// Icon tint follows the live average % change of the whole market
const colorRGB = computed(() => {
  const a = (assetsStore.liveMarket?.ret ?? 0) * 100
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

// A single clean, monotone line per class, read straight from that class's
// real 24h return. The old version added fixed "noise" jitter and a
// volatility-driven amplitude, so the graph was decorative rather than data —
// it never matched the /prices panel and read as broken.
const buildLine = (key: string, avgChangePct: number, share: number): ClassLine => {
  const w   = props.size - 3
  const h   = props.size * 0.62
  const top = props.size * 0.04
  const mid = top + h / 2
  const xs  = w / (N_POINTS - 1)

  // ±3% daily change spans the full band height
  const slopeNorm = Math.max(-1, Math.min(1, avgChangePct / 3))
  const slope     = slopeNorm * h * 0.55

  const pts: string[] = []
  for (let i = 0; i < N_POINTS; i++) {
    const x = 1.5 + i * xs
    const t = i / (N_POINTS - 1)
    const y = Math.max(top + 0.5, Math.min(top + h - 0.5, mid + slope / 2 - slope * t))
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const tipParts = pts[pts.length - 1].split(',')
  return {
    key,
    color: CLASS_COLOR[key] ?? '#00aaff',
    points: pts.join(' '),
    opacity: 0.5 + share * 0.5,
    width: 0.9 + share * 0.5,
    tip: [tipParts[0], tipParts[1]],
    avg: avgChangePct
  }
}

const classLines = computed<ClassLine[]>(() => {
  const assets = assetsStore.assets
  if (!assets || assets.length === 0) {
    // Fallback before the store hydrates: one macro-driven line
    return [buildLine('stock', macro.market_sentiment * 2, 1)]
  }
  // Same UP equation as the /prices tree, over live markets only.
  const tree = assetsStore.liveMarket
  if (!tree) return [buildLine('stock', 0, 1)]
  return tree.children
    .map(c => buildLine(c.id.replace('class:', ''), c.ret * 100, c.weight))
    .sort((a, b) => a.opacity - b.opacity)   // strongest class drawn last (on top)
})

// Live dot rides the strongest (most represented) class line
const leadLine = computed(() => classLines.value[classLines.value.length - 1])

</script>

<template>
  <div
    class="prices-icon"
    :style="{
      width:         `${size}px`,
      height:        `${size}px`,
      '--clr':       ready ? color : 'rgb(0,180,255)',
      '--pulse-dur': ready ? `${pulseDur}s` : '5s',
    }"
  >
    <svg :viewBox="`0 0 ${size} ${size}`" fill="none" overflow="visible">

      <!-- Placeholder until mounted: byte-identical on server and client, so
           hydration matches and the graph does not jump on settle. -->
      <polyline
        v-if="!ready"
        :points="placeholderPoints"
        :stroke="color"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.5"
        fill="none"
      />

      <!-- One sparkline per asset class: the whole market at a glance -->
      <template v-if="ready">
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
      </template>

      <!-- Live dot + pulse ring at the tip of the dominant class -->
      <circle
        v-if="ready && leadLine"
        :cx="leadLine.tip[0]"
        :cy="leadLine.tip[1]"
        r="1.5"
        :fill="leadLine.color"
        class="live-dot"
      />
      <circle
        v-if="ready && leadLine"
        :cx="leadLine.tip[0]"
        :cy="leadLine.tip[1]"
        r="2.8"
        :stroke="leadLine.color"
        stroke-width="0.5"
        fill="none"
        class="live-ring"
      />

      <!-- No number here: Navigation/Bar.vue prints the market move under the label. -->

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
