<template>
  <div class="opinion-vector" :class="{ tiny: variant === 'tiny' }">
    <div v-if="label" class="label">{{ label }}</div>
    <div class="bar">
      <div class="seg fiat" :style="{ width: pct(vector.fiat) }" :title="`Fiat ${vector.fiat.toFixed(1)}%`" />
      <div class="seg crypto" :style="{ width: pct(vector.crypto) }" :title="`Crypto ${vector.crypto.toFixed(1)}%`" />
      <div class="seg stocks" :style="{ width: pct(vector.stocks) }" :title="`Stocks ${vector.stocks.toFixed(1)}%`" />
      <div class="seg commodities" :style="{ width: pct(vector.commodities) }" :title="`Commodities ${vector.commodities.toFixed(1)}%`" />
    </div>
    <div v-if="variant !== 'tiny'" class="legend">
      <span class="lg fiat">FIAT {{ vector.fiat.toFixed(0) }}</span>
      <span class="lg crypto">CRYPTO {{ vector.crypto.toFixed(0) }}</span>
      <span class="lg stocks">STOCKS {{ vector.stocks.toFixed(0) }}</span>
      <span class="lg commodities">CMDTY {{ vector.commodities.toFixed(0) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OpinionVector } from '~/stores/agents'

defineProps<{
  vector: OpinionVector
  label?: string
  variant?: 'tiny' | 'full'
}>()

const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`
</script>

<style scoped>
.opinion-vector { display: flex; flex-direction: column; gap: 0.3rem; }
.label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.bar {
  display: flex;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.05);
}
.opinion-vector.tiny .bar { height: 4px; }
.seg { height: 100%; transition: width 0.4s ease; }
.seg.fiat { background: #4A90E2; }
.seg.crypto { background: #F5A623; }
.seg.stocks { background: #7ED321; }
.seg.commodities { background: #F8E71C; }
.legend {
  display: flex;
  gap: 0.6rem;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}
.lg.fiat { color: #4A90E2; }
.lg.crypto { color: #F5A623; }
.lg.stocks { color: #7ED321; }
.lg.commodities { color: #F8E71C; }
</style>
