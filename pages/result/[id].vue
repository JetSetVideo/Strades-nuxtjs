<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStrategies } from '@/composables/useStrategies'
import StrategyPnlChart from '@/components/StrategyPnlChart.vue'
import StrategyRating from '@/components/StrategyRating.vue'
import ShareButton from '@/components/Button/Share.vue'

const route = useRoute()
const strategyId = route.params.id as string

const { strategies, fetchStrategies, fetchStrategyDetail, generateComplementary, generateOpposite } = useStrategies()

const details = ref<{ code: any; rating: any; history: Array<{ date: string; pnl: number; equity: number; tradesCount: number }>; trades: any[] } | null>(null)
const summary = computed(() => strategies.value.find(s => s.id === strategyId) || null)

const percentChange = computed(() => {
  if (!details.value?.history?.length) return summary.value ? summary.value.monthlyGain : 0
  const first = details.value.history[0]
  const last = details.value.history[details.value.history.length - 1]
  if (!first || !last || !first.equity) return 0
  return ((last.equity - first.equity) / first.equity) * 100
})

const usersInvolved = ref<{ id: string; name: string }[]>([])

async function loadProfiles(profileIds: string[]) {
  try {
    const profiles = await $fetch<Array<{ id: string; name: string }>>('/data/strategies/profiles.json')
    usersInvolved.value = profiles.filter(p => profileIds.includes(p.id))
  } catch {
    usersInvolved.value = profileIds.map(id => ({ id, name: id }))
  }
}

onMounted(async () => {
  await fetchStrategies()
  try {
    details.value = await fetchStrategyDetail(strategyId)
    await loadProfiles(details.value.code?.profiles || [])
  } catch (e) {
    // ignore, UI will show fallbacks
  }
})

function goToStrategy() {
  navigateTo(`/strategy/${strategyId}`)
}

async function createComplementary() {
  const s = await generateComplementary(strategyId)
  navigateTo(`/strategy/${s.id}`)
}

async function createOpposite() {
  const s = await generateOpposite(strategyId)
  navigateTo(`/strategy/${s.id}`)
}
</script>

<template>
  <div class="result-page">
    <div class="header">
      <h1>Backtest Result</h1>
      <button class="primary" @click="goToStrategy">Open Strategy</button>
    </div>

    <div class="meta">
      <div class="meta-item">
        <span class="label">Strategy</span>
        <span class="value">{{ summary?.name || strategyId }}</span>
      </div>
      <div class="meta-item">
        <span class="label">Period</span>
        <span class="value">{{ details?.code?.period?.start }} → {{ details?.code?.period?.end }}</span>
      </div>
      <div class="meta-item">
        <span class="label">Assets</span>
        <span class="value">{{ details?.code?.assets?.entry }} → {{ details?.code?.assets?.exit }}</span>
      </div>
      <div class="meta-item">
        <span class="label">Trades</span>
        <span class="value">{{ summary?.numberOfTrades ?? (details?.history?.[details?.history?.length-1]?.tradesCount || 0) }}</span>
      </div>
      <div class="meta-item">
        <span class="label">Change</span>
        <span class="value" :class="{ pos: percentChange >= 0, neg: percentChange < 0 }">{{ percentChange.toFixed(2) }}%</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>P&amp;L</h2>
        <StrategyPnlChart v-if="details?.history?.length" :history="details!.history" />
        <div v-else class="empty">No history available</div>
      </div>

      <div class="card">
        <h2>Ratings</h2>
        <StrategyRating :risk="details?.rating?.risk || 0" :complexity="details?.rating?.complexity || '0/10'" :computationalCost="details?.rating?.computationalCost || 0" />
      </div>

      <div class="card">
        <h2>Users involved</h2>
        <div class="chips">
          <span v-for="u in usersInvolved" :key="u.id" class="chip">{{ u.name }}</span>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="secondary" @click="createComplementary">Create complementary strategy</button>
      <button class="secondary" @click="createOpposite">Create opposite strategy</button>
      <ShareButton />
      <button class="ghost" @click="goToStrategy">Publish</button>
      <button class="ghost" @click="goToStrategy">Store</button>
    </div>
  </div>
</template>

<style scoped>
.result-page { padding: var(--spacing-lg); color: var(--text-white); }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg); }
.primary { background: var(--button-primary); color: #000; border: none; padding: 8px 14px; border-radius: var(--radius-md); cursor: pointer; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
.meta-item { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--spacing-md); }
.label { color: var(--text-light-gray); display: block; font-size: 12px; }
.value { font-weight: 600; }
.value.pos { color: var(--success-green); }
.value.neg { color: var(--error-red); }
.grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: var(--spacing-md); }
.card { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--spacing-md); }
.empty { color: var(--text-gray); padding: var(--spacing-sm); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: rgba(0,0,0,0.3); border: 1px solid var(--border-secondary); border-radius: 999px; padding: 4px 10px; font-size: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-top: var(--spacing-lg); }
.secondary { background: transparent; color: var(--text-white); border: 1px solid var(--border-accent); padding: 8px 14px; border-radius: var(--radius-md); cursor: pointer; }
.ghost { background: transparent; color: var(--text-white); border: 1px solid var(--border-primary); padding: 8px 14px; border-radius: var(--radius-md); cursor: pointer; }

@media (max-width: 960px) {
  .grid { grid-template-columns: 1fr; }
}
</style>