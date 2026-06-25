<script setup lang="ts">
interface Trade {
  id: string
  asset: string
  type: 'win' | 'loss' | string
  pct: number
  usd: number
  ts: number
}

defineProps<{ trades: Trade[] }>()

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function fmtRelTime(ts: number) {
  const d = new Date(ts)
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
</script>

<template>
  <ul class="trade-list">
    <li v-for="t in trades" :key="t.id" :class="['trade-row', t.type]">
      <span :class="['kind', t.type]">{{ t.type === 'win' ? '+' : '−' }}</span>
      <span class="asset">{{ t.asset }}</span>
      <span class="pct">{{ fmtPct(t.pct) }}</span>
      <span class="usd">{{ fmtUsd(t.usd) }}</span>
      <span class="when">{{ fmtRelTime(t.ts) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.trade-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.trade-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
  min-width: 0;
}
.kind {
  font-size: 0.85rem;
  font-weight: 800;
  text-align: center;
  width: 20px; height: 20px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.kind.win  { color: var(--success-green, #00ff88); background: rgba(0,255,136,0.1); }
.kind.loss { color: #ff4d6a;                       background: rgba(255,77,106,0.1); }
.trade-row .asset {
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}
.trade-row .pct, .trade-row .usd {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.trade-row.win  .pct, .trade-row.win  .usd { color: var(--success-green, #00ff88); }
.trade-row.loss .pct, .trade-row.loss .usd { color: #ff4d6a; }
.trade-row .when {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.45);
  text-align: right;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

@media (max-width: 540px) {
  .trade-row { grid-template-columns: 20px minmax(0, 1fr) auto auto; }
  .trade-row .usd { display: none; }
}
</style>
