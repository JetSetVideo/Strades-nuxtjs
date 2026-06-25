<script setup lang="ts">
import UIPill from '@/components/UI/Pill.vue'

interface Platform {
  id: string
  name: string
  logo: string
  color: string
  status: 'connected' | 'rate_limited' | 'disconnected' | string
  type: string
  asset_count: number
  asset_classes: string[]
  balance_usd: number
  daily_pnl_pct: number
}

defineProps<{ platforms: Platform[] }>()
</script>

<template>
  <div class="platform-list">
    <div
      v-for="p in platforms"
      :key="p.id"
      class="platform-row"
      :class="`status-${p.status}`"
    >
      <div class="platform-logo" :style="{ background: p.color }">{{ p.logo }}</div>
      <div class="platform-body">
        <div class="platform-head">
          <strong>{{ p.name }}</strong>
          <UIPill
            :tone="p.status === 'connected' ? 'success' : p.status === 'rate_limited' ? 'warning' : 'danger'"
            show-dot
          >{{ p.status.replace('_', ' ') }}</UIPill>
        </div>
        <div class="platform-meta">
          <span>{{ p.asset_count }} assets · {{ p.asset_classes.join(', ') }}</span>
          <span class="bal">${{ Math.round(p.balance_usd).toLocaleString() }}</span>
        </div>
      </div>
      <div class="platform-pnl" :class="p.daily_pnl_pct >= 0 ? 'positive' : 'negative'">
        {{ p.daily_pnl_pct >= 0 ? '+' : '' }}{{ p.daily_pnl_pct.toFixed(2) }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
.platform-list { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.platform-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.5rem;
  border-radius: var(--app-border-radius, 6px);
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  min-width: 0;
}
.platform-row.status-rate_limited { border-color: rgba(255,165,0,0.25); }
.platform-row.status-disconnected { border-color: rgba(255,68,68,0.25); opacity: 0.7; }

.platform-logo {
  width: 32px; height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.platform-body { min-width: 0; overflow: hidden; }
.platform-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.platform-head strong {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.platform-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.68rem;
  color: rgba(255,255,255,0.5);
  margin-top: 0.1rem;
  gap: 0.4rem;
  min-width: 0;
}
.platform-meta > :first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.bal {
  color: rgba(255,255,255,0.85);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  font-weight: 700;
}

.platform-pnl {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}
.platform-pnl.positive { color: var(--success-green, #00ff88); }
.platform-pnl.negative { color: #ff4d6a; }
</style>
