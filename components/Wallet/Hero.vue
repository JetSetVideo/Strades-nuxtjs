<script setup lang="ts">
import { computed } from 'vue'

interface PerfPoint { change: number; change_percentage: number }
interface Wallet {
  id: string
  name?: string
  currency?: string
  total_value: number
  available_balance?: number
  invested_amount?: number
  daily_change?: number
  daily_change_percentage?: number
  performance_history?: Record<string, PerfPoint>
}

const props = defineProps<{
  wallet: Wallet | null | undefined
  period: '1d' | '7d' | '30d' | '90d' | '1y'
}>()

const emit = defineEmits<{ (e: 'update:period', p: '1d' | '7d' | '30d' | '90d' | '1y'): void }>()

const PERIOD_LABELS: Record<'1d' | '7d' | '30d' | '90d' | '1y', string> = {
  '1d': '1D',
  '7d': '1W',
  '30d': '1M',
  '90d': '3M',
  '1y': '1Y'
}

const periodPnl = computed<PerfPoint>(() => {
  const h = props.wallet?.performance_history
  if (!h) return { change: 0, change_percentage: 0 }
  return h[props.period] ?? { change: 0, change_percentage: 0 }
})

const isPositive = computed(() => periodPnl.value.change >= 0)

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtSigned = (n: number) => `${n >= 0 ? '+' : ''}$${fmt(Math.abs(n))}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const todayPnl = computed(() => props.wallet?.daily_change ?? 0)
const todayPct = computed(() => props.wallet?.daily_change_percentage ?? 0)
</script>

<template>
  <section class="wallet-hero" v-if="wallet">
    <!-- Primary cluster: total balance + period PnL -->
    <div class="primary-row">
      <div class="balance-block">
        <span class="label">Total Balance</span>
        <span class="balance-value">${{ fmt(wallet.total_value) }}</span>
        <span class="balance-currency">{{ wallet.currency || 'USD' }}</span>
      </div>

      <div class="pnl-block" :class="{ pos: isPositive, neg: !isPositive }">
        <div class="pnl-head">
          <span class="label">PnL {{ PERIOD_LABELS[period] }}</span>
          <div class="period-strip" role="group" aria-label="Period">
            <button
              v-for="p in (['1d','7d','30d','90d','1y'] as const)"
              :key="p"
              :class="{ active: period === p }"
              @click="emit('update:period', p)"
            >{{ PERIOD_LABELS[p] }}</button>
          </div>
        </div>
        <div class="pnl-values">
          <span class="pnl-amount">{{ fmtSigned(periodPnl.change) }}</span>
          <span class="pnl-pct">{{ fmtPct(periodPnl.change_percentage) }}</span>
        </div>
      </div>
    </div>

    <!-- Secondary cluster: available + invested + today -->
    <div class="secondary-row">
      <div class="sub">
        <span class="sub-label">Available</span>
        <span class="sub-value">${{ fmt(wallet.available_balance ?? 0) }}</span>
      </div>
      <div class="sub-divider" />
      <div class="sub">
        <span class="sub-label">Invested</span>
        <span class="sub-value">${{ fmt(wallet.invested_amount ?? 0) }}</span>
      </div>
      <div class="sub-divider" />
      <div class="sub" :class="{ pos: todayPnl >= 0, neg: todayPnl < 0 }">
        <span class="sub-label">Today</span>
        <span class="sub-value">{{ fmtSigned(todayPnl) }} <span class="sub-pct">({{ fmtPct(todayPct) }})</span></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wallet-hero {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 10px);
  min-width: 0;
  box-sizing: border-box;
}

.primary-row {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  gap: 1.2rem;
  align-items: flex-end;
}

@media (max-width: 720px) {
  .primary-row { grid-template-columns: 1fr; gap: 0.5rem; }
}

.balance-block {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}
.label {
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.balance-value {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.balance-currency {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 600;
}

.pnl-block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: flex-end;
  min-width: 0;
}
.pnl-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.pnl-values {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  font-variant-numeric: tabular-nums;
}
.pnl-amount {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.1;
}
.pnl-pct {
  font-size: 0.95rem;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
}

.pnl-block.pos .pnl-amount { color: var(--success-green, #00ff88); }
.pnl-block.pos .pnl-pct {
  color: var(--success-green, #00ff88);
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
}
.pnl-block.neg .pnl-amount { color: #ff4d6a; }
.pnl-block.neg .pnl-pct {
  color: #ff4d6a;
  background: rgba(255,77,106,0.1);
  border: 1px solid rgba(255,77,106,0.3);
}

@media (max-width: 720px) {
  .pnl-block { align-items: flex-start; }
}

.period-strip {
  display: inline-flex;
  gap: 0.15rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 999px;
  padding: 2px;
}
.period-strip button {
  background: none;
  border: none;
  color: rgba(255,255,255,0.55);
  font: inherit;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: ui-monospace, Menlo, monospace;
}
.period-strip button:hover { color: #fff; }
.period-strip button.active {
  background: var(--primary-green, #00ff88);
  color: #000;
}

.secondary-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  min-width: 0;
  flex-wrap: wrap;
}
.sub {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}
.sub-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}
.sub-value {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
}
.sub-pct {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
}
.sub.pos .sub-value, .sub.pos .sub-pct { color: var(--success-green, #00ff88); }
.sub.neg .sub-value, .sub.neg .sub-pct { color: #ff4d6a; }

.sub-divider {
  width: 1px;
  height: 1.5rem;
  background: rgba(255,255,255,0.06);
}

@media (max-width: 540px) {
  .balance-value { font-size: 1.6rem; }
  .pnl-amount { font-size: 1.15rem; }
  .pnl-pct { font-size: 0.85rem; }
  .sub-divider { display: none; }
}
</style>
