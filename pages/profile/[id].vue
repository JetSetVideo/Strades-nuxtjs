<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useCommunityStore } from '@/stores/community'
import { useProfile } from '@/composables/useProfile'

import ProfileHero from '@/components/Profile/Hero.vue'
import TradingCalendar from '@/components/Profile/TradingCalendar.vue'
import PsychCard from '@/components/Profile/PsychCard.vue'
import PoliticalCard from '@/components/Profile/PoliticalCard.vue'
import OpinionProfileCard from '@/components/Profile/OpinionProfileCard.vue'
import InvestorCard from '@/components/Profile/InvestorCard.vue'
import AvatarsSection from '@/components/Profile/AvatarsSection.vue'
import StrategiesSection from '@/components/Profile/StrategiesSection.vue'
import PostsFeed from '@/components/Profile/PostsFeed.vue'
import CommunitySection from '@/components/Profile/CommunitySection.vue'
import ContactsRail from '@/components/Profile/ContactsRail.vue'
import AchievementsSection from '@/components/Profile/AchievementsSection.vue'
import ExperienceBar from '@/components/Profile/ExperienceBar.vue'

const route = useRoute()
const userId = computed(() => route.params.id as string)

const usersStore = useUsersStore()
const communityStore = useCommunityStore()

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
  { key: 'conditions',   label: 'Market Conditions', icon: '🌐' },
  { key: 'psychology',   label: 'Psychology',         icon: '🧠' },
  { key: 'investor',     label: 'Investor Profile',   icon: '📊' },
  { key: 'political',    label: 'Political Profile',  icon: '⚖️' },
  { key: 'strategies',   label: 'Strategies',         icon: '⚙️' },
  { key: 'experience',   label: 'Experience',         icon: '🏅' },
  { key: 'communities',  label: 'Communities',        icon: '👥' },
  { key: 'contacts',     label: 'Contacts',           icon: '📇' },
  { key: 'achievements', label: 'Achievements',       icon: '🎯' },
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

// Upcoming vs past calendar split
const upcomingCalendar = computed(() =>
  user.value?.monthly_calendar?.filter(d => d.is_upcoming) ?? []
)
const pastCalendar = computed(() =>
  user.value?.monthly_calendar?.filter(d => !d.is_upcoming) ?? []
)

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

      <!-- PORTFOLIO SNAPSHOT -->
      <section class="card portfolio-snap">
        <div class="snap-label">Total Portfolio</div>
        <div class="snap-value">
          ${{ portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
        </div>
        <div
          class="snap-pct"
          :class="portfolioPct >= 0 ? 'pos' : 'neg'"
        >
          {{ portfolioPct >= 0 ? '+' : '' }}{{ portfolioPct.toFixed(2) }}% all-time
        </div>

        <!-- Wallet allocation preview -->
        <div v-if="defaultWallet?.assets?.length" class="wallet-alloc">
          <div
            v-for="asset in defaultWallet.assets.slice(0, 5)"
            :key="asset.asset_id"
            class="alloc-row"
          >
            <span class="alloc-sym">{{ asset.symbol }}</span>
            <div class="alloc-bar-wrap">
              <div class="alloc-bar" :style="{ width: `${asset.allocation_percentage}%` }" />
            </div>
            <span class="alloc-pct">{{ asset.allocation_percentage.toFixed(1) }}%</span>
            <span
              class="alloc-ret"
              :class="asset.return_percentage >= 0 ? 'pos' : 'neg'"
            >
              {{ asset.return_percentage >= 0 ? '+' : '' }}{{ asset.return_percentage.toFixed(1) }}%
            </span>
          </div>
        </div>
      </section>

      <!-- PLANNING — UPCOMING TRADES CALENDAR -->
      <section class="card">
        <h2 class="section-head">Planning</h2>
        <TradingCalendar
          :calendar="upcomingCalendar"
          :show-upcoming="true"
          title="Up Coming"
        />
      </section>

      <!-- PAST TRADES CALENDAR -->
      <section class="card">
        <TradingCalendar
          :calendar="pastCalendar"
          :show-upcoming="false"
          title="Past Trades"
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
            <span class="tab-icon">{{ tab.icon }}</span>
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
          <CommunitySection
            v-if="activeSection === 'communities'"
            :communities="communities"
          />

          <!-- Contacts -->
          <ContactsRail
            v-if="activeSection === 'contacts'"
            :friends="communityStore.friends"
          />

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
        <AvatarsSection :avatars="user.ai_avatars" />
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
  max-width: 680px;
  margin: 0 auto;
  padding: calc(4rem + var(--spacing-lg)) var(--spacing-md) var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  transition: all var(--profile-animation-speed, 0.5s) ease;
}

/* ── Cards ──────────────────────────────────────────────────────────── */
.card {
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border: 1px solid var(--border-primary);
  border-radius: var(--profile-radius, var(--radius-lg));
  padding: var(--spacing-md);
  transition: border-radius var(--profile-animation-speed, 0.5s) ease;
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

.snap-pct.pos { color: var(--success-green); }
.snap-pct.neg { color: var(--error-red); }

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

.alloc-ret.pos { color: var(--success-green); }
.alloc-ret.neg { color: var(--error-red); }

/* ── Self-analyse tabs ──────────────────────────────────────────────── */
.self-analyse { gap: 0; }

.tab-rail {
  display: flex;
  overflow-x: auto;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-sm);
  scrollbar-width: none;
  margin-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-primary);
}

.tab-rail::-webkit-scrollbar { display: none; }

.tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-gray);
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.tab-btn:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-light-gray);
}

.tab-btn.active {
  background: rgba(0,255,136,0.1);
  color: var(--primary-green);
}

.tab-icon { font-size: 0.9rem; }
.tab-label { font-size: 0.6rem; white-space: nowrap; }

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
@media (min-width: 768px) {
  .profile-page {
    padding-top: calc(5rem + var(--spacing-lg));
    padding-left: var(--spacing-xl);
    padding-right: var(--spacing-xl);
  }
}

@media (min-width: 1024px) {
  .profile-page {
    max-width: 760px;
  }}
</style>
