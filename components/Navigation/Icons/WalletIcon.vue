<template>
  <div class="wallet-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="wallet-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" :stop-color="dominantColor" stop-opacity="0.5" />
          <stop offset="100%" :stop-color="dominantColor" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Glow halo (only when the wallet has data) -->
      <circle v-if="segments.length" cx="12" cy="12" r="11" fill="url(#wallet-glow)" />

      <!-- One slice per asset in the main wallet -->
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
        >
          <title>{{ seg.label }}</title>
        </path>
      </g>

      <!-- Hollow center for the "donut" look -->
      <circle cx="12" cy="12" r="2.6" fill="var(--bg-primary, #0e0e0f)" />
      <text x="12" y="13.6" text-anchor="middle" font-size="4" font-weight="700" fill="rgba(255,255,255,0.85)" font-family="Poppins, sans-serif">$</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWalletStore } from '~/stores/wallet'
import { useAllocationStore } from '~/stores/allocation'
import { useMacroStore } from '~/stores/macro'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 24 })

const walletStore = useWalletStore()
const allocation = useAllocationStore()
const macro = useMacroStore()
const { getUserId } = useCurrentUser()

// Hydrate lazily on the client so the donut reflects the real main wallet
onMounted(() => {
  if (!walletStore.hydrated && !walletStore.loading) {
    walletStore.fetchWallets().catch(() => {/* falls back to allocation pie */})
  }
})

// Known asset colors + fallback palette for anything else
const SYMBOL_COLOR: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', ADA: '#0033ad',
  DOT: '#e6007a', LINK: '#2a5ada', USD: '#4A90E2', EUR: '#3b6fb5',
  GOLD: '#F8E71C', XAU: '#F8E71C', OIL: '#8B6F47',
}
const PALETTE = ['#F5A623', '#00aaff', '#00ff88', '#9945ff', '#F8E71C', '#ff6b9d', '#4A90E2', '#7ED321']

const CLASS_COLOR: Record<string, string> = {
  fiat: '#4A90E2',
  crypto: '#F5A623',
  stocks: '#7ED321',
  commodities: '#F8E71C'
}

/** Shares of the current main wallet: symbol + value share (0..1). */
const shares = computed<Array<{ key: string; label: string; share: number; color: string }>>(() => {
  const wallet = walletStore.getDefaultWallet(getUserId()) ?? walletStore.wallets[0]
  if (wallet && wallet.assets.length > 0) {
    const total = wallet.assets.reduce((s, a) => s + a.current_value, 0) || 1
    const sorted = [...wallet.assets].sort((a, b) => b.current_value - a.current_value)
    const top = sorted.slice(0, 6)
    const rest = sorted.slice(6).reduce((s, a) => s + a.current_value, 0)
    const out = top.map((a, i) => ({
      key: a.symbol,
      label: `${a.symbol} ${Math.round((a.current_value / total) * 100)}%`,
      share: a.current_value / total,
      color: SYMBOL_COLOR[a.symbol.toUpperCase()] ?? PALETTE[i % PALETTE.length]
    }))
    if (rest > 0.001 * total) {
      out.push({ key: 'other', label: `Other ${Math.round((rest / total) * 100)}%`, share: rest / total, color: 'rgba(255,255,255,0.35)' })
    }
    return out
  }
  // Fallback before wallet hydration: class-level allocation pie
  const a = allocation.allocationPie
  const totalAlloc = a.fiat + a.crypto + a.stocks + a.commodities || 100
  return (['fiat', 'crypto', 'stocks', 'commodities'] as const)
    .filter(k => a[k] > 0.01)
    .map(k => ({ key: k, label: `${k} ${Math.round((a[k] / totalAlloc) * 100)}%`, share: a[k] / totalAlloc, color: CLASS_COLOR[k] }))
})

const dominantColor = computed(() => {
  const lead = [...shares.value].sort((a, b) => b.share - a.share)[0]
  return lead?.color ?? CLASS_COLOR[macro.dominant_asset_class] ?? '#4A90E2'
})

const segments = computed(() => {
  const r = 9.4
  let cumulative = -Math.PI / 2 // start at 12 o'clock
  const maxShare = Math.max(...shares.value.map(s => s.share), 0)
  return shares.value.map(s => {
    const slice = s.share * Math.PI * 2
    const x1 = Math.cos(cumulative) * r
    const y1 = Math.sin(cumulative) * r
    const x2 = Math.cos(cumulative + slice) * r
    const y2 = Math.sin(cumulative + slice) * r
    const large = slice > Math.PI ? 1 : 0
    const path = `M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
    cumulative += slice
    return {
      key: s.key,
      label: s.label,
      path,
      color: s.color,
      dominant: s.share === maxShare
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
