<script setup lang="ts">
import { computed } from 'vue'
import { usePlatformsStore } from '@/stores/platforms'

/**
 * Wallet/PlatformBreakdown.vue — shows the total portfolio distributed across
 * every connected trading platform. The "centralized hub" view.
 *
 * Design: horizontal stacked bar of platform shares + per-platform cards.
 */

const platforms = usePlatformsStore()

const totalBalance = computed(() =>
  platforms.list.reduce((s, p) => s + (p.balance_usd ?? 0), 0)
)

const byType = computed(() => {
  const groups: Record<string, { label: string; total: number; color: string; count: number }> = {
    crypto_exchange: { label: 'Crypto Exchanges', total: 0, color: 'var(--asset-btc, #f7931a)', count: 0 },
    stock_broker:    { label: 'Stock Brokers',    total: 0, color: 'var(--primary-blue, #00aaff)', count: 0 },
    bank:            { label: 'Banks',            total: 0, color: 'oklch(0.6 0.1 145)', count: 0 },
    commodity_vault: { label: 'Commodity Vaults', total: 0, color: 'var(--asset-gold, #d4a017)', count: 0 },
    other:           { label: 'Other',            total: 0, color: 'var(--text-gray)', count: 0 },
  }
  for (const p of platforms.list) {
    const g = groups[p.type] ?? groups.other
    g.total += p.balance_usd ?? 0
    g.count += 1
  }
  return Object.values(groups).filter(g => g.count > 0)
})

const pct = (v: number) => totalBalance.value > 0 ? (v / totalBalance.value) * 100 : 0
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

const platformTone = (pct: number) =>
  pct > 0.3 ? 'positive' : pct > 0 ? 'warning' : 'neutral'

const typeIcon: Record<string, string> = {
  crypto_exchange: '₿',
  stock_broker: '📈',
  bank: '🏦',
  commodity_vault: '🏗',
  other: '◈',
}
</script>

<template>
  <div class="plat-breakdown" v-if="platforms.list.length">
    <header class="bd-head">
      <h4>Platform Breakdown</h4>
      <span class="bd-total">
        ${{ fmt(totalBalance) }} across {{ platforms.list.length }} platforms
      </span>
    </header>

    <!-- Stacked bar by type -->
    <div class="type-bar">
      <div
        v-for="g in byType"
        :key="g.label"
        class="type-seg"
        :style="{ width: `${pct(g.total)}%`, background: g.color }"
        :title="`${g.label}: $${fmt(g.total)} (${pct(g.total).toFixed(1)}%)`"
      />
    </div>
    <div class="type-labels">
      <span v-for="g in byType" :key="g.label" class="type-label" :style="{ color: g.color }">
        ● {{ g.label }}
        <b>{{ pct(g.total).toFixed(1) }}%</b>
      </span>
    </div>

    <!-- Per-platform cards -->
    <div class="plat-grid">
      <div
        v-for="p in platforms.list"
        :key="p.id"
        class="plat-card"
        :data-status="p.status"
      >
        <div class="pc-head">
          <span class="pc-icon" :style="{ background: p.color }">{{ typeIcon[p.type] || '◈' }}</span>
          <div class="pc-info">
            <span class="pc-name">{{ p.name }}</span>
            <span class="pc-type">{{ p.type.replace(/_/g, ' ') }}</span>
          </div>
          <span
            v-if="p.status === 'connected'"
            class="pc-health"
            :title="`API health ${(p.api_health * 100).toFixed(0)}%`"
          >●</span>
          <span v-else class="pc-health warn">◌</span>
        </div>
        <div class="pc-balance">
          <span class="pc-bal-label">Balance</span>
          <span class="pc-bal-value">${{ fmt(p.balance_usd) }}</span>
          <span class="pc-bal-pct">({{ pct(p.balance_usd).toFixed(1) }}% of portfolio)</span>
        </div>
        <div class="pc-meta">
          <span>{{ p.asset_count }} assets</span>
          <span class="pc-pnl" :data-tone="p.daily_pnl_usd >= 0 ? 'pos' : 'neg'">
            {{ p.daily_pnl_usd >= 0 ? '+' : '' }}${{ Math.round(p.daily_pnl_usd).toLocaleString() }}
          </span>
        </div>
        <div class="pc-detail">
          <span class="pc-detail-label">Available</span>
          <span class="pc-detail-val">${{ fmt(p.available_usd) }}</span>
          <span class="pc-detail-label">30d fees</span>
          <span class="pc-detail-val">${{ fmt(p.fees_30d_usd) }}</span>
          <span class="pc-detail-label">Last sync</span>
          <span class="pc-detail-val">{{ new Date(p.last_sync_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</span>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="bd-empty">
    <p>No platforms connected. Go to <NuxtLink to="/apis">API Sync</NuxtLink> to add your trading accounts.</p>
  </div>
</template>

<style scoped>
.plat-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.bd-head { display: flex; justify-content: space-between; align-items: center; }
.bd-head h4 { margin: 0; font-size: 0.9rem; font-weight: 600; }
.bd-total { font-size: 0.75rem; color: var(--text-gray); }

/* Type stacked bar */
.type-bar {
  display: flex;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
}
.type-seg { transition: width 0.5s ease; }
.type-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  font-size: 0.7rem;
}
.type-label b { margin-left: 0.2rem; font-weight: 600; }

/* Platform cards */
.plat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  gap: 0.4rem;
}
.plat-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--app-border-radius, 6px);
}
.plat-card[data-status="disconnected"] { opacity: 0.55; }
.plat-card[data-status="rate_limited"] { border-color: oklch(0.7 0.2 80 / 0.3); }

.pc-head { display: flex; align-items: center; gap: 0.4rem; }
.pc-icon {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.pc-info { flex: 1; display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; }
.pc-name { font-size: 0.78rem; font-weight: 600; }
.pc-type { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-gray); }
.pc-health { font-size: 0.7rem; color: oklch(0.7 0.2 145); }
.pc-health.warn { color: oklch(0.7 0.2 80); }

.pc-balance { display: flex; flex-direction: column; gap: 0.05rem; }
.pc-bal-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-gray); }
.pc-bal-value { font-size: 1rem; font-weight: 700; }
.pc-bal-pct { font-size: 0.65rem; color: var(--text-gray); }

.pc-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--text-gray);
}
.pc-pnl { font-weight: 600; }
.pc-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pc-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }

.pc-detail {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.4rem;
  font-size: 0.65rem;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.pc-detail-label { color: var(--text-gray); }
.pc-detail-val { text-align: right; font-weight: 500; }

.bd-empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-gray);
  font-size: 0.8rem;
}
.bd-empty a { color: var(--primary-blue); }
</style>
