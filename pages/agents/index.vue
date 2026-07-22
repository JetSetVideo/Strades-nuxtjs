<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAgentsStore, type Agent } from '@/stores/agents'
import { useOpinionsStore } from '@/stores/opinions'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AgentAvatarCard from '@/components/Agent/AvatarCard.vue'

definePageMeta({ title: 'Avatar Marketplace', layout: 'default' })

const agents = useAgentsStore()
const opinions = useOpinionsStore()

const loading = ref(true)
const sortKey = ref<'performance' | 'confidence' | 'popular'>('performance')
const filterStyle = ref<string>('all')
const search = ref('')

onMounted(async () => {
  if (!agents.hydrated) await agents.fetchAvatars()
  loading.value = false
})

const STYLES = ['all', 'swing_trader', 'day_trader', 'scalper', 'long_term', 'arbitrageur', 'momentum']

// Public + forked agents (not the user's own personal avatar)
const catalog = computed(() =>
  agents.all.filter(a => a.kind !== 'personal' && a.share_state.is_public)
)

const filtered = computed(() => {
  let list = [...catalog.value]
  // Filter by trading style
  if (filterStyle.value !== 'all')
    list = list.filter(a => a.trading_style === filterStyle.value)
  // Search by name/tagline/tags
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.tagline.toLowerCase().includes(q) ||
      a.specialization.some(s => s.toLowerCase().includes(q))
    )
  }
  // Sort
  switch (sortKey.value) {
    case 'confidence':
      list.sort((a, b) => b.confidence - a.confidence)
      break
    case 'performance':
      list.sort((a, b) => b.performance.live_pnl_pct - a.performance.live_pnl_pct)
      break
    case 'popular':
      list.sort((a, b) => (b.performance.trades_total || 0) - (a.performance.trades_total || 0))
      break
  }
  return list
})

const kpis = computed(() => [
  { label: 'Total agents', value: catalog.value.length },
  { label: 'Plugged by you', value: opinions.activeCount },
  { label: 'Top PnL', value: catalog.value.length ? Math.max(...catalog.value.map(a => a.performance.live_pnl_pct)).toFixed(1) : '—', suffix: '%' },
  { label: 'Avg confidence', value: catalog.value.length ? (catalog.value.reduce((s, a) => s + a.confidence, 0) / catalog.value.length * 100).toFixed(0) : '—', suffix: '%' },
])

const handlePlug = (agentId: string, plugged: boolean) => {
  if (plugged) opinions.plug(agentId, 0.5)
  else opinions.unplug(agentId)
}

const isPlugged = (id: string) => opinions.isPlugged(id)
</script>

<template>
  <UIScreenShell
    title="Avatar Marketplace"
    :kpis="kpis"
    subtitle="Discover, plug, and fork AI avatars that trade like real people"
  >
    <template #actions>
      <UIPill v-if="opinions.activeCount" tone="info" show-dot>{{ opinions.activeCount }} plugged</UIPill>
      <UIPill v-if="opinions.swarmConfidence > 0.5" tone="success" show-dot>Swarm active</UIPill>
    </template>

    <!-- Filters -->
    <div class="market-toolbar">
      <input
        v-model="search"
        type="search"
        class="search-input"
        placeholder="Search by name, tagline, specialization…"
        aria-label="Search agents"
      />
      <div class="filter-chips">
        <button
          v-for="s in STYLES"
          :key="s"
          :class="['style-chip', { active: filterStyle === s }]"
          @click="filterStyle = s"
        >{{ s.replace(/_/g, ' ') }}</button>
      </div>
      <div class="sort-row">
        <span class="sort-label">Sort:</span>
        <button :class="{ active: sortKey === 'performance' }" @click="sortKey = 'performance'">PnL</button>
        <button :class="{ active: sortKey === 'confidence' }" @click="sortKey = 'confidence'">Confidence</button>
        <button :class="{ active: sortKey === 'popular' }" @click="sortKey = 'popular'">Trades</button>
      </div>
    </div>

    <!-- Grid -->
    <div v-if="!loading && filtered.length === 0" class="empty">
      <p>No avatars match this filter.</p>
    </div>

    <div v-if="filtered.length" class="agent-grid">
      <div v-for="agent in filtered" :key="agent.id" class="agent-cell">
        <AgentAvatarCard
          :agent="agent"
          @select="(id) => navigateTo(`/agents/${id}`)"
        />
        <button
          class="plug-action"
          :class="{ plugged: isPlugged(agent.id) }"
          @click="handlePlug(agent.id, !isPlugged(agent.id))"
        >
          {{ isPlugged(agent.id) ? '✓ Plugged' : '+ Plug into swarm' }}
        </button>
      </div>
    </div>
  </UIScreenShell>
</template>

<style scoped>
.market-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.search-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: white;
  padding: 0.45rem 0.65rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.8rem;
  width: 100%;
  box-sizing: border-box;
}
.search-input:focus {
  outline: none;
  border-color: var(--primary-blue);
}
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.style-chip {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: var(--text-gray);
  border-radius: 999px;
  cursor: pointer;
  text-transform: capitalize;
}
.style-chip.active {
  background: color-mix(in oklch, var(--primary-blue) 25%, transparent);
  border-color: var(--primary-blue);
  color: white;
}
.sort-row {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.7rem;
}
.sort-label { color: var(--text-gray); text-transform: uppercase; letter-spacing: 0.05em; }
.sort-row button {
  padding: 0.15rem 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text-gray);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
}
.sort-row button.active {
  background: rgba(255,255,255,0.1);
  color: white;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-gray);
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 0.5rem;
}
.agent-cell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.plug-action {
  width: 100%;
  padding: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid color-mix(in oklch, var(--primary-blue) 30%, transparent);
  background: color-mix(in oklch, var(--primary-blue) 10%, transparent);
  color: var(--primary-blue);
  border-radius: var(--app-border-radius, 4px);
  cursor: pointer;
  transition: background 0.15s;
}
.plug-action:hover { background: color-mix(in oklch, var(--primary-blue) 25%, transparent); }
.plug-action.plugged {
  background: color-mix(in oklch, var(--success-green, #00ff88) 15%, transparent);
  border-color: var(--success-green, #00ff88);
  color: var(--success-green, #00ff88);
}
</style>
