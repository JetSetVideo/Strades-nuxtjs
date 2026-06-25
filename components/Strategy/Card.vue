<script setup lang="ts">
import { computed } from 'vue'
import { useAgentsStore } from '~/stores/agents'

interface Strategy {
  id: string
  name: string
  description?: string
  category?: string
  type?: string
  status?: string
  risk_level?: string
  target_assets?: string[]
  current_capital?: number
  total_return_percentage?: number
  win_rate?: number
  total_trades?: number
  max_drawdown?: number
  sharpe_ratio?: number
  followers_count?: number
  tags?: string[]
  agent_id?: string | null
  last_run?: string
}

const props = defineProps<{ strategy: Strategy }>()
defineEmits<{ (e: 'select', id: string): void }>()

const agents = useAgentsStore()

const agent = computed(() => props.strategy.agent_id ? agents.getAvatarById(props.strategy.agent_id) : null)

const statusTone = computed(() => {
  switch (props.strategy.status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'stopped': return 'danger'
    default: return 'neutral'
  }
})

const riskTone = computed(() => {
  switch (props.strategy.risk_level) {
    case 'low': return 'success'
    case 'medium': return 'warning'
    case 'high': return 'danger'
    default: return 'neutral'
  }
})

const returnPct = computed(() => props.strategy.total_return_percentage ?? 0)
const returnTone = computed(() => returnPct.value >= 0 ? 'positive' : 'negative')
const isPositive = computed(() => returnPct.value >= 0)

const fmtPct = (n?: number) => n === undefined ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const fmtUsd = (n?: number) => n === undefined ? '—' : `$${Math.round(n).toLocaleString()}`

const lastRunRel = computed(() => {
  if (!props.strategy.last_run) return '—'
  const days = Math.floor((Date.now() - new Date(props.strategy.last_run).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
})
</script>

<template>
  <article
    class="strategy-card"
    :class="[`status-${strategy.status}`, returnTone]"
    @click="$emit('select', strategy.id)"
  >
    <header class="head">
      <div class="title-block">
        <h3>{{ strategy.name }}</h3>
        <p class="desc">{{ strategy.description }}</p>
      </div>
      <span :class="['status-pill', statusTone]">{{ strategy.status }}</span>
    </header>

    <!-- Tags row -->
    <div class="meta-row">
      <span :class="['risk', riskTone]">{{ strategy.risk_level }} risk</span>
      <span class="dot-sep">·</span>
      <span class="cat">{{ strategy.category }}</span>
      <span class="dot-sep">·</span>
      <span class="last-run">last run {{ lastRunRel }}</span>
    </div>

    <!-- Target assets pills -->
    <div class="assets" v-if="strategy.target_assets?.length">
      <span v-for="a in strategy.target_assets" :key="a" class="asset-tag">{{ a }}</span>
    </div>

    <!-- Performance metrics -->
    <div class="metrics">
      <div class="metric primary" :class="returnTone">
        <span class="m-label">Return</span>
        <span class="m-value">{{ fmtPct(strategy.total_return_percentage) }}</span>
      </div>
      <div class="metric">
        <span class="m-label">Capital</span>
        <span class="m-value">{{ fmtUsd(strategy.current_capital) }}</span>
      </div>
      <div class="metric">
        <span class="m-label">Win rate</span>
        <span class="m-value">{{ (strategy.win_rate ?? 0).toFixed(0) }}%</span>
      </div>
      <div class="metric">
        <span class="m-label">Sharpe</span>
        <span class="m-value">{{ (strategy.sharpe_ratio ?? 0).toFixed(2) }}</span>
      </div>
      <div class="metric">
        <span class="m-label">Max DD</span>
        <span class="m-value neg">−{{ (strategy.max_drawdown ?? 0).toFixed(1) }}%</span>
      </div>
      <div class="metric">
        <span class="m-label">Trades</span>
        <span class="m-value">{{ strategy.total_trades ?? 0 }}</span>
      </div>
    </div>

    <!-- Footer: agent + followers -->
    <footer class="foot">
      <div class="agent-link" v-if="agent">
        <img :src="agent.avatar_url" :alt="agent.name" class="agent-avatar" />
        <span class="agent-info">
          <small>RUN BY</small>
          <strong>{{ agent.name }}</strong>
        </span>
      </div>
      <div class="agent-link unassigned" v-else>
        <span class="agent-empty">◯</span>
        <span class="agent-info">
          <small>RUN BY</small>
          <strong>Unassigned</strong>
        </span>
      </div>

      <span class="followers" v-if="strategy.followers_count">
        ◉ {{ strategy.followers_count }}
      </span>
      <slot name="footer-extra" />
    </footer>
  </article>
</template>

<style scoped>
.strategy-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--app-border-radius, 8px);
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  transition: border-color 0.18s ease, transform 0.18s ease;
}
.strategy-card.status-active { border-color: rgba(0,255,136,0.18); }
.strategy-card.status-paused { border-color: rgba(255,170,0,0.18); }
.strategy-card.status-stopped { opacity: 0.7; }
.strategy-card.positive { box-shadow: inset 2px 0 0 var(--success-green, #00ff88); }
.strategy-card.negative { box-shadow: inset 2px 0 0 #ff4d6a; }
.strategy-card:hover {
  border-color: var(--primary-green, #00ff88);
  transform: translateY(-1px);
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: flex-start;
}
.title-block { min-width: 0; }
.title-block h3 {
  margin: 0 0 0.15rem 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-pill {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.status-pill.success  { background: rgba(0,255,136,0.12); color: #00ff88; }
.status-pill.warning  { background: rgba(255,170,0,0.15); color: #ffaa00; }
.status-pill.danger   { background: rgba(255,77,106,0.15); color: #ff4d6a; }
.status-pill.neutral  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  flex-wrap: wrap;
}
.risk { font-weight: 700; }
.risk.success { color: #00ff88; }
.risk.warning { color: #ffaa00; }
.risk.danger  { color: #ff4d6a; }
.cat { color: rgba(255,255,255,0.7); font-weight: 600; }
.dot-sep { color: rgba(255,255,255,0.25); }
.last-run { color: rgba(255,255,255,0.45); }

.assets { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.asset-tag {
  background: rgba(0,170,255,0.08);
  color: var(--primary-blue, #00aaff);
  border: 1px solid rgba(0,170,255,0.25);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 3px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  background: rgba(255,255,255,0.03);
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  min-width: 0;
}
.metric.primary {
  background: rgba(0,255,136,0.05);
  border: 1px solid rgba(0,255,136,0.2);
}
.metric.primary.negative {
  background: rgba(255,77,106,0.05);
  border-color: rgba(255,77,106,0.25);
}
.m-label {
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.m-value {
  font-size: 0.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.metric.primary.positive .m-value { color: var(--success-green, #00ff88); }
.metric.primary.negative .m-value { color: #ff4d6a; }
.m-value.neg { color: #ff4d6a; }

.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  min-width: 0;
}

.agent-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  overflow: hidden;
}
.agent-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0,255,136,0.3);
}
.agent-empty {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
}
.agent-info { display: flex; flex-direction: column; min-width: 0; line-height: 1.1; }
.agent-info small {
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}
.agent-info strong {
  font-size: 0.7rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.unassigned .agent-info strong { color: rgba(255,255,255,0.5); }

.followers {
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .metrics { grid-template-columns: repeat(2, 1fr); }
}
</style>
