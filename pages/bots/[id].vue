<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBotsStore } from '@/stores/bots'
import { useAgentsStore } from '@/stores/agents'
import { useStrategiesStore } from '@/stores/strategies'
import { usePlatformsStore } from '@/stores/platforms'
import { seededRandom } from '@/composables/useSeededRandom'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

import StrategyEquityCurve from '@/components/Strategy/EquityCurve.vue'
import BotLinkRow from '@/components/Bot/LinkRow.vue'
import BotFillsList from '@/components/Bot/FillsList.vue'

definePageMeta({ title: 'Bot', layout: 'default' })

const route = useRoute()
const botId = computed(() => String(route.params.id))

const bots = useBotsStore()
const agents = useAgentsStore()
const strategies = useStrategiesStore()
const platforms = usePlatformsStore()

const loading = ref(true)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    !bots.hydrated      ? bots.fetchBots()           : Promise.resolve(),
    !agents.hydrated    ? agents.fetchAgents()       : Promise.resolve(),
    !platforms.hydrated ? platforms.fetchPlatforms() : Promise.resolve(),
    strategies.fetchStrategies()
  ])
  loading.value = false
})

const bot = computed(() => bots.list.find(b => b.id === botId.value))
const agent = computed(() => bot.value ? agents.getAvatarById(bot.value.agent_id) : null)
const platform = computed(() => bot.value ? platforms.list.find(p => p.id === bot.value!.platform_id) : null)
const strategy = computed(() => bot.value && bot.value.strategy_id
  ? (strategies.strategies ?? []).find((s: any) => s.id === bot.value!.strategy_id)
  : null)

const statusTone = computed(() => {
  switch (bot.value?.status) {
    case 'live':    return 'success'
    case 'paused':  return 'warning'
    case 'stopped': return 'danger'
    case 'error':   return 'danger'
    default:        return 'neutral'
  }
})

const startedRel = computed(() => {
  if (!bot.value?.started_at) return '—'
  const days = Math.floor((Date.now() - new Date(bot.value.started_at).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
})

const nextActionRel = computed(() => {
  if (!bot.value?.next_action_at) return null
  const ms = new Date(bot.value.next_action_at).getTime() - Date.now()
  if (ms < 0)           return 'now'
  if (ms < 60_000)      return `in ${Math.round(ms / 1000)}s`
  if (ms < 3_600_000)   return `in ${Math.round(ms / 60_000)}m`
  if (ms < 86_400_000)  return `in ${Math.round(ms / 3_600_000)}h`
  return `in ${Math.round(ms / 86_400_000)}d`
})

interface Fill {
  id: string; ts: number; side: 'buy' | 'sell'
  asset: string; price: number; size: number; pnl: number
}

const recentFills = computed<Fill[]>(() => {
  if (!bot.value || !strategy.value) return []
  const rand = seededRandom(bot.value.id + 'fills')
  const assets = (strategy.value as any).target_assets ?? ['BTC']
  const n = Math.min(12, bot.value.trades_30d)
  const out: Fill[] = []
  for (let i = 0; i < n; i++) {
    const isBuy = rand() < 0.5
    const asset = assets[Math.floor(rand() * assets.length)]
    out.push({
      id: `f_${bot.value.id}_${i}`,
      ts: Date.now() - (i + 1) * 3_600_000 * (1 + rand() * 4),
      side: isBuy ? 'buy' : 'sell',
      asset,
      price: 100 + rand() * 100000,
      size: Number((rand() * 5).toFixed(3)),
      pnl: (rand() - 0.45) * 200
    })
  }
  return out
})

function toggleStatus() {
  if (!bot.value) return
  bots.toggleStatus(bot.value.id)
}
</script>

<template>
  <div v-if="loading" class="loading-shell">
    <AppSkeletonLoader height="20px" width="200px" />
    <div class="skel-metrics">
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
    </div>
    <AppSkeletonLoader height="100px" />
    <AppSkeletonLoader height="200px" />
  </div>

  <div v-else-if="bot" class="bot-detail">
    <UIPageHeader :title="bot.name" :subtitle="`Bot · started ${startedRel}`">
      <template #actions>
        <UIPill :tone="statusTone" show-dot>{{ bot.status }}</UIPill>
        <button
          class="action"
          :disabled="bot.status === 'stopped' || bot.status === 'error'"
          @click="toggleStatus"
        >
          {{ bot.status === 'live' ? '⏸ Pause' : '▶ Resume' }}
        </button>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="Capital"   :value="bot.capital_allocated_usd" :precision="0" suffix="USD" size="lg" />
      <UIStat label="PnL today" :value="bot.pnl_today_usd"          tone="auto" :precision="0" suffix="USD" size="md" />
      <UIStat label="PnL 30d"   :value="bot.pnl_30d_pct"            tone="auto" suffix="%" :precision="2" size="md" />
      <UIStat label="Uptime"    :value="bot.uptime_pct"             suffix="%" :precision="1" size="md" />
    </UIMetricRow>

    <UICard title="Equity · 30d">
      <template #action>
        <UIPill ghost tone="neutral">{{ bot.trades_30d }} trades</UIPill>
      </template>
      <StrategyEquityCurve
        :seed="`bot-${bot.id}`"
        :initial-value="bot.capital_allocated_usd"
        :final-value="bot.capital_allocated_usd + bot.pnl_30d_usd"
        :steps="30"
      />
    </UICard>

    <div class="stack-grid">
      <UICard title="Agent">
        <BotLinkRow
          v-if="agent"
          variant="agent"
          :to="`/agents/${agent.id}`"
          :avatar-url="agent.avatar_url"
          :title="agent.name"
          :subtitle="`${agent.trading_style} · v${agent.training_state.version}`"
        />
        <UIEmptyState v-else size="sm" icon="◯" message="No agent linked." />
      </UICard>

      <UICard title="Strategy">
        <BotLinkRow
          v-if="strategy"
          variant="strategy"
          :to="`/strategy/${strategy.id}`"
          mark="◫"
          mark-color="var(--primary-blue, #00aaff)"
          mark-bg="rgba(0,170,255,0.15)"
          :title="strategy.name"
          :subtitle="(strategy as any).target_assets?.join(' · ') || (strategy as any).category"
        />
        <UIEmptyState v-else size="sm" icon="◯" message="Strategy not linked." />
      </UICard>

      <UICard title="Platform">
        <BotLinkRow
          v-if="platform"
          variant="platform"
          to="/apis"
          :mark="platform.logo"
          :mark-bg="platform.color"
          mark-color="#fff"
          :title="platform.name"
          :subtitle="`API health ${Math.round(platform.api_health * 100)}% · ${platform.status.replace('_', ' ')}`"
        />
        <UIEmptyState v-else size="sm" icon="◯" message="No platform configured." />
      </UICard>
    </div>

    <div class="stack-grid">
      <UICard title="Schedule" v-if="nextActionRel">
        <div class="schedule-row">
          <span class="schedule-icon">↻</span>
          <div class="schedule-body">
            <strong>Next action {{ nextActionRel }}</strong>
            <small>{{ new Date(bot.next_action_at!).toLocaleString() }}</small>
          </div>
        </div>
      </UICard>

      <UICard title="Tags" v-if="bot.tags?.length">
        <div class="tag-row">
          <span v-for="t in bot.tags" :key="t" class="tag">{{ t }}</span>
        </div>
      </UICard>
    </div>

    <UICard title="Recent fills">
      <template #action>
        <UIPill ghost tone="neutral">
          {{ recentFills.length }} shown · {{ bot.trades_30d }} this month
        </UIPill>
      </template>
      <UIEmptyState v-if="recentFills.length === 0" icon="◯" message="No fills yet." />
      <BotFillsList v-else :fills="recentFills" />
    </UICard>
  </div>

  <div v-else class="not-found">
    <h1>Bot not found</h1>
    <NuxtLink to="/strategies">← Back to Trading Lab</NuxtLink>
  </div>
</template>

<style scoped>
.bot-detail {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.loading-shell { display: flex; flex-direction: column; gap: 0.5rem; }
.skel-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}
@media (max-width: 640px) {
  .skel-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.not-found {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255,255,255,0.5);
}
.not-found a { color: var(--primary-green, #00ff88); }

.action {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.35rem 0.7rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: inherit;
}
.action:hover:not(:disabled) {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.action:disabled { opacity: 0.4; cursor: not-allowed; }

.stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.stack-grid > * { min-width: 0; }

.schedule-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 0.55rem;
  align-items: center;
  padding: 0.4rem 0.5rem;
  background: rgba(0,170,255,0.05);
  border: 1px solid rgba(0,170,255,0.18);
  border-radius: var(--app-border-radius, 6px);
}
.schedule-icon {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(0,170,255,0.15);
  color: var(--primary-blue, #00aaff);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  animation: schedule-spin 4s linear infinite;
}
@keyframes schedule-spin { to { transform: rotate(360deg); } }
.schedule-body {
  display: flex; flex-direction: column; gap: 0.05rem;
}
.schedule-body strong {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--primary-blue, #00aaff);
}
.schedule-body small {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.5);
}

.tag-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.75);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 999px;
  text-transform: uppercase;
}
</style>
