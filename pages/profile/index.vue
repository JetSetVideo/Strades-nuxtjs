<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useWalletStore } from '@/stores/wallet'
import { useAgentsStore } from '@/stores/agents'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useTrainingStore } from '@/stores/training'
import { useActivityLogStore } from '@/stores/activityLog'
import { useBotsStore } from '@/stores/bots'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import ProfileHero from '@/components/Profile/Hero.vue'
import ProfilePersonalityMatrix from '@/components/Profile/PersonalityMatrix.vue'
import ProfileTradingRecords from '@/components/Profile/TradingRecords.vue'

definePageMeta({ title: 'Profile', layout: 'default' })

const usersStore = useUsersStore()
const walletStore = useWalletStore()
const agents = useAgentsStore()
const prefs = useUserPreferencesStore()
const training = useTrainingStore()
const activityLog = useActivityLogStore()
const bots = useBotsStore()
const { user: authUser, isAuthenticated } = useAuth()
const { portfolio, loading: portfolioLoading, error: portfolioError, refresh: refreshPortfolio } = usePortfolio()

const userId = computed<string>(() => {
  const { userId: uid } = useCurrentUser()
  return authUser.value?.id || uid.value
})

const loading = ref(true)
const statistics = ref<any>(null)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    usersStore.fetchUsers(),
    !walletStore.hydrated ? walletStore.fetchWallets() : Promise.resolve(),
    !agents.hydrated ? agents.fetchAgents() : Promise.resolve(),
    !prefs.hydrated ? prefs.fetchPreferences() : Promise.resolve(),
    !bots.hydrated ? bots.fetchBots() : Promise.resolve(),
    activityLog.hydrate(),
    isAuthenticated.value ? refreshPortfolio() : Promise.resolve(),
  ])
  try {
    const statsData = await $fetch<any[]>('/data/user/statistics.json')
    statistics.value = statsData.find(s => s.user_id === userId.value) || {}
  } catch {
    statistics.value = {}
  }
  loading.value = false
})

const user = computed(() => usersStore.getUserById(userId.value) || (
  authUser.value ? {
    id: authUser.value.id,
    username: authUser.value.username || authUser.value.display_name || authUser.value.email,
    bio: authUser.value.bio || '',
    total_portfolio_value: portfolio.value?.total_value,
    total_returns: undefined,
  } as any : null
))
const wallet = computed(() => walletStore.getWalletByUserId(userId.value))
const personalAgent = computed(() => agents.personal)

const backendPnl = computed(() => {
  if (!portfolio.value) return 0
  return portfolio.value.holdings.reduce((sum, h) => sum + (h.unrealized_pnl ?? 0), 0)
})

const formatCurrency = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const formatPct = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

const evolution24h = computed(() => {
  const pct = wallet.value?.performance_history?.['1d']?.change_percentage
  return pct !== undefined ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'
})

const evolution30d = computed(() => {
  const pct = wallet.value?.performance_history?.['30d']?.change_percentage
  return pct !== undefined ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'
})

const totalTrades = computed(() => statistics.value?.performance?.total_trades ?? 0)
const winRate = computed(() => statistics.value?.performance?.win_rate ?? 0)
const netProfit = computed(() => statistics.value?.performance?.net_profit ?? 0)
const tradingStyle = computed(() => statistics.value?.psychology?.trading_style ?? prefs.trading_style ?? '—')

const recentEvents = computed(() => training.recentEvents.slice(0, 6))
const tradingRecord = computed(() => activityLog.tradingRecords)
const activityFeed = computed(() => activityLog.recentFeed)

const eventLabel = (type: string) => type.replace(/_/g, ' ')

const heatTop = computed(() => {
  const heat = prefs.behavioral_history?.eye_tracking_heat ?? {}
  return Object.entries(heat)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 4)
    .map(([k, v]) => ({ key: k, value: v as number }))
})

const relTime = (ts: number) => {
  const ms = Date.now() - ts
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

const liveBots = computed(() => bots.live.length)
const totalBots = computed(() => bots.list.length)

const displayPortfolioValue = computed(() =>
  portfolio.value?.total_value ?? user.value?.total_portfolio_value ?? 0
)
</script>

<template>
  <div class="profile-page">
    <!-- Loading shell mirrors the real layout -->
    <template v-if="loading">
      <div class="skel-hero">
        <AppSkeletonLoader height="80px" width="80px" />
        <div class="skel-hero-stack">
          <AppSkeletonLoader height="22px" width="180px" />
          <AppSkeletonLoader height="14px" width="240px" />
        </div>
      </div>
      <AppSkeletonLoader height="80px" />
      <div class="skel-grid">
        <AppSkeletonLoader height="220px" />
        <AppSkeletonLoader height="220px" />
        <AppSkeletonLoader height="220px" />
      </div>
    </template>

    <template v-else-if="user">
      <UIPageHeader :title="user.username" :subtitle="user.bio || 'Trader'">
        <template #actions>
          <UIPill tone="success" show-dot>{{ evolution24h }} 24h</UIPill>
          <NuxtLink v-if="personalAgent" :to="`/agents/${personalAgent.id}`" class="cta-link">
            View Avatar →
          </NuxtLink>
        </template>
      </UIPageHeader>

      <ProfileHero
        :user="user"
        :trading-style="tradingStyle"
        :total-trades="totalTrades"
        :win-rate="winRate"
        :portfolio-value="displayPortfolioValue"
        :total-return="user.total_returns ?? 0"
        :evolution24h="evolution24h"
        :evolution30d="evolution30d"
      />

      <!-- Backend portfolio (API) when authenticated -->
      <UICard v-if="portfolio" title="Live portfolio">
        <template #action>
          <UIPill tone="success" show-dot>Backend</UIPill>
        </template>
        <div v-if="portfolioError" class="muted">{{ portfolioError }}</div>
        <UIMetricRow :cols="4">
          <UIStat label="Total value" :value="portfolio.total_value" :precision="0" suffix="USD" size="md" />
          <UIStat label="Cash" :value="portfolio.cash_balance" :precision="0" suffix="USD" size="md" />
          <UIStat label="Unrealized P&L" :value="backendPnl" tone="auto" :precision="0" suffix="USD" size="md" />
          <UIStat label="Holdings" :value="portfolio.holdings.length" size="md" />
        </UIMetricRow>
        <div v-if="portfolio.holdings.length" class="holdings-table-wrap">
          <table class="holdings-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Value</th>
                <th class="text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in portfolio.holdings" :key="h.asset.id">
                <td>{{ h.asset.symbol }}</td>
                <td class="text-right">{{ h.quantity }}</td>
                <td class="text-right">{{ formatCurrency(h.current_value, portfolio.currency) }}</td>
                <td class="text-right" :class="h.unrealized_pnl >= 0 ? 'pos' : 'neg'">
                  {{ formatPct(h.unrealized_pnl_pct) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UIEmptyState
          v-else-if="!portfolioLoading"
          size="sm"
          icon="◯"
          message="No holdings yet — paper-trade or connect a platform."
        />
      </UICard>

      <!-- 3-col: Personality / Performance / Avatar-link -->
      <div class="grid-3">
        <UICard title="Personality matrix" v-if="personalAgent">
          <template #action>
            <UIPill tone="info">v{{ personalAgent.training_state.version }}</UIPill>
          </template>
          <ProfilePersonalityMatrix :matrix="personalAgent.personality_matrix" />
        </UICard>

        <UICard title="Performance">
          <UIMetricRow :cols="2">
            <UIStat label="Win rate" :value="winRate" suffix="%" size="md" />
            <UIStat label="Net profit" :value="netProfit" tone="auto" :precision="0" suffix="USD" size="md" />
            <UIStat label="Avg profit / trade" :value="statistics?.performance?.average_profit_per_trade ?? 0" :precision="0" suffix="USD" size="sm" tone="positive" />
            <UIStat label="Avg loss / trade" :value="statistics?.performance?.average_loss_per_trade ?? 0" :precision="0" suffix="USD" size="sm" tone="negative" />
            <UIStat label="Risk tolerance" :value="statistics?.psychology?.risk_tolerance ?? '—'" size="sm" />
            <UIStat label="Emotional control" :value="statistics?.psychology?.emotional_control_score ?? 0" :precision="1" size="sm" />
          </UIMetricRow>
        </UICard>

        <UICard title="Bots running" v-if="totalBots > 0">
          <template #action>
            <NuxtLink to="/strategies" class="cta-link">All bots →</NuxtLink>
          </template>
          <UIMetricRow :cols="2">
            <UIStat label="Live" :value="liveBots" tone="positive" size="md" />
            <UIStat label="Total" :value="totalBots" size="md" />
            <UIStat label="Capital deployed" :value="bots.totalCapital" :precision="0" suffix="USD" size="sm" />
            <UIStat label="PnL today" :value="bots.totalPnlTodayUsd" tone="auto" :precision="0" suffix="USD" size="sm" />
          </UIMetricRow>
        </UICard>
      </div>

      <!-- Trading records from activity log (where/when/what/why + shares) -->
      <div class="grid-2">
        <UICard title="Trading records">
          <template #action>
            <UIPill tone="info">{{ tradingRecord.total_interactions }} logged</UIPill>
          </template>
          <ProfileTradingRecords :record="tradingRecord" :recent="activityFeed" />
        </UICard>

        <UICard title="Avatar Training">
          <template #action>
            <UIPill tone="info">{{ training.totalEventsRecorded }} events</UIPill>
          </template>
          <UIEmptyState v-if="recentEvents.length === 0" size="sm" icon="◯" message="Interact with the app to start training your Avatar." />
          <ul v-else class="event-list">
            <li v-for="ev in recentEvents" :key="ev.id" class="event-row">
              <span class="dot" />
              <span class="ev-type">{{ eventLabel(ev.type) }}</span>
              <span class="ev-time">{{ relTime(ev.ts) }}</span>
            </li>
          </ul>
        </UICard>
      </div>

      <!-- Activity + Heat + Favorites -->
      <div class="grid-3">
        <UICard title="Attention heat" v-if="heatTop.length">
          <p class="muted">Where you spend the most time — these areas pre-fetch their data when you hover the nav.</p>
          <ul class="heat-list">
            <li v-for="h in heatTop" :key="h.key">
              <span class="h-name">{{ h.key.replace(/_/g, ' ') }}</span>
              <span class="bar"><span class="bar-fill" :style="{ width: `${Math.min(100, h.value * 100)}%` }" /></span>
              <span class="h-pct">{{ Math.round(h.value * 100) }}%</span>
            </li>
          </ul>
        </UICard>

        <UICard title="Favorite assets" v-if="prefs.favorite_assets?.length">
          <div class="fav-grid">
            <NuxtLink
              v-for="id in prefs.favorite_assets"
              :key="id"
              :to="`/assets/${id}`"
              class="fav-chip"
            >{{ id.toUpperCase() }}</NuxtLink>
          </div>
        </UICard>
      </div>

      <!-- Connected platforms (from real statistics) -->
      <UICard v-if="statistics?.trading_platforms?.length" title="Connected platforms">
        <ul class="plat-list">
          <li v-for="p in statistics.trading_platforms" :key="p" class="plat-row">
            <span class="dot info" />
            <span>{{ p }}</span>
          </li>
        </ul>
      </UICard>

      <!-- Achievements -->
      <UICard title="Achievements" v-if="statistics?.achievements?.length">
        <ul class="ach-list">
          <li v-for="ach in statistics.achievements" :key="ach.id" class="ach-row">
            <span class="trophy">◈</span>
            <span class="ach-name">{{ ach.name }}</span>
            <span class="ach-date">{{ ach.unlocked }}</span>
          </li>
        </ul>
      </UICard>
    </template>

    <UIEmptyState v-else icon="◯" title="Profile not found" message="The user you're looking for doesn't exist." />
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

/* Loading shell */
.skel-hero {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 0.8rem;
  align-items: center;
}
.skel-hero-stack { display: flex; flex-direction: column; gap: 0.4rem; }
.skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 0.6rem;
}

.cta-link {
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  font-weight: 700;
}
.cta-link:hover { text-decoration: underline; }

/* 2–3 col layouts */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.grid-2 > * { min-width: 0; }
.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.grid-3 > * { min-width: 0; }

.holdings-table-wrap {
  margin-top: 0.6rem;
  overflow-x: auto;
}
.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}
.holdings-table th,
.holdings-table td {
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  text-align: left;
}
.holdings-table .text-right { text-align: right; }
.holdings-table .pos { color: var(--primary-green, #00ff88); }
.holdings-table .neg { color: var(--error-red, #ff4444); }

/* Event list */
.event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.event-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.45rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 4px;
}
.event-row .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--primary-green, #00ff88);
  box-shadow: 0 0 4px var(--primary-green, #00ff88);
}
.ev-type {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(255,255,255,0.85);
}
.ev-time {
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
}

/* Heat list */
.muted {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  margin: 0 0 0.3rem 0;
  line-height: 1.35;
}
.heat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.heat-list li {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.h-name {
  font-size: 0.7rem;
  text-transform: capitalize;
  color: rgba(255,255,255,0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  display: block;
  height: 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--primary-blue, #00aaff), var(--primary-green, #00ff88));
}
.h-pct {
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: rgba(255,255,255,0.7);
}

/* Favorites */
.fav-grid {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.fav-chip {
  background: rgba(0,170,255,0.08);
  border: 1px solid rgba(0,170,255,0.3);
  color: var(--primary-blue, #00aaff);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-decoration: none;
  transition: all 0.15s ease;
}
.fav-chip:hover {
  background: rgba(0,170,255,0.18);
  transform: translateY(-1px);
}

/* Platforms / Achievements */
.plat-list, .ach-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.plat-row, .ach-row {
  display: grid;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 4px;
}
.plat-row {
  grid-template-columns: 8px minmax(0, 1fr);
}
.plat-row .dot.info {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary-blue, #00aaff);
  box-shadow: 0 0 4px var(--primary-blue, #00aaff);
}
.ach-row { grid-template-columns: 18px minmax(0, 1fr) auto; }
.trophy {
  font-size: 0.95rem;
  color: #ffaa00;
  text-align: center;
}
.ach-name { font-size: 0.78rem; color: rgba(255,255,255,0.85); }
.ach-date {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.04em;
}
</style>
