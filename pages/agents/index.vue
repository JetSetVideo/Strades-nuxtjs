<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { allowsAny, allowsValue, cycleKey, type FilterTriState } from '~/utils/priceFilters'
import { useAgentsStore } from '@/stores/agents'
import { useOpinionsStore } from '@/stores/opinions'
import { useCommunityStore, type CommunityUser } from '@/stores/community'
import { useUsersStore } from '@/stores/users'
import { useStrategiesStore } from '@/stores/strategies'
import { assetClassTheme } from '~/utils/assetClass'
import { isPaidRole } from '~/utils/profileDesk'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UIPill from '@/components/UI/Pill.vue'
import AgentAvatarCard from '@/components/Agent/AvatarCard.vue'
import CommunityPersonCard from '@/components/Community/PersonCard.vue'
import StrategyCard from '@/components/Strategy/Card.vue'

definePageMeta({ title: 'Avatar Marketplace', layout: 'default' })

type Source = 'people' | 'agents' | 'strategies'

const agents = useAgentsStore()
const opinions = useOpinionsStore()
const community = useCommunityStore()
const users = useUsersStore()
const strategies = useStrategiesStore()

const loading = ref(true)
const source = ref<Source>('agents')
const sortKey = ref('performance')
const search = ref('')
const extraFollow = ref<Record<string, boolean>>({})
const strategyFollow = ref<Record<string, boolean>>({})

const kindStates = reactive<Record<string, FilterTriState>>({})
const modelStates = reactive<Record<string, FilterTriState>>({})
const styleStates = reactive<Record<string, FilterTriState>>({})
const classStates = reactive<Record<string, FilterTriState>>({})
const statusStates = reactive<Record<string, FilterTriState>>({})
const peopleStyle = reactive<Record<string, FilterTriState>>({})
const verifiedStates = reactive<Record<string, FilterTriState>>({})
const peopleClass = reactive<Record<string, FilterTriState>>({})
const stratCategory = reactive<Record<string, FilterTriState>>({})
const stratRisk = reactive<Record<string, FilterTriState>>({})
const stratStatus = reactive<Record<string, FilterTriState>>({})
const stratType = reactive<Record<string, FilterTriState>>({})

onMounted(async () => {
  await Promise.all([
    agents.hydrated ? Promise.resolve() : agents.fetchAgents(),
    community.hydrated ? Promise.resolve() : community.fetchCommunity(),
    users.users.length ? Promise.resolve() : users.fetchUsers(),
    strategies.strategies.length ? Promise.resolve() : strategies.fetchStrategies(),
  ])
  loading.value = false
})

function asRate(n: number) {
  if (!Number.isFinite(n)) return 0
  return n > 1 ? n / 100 : n
}

function labelOf(id: string) {
  return id.replace(/_/g, ' ')
}

function classOf(symbol: string): CommunityUser['specialization'][number] | null {
  const id = assetClassTheme(symbol).id
  if (id === 'precious_metals' || id === 'commodities') return 'commodities'
  if (id === 'fiat' || id === 'crypto' || id === 'stocks') return id
  return null
}

function optionsFrom(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort().map(id => ({ id, label: labelOf(id) }))
}

const people = computed<CommunityUser[]>(() => {
  const byId = new Map(users.users.map(row => [row.id, row]))
  const seen = new Set<string>()
  const cards: CommunityUser[] = []
  for (const person of community.list) {
    seen.add(person.id)
    const row = byId.get(person.id)
    cards.push({
      ...person,
      handle: row?.username || person.handle || person.username,
      verified: row?.is_verified ?? person.verified ?? false,
      premium: isPaidRole(row?.role) || person.premium,
      trading_style: person.trading_style || row?.trading_style || '',
      win_rate: asRate(person.win_rate || row?.win_rate || 0),
      last_30d_pnl_pct: person.last_30d_pnl_pct ?? row?.performance_30d ?? 0,
      followers: person.followers || row?.followers_count || 0,
      is_friend: person.is_friend || !!extraFollow.value[person.id],
    })
  }
  for (const row of users.users) {
    if (seen.has(row.id)) continue
    const classes = [...new Set(row.preferred_assets.map(classOf).filter((id): id is CommunityUser['specialization'][number] => !!id))]
    cards.push({
      id: row.id,
      username: `${row.first_name} ${row.last_name}`.trim() || row.username,
      handle: row.username,
      avatar_url: '',
      bio: row.bio,
      is_friend: !!extraFollow.value[row.id],
      online: row.is_online,
      timezone: row.timezone,
      specialization: classes as CommunityUser['specialization'],
      trading_style: row.trading_style,
      win_rate: asRate(row.win_rate),
      last_30d_pnl_pct: row.performance_30d,
      followers: row.followers_count,
      match_score: 0,
      last_active_at: row.last_login,
      verified: row.is_verified,
      premium: isPaidRole(row.role),
    })
  }
  return cards
})

const agentList = computed(() => agents.all)
const strategyList = computed(() => strategies.strategies)

const sortOptions = computed(() => {
  if (source.value === 'people') {
    return [
      { id: 'pnl', label: '30d' },
      { id: 'win', label: 'Win' },
      { id: 'followers', label: 'Followers' },
    ]
  }
  if (source.value === 'strategies') {
    return [
      { id: 'return', label: 'Return' },
      { id: 'sharpe', label: 'Sharpe' },
      { id: 'win', label: 'Win' },
      { id: 'followers', label: 'Followers' },
    ]
  }
  return [
    { id: 'performance', label: 'PnL' },
    { id: 'sharpe', label: 'Sharpe' },
    { id: 'confidence', label: 'Confidence' },
    { id: 'popular', label: 'Trades' },
    { id: 'drawdown', label: 'Drawdown' },
  ]
})

watch(source, () => {
  if (!sortOptions.value.some(option => option.id === sortKey.value)) {
    sortKey.value = sortOptions.value[0]?.id || 'performance'
  }
})

function matches(query: string, parts: Array<string | undefined>) {
  if (!query) return true
  return parts.some(part => (part || '').toLowerCase().includes(query))
}

const filteredPeople = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = people.value.filter(person =>
    allowsValue(person.trading_style, peopleStyle)
    && allowsValue(person.verified ? 'verified' : 'open', verifiedStates)
    && allowsAny(person.specialization, peopleClass)
    && matches(q, [person.username, person.handle, person.bio, person.trading_style])
  )
  const ranked = [...list]
  if (sortKey.value === 'win') ranked.sort((a, b) => b.win_rate - a.win_rate)
  else if (sortKey.value === 'followers') ranked.sort((a, b) => b.followers - a.followers)
  else ranked.sort((a, b) => b.last_30d_pnl_pct - a.last_30d_pnl_pct)
  return ranked
})

const filteredAgents = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = agentList.value.filter(agent =>
    allowsValue(agent.kind, kindStates)
    && allowsValue(agent.model_type, modelStates)
    && allowsValue(agent.trading_style, styleStates)
    && allowsValue(agent.training_state.status, statusStates)
    && allowsAny(agent.specialization, classStates)
    && matches(q, [agent.name, agent.tagline, agent.trading_style, ...agent.specialization])
  )
  const ranked = [...list]
  if (sortKey.value === 'confidence') ranked.sort((a, b) => b.confidence - a.confidence)
  else if (sortKey.value === 'sharpe') ranked.sort((a, b) => b.performance.sharpe - a.performance.sharpe)
  else if (sortKey.value === 'popular') ranked.sort((a, b) => b.performance.trades_total - a.performance.trades_total)
  else if (sortKey.value === 'drawdown') ranked.sort((a, b) => b.performance.max_drawdown_pct - a.performance.max_drawdown_pct)
  else ranked.sort((a, b) => b.performance.live_pnl_pct - a.performance.live_pnl_pct)
  return ranked
})

const filteredStrategies = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = strategyList.value.filter(strategy =>
    allowsValue(strategy.category, stratCategory)
    && allowsValue(strategy.risk_level, stratRisk)
    && allowsValue(strategy.status, stratStatus)
    && allowsValue(strategy.type, stratType)
    && matches(q, [strategy.name, strategy.description, strategy.category, ...(strategy.tags || []), ...(strategy.target_assets || [])])
  )
  const ranked = [...list]
  if (sortKey.value === 'sharpe') ranked.sort((a, b) => b.sharpe_ratio - a.sharpe_ratio)
  else if (sortKey.value === 'win') ranked.sort((a, b) => b.win_rate - a.win_rate)
  else if (sortKey.value === 'followers') ranked.sort((a, b) => b.followers_count - a.followers_count)
  else ranked.sort((a, b) => b.total_return_percentage - a.total_return_percentage)
  return ranked
})

const visibleCount = computed(() => {
  if (source.value === 'people') return filteredPeople.value.length
  if (source.value === 'strategies') return filteredStrategies.value.length
  return filteredAgents.value.length
})

const kpis = computed(() => {
  if (source.value === 'people') {
    return [
      { label: 'People', value: people.value.length },
      { label: 'Verified', value: people.value.filter(person => person.verified).length },
      { label: 'Showing', value: filteredPeople.value.length },
    ]
  }
  if (source.value === 'strategies') {
    return [
      { label: 'Strategies', value: strategyList.value.length },
      { label: 'Active', value: strategyList.value.filter(strategy => strategy.status === 'active').length },
      { label: 'Showing', value: filteredStrategies.value.length },
    ]
  }
  const list = agentList.value
  const top = list.length ? Math.max(...list.map(agent => agent.performance.live_pnl_pct)) : 0
  return [
    { label: 'Agents', value: list.length },
    { label: 'Classifiers', value: list.filter(agent => agent.model_type === 'classifier').length },
    { label: 'Plugged', value: opinions.activeCount },
    { label: 'Top PnL', value: list.length ? top.toFixed(1) : '—', suffix: '%' },
  ]
})

function followPerson(person: CommunityUser) {
  if (community.list.some(row => row.id === person.id)) community.toggleFriend(person.id)
  else extraFollow.value = { ...extraFollow.value, [person.id]: !extraFollow.value[person.id] }
}

function followStrategy(id: string) {
  strategyFollow.value = { ...strategyFollow.value, [id]: !strategyFollow.value[id] }
}
</script>

<template>
  <UIScreenShell
    title="Follow"
    :kpis="kpis"
    subtitle="People, agents, and strategies already in the book"
  >
    <template #actions>
      <UIPill v-if="opinions.activeCount" tone="info" show-dot>{{ opinions.activeCount }} plugged</UIPill>
    </template>

    <div class="sources" role="tablist" aria-label="Who to follow">
      <button type="button" role="tab" :class="{ on: source === 'people' }" :aria-selected="source === 'people'" @click="source = 'people'">
        People <em>{{ people.length }}</em>
      </button>
      <button type="button" role="tab" :class="{ on: source === 'agents' }" :aria-selected="source === 'agents'" @click="source = 'agents'">
        Agents <em>{{ agentList.length }}</em>
      </button>
      <button type="button" role="tab" :class="{ on: source === 'strategies' }" :aria-selected="source === 'strategies'" @click="source = 'strategies'">
        Strategies <em>{{ strategyList.length }}</em>
      </button>
    </div>

    <div class="market-toolbar">
      <input
        v-model="search"
        type="search"
        class="search-input"
        placeholder="Search this list"
        aria-label="Search"
      />

      <template v-if="source === 'agents'">
        <div class="chip-rail"><UIOpChips nowrap label="Kind" :options="optionsFrom(agentList.map(agent => agent.kind))" :states="kindStates" @cycle="id => cycleKey(kindStates, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Model" :options="optionsFrom(agentList.map(agent => agent.model_type))" :states="modelStates" @cycle="id => cycleKey(modelStates, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Style" :options="optionsFrom(agentList.map(agent => agent.trading_style))" :states="styleStates" @cycle="id => cycleKey(styleStates, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Class" :options="optionsFrom(agentList.flatMap(agent => agent.specialization))" :states="classStates" @cycle="id => cycleKey(classStates, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Status" :options="optionsFrom(agentList.map(agent => agent.training_state.status))" :states="statusStates" @cycle="id => cycleKey(statusStates, id)" /></div>
      </template>
      <template v-else-if="source === 'people'">
        <div class="chip-rail"><UIOpChips nowrap label="Style" :options="optionsFrom(people.map(person => person.trading_style))" :states="peopleStyle" @cycle="id => cycleKey(peopleStyle, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Trust" :options="[{ id: 'verified', label: 'verified' }, { id: 'open', label: 'open' }]" :states="verifiedStates" @cycle="id => cycleKey(verifiedStates, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Class" :options="optionsFrom(people.flatMap(person => person.specialization))" :states="peopleClass" @cycle="id => cycleKey(peopleClass, id)" /></div>
      </template>
      <template v-else>
        <div class="chip-rail"><UIOpChips nowrap label="Category" :options="optionsFrom(strategyList.map(strategy => strategy.category))" :states="stratCategory" @cycle="id => cycleKey(stratCategory, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Risk" :options="optionsFrom(strategyList.map(strategy => strategy.risk_level))" :states="stratRisk" @cycle="id => cycleKey(stratRisk, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Status" :options="optionsFrom(strategyList.map(strategy => strategy.status))" :states="stratStatus" @cycle="id => cycleKey(stratStatus, id)" /></div>
        <div class="chip-rail"><UIOpChips nowrap label="Type" :options="optionsFrom(strategyList.map(strategy => strategy.type))" :states="stratType" @cycle="id => cycleKey(stratType, id)" /></div>
      </template>

      <div class="sort-row" role="group" aria-label="Sort">
        <button
          v-for="option in sortOptions"
          :key="option.id"
          type="button"
          :class="{ on: sortKey === option.id }"
          @click="sortKey = option.id"
        >{{ option.label }}</button>
      </div>
    </div>

    <p v-if="!loading && visibleCount === 0" class="empty">Nothing in this filter.</p>

    <div v-if="source === 'agents' && filteredAgents.length" class="agent-grid">
      <AgentAvatarCard
        v-for="agent in filteredAgents"
        :key="agent.id"
        :agent="agent"
        @select="id => navigateTo(`/agents/${id}`)"
      />
    </div>

    <div v-else-if="source === 'people' && filteredPeople.length" class="agent-grid">
      <div v-for="person in filteredPeople" :key="person.id" class="strategy-cell">
        <CommunityPersonCard
          :user="person"
          @profile="id => navigateTo(`/profile/${id}`)"
          @message="() => navigateTo('/chat')"
        />
        <button
          type="button"
          class="follow"
          :class="{ on: person.is_friend }"
          @click="followPerson(person)"
        >{{ person.is_friend ? 'Following' : 'Follow' }}</button>
      </div>
    </div>

    <div v-else-if="source === 'strategies' && filteredStrategies.length" class="agent-grid">
      <div v-for="strategy in filteredStrategies" :key="strategy.id" class="strategy-cell">
        <StrategyCard :strategy="strategy" @select="id => navigateTo(`/strategy/${id}`)" />
        <button
          type="button"
          class="follow"
          :class="{ on: strategyFollow[strategy.id] }"
          @click="followStrategy(strategy.id)"
        >{{ strategyFollow[strategy.id] ? 'Following' : 'Follow' }}</button>
      </div>
    </div>
  </UIScreenShell>
</template>

<style scoped>
.sources {
  display: flex;
  width: 100%;
  gap: 0.3rem;
}
.sources button {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.75);
  border-radius: 999px;
  padding: 0.28rem 0.4rem;
  font: inherit;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.sources button em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.45);
}
.sources button.on {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.sources button.on em { color: inherit; }

.market-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.search-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: white;
  padding: 0.32rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  width: 100%;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: var(--primary-blue); }
.chip-rail {
  overflow-x: auto;
  width: 100%;
  min-width: 0;
}
.chip-rail :deep(.op-chips) {
  flex-wrap: nowrap;
  width: max-content;
  min-width: 100%;
}
.sort-row {
  display: flex;
  width: 100%;
  gap: 0.3rem;
}
.sort-row button {
  flex: 1 1 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.72);
  border-radius: 999px;
  padding: 0.16rem 0.3rem;
  font: inherit;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}
.sort-row button.on { border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }

.empty {
  margin: 0;
  padding: 1.2rem 0.4rem;
  text-align: center;
  color: rgba(255,255,255,0.55);
  font-size: 0.8rem;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
}
.strategy-cell {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.follow {
  width: 100%;
  padding: 0.32rem;
  font: inherit;
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid rgba(79, 168, 255, 0.7);
  background: rgba(0, 140, 255, 0.16);
  color: #8ec8ff;
  border-radius: 10px 0 10px 0;
  cursor: pointer;
}
.follow.on {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0, 255, 136, 0.1);
}
</style>
