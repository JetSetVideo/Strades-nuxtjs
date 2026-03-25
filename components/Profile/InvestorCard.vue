<script setup lang="ts">
import type { InvestorProfile } from '@/stores/users'

const props = defineProps<{
  profile: InvestorProfile
}>()

const esgColor = computed(() => {
  const v = props.profile.esg_score / 10
  if (v > 0.65) return 'var(--success-green)'
  if (v > 0.35) return 'var(--warning-orange)'
  return 'var(--error-red)'
})

const leverageLevel = computed(() => {
  const map: Record<string, number> = { none: 0, light: 33, moderate: 66, high: 100 }
  return map[props.profile.leverage_usage] ?? 0
})

const leverageColor = computed(() => {
  const l = leverageLevel.value
  if (l === 0) return 'var(--success-green)'
  if (l < 66) return 'var(--warning-orange)'
  return 'var(--error-red)'
})
</script>

<template>
  <div class="inv-card">
    <div class="inv-header">
      <span class="inv-type">{{ profile.type?.replace(/_/g, ' ') }}</span>
      <span class="horizon">⏳ {{ profile.time_horizon?.replace(/_/g, ' ') }}</span>
    </div>

    <p class="inv-desc">{{ profile.description }}</p>

    <!-- Markets & sectors -->
    <div class="tag-group">
      <span v-for="m in profile.preferred_markets" :key="m" class="tag-market">{{ m.replace(/_/g, ' ') }}</span>
    </div>

    <div class="tag-group">
      <span v-for="s in profile.sector_focus" :key="s" class="tag-sector">{{ s.replace(/_/g, ' ') }}</span>
    </div>

    <!-- Metrics -->
    <div class="inv-metrics">
      <div class="metric-row">
        <span class="metric-label">ESG Score</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: `${props.profile.esg_score * 10}%`, background: esgColor }" />
        </div>
        <span class="metric-val" :style="{ color: esgColor }">{{ profile.esg_score?.toFixed(1) }}</span>
      </div>

      <div class="metric-row">
        <span class="metric-label">Leverage</span>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: `${leverageLevel}%`, background: leverageColor }" />
        </div>
        <span class="metric-val" :style="{ color: leverageColor }">{{ profile.leverage_usage }}</span>
      </div>
    </div>

    <!-- Copy trading -->
    <div class="copy-row">
      <span class="copy-label">Copy Trading</span>
      <span class="copy-status" :class="profile.copy_trading_open ? 'open' : 'closed'">
        {{ profile.copy_trading_open ? 'Open' : 'Closed' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.inv-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inv-type {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-white);
  text-transform: capitalize;
}

.horizon {
  font-size: 0.72rem;
  color: var(--text-gray);
  text-transform: capitalize;
}

.inv-desc {
  font-size: 0.8rem;
  color: var(--text-light-gray);
  line-height: 1.5;
  margin: 0;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-market, .tag-sector {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: capitalize;
}

.tag-market {
  background: rgba(0,170,255,0.1);
  border: 1px solid rgba(0,170,255,0.25);
  color: var(--primary-blue);
}

.tag-sector {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  color: var(--text-light-gray);
}

.inv-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.metric-label {
  font-size: 0.68rem;
  color: var(--text-gray);
  min-width: 72px;
}

.bar-track {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.metric-val {
  font-size: 0.7rem;
  min-width: 56px;
  text-align: right;
  text-transform: capitalize;
}

.copy-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copy-label {
  font-size: 0.72rem;
  color: var(--text-gray);
}

.copy-status {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
}

.copy-status.open   { background: rgba(0,255,136,0.12); color: var(--success-green); border: 1px solid rgba(0,255,136,0.3); }
.copy-status.closed { background: rgba(255,68,68,0.1); color: var(--error-red); border: 1px solid rgba(255,68,68,0.25); }
</style>
