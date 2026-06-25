<script setup lang="ts">
import { computed } from 'vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'

interface Bot {
  id: string
  name: string
  status: 'live' | 'paused' | 'error' | 'stopped' | string
  capital_allocated_usd: number
  pnl_today_usd: number
  pnl_30d_pct: number
  trades_30d: number
  uptime_pct: number
  agent_id: string
}

const props = defineProps<{ bot: Bot }>()
defineEmits<{
  (e: 'open', id: string): void
  (e: 'toggle', id: string): void
}>()

const statusTone = computed(() => {
  if (props.bot.status === 'live') return 'success'
  if (props.bot.status === 'paused') return 'warning'
  if (props.bot.status === 'error') return 'danger'
  return 'neutral'
})
</script>

<template>
  <UICard
    :title="bot.name"
    :dominant="bot.status === 'live'"
    hoverable
    @click="$emit('open', bot.id)"
  >
    <template #action>
      <UIPill :tone="statusTone" show-dot>{{ bot.status }}</UIPill>
    </template>
    <UIMetricRow :cols="5">
      <UIStat label="Capital" :value="bot.capital_allocated_usd" suffix="USD" :precision="0" />
      <UIStat label="PnL Today" :value="bot.pnl_today_usd" tone="auto" suffix="USD" />
      <UIStat label="PnL 30d" :value="bot.pnl_30d_pct" tone="auto" suffix="%" />
      <UIStat label="Trades 30d" :value="bot.trades_30d" />
      <UIStat label="Uptime" :value="bot.uptime_pct" suffix="%" />
    </UIMetricRow>
    <template #footer>
      <span class="muted">
        Agent: <NuxtLink :to="`/agents/${bot.agent_id}`" @click.stop>{{ bot.agent_id }}</NuxtLink>
      </span>
      <button class="link-btn" @click.stop="$emit('toggle', bot.id)">
        {{ bot.status === 'live' ? 'Pause' : 'Resume' }} →
      </button>
    </template>
  </UICard>
</template>

<style scoped>
.muted { color: rgba(255,255,255,0.5); font-size: 0.75rem; margin: 0; }
.muted a { color: var(--primary-green, #00ff88); text-decoration: none; }
.muted a:hover { text-decoration: underline; }

.link-btn {
  background: none;
  border: none;
  color: var(--primary-green, #00ff88);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0;
}
.link-btn:hover { text-decoration: underline; }
</style>
