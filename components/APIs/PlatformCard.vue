<script setup lang="ts">
import { computed } from 'vue'
import type { TradingPlatform } from '@/stores/platforms'

import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'

const props = defineProps<{
  platform: TradingPlatform
  testing?: boolean
}>()

defineEmits<{
  (e: 'test', id: string): void
  (e: 'reconnect', id: string): void
  (e: 'disconnect', id: string): void
}>()

const TYPE_LABEL: Record<string, string> = {
  crypto_exchange: 'Crypto Exchange',
  stock_broker: 'Stock Broker',
  bank: 'Bank',
  commodity_vault: 'Commodity Vault'
}

const typeLabel = computed(() => TYPE_LABEL[props.platform.type] ?? props.platform.type)

const statusTone = computed(() => {
  if (props.platform.status === 'connected') return 'success'
  if (props.platform.status === 'rate_limited') return 'warning'
  if (props.platform.status === 'disconnected') return 'danger'
  return 'neutral'
})

const healthTone = computed(() => {
  const h = props.platform.api_health
  if (h > 0.9) return 'positive'
  if (h > 0.6) return 'warning'
  return 'negative'
})

const lastSyncRel = computed(() => {
  const mins = Math.floor((Date.now() - new Date(props.platform.last_sync_at).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / (60 * 24))}d ago`
})
</script>

<template>
  <UICard :class="['plat-card', `status-${platform.status}`]">
    <template #header>
      <div class="plat-head">
        <div class="logo" :style="{ background: platform.color }">{{ platform.logo }}</div>
        <div class="plat-meta">
          <strong>{{ platform.name }}</strong>
          <small>{{ typeLabel }}</small>
        </div>
        <UIPill :tone="statusTone" show-dot>{{ platform.status.replace('_', ' ') }}</UIPill>
      </div>
    </template>

    <!-- Sync status -->
    <div class="sync-row">
      <span class="sync-label">Last sync</span>
      <span class="sync-value">{{ lastSyncRel }}</span>
    </div>

    <!-- API health bar -->
    <div class="health-row">
      <span class="health-label">API health</span>
      <span class="health-bar">
        <span
          class="health-fill"
          :class="healthTone"
          :style="{ width: `${Math.round(platform.api_health * 100)}%` }"
        />
      </span>
      <span class="health-pct">{{ Math.round(platform.api_health * 100) }}%</span>
    </div>

    <UIMetricRow :cols="2">
      <UIStat label="Balance"   :value="platform.balance_usd"     :precision="0" suffix="USD" size="sm" />
      <UIStat label="Available" :value="platform.available_usd"   :precision="0" suffix="USD" size="sm" />
      <UIStat label="PnL today" :value="platform.daily_pnl_pct"   tone="auto" suffix="%" :precision="2" size="sm" />
      <UIStat label="PnL 30d"   :value="platform.monthly_pnl_pct" tone="auto" suffix="%" :precision="2" size="sm" />
    </UIMetricRow>

    <div class="asset-tags">
      <span
        v-for="cls in platform.asset_classes"
        :key="cls"
        :class="['cls-tag', `cls-${cls}`]"
      >{{ cls }}</span>
      <span class="asset-count">{{ platform.asset_count }} assets</span>
    </div>

    <div class="perm-row">
      <span class="perm-label">Permissions</span>
      <div class="perm-pills">
        <span v-for="perm in platform.permissions" :key="perm" class="perm-pill">{{ perm }}</span>
      </div>
      <span class="twofa" :class="{ on: platform.two_factor }">
        <span class="twofa-dot" />
        2FA {{ platform.two_factor ? 'on' : 'off' }}
      </span>
    </div>

    <template #footer>
      <button class="action" :disabled="testing" @click="$emit('test', platform.id)">
        {{ testing ? 'Pinging…' : '↻ Test' }}
      </button>
      <button
        v-if="platform.status === 'disconnected'"
        class="action primary"
        @click="$emit('reconnect', platform.id)"
      >↺ Reconnect</button>
      <button
        v-else
        class="action danger-ghost"
        @click="$emit('disconnect', platform.id)"
      >Disconnect</button>
    </template>
  </UICard>
</template>

<style scoped>
.plat-card.status-connected    { border-color: rgba(0,255,136,0.15); }
.plat-card.status-rate_limited { border-color: rgba(255,170,0,0.2); }
.plat-card.status-disconnected { border-color: rgba(255,77,106,0.2); opacity: 0.85; }

.plat-head {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
}
.logo {
  width: 36px; height: 36px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.plat-meta {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  overflow: hidden;
}
.plat-meta strong {
  font-size: 0.88rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plat-meta small {
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
}

.sync-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.7rem;
}
.sync-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.sync-value {
  color: rgba(255,255,255,0.8);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.health-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 0.5rem;
}
.health-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.health-bar {
  display: block;
  width: 100%;
  height: 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
  overflow: hidden;
}
.health-fill {
  display: block;
  height: 100%;
  transition: width 0.4s ease;
}
.health-fill.positive { background: linear-gradient(90deg, var(--primary-blue, #00aaff), var(--primary-green, #00ff88)); }
.health-fill.warning  { background: linear-gradient(90deg, #ffaa00, #ff8800); }
.health-fill.negative { background: linear-gradient(90deg, #ff8800, #ff4d6a); }
.health-pct {
  font-size: 0.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: rgba(255,255,255,0.85);
}

.asset-tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  align-items: center;
}
.cls-tag {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}
.cls-fiat        { background: rgba(74,144,226,0.18); color: #4A90E2; }
.cls-crypto      { background: rgba(245,166,35,0.18); color: #F5A623; }
.cls-stocks      { background: rgba(126,211,33,0.18); color: #7ED321; }
.cls-commodities { background: rgba(248,231,28,0.18); color: #F8E71C; }
.asset-count {
  margin-left: auto;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
}

.perm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.perm-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.perm-pills { display: inline-flex; gap: 0.2rem; }
.perm-pill {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}
.twofa {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.twofa.on { color: var(--success-green, #00ff88); }
.twofa-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 4px currentColor;
}

.action {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.35rem 0.7rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: inherit;
  transition: all 0.15s ease;
}
.action:hover:not(:disabled) {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.action:disabled { opacity: 0.5; cursor: not-allowed; }
.action.primary {
  background: var(--primary-gradient);
  color: #000;
  border-color: transparent;
}
.action.danger-ghost:hover {
  border-color: var(--error-red, #ff4d6a);
  color: var(--error-red, #ff4d6a);
}

@media (max-width: 540px) {
  .health-row { grid-template-columns: 60px minmax(0, 1fr) 36px; }
  .perm-row .twofa { margin-left: 0; }
}
</style>
