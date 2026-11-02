<script setup lang="ts">
interface Fill {
  id: string
  ts: number
  side: 'buy' | 'sell' | string
  asset: string
  price: number
  size: number
  pnl: number
}

defineProps<{ fills: Fill[] }>()

// One format with the rest of the app (utils/format.ts): "−$9.00", "+$2.00", "$0.00", times in UTC.
import { utcCalendarDaysAgo } from '~/utils/walletBook'

function fmtRelTime(ts: number) {
  // Calendar day in UTC (the times are UTC), not a 24 h window: yesterday's 15:35 no longer reads "15:35" (REVIEW-17).
  const days = utcCalendarDaysAgo(ts)
  if (days === 0) return fmtTime(ts)
  if (days < 7) return fmtDayTime(ts)
  return fmtShortDate(ts)
}
</script>

<template>
  <ul class="fill-list">
    <li v-for="f in fills" :key="f.id" :class="['fill-row', f.side]">
      <span :class="['side', f.side]">{{ f.side === 'buy' ? '+ BUY' : '− SELL' }}</span>
      <span class="asset">{{ f.asset }}</span>
      <span class="size">{{ f.size }} <em>{{ f.asset }}</em></span>
      <span class="price">@ {{ fmtMoney(f.price) }}</span>
      <span :class="['pnl', f.pnl > 0 ? 'pos' : f.pnl < 0 ? 'neg' : '']">
        {{ fmtSignedMoney(f.pnl) }}
      </span>
      <span class="when">{{ fmtRelTime(f.ts) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.fill-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.fill-row {
  display: grid;
  grid-template-columns: 60px auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
  min-width: 0;
}
.side {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 2px 0;
  border-radius: 3px;
  text-align: center;
}
.side.buy  { background: rgba(0,255,136,0.12); color: var(--app-color-up, var(--success-green, #00ff88)); border: 1px solid rgba(0,255,136,0.3); }
.side.sell { background: rgba(255,77,106,0.12); color: var(--app-color-down, #ff4d6a);                     border: 1px solid rgba(255,77,106,0.3); }
.fill-row .asset { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; }
.fill-row .size  { font-size: 0.7rem; color: rgba(255,255,255,0.75); font-variant-numeric: tabular-nums; }
.fill-row .size em {
  font-style: normal;
  color: rgba(255,255,255,0.4);
  font-size: 0.6rem;
  margin-left: 0.15rem;
}
.fill-row .price {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.65);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fill-row .pnl {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fill-row .pnl.pos { color: var(--app-color-up, var(--success-green, #00ff88)); }
.fill-row .pnl.neg { color: var(--app-color-down, #ff4d6a); }
.fill-row .when {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-align: right;
}

@media (max-width: 720px) {
  .fill-row { grid-template-columns: 60px minmax(0, 1fr) auto auto; }
  .fill-row .size,
  .fill-row .price { display: none; }
}
</style>
