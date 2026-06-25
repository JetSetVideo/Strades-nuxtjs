<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useWalletStore } from '@/stores/wallet'
import { useAgentsStore } from '@/stores/agents'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useTrainingStore } from '@/stores/training'
import { useBotsStore } from '@/stores/bots'
import { useRoute } from 'vue-router'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import ProfileHero from '@/components/Profile/Hero.vue'
import ProfilePersonalityMatrix from '@/components/Profile/PersonalityMatrix.vue'

definePageMeta({ title: 'Profile', layout: 'default' })

const route = useRoute()
const usersStore = useUsersStore()
const walletStore = useWalletStore()
const agents = useAgentsStore()
const prefs = useUserPreferencesStore()
const training = useTrainingStore()
const bots = useBotsStore()

const userId = computed<string>(() => (route.params.id as string) || 'user_001')

const loading = ref(true)
const statistics = ref<any>(null)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    usersStore.fetchUsers(),
    !walletStore.hydrated ? walletStore.fetchWallets() : Promise.resolve(),
    !agents.hydrated ? agents.fetchAgents() : Promise.resolve(),
    !prefs.hydrated ? prefs.fetchPreferences() : Promise.resolve(),
    !bots.hydrated ? bots.fetchBots() : Promise.resolve()
  ])
  try {
    const statsData = await $fetch<any[]>('/data/user_statistics.json')
    statistics.value = statsData.find(s => s.user_id === userId.value) || {}
  } catch {
    statistics.value = {}
  }
  loading.value = false
})

const user = computed(() => usersStore.getUserById(userId.value))
const wallet = computed(() => walletStore.getWalletByUserId(userId.value))
const personalAgent = computed(() => agents.personal)

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

// Recent activity captured by the training pipeline
const recentEvents = computed(() => training.recentEvents.slice(0, 6))

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
        :portfolio-value="user.total_portfolio_value ?? 0"
        :total-return="user.total_returns ?? 0"
        :evolution24h="evolution24h"
        :evolution30d="evolution30d"
      />

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

      <!-- Activity + Heat + Favorites -->
      <div class="grid-3">
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

/* 3-col layouts */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.grid-3 > * { min-width: 0; }

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
