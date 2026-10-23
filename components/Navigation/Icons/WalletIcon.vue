<script setup lang="ts">
/**
 * Wallet tab — two rings over the user's total balance.
 *   outer ring  each wallet's share of the total (amber family, one per wallet)
 *   inner ring  asset types across all wallets (the app's class colours, cash grey)
 * Data: useNavPanels() wallet (walletRings). Presentational only.
 */
import { computed } from 'vue'
import { donutArcPath, sharesToArcs } from '~/utils/navIcons'
import type { ColoredShare } from '~/composables/useNavPanels'

const props = withDefaults(defineProps<{
  size?: number
  active?: boolean
  ready?: boolean
  wallets?: ColoredShare[]
  classes?: ColoredShare[]
}>(), { size: 40, active: false, ready: false, wallets: () => [], classes: () => [] })

const C = 12
// Ring radii — selected = zoomed in: thicker rings, smaller hole.
const R = computed(() => (props.active
  ? { o1: 11.6, o0: 9.4, i1: 8.5, i0: 4.4 }
  : { o1: 10.6, o0: 8.9, i1: 8.0, i0: 5.0 }))

const ring = (list: ColoredShare[], r1: number, r0: number, gap: number) =>
  sharesToArcs(list, gap).map(a => ({ key: a.key, color: a.color, d: donutArcPath(C, C, r1, r0, a.a0, a.a1) }))

const outer = computed(() => (props.ready ? ring(props.wallets, R.value.o1, R.value.o0, 0.16) : []))
const inner = computed(() => (props.ready ? ring(props.classes, R.value.i1, R.value.i0, 0.14) : []))
const lead = computed(() => props.classes[0]?.color ?? 'rgba(255,255,255,0.4)')
</script>

<template>
  <span class="nav-icon wallet-icon" :class="{ active }" aria-hidden="true" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" :width="size" :height="size">
      <!-- Track rings: also the SSR / empty placeholder -->
      <circle :cx="C" :cy="C" :r="(R.o1 + R.o0) / 2" :stroke-width="R.o1 - R.o0" class="track" />
      <circle :cx="C" :cy="C" :r="(R.i1 + R.i0) / 2" :stroke-width="R.i1 - R.i0" class="track" />

      <g class="rings">
        <path v-for="a in outer" :key="`w-${a.key}`" :d="a.d" :fill="a.color" class="seg outer" />
        <path v-for="a in inner" :key="`c-${a.key}`" :d="a.d" :fill="a.color" class="seg" />
      </g>

      <!-- Hole + a pip in the largest asset type's colour -->
      <circle :cx="C" :cy="C" :r="R.i0 - 0.6" class="hole" />
      <circle :cx="C" :cy="C" :r="active ? 1.6 : 1.3" :fill="ready && classes.length ? lead : 'rgba(255,255,255,0.3)'" class="hub" />
    </svg>
  </span>
</template>

<style scoped>
.nav-icon { display: inline-flex; align-items: center; justify-content: center; }
svg { display: block; overflow: visible; }
.track { fill: none; stroke: rgba(255,255,255,0.08); }
.outer { opacity: 0.92; }
.hole { fill: rgba(0,0,0,0.55); }
.hub { opacity: 0.9; }
/* Rings turn slightly on selection (one-shot, transform only) so the change of state is felt. */
.rings { transform-origin: 12px 12px; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
.active .rings { transform: rotate(-12deg); }
@media (prefers-reduced-motion: reduce) { .rings { transition: none; } }
</style>
