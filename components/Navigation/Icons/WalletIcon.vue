<template>
  <div class="wallet-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="wallet-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" :stop-color="dominantColor" stop-opacity="0.5" />
          <stop offset="100%" :stop-color="dominantColor" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Glow halo (only when wallet has data) -->
      <circle v-if="totalAlloc > 0" cx="12" cy="12" r="11" fill="url(#wallet-glow)" />

      <!-- Pie segments -->
      <g transform="translate(12, 12)">
        <path
          v-for="seg in segments"
          :key="seg.key"
          :d="seg.path"
          :fill="seg.color"
          :opacity="seg.dominant ? 1 : 0.85"
          :stroke="seg.dominant ? '#fff' : 'rgba(0,0,0,0.35)'"
          :stroke-width="seg.dominant ? 0.6 : 0.4"
          stroke-linejoin="round"
          class="seg"
        />
      </g>

      <!-- Hollow center for "donut" look -->
      <circle cx="12" cy="12" r="2.25" fill="var(--bg-primary, #0e0e0f)" />
      <!-- Tiny dollar tick mark -->
      <text x="12" y="14" text-anchor="middle" font-size="3.5" font-weight="700" fill="rgba(255,255,255,0.85)" font-family="Poppins, sans-serif">$</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAllocationStore } from '~/stores/allocation'
import { useMacroStore } from '~/stores/macro'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 24 })

const allocation = useAllocationStore()
const macro = useMacroStore()

const colorMap: Record<string, string> = {
  fiat: '#4A90E2',
  crypto: '#F5A623',
  stocks: '#7ED321',
  commodities: '#F8E71C'
}

const totalAlloc = computed(() => {
  const a = allocation.allocationPie
  return a.fiat + a.crypto + a.stocks + a.commodities
})

const dominantColor = computed(() => colorMap[macro.dominant_asset_class] ?? '#4A90E2')

const segments = computed(() => {
  const a = allocation.allocationPie
  const total = totalAlloc.value || 100
  const order: Array<keyof typeof a> = ['fiat', 'crypto', 'stocks', 'commodities']
  const r = 9
  let cumulative = -Math.PI / 2 // start at 12 o'clock
  return order
    .filter(k => a[k] > 0.01)
    .map(k => {
      const slice = (a[k] / total) * Math.PI * 2
      const x1 = Math.cos(cumulative) * r
      const y1 = Math.sin(cumulative) * r
      const x2 = Math.cos(cumulative + slice) * r
      const y2 = Math.sin(cumulative + slice) * r
      const large = slice > Math.PI ? 1 : 0
      const path = `M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
      cumulative += slice
      return {
        key: k,
        path,
        color: colorMap[k],
        dominant: macro.dominant_asset_class === k
      }
    })
})
</script>

<style scoped>
.wallet-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: transform var(--app-animation-speed, 0.3s) ease;
}
.wallet-icon:hover { transform: rotate(-6deg) scale(1.06); }

.seg {
  transition: opacity 0.4s ease, stroke 0.4s ease;
  transform-origin: center;
}
</style>
