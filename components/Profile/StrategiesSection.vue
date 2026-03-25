<script setup lang="ts">
import type { Strategy } from '@/stores/strategies'

const props = defineProps<{
  strategies: Strategy[]
}>()

const statusColor = (s: string) => {
  const map: Record<string, string> = {
    active: 'var(--success-green)',
    paused: 'var(--warning-orange)',
    stopped: 'var(--error-red)',
    backtesting: 'var(--primary-blue)',
  }
  return map[s] ?? 'var(--text-gray)'
}

const riskBadge = (r: string) => {
  const map: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' }
  return map[r] ?? '⚪'
}
</script>

<template>
  <div class="strats-section">
    <div v-if="!strategies?.length" class="empty">No public strategies yet.</div>

    <div
      v-for="strat in strategies"
      :key="strat.id"
      class="strat-card"
    >
      <div class="strat-header">
        <span class="strat-name">{{ strat.name }}</span>
        <span class="status-dot" :style="{ color: statusColor(strat.status) }">●</span>
        <span class="status-label" :style="{ color: statusColor(strat.status) }">{{ strat.status }}</span>
      </div>

      <p class="strat-desc">{{ strat.description }}</p>

      <!-- Assets + indicators -->
      <div class="strat-tags">
        <span v-for="a in strat.target_assets" :key="a" class="tag-asset">{{ a }}</span>
        <span v-for="i in strat.indicators.slice(0, 4)" :key="i" class="tag-ind">{{ i }}</span>
        <span class="risk-badge">{{ riskBadge(strat.risk_level) }} {{ strat.risk_level }}</span>
      </div>

      <!-- Performance stats -->
      <div class="strat-stats">
        <div class="stat">
          <span class="stat-label">Return</span>
          <span class="stat-val" :class="strat.total_return_percentage >= 0 ? 'pos' : 'neg'">
            {{ strat.total_return_percentage >= 0 ? '+' : '' }}{{ strat.total_return_percentage.toFixed(1) }}%
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Win Rate</span>
          <span class="stat-val">{{ strat.win_rate }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Sharpe</span>
          <span class="stat-val">{{ strat.sharpe_ratio?.toFixed(2) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Drawdown</span>
          <span class="stat-val neg">-{{ strat.max_drawdown }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Followers</span>
          <span class="stat-val">{{ strat.followers_count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.strats-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.strat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.strat-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.strat-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-white);
  flex: 1;
}

.status-label {
  font-size: 0.7rem;
  text-transform: capitalize;
}

.strat-desc {
  font-size: 0.78rem;
  color: var(--text-light-gray);
  margin: 0;
}

.strat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-asset, .tag-ind, .risk-badge {
  font-size: 0.62rem;
  padding: 2px 7px;
  border-radius: 999px;
}

.tag-asset {
  background: rgba(247,147,26,0.1);
  border: 1px solid rgba(247,147,26,0.25);
  color: var(--asset-btc);
  font-weight: 600;
}

.tag-ind {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  color: var(--text-light-gray);
}

.risk-badge {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-secondary);
  color: var(--text-gray);
  text-transform: capitalize;
}

.strat-stats {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 0.6rem;
  color: var(--text-gray);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-val {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-white);
}

.stat-val.pos { color: var(--success-green); }
.stat-val.neg { color: var(--error-red); }
</style>
