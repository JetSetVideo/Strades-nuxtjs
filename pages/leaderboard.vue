<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useStrategiesStore } from '@/stores/strategies'
import { useWalletStore } from '@/stores/wallet'
import { useCreditsStore } from '@/stores/credits'
import type { Competition, Contribution } from '~/types/quests'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import LeaderboardCompetition from '@/components/Leaderboard/Competition.vue'

definePageMeta({ title: 'Leaderboard', description: 'Top traders and strategies across the community.', layout: 'default' })

const usersStore = useUsersStore()
const strategiesStore = useStrategiesStore()
const walletsStore = useWalletStore()
const credits = useCreditsStore()
const { userId } = useCurrentUser()

// useLocalJson returns a plain Promise (not useFetch's { data }), so load into refs.
const competitions = ref<Competition[]>([])
const contributions = ref<Contribution[]>([])
const loading = ref(true)

type Entity = 'users' | 'strategies'
type Metric = 'profit' | 'diversity' | 'consistency' | 'trades' | 'followers' | 'sharpe' | 'winrate'

const entity = ref<Entity>('users')
const metric = ref<Metric>('profit')

const METRICS: Record<Entity, { id: Metric; label: string }[]> = {
  users: [
    { id: 'profit', label: 'Most profitable' },
    { id: 'diversity', label: 'Most diverse wallet' },
    { id: 'consistency', label: 'Most consistent' },
    { id: 'trades', label: 'Most trades' },
  ],
  strategies: [
    { id: 'profit', label: 'Most profitable' },
    { id: 'followers', label: 'Most followed' },
    { id: 'sharpe', label: 'Highest Sharpe' },
    { id: 'winrate', label: 'Best win rate' },
  ],
}

onMounted(async () => {
  credits.hydrate()
  const [comps, contribs] = await Promise.all([
    useLocalJson<Competition[]>('competitions/competitions.json', []),
    useLocalJson<Contribution[]>('competitions/contributions.json', []),
    usersStore.fetchUsers(),
    strategiesStore.strategies.length ? Promise.resolve() : strategiesStore.fetchStrategies(),
    walletsStore.wallets.length ? Promise.resolve() : walletsStore.fetchWallets(),
  ])
  competitions.value = comps
  contributions.value = contribs
  loading.value = false
})

const entityTabs = computed<TabItem[]>(() => [
  { id: 'users', label: 'Traders', count: usersStore.users.length },
  { id: 'strategies', label: 'Strategies', count: strategiesStore.strategies.length },
])
const metricTabs = computed<TabItem[]>(() => METRICS[entity.value])

function setEntity(id: string) {
  entity.value = id as Entity
  metric.value = 'profit'
}

interface Row {
  id: string
  to: string
  name: string
  sub: string
  avatar?: string
  score: number
  display: string
  isMe: boolean
}

const usd = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const pct = (n: number, signed = false) => `${signed && n > 0 ? '+' : ''}${n.toFixed(1)}%`

// Distinct assets per user across all of their wallets (not one row per wallet).
const assetsByUser = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const w of walletsStore.wallets) {
    const set = map.get(w.user_id) ?? new Set<string>()
    for (const a of w.assets ?? []) set.add((a as any).asset_id ?? (a as any).symbol ?? String(a))
    map.set(w.user_id, set)
  }
  return map
})

const rows = computed<Row[]>(() => {
  let list: Row[]
  if (entity.value === 'users') {
    list = usersStore.users.map((u: any) => {
      const diversity = assetsByUser.value.get(u.id)?.size ?? 0
      const score =
        metric.value === 'profit' ? u.total_returns ?? 0
        : metric.value === 'diversity' ? diversity
        : metric.value === 'consistency' ? u.win_rate ?? 0
        : u.total_trades ?? 0
      const display =
        metric.value === 'profit' ? usd(score)
        : metric.value === 'diversity' ? `${score} asset${score === 1 ? '' : 's'}`
        : metric.value === 'consistency' ? `${pct(score)} win`
        : `${score.toLocaleString('en-US')} trades`
      return {
        id: u.id,
        to: `/profile/${u.id}`,
        name: u.username,
        sub: [u.first_name, u.last_name].filter(Boolean).join(' '),
        avatar: u.avatar_url,
        score,
        display,
        isMe: u.id === userId.value,
      }
    })
    // Users with no wallet on file can't be ranked on diversity.
    if (metric.value === 'diversity') list = list.filter(r => assetsByUser.value.has(r.id))
  } else {
    list = strategiesStore.strategies.map(s => {
      const score =
        metric.value === 'profit' ? s.total_return_percentage ?? 0
        : metric.value === 'followers' ? s.followers_count ?? 0
        : metric.value === 'sharpe' ? s.sharpe_ratio ?? 0
        : s.win_rate ?? 0
      const display =
        metric.value === 'profit' ? pct(score, true)
        : metric.value === 'followers' ? `${score.toLocaleString('en-US')} followers`
        : metric.value === 'sharpe' ? score.toFixed(2)
        : `${pct(score)} win`
      return {
        id: s.id,
        to: `/strategy/${s.id}`,
        name: s.name,
        sub: [s.category, s.target_assets?.join(' · ')].filter(Boolean).join(' — '),
        score,
        display,
        isMe: s.creator_id === userId.value,
      }
    })
  }
  // Sort a copy — sorting the store arrays in place reorders them app-wide.
  return [...list].sort((a, b) => b.score - a.score).slice(0, 10)
})

const MEDALS = ['gold', 'silver', 'bronze']
const initials = (name: string) => name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

function handleAddContribution(c: { competitionId: string; amount: number }) {
  // Local simulation — a backend would persist this.
  contributions.value = [
    ...contributions.value,
    { id: `contrib_${Date.now()}`, userId: userId.value, ...c },
  ]
}
</script>

<template>
  <div class="leaderboard-page">
    <UIPageHeader title="Leaderboard" subtitle="Top traders and strategies across the community.">
      <template #actions>
        <UIPill tone="accent">{{ credits.balance.toLocaleString('en-US') }} credits</UIPill>
      </template>
    </UIPageHeader>

    <LeaderboardCompetition
      v-if="competitions.length"
      :competitions="competitions"
      :contributions="contributions"
      @add:contribution="handleAddContribution"
    />

    <UISectionTabs :model-value="entity" :tabs="entityTabs" @update:model-value="setEntity" />
    <UISectionTabs v-model="metric" :tabs="metricTabs" class="metric-tabs" />

    <UICard :title="`${entity === 'users' ? 'Traders' : 'Strategies'} — ${metricTabs.find(m => m.id === metric)?.label ?? ''}`" padding="tight">
      <UIEmptyState
        v-if="!loading && rows.length === 0"
        icon="◯"
        title="Nothing to rank yet"
        message="No entries carry data for this metric."
      />
      <ol v-else class="ranked-list">
        <li v-for="(r, i) in rows" :key="r.id">
          <NuxtLink :to="r.to" class="rank-row" :class="[MEDALS[i], { me: r.isMe }]">
            <span class="position">{{ i + 1 }}</span>
            <img v-if="r.avatar" :src="r.avatar" :alt="r.name" class="rank-avatar" loading="lazy" />
            <span v-else class="rank-avatar glyph" aria-hidden="true">{{ initials(r.name) }}</span>
            <span class="who">
              <span class="name">{{ r.name }}<span v-if="r.isMe" class="you">you</span></span>
              <span v-if="r.sub" class="sub">{{ r.sub }}</span>
            </span>
            <span class="value" :class="{ neg: r.score < 0 && (metric === 'profit' || metric === 'sharpe') }">{{ r.display }}</span>
          </NuxtLink>
        </li>
      </ol>
    </UICard>
  </div>
</template>

<style scoped>
.leaderboard-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}
.metric-tabs { margin-top: -0.3rem; }

.ranked-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.rank-row {
  display: grid;
  grid-template-columns: 2rem 2rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--surface-raised, rgba(255,255,255,0.02));
  border: 1px solid var(--edge-raised, rgba(255,255,255,0.05));
  border-left: 3px solid transparent;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease, transform 0.2s ease;
  min-width: 0;
}
.rank-row:hover { background: rgba(255,255,255,0.05); transform: translateX(2px); }
.rank-row.me { box-shadow: inset 0 0 0 1px var(--app-color-up, rgba(0,255,136,0.35)); }

.position {
  font-weight: 800;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.45);
  text-align: center;
}
.gold   { border-left-color: #f5c542; }
.silver { border-left-color: #c9ced6; }
.bronze { border-left-color: #cd7f32; }
.gold .position   { color: #f5c542; }
.silver .position { color: #c9ced6; }
.bronze .position { color: #cd7f32; }

.rank-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255,255,255,0.15);
}
.rank-avatar.glyph {
  display: grid;
  place-items: center;
  font-size: 0.65rem;
  font-weight: 800;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
}

.who { display: flex; flex-direction: column; min-width: 0; }
.name {
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.you {
  margin-left: 0.4rem;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-color-up, var(--primary-green, #00ff88));
}
.sub {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.value {
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--app-color-up, var(--primary-green, #00ff88));
}
.value.neg { color: var(--app-color-down, var(--error-red, #ff4d6a)); }

@media (max-width: 480px) {
  .rank-row { grid-template-columns: 1.5rem 1.75rem minmax(0, 1fr) auto; gap: 0.45rem; padding: 0.45rem 0.55rem; }
  .rank-avatar { width: 1.75rem; height: 1.75rem; }
}
</style>
