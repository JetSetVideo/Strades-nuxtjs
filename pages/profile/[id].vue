<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useCommunityStore } from '@/stores/community'
import { useProfile } from '@/composables/useProfile'
import { useWalletStore } from '@/stores/wallet'
import { assetClassTheme } from '~/utils/assetClass'
import { compareCircle } from '~/utils/profileMask'
import { isPaidRole, buildDeskCalendar, type HistoryRow, type TradeMark } from '~/utils/profileDesk'
import { POINTS_FOR, sharePaths, walletLayers } from '~/utils/walletBook'
import type { CommunityUser } from '@/stores/community'

import ProfileHero from '@/components/Profile/Hero.vue'
import ProfileActivityYear from '@/components/Profile/ActivityYear.vue'
import WalletEquityCurve from '@/components/Wallet/EquityCurve.vue'
import CommunityPersonCard from '@/components/Community/PersonCard.vue'
import PsychCard from '@/components/Profile/PsychCard.vue'
import PoliticalCard from '@/components/Profile/PoliticalCard.vue'
import OpinionProfileCard from '@/components/Profile/OpinionProfileCard.vue'
import InvestorCard from '@/components/Profile/InvestorCard.vue'
import StrategiesSection from '@/components/Profile/StrategiesSection.vue'
import PostsFeed from '@/components/Profile/PostsFeed.vue'
import AchievementsSection from '@/components/Profile/AchievementsSection.vue'
import ExperienceBar from '@/components/Profile/ExperienceBar.vue'

const route = useRoute()
const userId = computed(() => route.params.id as string)

const usersStore = useUsersStore()
const communityStore = useCommunityStore()
const walletStore = useWalletStore()
const chartPeriod = ref<'1d' | '7d' | '30d' | '90d' | '1y'>('30d')

const {
  user,
  wallets,
  defaultWallet,
  strategies,
  posts,
  communities,
  loading,
  sectionErrors,
  dynamicRadius,
} = useProfile(userId)

// Load friends for contacts rail (non-blocking, parallel with profile data)
onMounted(() => { communityStore.fetchCommunity() })

// Active section tab for Self-Analyse panel
type AnalyseSection =
  | 'conditions'
  | 'psychology'
  | 'investor'
  | 'political'
  | 'strategies'
  | 'experience'
  | 'communities'
  | 'contacts'
  | 'achievements'

const activeSection = ref<AnalyseSection>('psychology')

const sectionTabs: { key: AnalyseSection; label: string; icon: string }[] = [
  { key: 'conditions', label: 'Market', icon: 'globe' },
  { key: 'psychology', label: 'Mind', icon: 'mind' },
  { key: 'investor', label: 'Investor', icon: 'bars' },
  { key: 'political', label: 'Politics', icon: 'scale' },
  { key: 'strategies', label: 'Strategies', icon: 'gear' },
  { key: 'experience', label: 'Level', icon: 'mark' },
  { key: 'communities', label: 'Groups', icon: 'people' },
  { key: 'contacts', label: 'Contacts', icon: 'card' },
  { key: 'achievements', label: 'Marks', icon: 'star' },
]

// Portfolio overview from default wallet
const portfolioValue = computed(() =>
  defaultWallet.value?.total_value ?? user.value?.total_portfolio_value ?? 0
)

const portfolioPct = computed(() =>
  defaultWallet.value?.total_return_percentage ?? user.value?.total_return_percentage ?? 0
)

const isOwn = computed(() =>
  usersStore.currentUser?.id === userId.value
)

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const bookTrades = computed<TradeMark[]>(() =>
  wallets.value.flatMap(w =>
    (w.transactions ?? []).map(t => ({
      date: t.timestamp.slice(0, 10),
      symbol: t.asset_symbol,
      walletId: w.id,
    })),
  ),
)

const calendar = computed(() => {
  if (!user.value) return { weeks: [] as never[], best: null, worst: null, active: false }
  return buildDeskCalendar({
    histories: walletStore.walletHistory as Record<string, Record<string, HistoryRow> | undefined>,
    walletIds: wallets.value.map(w => w.id),
    trades: bookTrades.value,
    seed: user.value.monthly_calendar ?? [],
    today: todayIso(),
    events: [
      ...wallets.value.map(w => ({ date: w.created_at, label: w.name })),
      ...(user.value.achievements ?? []).map(a => ({ date: a.unlocked_date, label: a.name })),
    ],
  })
})

const chartValue = computed(() => wallets.value.reduce((sum, w) => sum + (w.total_value || 0), 0))
const chartPerf = computed(() => {
  const list = wallets.value
  const sum = list.reduce((total, w) => total + (w.total_value || 0), 0) || 1
  const periods = ['1d', '7d', '30d', '90d', '1y'] as const
  const out: Record<string, { change: number; change_percentage: number }> = {}
  for (const period of periods) {
    let change = 0
    let weighted = 0
    for (const wallet of list) {
      const point = wallet.performance_history?.[period]
      change += point?.change ?? 0
      weighted += (point?.change_percentage ?? 0) * ((wallet.total_value || 0) / sum)
    }
    out[period] = { change, change_percentage: weighted }
  }
  return out
})
const chartLayers = computed(() => {
  const n = POINTS_FOR[chartPeriod.value] ?? 30
  const layers = walletLayers(wallets.value.map(wallet => ({
    id: wallet.id,
    name: wallet.name,
    total_value: wallet.total_value,
  })))
  const grid = sharePaths(layers, n, `${userId.value}::${chartPeriod.value}`)
  return layers.map((layer, index) => ({
    id: layer.id,
    label: layer.label,
    color: layer.color,
    shares: grid.map(row => row[index] ?? 0),
  }))
})

const heldAssets = computed(() => {
  const map = new Map<string, { symbol: string; value: number; pct: number }>()
  for (const wallet of wallets.value) {
    for (const asset of wallet.assets ?? []) {
      const row = map.get(asset.symbol) ?? { symbol: asset.symbol, value: 0, pct: 0 }
      const next = row.value + (asset.current_value || 0)
      row.pct = next ? ((row.pct * row.value) + (asset.return_percentage || 0) * (asset.current_value || 0)) / next : row.pct
      row.value = next
      map.set(asset.symbol, row)
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
})

const contactCards = computed<CommunityUser[]>(() => {
  const ids = user.value?.friends ?? []
  const cards = ids.map(id => {
    const row = usersStore.getUserById(id)
    const person = communityStore.list.find(entry => entry.id === id)
    return {
      id,
      username: person?.username || row?.first_name || id,
      handle: row?.username || person?.username || id,
      avatar_url: '',
      bio: person?.bio || row?.bio || '',
      is_friend: true,
      online: person?.online ?? row?.is_online ?? false,
      timezone: row?.timezone || '',
      specialization: person?.specialization ?? [],
      trading_style: person?.trading_style || row?.trading_style || 'swing_trader',
      win_rate: person?.win_rate ?? ((row?.win_rate ?? 0) > 1 ? (row?.win_rate ?? 0) / 100 : (row?.win_rate ?? 0)),
      last_30d_pnl_pct: person?.last_30d_pnl_pct ?? row?.performance_30d ?? 0,
      followers: person?.followers ?? row?.followers_count ?? 0,
      match_score: person?.match_score ?? 0,
      last_active_at: person?.last_active_at ?? '',
      verified: !!row?.is_verified,
      premium: isPaidRole(row?.role),
    } satisfies CommunityUser
  })
  return cards.sort(compareCircle)
})

const avatarCards = computed(() =>
  (user.value?.ai_avatars ?? []).map(av => ({
    raw: av,
    user: {
      id: av.id,
      username: av.name,
      handle: av.trading_style,
      avatar_url: '',
      bio: av.is_public ? `Public · ${av.followers} followers` : 'Private',
      is_friend: false,
      online: av.is_public,
      timezone: '',
      specialization: [],
      trading_style: av.trading_style,
      win_rate: av.confidence_score,
      last_30d_pnl_pct: av.pnl_30d,
      followers: av.followers,
      match_score: av.confidence_score,
      last_active_at: '',
      execution_frequency: av.execution_frequency,
    } satisfies CommunityUser,
  })),
)

function themeOf(symbol: string) {
  return assetClassTheme(symbol)
}
function goProfile(id: string) {
  navigateTo(`/profile/${id}`)
}
function groupStyle(category?: string) {
  if (category === 'crypto') return 'trend_follow'
  if (category === 'forex') return 'carry'
  if (category === 'stocks') return 'buy_hold'
  return 'swing_trader'
}

// CSS driven by risk profile (Design.md)
const pageStyle = computed(() => ({
  '--profile-radius': dynamicRadius.value,
  '--profile-animation-speed': user.value
    ? `${0.8 - (user.value.psychology_profile?.risk_score ?? 0.5) * 0.5}s`
    : '0.5s',
}))
</script>

<template>
  <div class="profile-page" :style="pageStyle">

    <!-- ── Skeleton loader while fetching ─────────────────────────────── -->
    <div v-if="loading && !user" class="skeleton-wrap">
      <div class="skeleton-hero" :style="{ borderRadius: dynamicRadius }" />
      <div class="skeleton-section" />
      <div class="skeleton-section short" />
    </div>

    <!-- ── User not found ─────────────────────────────────────────────── -->
    <div v-else-if="!user && !loading" class="not-found">
      <p>Profile not found.</p>
      <NuxtLink to="/">← Home</NuxtLink>
    </div>

    <!-- ── Main content ──────────────────────────────────────────────── -->
    <template v-else-if="user">

      <!-- HERO -->
      <ProfileHero
        :user="user"
        :is-own="isOwn"
        class="fade-in"
        @follow="() => {}"
        @message="() => {}"
      />

      <!-- Error notices (per section, non-blocking) -->
      <div v-if="Object.keys(sectionErrors).length" class="error-banner">
        <span v-for="(msg, key) in sectionErrors" :key="key" class="error-item">
          ⚠️ {{ key }}: {{ msg }}
        </span>
      </div>

      <section class="card portfolio-snap">
        <div class="snap-head">
          <div>
            <div class="snap-label">Book</div>
            <div class="snap-value">
              ${{ portfolioValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}
            </div>
          </div>
          <div class="snap-pct" :class="portfolioPct >= 0 ? 'pos' : 'neg'">
            {{ portfolioPct >= 0 ? '+' : '' }}{{ portfolioPct.toFixed(1) }}% all-time
          </div>
        </div>
        <div class="periods" role="group" aria-label="Chart period">
          <button
            v-for="p in (['1d','7d','30d','90d','1y'] as const)"
            :key="p"
            type="button"
            :class="{ on: chartPeriod === p }"
            @click="chartPeriod = p"
          >{{ p.toUpperCase() }}</button>
        </div>
        <WalletEquityCurve
          v-if="chartValue > 0"
          :wallet-id="userId"
          :total-value="chartValue"
          :performance-history="chartPerf"
          :period="chartPeriod"
          :layers="chartLayers"
          breakdown="Wallets"
        />
        <ul v-if="heldAssets.length" class="asset-list">
          <li v-for="asset in heldAssets" :key="asset.symbol">
            <span
              class="tag"
              :style="{ color: themeOf(asset.symbol).color, background: themeOf(asset.symbol).tint, borderColor: themeOf(asset.symbol).color }"
            >{{ themeOf(asset.symbol).label }}</span>
            <NuxtLink :to="`/assets/${asset.symbol}`">{{ asset.symbol }}</NuxtLink>
            <span class="grow">${{ asset.value.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
            <b :class="asset.pct < 0 ? 'neg' : 'pos'">{{ asset.pct >= 0 ? '+' : '' }}{{ asset.pct.toFixed(1) }}%</b>
          </li>
        </ul>
      </section>

      <section class="card activity-card">
        <ProfileActivityYear
          :weeks="calendar.weeks"
          :active="calendar.active"
          :today="todayIso()"
        />
      </section>

      <!-- SELF-ANALYSE — TABBED PANEL -->
      <section class="card self-analyse">
        <h2 class="section-head">Self-Analyse</h2>

        <!-- Tab navigation -->
        <div class="tab-rail" role="tablist">
          <button
            v-for="tab in sectionTabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeSection === tab.key }"
            role="tab"
            :aria-selected="activeSection === tab.key"
            @click="activeSection = tab.key"
          >
            <svg class="tab-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle v-if="tab.icon === 'globe'" cx="8" cy="8" r="5.5" />
              <path v-if="tab.icon === 'globe'" d="M2.5 8h11M8 2.6c1.6 1.8 1.6 9 0 10.8M8 2.6c-1.6 1.8-1.6 9 0 10.8" />
              <circle v-if="tab.icon === 'mind'" cx="8" cy="8" r="5.5" />
              <path v-if="tab.icon === 'mind'" d="M8 4.5v4l2.5 1.5" />
              <path v-if="tab.icon === 'bars'" d="M3 12V8M8 12V4M13 12V6" />
              <path v-if="tab.icon === 'scale'" d="M8 2.5v11M3 13.5h10M4 5h8M4 5 2.5 9h3L4 5zM12 5l-1.5 4h3L12 5z" />
              <circle v-if="tab.icon === 'gear'" cx="8" cy="8" r="2.2" />
              <path v-if="tab.icon === 'gear'" d="M8 2.2v2M8 11.8v2M2.2 8h2M11.8 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M12.2 3.8l-1.4 1.4M5.2 10.8l-1.4 1.4" />
              <path v-if="tab.icon === 'mark'" d="M8 2.2 9.6 6l4 .5-3 2.8.8 3.9L8 11.2 4.6 13.2l.8-3.9-3-2.8 4-.5z" />
              <circle v-if="tab.icon === 'people'" cx="5.5" cy="6" r="2" />
              <circle v-if="tab.icon === 'people'" cx="11" cy="6.5" r="1.6" />
              <path v-if="tab.icon === 'people'" d="M1.8 13c.4-2 1.8-3 3.7-3s3.3 1 3.7 3M9.2 13c.3-1.4 1.2-2.2 2.4-2.2 1.1 0 1.9.7 2.3 2.2" />
              <rect v-if="tab.icon === 'card'" x="2.5" y="3.5" width="11" height="9" rx="1" />
              <path v-if="tab.icon === 'card'" d="M2.5 6.5h11" />
              <path v-if="tab.icon === 'star'" d="M8 2.5l1.4 3 3.3.4-2.4 2.2.6 3.2L8 9.6 5.1 11.3l.6-3.2L3.3 5.9l3.3-.4z" />
            </svg>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- Tab panels -->
        <div class="tab-panel fade-in" :key="activeSection">

          <!-- Market Conditions (placeholder — linked to macro store) -->
          <div v-if="activeSection === 'conditions'" class="placeholder-panel">
            <p class="placeholder-text">
              Market conditions panel — global volatility, sector rotations,
              macro stress indicators affecting this trader's preferred assets.
            </p>
            <div class="preferred-assets">
              <span v-for="a in user.preferred_assets" :key="a" class="asset-pill">{{ a }}</span>
            </div>
          </div>

          <!-- Psychology -->
          <PsychCard
            v-if="activeSection === 'psychology'"
            :profile="user.psychology_profile"
            :risk-radius="dynamicRadius"
          />

          <!-- Investor Profile -->
          <InvestorCard
            v-if="activeSection === 'investor'"
            :profile="user.investor_profile"
          />

          <!-- Political Profile (static, self-reported) -->
          <PoliticalCard
            v-if="activeSection === 'political'"
            :profile="user.political_profile"
          />

          <!-- Live Opinion Profile (article-derived, dynamic) -->
          <OpinionProfileCard
            v-if="activeSection === 'political'"
            :user-id="userId"
            :friend-ids="(user.friends ?? []).slice(0, 5)"
          />

          <!-- Strategies -->
          <StrategiesSection
            v-if="activeSection === 'strategies'"
            :strategies="strategies"
          />

          <!-- Experience -->
          <ExperienceBar
            v-if="activeSection === 'experience' && user.experience"
            :experience="user.experience"
          />

          <!-- Communities -->
          <div v-if="activeSection === 'communities'" class="rail">
            <p v-if="!communities.length" class="placeholder-text">No groups on this desk.</p>
            <CommunityPersonCard
              v-for="group in communities"
              :key="group.id"
              variant="group"
              :href="`/discussions/${group.id}`"
              :members="(group.members ?? []).map((member: { id: string }) => ({ id: member.id, style: groupStyle(group.category) }))"
              :user="{
                id: group.id,
                username: group.name,
                handle: group.category || 'group',
                avatar_url: '',
                bio: `${group.members?.length ?? 0} members`,
                is_friend: false,
                online: false,
                timezone: '',
                specialization: [],
                trading_style: groupStyle(group.category),
                win_rate: 0,
                last_30d_pnl_pct: 0,
                followers: group.members?.length ?? 0,
                match_score: 0,
                last_active_at: '',
              }"
            />
          </div>

          <!-- Contacts -->
          <div v-if="activeSection === 'contacts'" class="rail">
            <CommunityPersonCard v-if="!contactCards.length" empty />
            <CommunityPersonCard
              v-for="person in contactCards"
              :key="person.id"
              :user="person"
              @profile="goProfile"
            />
          </div>

          <!-- Achievements -->
          <AchievementsSection
            v-if="activeSection === 'achievements'"
            :achievements="user.achievements"
          />
        </div>
      </section>

      <!-- AI AVATARS -->
      <section class="card">
        <h2 class="section-head">AI Avatars</h2>
        <div class="rail">
          <CommunityPersonCard
            v-for="card in avatarCards"
            :key="card.user.id"
            variant="avatar"
            :user="card.user"
            :risk="card.raw.personality_matrix.risk"
            :aggression="card.raw.personality_matrix.aggression"
          />
        </div>
      </section>

      <!-- POSTS & ANALYSIS -->
      <section v-if="posts.length" class="card">
        <h2 class="section-head">Posts & Analysis</h2>
        <PostsFeed :posts="posts" />
      </section>

    </template>  </div>
</template>

<style scoped>
/* ── Page container ─────────────────────────────────────────────────── */
.profile-page {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
  box-sizing: border-box;
}

/* ── Cards ──────────────────────────────────────────────────────────── */
.card {
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border: 1px solid var(--border-primary);
  border-radius: var(--profile-radius, var(--radius-lg));
  padding: var(--spacing-md);
  transition: border-radius var(--profile-animation-speed, 0.5s) ease;
}

.activity-card {
  padding: 0.28rem 0.32rem 0.32rem;
  margin: 0;
}

.section-head {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-gray);
  margin: 0 0 var(--spacing-md);
}

/* ── Portfolio snapshot ─────────────────────────────────────────────── */
.portfolio-snap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.snap-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-gray);
}

.snap-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-white);
  line-height: 1;
}

.snap-pct {
  font-size: 0.9rem;
  font-weight: 600;
}

.snap-pct.pos { color: var(--app-color-up, var(--success-green)); }
.snap-pct.neg { color: var(--app-color-down, var(--error-red)); }

.wallet-alloc {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: var(--spacing-xs);
}

.alloc-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.alloc-sym {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-white);
  min-width: 36px;
}

.alloc-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  overflow: hidden;
}

.alloc-bar {
  height: 100%;
  background: var(--primary-gradient);
  border-radius: 999px;
  max-width: 100%;
  transition: width 0.5s ease;
}

.alloc-pct {
  font-size: 0.65rem;
  color: var(--text-gray);
  min-width: 36px;
  text-align: right;
}

.alloc-ret {
  font-size: 0.65rem;
  font-weight: 600;
  min-width: 44px;
  text-align: right;
}

.alloc-ret.pos { color: var(--app-color-up, var(--success-green)); }
.alloc-ret.neg { color: var(--app-color-down, var(--error-red)); }

/* ── Self-analyse tabs ──────────────────────────────────────────────── */
.self-analyse { gap: 0; }

.tab-rail {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 0.3rem;
  margin-bottom: var(--spacing-md);
}

.tab-btn {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  flex: 1 1 6.2rem;
  padding: 0.28rem 0.45rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  cursor: pointer;
  color: var(--text-gray);
  font: inherit;
}

.tab-btn:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-light-gray);
}

.tab-btn.active {
  background: rgba(0,255,136,0.1);
  color: var(--primary-green);
}

.tab-icon {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: 0 0 auto;
}
.tab-label { font-size: 0.62rem; letter-spacing: 0.04em; white-space: nowrap; }
.rail {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  width: 100%;
  min-width: 0;
  padding-bottom: 0.15rem;
}
.rail :deep(.person-card) { flex: 0 0 min(280px, 86%); }
.asset-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.asset-list li { display: flex; align-items: center; gap: 0.45rem; width: 100%; font-size: 0.75rem; }
.asset-list .grow { flex: 1; }
.tag {
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.08rem 0.38rem;
}
.snap-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 0.6rem; width: 100%; }
.periods { display: flex; width: 100%; gap: 0.3rem; }
.periods button {
  flex: 1 1 0;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.75);
  border-radius: 999px;
  padding: 0.18rem 0.4rem;
  font: inherit;
  font-size: 0.62rem;
  cursor: pointer;
}
.periods button.on { border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }
.pos { color: var(--primary-green, #00ff88); }
.neg { color: #ff5555; }

.tab-panel {
  min-height: 120px;
}

/* ── Placeholder panel ──────────────────────────────────────────────── */
.placeholder-panel {
  padding: var(--spacing-sm);
}

.placeholder-text {
  font-size: 0.8rem;
  color: var(--text-gray);
  line-height: 1.5;
  margin: 0 0 var(--spacing-sm);
}

.preferred-assets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.asset-pill {
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0,170,255,0.1);
  border: 1px solid rgba(0,170,255,0.2);
  color: var(--primary-blue);
  font-weight: 600;
}

/* ── Skeletons ─────────────────────────────────────────────────────── */
.skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton-hero, .skeleton-section {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, rgba(255,255,255,0.05) 50%, var(--bg-secondary) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-hero {
  height: 280px;
  border-radius: var(--profile-radius, var(--radius-lg));
}

.skeleton-section {
  height: 160px;
  border-radius: var(--radius-md);
}

.skeleton-section.short {
  height: 100px;
}

/* ── Not found ─────────────────────────────────────────────────────── */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  gap: var(--spacing-md);
  color: var(--text-gray);
  font-size: 0.9rem;
}

.not-found a {
  color: var(--primary-green);
  text-decoration: none;
}

/* ── Error banner ──────────────────────────────────────────────────── */
.error-banner {
  background: rgba(255,68,68,0.08);
  border: 1px solid rgba(255,68,68,0.2);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-item {
  font-size: 0.72rem;
  color: var(--error-red);
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .tab-btn { flex-basis: 5.2rem; }
}
</style>
