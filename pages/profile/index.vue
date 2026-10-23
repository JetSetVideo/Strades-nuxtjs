<script setup lang="ts">
/**
 * Signed-in desk. A demo login id is not a row in the user book, so the
 * portrait and name are the demo face and every other figure comes from the
 * catalog (wallets, trades, mind, friends). Free desks show the whole record
 * and leave audience controls locked. A paid role can change who sees a block.
 */
import { computed, onMounted, ref } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useWalletStore } from '@/stores/wallet'
import { useAgentsStore } from '@/stores/agents'
import { useBotsStore } from '@/stores/bots'
import { useStrategiesStore } from '@/stores/strategies'
import { useCommunityStore } from '@/stores/community'
import { useOpinionProfileStore } from '@/stores/opinionProfile'
import ProfileActivityYear from '@/components/Profile/ActivityYear.vue'
import ProfileHero from '@/components/Profile/Hero.vue'
import ProfilePersonalityMatrix from '@/components/Profile/PersonalityMatrix.vue'
import WalletEquityCurve from '@/components/Wallet/EquityCurve.vue'
import CommunityPersonCard from '@/components/Community/PersonCard.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import { useProfileFaceStore } from '@/stores/profileFace'
import type { CommunityUser } from '@/stores/community'
import { assetClassTheme } from '~/utils/assetClass'
import { compareCircle, meterFill } from '~/utils/profileMask'
import {
  POINTS_FOR,
  assetLayers,
  sharePaths,
  walletLayers,
} from '~/utils/walletBook'
import {
  BOOK_USER_ID,
  FREE_BOT_CAP,
  FREE_WALLET_CAP,
  ageOf,
  buildDeskCalendar,
  isPaidRole,
  visitorSees,
  type Audience,
  type HistoryRow,
  type TradeMark,
} from '~/utils/profileDesk'

definePageMeta({ title: 'Profile', layout: 'default' })

const usersStore = useUsersStore()
const walletStore = useWalletStore()
const agents = useAgentsStore()
const bots = useBotsStore()
const strategies = useStrategiesStore()
const community = useCommunityStore()
const opinions = useOpinionProfileStore()
const face = useProfileFaceStore()
const { user: authUser, isAuthenticated } = useAuth()
const { userId: sessionUserId } = useCurrentUser()
const { portfolio, refresh: refreshPortfolio } = usePortfolio()

const loading = ref(true)
const audience = ref<'desk' | 'visitors'>('desk')
const privacyOverride = ref<Partial<Record<'profile' | 'portfolio' | 'history', Audience>>>({})
const hiddenBlocks = ref<string[]>([])
const promoted = ref<string | null>(null)
const walletFilter = ref<string | null>(null)
const assetFilter = ref<string | null>(null)
const chartPeriod = ref<'1d' | '7d' | '30d' | '90d' | '1y'>('30d')
const circle = ref<'friends' | 'followers' | 'following' | 'groups' | null>(null)
const friendRail = ref<HTMLElement | null>(null)
const railDrag = { on: false, x: 0, left: 0, moved: false }

interface StatsSlice {
  user_id: string
  performance?: { total_trades?: number; win_rate?: number; net_profit?: number }
  historics?: { success_periods?: string[]; failure_periods?: string[] }
  trading_platforms?: string[]
}
const stats = ref<StatsSlice | null>(null)

interface DiscussionRow {
  id: string
  name: string
  category?: string
  members?: { id: string; username: string; role?: string }[]
}
const discussions = ref<DiscussionRow[]>([])

const STYLE: Record<string, string> = {
  scalper: 'Scalper',
  day_trader: 'Day trader',
  swing_trader: 'Swing trader',
  position_trader: 'Position trader',
  growth_aggressive: 'Growth aggressive',
}
const RISK: Record<string, string> = {
  low: 'Conservative',
  moderate: 'Moderate',
  high: 'Aggressive',
  very_high: 'Ultra',
}

const bookId = computed(() => {
  const id = authUser.value?.id || sessionUserId.value
  if (id && usersStore.getUserById(id)) return id
  return BOOK_USER_ID
})
const user = computed(() => usersStore.getUserById(bookId.value) ?? null)
const catalogSelf = computed(() => {
  const id = authUser.value?.id
  return !!(id && usersStore.getUserById(id))
})
const paid = computed(() => isPaidRole(authUser.value?.role))
const faceName = computed(() => {
  if (face.displayName) return face.displayName
  if (catalogSelf.value && user.value) return `${user.value.first_name} ${user.value.last_name}`
  return authUser.value?.display_name || authUser.value?.full_name || 'Demo trader'
})
const faceHandle = computed(() => {
  if (face.handle) return face.handle
  if (catalogSelf.value && user.value) return user.value.username
  return 'demo'
})
const publishedName = computed(() => (paid.value && face.hideRealName ? `@${faceHandle.value}` : faceName.value))
const portraitUrl = computed(() => face.avatarDataUrl || (catalogSelf.value ? user.value?.avatar_url || '' : ''))
const wallets = computed(() => walletStore.getUserWallets(bookId.value))
const ownBots = computed(() => bots.list.filter(b => b.owner_id === bookId.value))
const ownStrategies = computed(() => strategies.getStrategiesByCreator(bookId.value))
const personalAgent = computed(() => agents.personal)

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const trades = computed<TradeMark[]>(() =>
  wallets.value.flatMap(w =>
    w.transactions.map(t => ({
      date: t.timestamp.slice(0, 10),
      symbol: t.asset_symbol,
      walletId: w.id,
    })),
  ),
)

const calendar = computed(() => {
  const u = user.value
  if (!u) return { weeks: [], best: null, worst: null, active: false }
  return buildDeskCalendar({
    histories: walletStore.walletHistory as Record<string, Record<string, HistoryRow> | undefined>,
    walletIds: wallets.value.map(w => w.id),
    trades: trades.value,
    seed: u.monthly_calendar ?? [],
    today: todayIso(),
    walletId: walletFilter.value,
    asset: assetFilter.value,
    events: lifeEvents.value,
  })
})

const lifeEvents = computed(() => {
  const u = user.value
  if (!u) return []
  const rows: { date: string; label: string }[] = []
  const push = (date: string | undefined, label: string) => {
    if (date && date.length >= 10) rows.push({ date: date.slice(0, 10), label })
  }
  push(u.joined_date, 'Joined')
  push(u.last_login, 'Last login')
  for (const mark of u.achievements) push(mark.unlocked_date, mark.name)
  for (const wallet of wallets.value) push(wallet.created_at, wallet.name)
  for (const bot of ownBots.value) push(bot.started_at, bot.name)
  for (const trade of trades.value) push(trade.date, trade.symbol)
  return rows
})

const assetRows = computed(() => {
  const list = walletFilter.value
    ? wallets.value.filter(w => w.id === walletFilter.value)
    : wallets.value
  const map = new Map<string, { symbol: string; value: number; ret: number }>()
  for (const w of list) {
    for (const a of w.assets) {
      const row = map.get(a.symbol) ?? { symbol: a.symbol, value: 0, ret: 0 }
      row.value += a.current_value
      row.ret += a.return_amount
      map.set(a.symbol, row)
    }
  }
  const preferred = user.value?.preferred_assets ?? []
  for (const symbol of preferred) {
    if (!map.has(symbol)) map.set(symbol, { symbol, value: 0, ret: 0 })
  }
  return [...map.values()]
    .map(a => {
      const cost = a.value - a.ret
      return { ...a, pct: cost > 0 ? (a.ret / cost) * 100 : null, held: a.value > 0 }
    })
    .sort((a, b) => b.value - a.value)
})

const shownAssets = computed(() =>
  assetFilter.value ? assetRows.value.filter(a => a.symbol === assetFilter.value) : assetRows.value,
)

function settingFor(block: 'profile' | 'portfolio' | 'history'): Audience {
  const privacy = user.value?.privacy_settings
  const seeded: Audience = block === 'profile'
    ? privacy?.profile_visibility ?? 'public'
    : block === 'portfolio'
      ? privacy?.portfolio_visibility ?? 'public'
      : privacy?.trading_history_visibility ?? 'public'
  return privacyOverride.value[block] ?? seeded
}
function sees(block: 'profile' | 'portfolio' | 'history') {
  if (audience.value === 'desk') return true
  return visitorSees(settingFor(block))
}
function cycleAudience(block: 'profile' | 'portfolio' | 'history') {
  if (!paid.value) return
  const order: Audience[] = ['public', 'friends_only', 'private']
  const current = settingFor(block)
  const next = order[(order.indexOf(current) + 1) % order.length] ?? 'public'
  privacyOverride.value = { ...privacyOverride.value, [block]: next }
}
function toggleHide(id: string) {
  if (!paid.value) return
  hiddenBlocks.value = hiddenBlocks.value.includes(id)
    ? hiddenBlocks.value.filter(x => x !== id)
    : [...hiddenBlocks.value, id]
}
function promote(id: string) {
  if (!paid.value) return
  promoted.value = promoted.value === id ? null : id
}
function ownerSees(id: string, block: 'profile' | 'portfolio' | 'history') {
  if (!sees(block)) return false
  return audience.value === 'desk' || !hiddenBlocks.value.includes(id)
}

const namedFriends = computed(() => {
  const ids = user.value?.friends ?? []
  return ids.map(id => {
    const row = usersStore.getUserById(id)
    const person = community.list.find(p => p.id === id)
    return {
      id,
      name: row ? `${row.first_name} ${row.last_name}` : person?.username ?? id,
      handle: row?.username ?? person?.username ?? id,
      style: STYLE[row?.trading_style ?? ''] ?? person?.trading_style ?? '',
      pnl: person?.last_30d_pnl_pct ?? row?.performance_30d ?? null,
      win: row?.win_rate ?? (person ? person.win_rate * 100 : null),
    }
  })
})

const followerCircle = computed(() =>
  [...community.list].sort((a, b) => b.followers - a.followers),
)

const groups = computed(() => {
  const ids = new Set(user.value?.communities ?? [])
  return discussions.value.filter(d => ids.has(d.id))
})

const mindMeters = computed(() => {
  const p = user.value?.psychology_profile
  if (!p) return []
  return [
    { label: 'Risk', value: p.risk_score },
    { label: 'Discipline', value: p.discipline_score },
    { label: 'Patience', value: p.patience_index },
    { label: 'Aggression', value: p.aggression_score },
    { label: 'FOMO', value: p.fomo_susceptibility },
    { label: 'Revenge', value: p.revenge_trading_tendency },
    { label: 'Overconfidence', value: p.overconfidence_bias },
    { label: 'Loss aversion', value: p.loss_aversion_index },
    { label: 'Emotional control', value: p.emotional_control_score / 10 },
  ]
})

const dates = computed(() => {
  const u = user.value
  if (!u) return []
  const today = todayIso()
  const rows: { label: string; when: string; age: string; icon: string }[] = [
    { label: 'Born', when: u.date_of_birth, age: ageOf(u.date_of_birth, today), icon: 'user' },
    { label: 'Account', when: u.joined_date, age: ageOf(u.joined_date, today), icon: 'desk' },
    { label: 'Last login', when: u.last_login, age: ageOf(u.last_login, today), icon: 'clock' },
  ]
  for (const a of u.achievements) rows.push({ label: a.name, when: a.unlocked_date, age: '', icon: 'mark' })
  for (const p of stats.value?.historics?.success_periods ?? []) rows.push({ label: 'Strong stretch', when: p, age: '', icon: 'up' })
  for (const p of stats.value?.historics?.failure_periods ?? []) rows.push({ label: 'Weak stretch', when: p, age: '', icon: 'down' })
  const first = usersStore.getUserAssets(bookId.value)
    .map(a => a.first_purchase_date)
    .filter(Boolean)
    .sort()[0]
  if (first) rows.push({ label: 'First purchase', when: first, age: ageOf(first, today), icon: 'mark' })
  return rows
})

const CHART_PERIODS = [
  { key: '1d' as const, label: '1D' },
  { key: '7d' as const, label: '1W' },
  { key: '30d' as const, label: '1M' },
  { key: '90d' as const, label: '3M' },
  { key: '1y' as const, label: '1Y' },
]

const chartWallets = computed(() => (
  walletFilter.value ? wallets.value.filter(w => w.id === walletFilter.value) : wallets.value
))
const chartValue = computed(() => chartWallets.value.reduce((sum, w) => sum + (w.total_value || 0), 0))
const chartId = computed(() => walletFilter.value || 'all')
const chartPerf = computed(() => {
  const list = chartWallets.value
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
  const seed = `${chartId.value}::${chartPeriod.value}::${assetFilter.value || 'all'}`
  const holdings = chartWallets.value.flatMap(w => w.assets ?? [])
    .filter(asset => !assetFilter.value || asset.symbol.toUpperCase() === assetFilter.value.toUpperCase())
  const layers = (walletFilter.value || assetFilter.value)
    ? assetLayers(holdings.map(asset => ({
      asset_id: asset.asset_id || asset.symbol,
      symbol: asset.symbol,
      current_value: asset.current_value,
    })))
    : walletLayers(chartWallets.value.map(wallet => ({
      id: wallet.id,
      name: wallet.name,
      total_value: wallet.total_value,
    })))
  const grid = sharePaths(layers, n, seed)
  return layers.map((layer, index) => ({
    id: layer.id,
    label: layer.label,
    color: layer.color,
    shares: grid.map(row => row[index] ?? 0),
  }))
})
const chartBreakdown = computed(() => (walletFilter.value || assetFilter.value ? 'Holdings' : 'Wallets'))

const friendCards = computed<CommunityUser[]>(() => {
  const cards = namedFriends.value.map(friend => {
    const row = usersStore.getUserById(friend.id)
    const person = community.list.find(entry => entry.id === friend.id)
    const base: CommunityUser = person ?? {
      id: friend.id,
      username: friend.handle,
      avatar_url: '',
      bio: friend.style || 'On this desk',
      is_friend: true,
      online: false,
      timezone: '',
      specialization: [],
      trading_style: friend.style || 'swing_trader',
      win_rate: (friend.win ?? 0) / 100,
      last_30d_pnl_pct: friend.pnl ?? 0,
      followers: 0,
      match_score: 0,
      last_active_at: '',
    }
    return {
      ...base,
      username: person?.username || row?.first_name || friend.handle,
      handle: friend.handle,
      trading_style: person?.trading_style || row?.trading_style || base.trading_style,
      verified: !!row?.is_verified,
      premium: isPaidRole(row?.role),
    }
  })
  return cards.sort(compareCircle)
})

const opinion = computed(() => opinions.getProfile(bookId.value))

const bookValue = computed(() => {
  const sum = wallets.value.reduce((s, w) => s + w.total_value, 0)
  return sum || user.value?.total_portfolio_value || 0
})

const desk = computed(() => {
  const value = Math.min(1_000_000_000, Math.max(0, bookValue.value))
  const win = Math.min(100, Math.max(0, user.value?.win_rate ?? 0))
  const total = ownBots.value.length
  const live = ownBots.value.filter(b => b.status === 'live').length
  return {
    value,
    win,
    live,
    bots: total,
    coverage: total ? live / total : 0,
    edge: win >= 55 ? 'ahead' : win >= 45 ? 'even' : 'behind',
  }
})

const personaLine = computed(() => {
  const u = user.value
  if (!u) return ''
  const style = STYLE[u.trading_style] ?? u.trading_style
  const risk = RISK[u.risk_tolerance] ?? u.risk_tolerance
  const kind = STYLE[u.investor_profile.type] ?? u.investor_profile.type.replace(/_/g, ' ')
  return `${style} · ${u.psychology_profile.mbti} · ${risk} · ${kind} · ${u.experience.title}`
})

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
function when(iso: string) {
  if (!iso || iso.length < 8) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function audienceLabel(v: Audience | undefined) {
  if (v === 'friends_only') return 'Friends'
  if (v === 'private') return 'Private'
  return 'Public'
}
function openCircle(next: typeof circle.value) {
  circle.value = circle.value === next ? null : next
}
function classTheme(symbol: string) {
  return assetClassTheme(symbol)
}
function barFill(value: number) {
  return meterFill(value)
}
function railDown(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  const el = friendRail.value
  if (!el) return
  railDrag.on = true
  railDrag.x = event.clientX
  railDrag.left = el.scrollLeft
  railDrag.moved = false
  try { el.setPointerCapture(event.pointerId) } catch { /* the drag still follows the pointer */ }
}
function railMove(event: PointerEvent) {
  const el = friendRail.value
  if (!railDrag.on || !el) return
  const dx = event.clientX - railDrag.x
  if (Math.abs(dx) > 4) railDrag.moved = true
  el.scrollLeft = railDrag.left - dx
}
function railUp() {
  railDrag.on = false
}
function railClick(event: MouseEvent) {
  if (!railDrag.moved) return
  event.preventDefault()
  event.stopPropagation()
  railDrag.moved = false
}
function goProfile(id: string) {
  navigateTo(`/profile/${id}`)
}
function toggleAlias() {
  if (!paid.value) return
  face.setHideRealName(!face.hideRealName)
}

onMounted(async () => {
  loading.value = true
  opinions.hydrate()
  face.hydrate()
  await Promise.all([
    usersStore.fetchUsers(),
    usersStore.fetchUserAssets(),
    walletStore.hydrated ? Promise.resolve() : walletStore.fetchWallets(),
    agents.hydrated ? Promise.resolve() : agents.fetchAgents(),
    bots.hydrated ? Promise.resolve() : bots.fetchBots(),
    strategies.fetchStrategies(),
    community.hydrated ? Promise.resolve() : community.fetchCommunity(),
    isAuthenticated.value ? refreshPortfolio().catch(() => null) : Promise.resolve(),
    $fetch<StatsSlice[]>('/data/user/statistics.json').then(rows => {
      stats.value = rows.find(s => s.user_id === bookId.value) ?? null
    }).catch(() => { stats.value = null }),
    $fetch<DiscussionRow[]>('/data/social/discussions.json').then(rows => {
      discussions.value = rows
    }).catch(() => { discussions.value = [] }),
  ])
  loading.value = false
})
</script>

<template>
  <div class="profile-page">
    <template v-if="loading && !user">
      <div class="skel-hero">
        <AppSkeletonLoader height="72px" width="72px" />
        <div class="skel-stack">
          <AppSkeletonLoader height="22px" width="180px" />
          <AppSkeletonLoader height="14px" width="260px" />
        </div>
      </div>
      <AppSkeletonLoader height="92px" />
      <AppSkeletonLoader height="140px" />
    </template>

    <UIEmptyState
      v-else-if="!user"
      icon="◯"
      title="Profile not found"
      message="The user book has no row for this desk."
    />

    <template v-else>
      <ProfileHero
        :user="user"
        is-own
        :name="publishedName"
        :handle="faceHandle"
        :portrait="portraitUrl"
        :plan="paid ? 'Paid' : 'Free'"
        :paid="paid"
        :note="catalogSelf ? '' : 'Demo portrait and name. The book, mind, wallets, and circle are the account already in the app. The portrait and the name open Settings.'"
      />

      <section class="desk spread" aria-label="Desk summary">
        <span><em>Value</em> {{ money(desk.value) }}</span>
        <span><em>Win</em> {{ desk.win.toFixed(0) }}%</span>
        <span><em>Avatars</em> {{ desk.live }}/{{ desk.bots }}</span>
        <span><em>Coverage</em> {{ Math.round(desk.coverage * 100) }}%</span>
        <span><em>Edge</em> <b :class="desk.edge">{{ desk.edge }}</b></span>
        <span><em>Level</em> {{ user.experience.level }} {{ user.experience.title }}</span>
      </section>

      <section class="audience">
        <div class="seg" role="group" aria-label="Who is looking">
          <button type="button" :class="{ on: audience === 'desk' }" @click="audience = 'desk'">Your desk</button>
          <button type="button" :class="{ on: audience === 'visitors' }" @click="audience = 'visitors'">Visitors</button>
        </div>
        <div class="aud-controls">
          <button type="button" :disabled="!paid" @click="cycleAudience('profile')">Profile {{ audienceLabel(settingFor('profile')) }}</button>
          <button type="button" :disabled="!paid" @click="cycleAudience('portfolio')">Book {{ audienceLabel(settingFor('portfolio')) }}</button>
          <button type="button" :disabled="!paid" @click="cycleAudience('history')">History {{ audienceLabel(settingFor('history')) }}</button>
          <button type="button" :disabled="!paid" :class="{ on: paid && face.hideRealName }" @click="toggleAlias">
            {{ paid && face.hideRealName ? '@ name only' : 'Show @ only' }}
          </button>
        </div>
        <p v-if="paid" class="aud-line">Paid desk. These switches decide what a visitor, a follower, or nobody sees.</p>
        <p v-else class="aud-line">
          Free desk shows the whole record.
          A paid desk changes who sees each block and opens wallets and bots past {{ FREE_WALLET_CAP }} and {{ FREE_BOT_CAP }}.
          <NuxtLink to="/Shop">Plans</NuxtLink>
        </p>
      </section>

      <section v-if="ownerSees('activity', 'portfolio')" class="block" :style="{ order: promoted === 'activity' ? -1 : 0 }">
        <header class="block-head">
          <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M2 6h12M5 1.5v3M11 1.5v3" /></svg>Activity</h2>
          <span>{{ calendar.active ? 'Trading in the last two weeks' : 'No recorded day in the last two weeks' }}</span>
          <button type="button" class="mini" :disabled="!paid" @click="toggleHide('activity')">{{ hiddenBlocks.includes('activity') ? 'Hidden' : 'Hide' }}</button>
          <button type="button" class="mini" :disabled="!paid" @click="promote('activity')">{{ promoted === 'activity' ? 'Promoted' : 'Promote' }}</button>
        </header>
        <div class="filters">
          <button type="button" :class="{ on: !walletFilter }" @click="walletFilter = null">All wallets</button>
          <button
            v-for="w in wallets"
            :key="w.id"
            type="button"
            :class="{ on: walletFilter === w.id }"
            @click="walletFilter = w.id"
          >{{ w.name }}</button>
          <span class="filter-gap" />
          <button type="button" :class="{ on: !assetFilter }" @click="assetFilter = null">All assets</button>
          <button
            v-for="a in assetRows.filter(r => r.held || user.preferred_assets.includes(r.symbol))"
            :key="a.symbol"
            type="button"
            :class="{ on: assetFilter === a.symbol }"
            @click="assetFilter = a.symbol"
          >{{ a.symbol }}</button>
        </div>
        <div class="chart-block">
          <div class="filters periods" role="group" aria-label="Chart period">
            <button
              v-for="p in CHART_PERIODS"
              :key="p.key"
              type="button"
              :class="{ on: chartPeriod === p.key }"
              @click="chartPeriod = p.key"
            >{{ p.label }}</button>
          </div>
          <WalletEquityCurve
            v-if="chartValue > 0"
            :wallet-id="chartId"
            :total-value="chartValue"
            :performance-history="chartPerf"
            :period="chartPeriod"
            :layers="chartLayers"
            :breakdown="chartBreakdown"
          />
          <p v-else class="copy">No priced holdings on this filter.</p>
        </div>
        <div
          v-if="sees('profile')"
          ref="friendRail"
          class="rail"
          aria-label="Friends"
          @pointerdown="railDown"
          @pointermove="railMove"
          @pointerup="railUp"
          @pointercancel="railUp"
          @click.capture="railClick"
        >
          <CommunityPersonCard v-if="!friendCards.length" empty />
          <CommunityPersonCard
            v-for="person in friendCards"
            :key="person.id"
            :user="person"
            @profile="goProfile"
          />
        </div>
        <ProfileActivityYear
          :weeks="calendar.weeks"
          :active="calendar.active"
          :today="todayIso()"
        />
      </section>
      <p v-else class="redacted">The book stays with friends.</p>

      <section v-if="ownerSees('assets', 'portfolio')" class="block" :style="{ order: promoted === 'assets' ? -1 : 0 }">
        <header class="block-head">
          <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12l4-5 3 3 5-7" /></svg>Assets</h2>
          <span>{{ shownAssets.length }} on this filter</span>
          <button type="button" class="mini" :disabled="!paid" @click="toggleHide('assets')">{{ hiddenBlocks.includes('assets') ? 'Hidden' : 'Hide' }}</button>
          <button type="button" class="mini" :disabled="!paid" @click="promote('assets')">{{ promoted === 'assets' ? 'Promoted' : 'Promote' }}</button>
        </header>
        <ul class="asset-list">
          <li v-for="a in shownAssets" :key="a.symbol">
            <span
              class="tag"
              :style="{ color: classTheme(a.symbol).color, background: classTheme(a.symbol).tint, borderColor: classTheme(a.symbol).color }"
            >{{ classTheme(a.symbol).label }}</span>
            <NuxtLink :to="`/assets/${a.symbol}`">{{ a.symbol }}</NuxtLink>
            <span v-if="!a.held" class="dim grow">Preferred · not held</span>
            <span v-else class="grow">{{ money(a.value) }}</span>
            <b :class="a.pct != null && a.pct < 0 ? 'down' : 'up'">{{ a.held ? pct(a.pct) : '' }}</b>
          </li>
        </ul>
      </section>

      <section v-if="ownerSees('mind', 'profile')" class="block" :style="{ order: promoted === 'mind' ? -1 : 0 }">
          <header class="block-head">
            <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 4.5v4l2.5 1.5" /></svg>Mind</h2>
            <span>{{ user.psychology_profile.mbti }}</span>
            <button type="button" class="mini" :disabled="!paid" @click="toggleHide('mind')">{{ hiddenBlocks.includes('mind') ? 'Hidden' : 'Hide' }}</button>
            <button type="button" class="mini" :disabled="!paid" @click="promote('mind')">{{ promoted === 'mind' ? 'Promoted' : 'Promote' }}</button>
          </header>
          <p class="copy">{{ user.psychology_profile.description }}</p>
          <ul class="meters">
            <li v-for="m in mindMeters" :key="m.label">
              <span>{{ m.label }}</span>
              <i><b :style="{ width: `${Math.round(m.value * 100)}%`, background: barFill(m.value) }" /></i>
              <em>{{ Math.round(m.value * 100) }}</em>
            </li>
          </ul>
          <p class="copy">{{ user.investor_profile.description }}</p>
          <p class="copy">{{ user.political_profile.description }}</p>
          <p v-if="opinion.sample_count" class="copy">
            Articles have moved the lean to {{ opinion.political_leaning.toFixed(2) }} political
            and {{ opinion.economic_leaning.toFixed(2) }} economic
            across {{ opinion.sample_count }} reads.
          </p>
          <ProfilePersonalityMatrix
            v-if="personalAgent"
            :matrix="personalAgent.personality_matrix"
          />
          <ul class="dates">
            <li v-for="d in dates" :key="d.label + d.when">
              <span class="date-label">
                <svg v-if="d.icon === 'user'" class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.5" r="2.2" /><path d="M3.5 13.5c.6-2.4 2.2-3.5 4.5-3.5s3.9 1.1 4.5 3.5" /></svg>
                <svg v-else-if="d.icon === 'desk'" class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h12v7H2zM4 6V3.5h8V6" /></svg>
                <svg v-else-if="d.icon === 'clock'" class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></svg>
                <svg v-else-if="d.icon === 'up'" class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11l5-6 5 6" /></svg>
                <svg v-else-if="d.icon === 'down'" class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5l5 6 5-6" /></svg>
                <svg v-else class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5l1.4 3 3.3.4-2.4 2.2.6 3.2L8 9.6 5.1 11.3l.6-3.2L3.3 5.9l3.3-.4z" /></svg>
                {{ d.label }}
              </span>
              <span class="date-meta">
                <time v-if="d.when !== d.label">{{ when(d.when) }}</time>
                <b v-if="d.age">{{ d.age }}</b>
              </span>
            </li>
          </ul>
          <p class="tags">
            <span v-for="s in user.psychology_profile.strengths" :key="s">{{ s.replace(/_/g, ' ') }}</span>
          </p>
      </section>
        <p v-else class="redacted">The persona stays private.</p>

        <section class="block">
          <header class="block-head">
            <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.5" cy="6" r="2" /><circle cx="11" cy="6.5" r="1.6" /><path d="M1.8 13c.4-2 1.8-3 3.7-3s3.3 1 3.7 3M9.2 13c.3-1.4 1.2-2.2 2.4-2.2 1.1 0 1.9.7 2.3 2.2" /></svg>Circle</h2>
            <span>{{ user.friends_count }} friends · {{ user.followers_count }} followers · {{ user.following_count }} following</span>
          </header>
          <div class="filters">
            <button type="button" :class="{ on: circle === 'friends' }" @click="openCircle('friends')">Friends {{ user.friends_count }}</button>
            <button type="button" :class="{ on: circle === 'followers' }" @click="openCircle('followers')">Followers {{ user.followers_count }}</button>
            <button type="button" :class="{ on: circle === 'following' }" @click="openCircle('following')">Following {{ user.following_count }}</button>
            <button type="button" :class="{ on: circle === 'groups' }" @click="openCircle('groups')">Groups {{ groups.length }}</button>
          </div>

          <ul v-if="circle === 'friends' || circle === 'following'" class="people">
            <li v-for="p in namedFriends" :key="p.id">
              <NuxtLink :to="`/profile/${p.id}`">{{ p.name }}</NuxtLink>
              <span class="dim">@{{ p.handle }} {{ p.style }}</span>
              <b :class="(p.pnl ?? 0) < 0 ? 'down' : 'up'">{{ pct(p.pnl) }}</b>
            </li>
          </ul>
          <ul v-else-if="circle === 'followers'" class="people">
            <li v-for="p in followerCircle" :key="p.id">
              <NuxtLink :to="`/profile/${p.id}`">{{ p.username }}</NuxtLink>
              <span class="dim">{{ p.trading_style.replace(/_/g, ' ') }} · {{ p.followers }} followers</span>
              <b :class="p.last_30d_pnl_pct < 0 ? 'down' : 'up'">{{ pct(p.last_30d_pnl_pct) }}</b>
            </li>
          </ul>
          <ul v-else-if="circle === 'groups'" class="people">
            <li v-for="g in groups" :key="g.id">
              <span>{{ g.name }}</span>
              <span class="dim">{{ g.category }} · {{ g.members?.length ?? 0 }} members</span>
            </li>
          </ul>
        </section>

      <section v-if="ownerSees('wallets', 'portfolio')" class="block" :style="{ order: promoted === 'wallets' ? -1 : 0 }">
        <header class="block-head">
          <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="12" height="9" rx="1" /><path d="M2 7h12M10.5 9.5h1.5" /></svg>Wallets</h2>
          <span>{{ wallets.length }} on the book · free desk opens {{ FREE_WALLET_CAP }}</span>
          <button type="button" class="mini" :disabled="!paid" @click="toggleHide('wallets')">{{ hiddenBlocks.includes('wallets') ? 'Hidden' : 'Hide' }}</button>
          <button type="button" class="mini" :disabled="!paid" @click="promote('wallets')">{{ promoted === 'wallets' ? 'Promoted' : 'Promote' }}</button>
        </header>
        <ul class="cards">
          <li v-for="w in wallets" :key="w.id" :class="{ dimmed: walletFilter && walletFilter !== w.id }">
            <div>
              <strong>{{ w.name }}</strong>
              <span class="dim">{{ w.type }} · {{ audienceLabel(settingFor('portfolio')) }}</span>
            </div>
            <span>{{ money(w.total_value) }}</span>
            <b :class="w.total_return_percentage < 0 ? 'down' : 'up'">{{ pct(w.total_return_percentage) }}</b>
            <span class="dim">{{ pct(w.daily_change_percentage) }} today</span>
          </li>
        </ul>
        <p v-if="portfolio" class="copy">Live portfolio {{ money(portfolio.total_value) }} · cash {{ money(portfolio.cash_balance) }} · {{ portfolio.holdings.length }} holdings.</p>
      </section>

      <section v-if="ownerSees('bots', 'history')" class="block" :style="{ order: promoted === 'bots' ? -1 : 0 }">
        <header class="block-head">
          <h2><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="5" width="10" height="7" rx="1" /><path d="M8 5V2.5M5.5 8.5h.01M10.5 8.5h.01" /></svg>Bots</h2>
          <span>{{ ownBots.length }} on the book · free desk opens {{ FREE_BOT_CAP }} · {{ ownStrategies.length }} strategies</span>
          <button type="button" class="mini" :disabled="!paid" @click="toggleHide('bots')">{{ hiddenBlocks.includes('bots') ? 'Hidden' : 'Hide' }}</button>
          <button type="button" class="mini" :disabled="!paid" @click="promote('bots')">{{ promoted === 'bots' ? 'Promoted' : 'Promote' }}</button>
        </header>
        <ul class="cards">
          <li v-for="b in ownBots" :key="b.id">
            <div>
              <strong>{{ b.name }}</strong>
              <span class="dim">{{ b.status }} · {{ b.tags.join(' ') }}</span>
            </div>
            <span>{{ money(b.capital_allocated_usd) }}</span>
            <b :class="b.pnl_30d_pct < 0 ? 'down' : 'up'">{{ pct(b.pnl_30d_pct) }}</b>
            <NuxtLink to="/strategies" class="dim">Desk</NuxtLink>
          </li>
        </ul>
        <ul v-if="user.ai_avatars.length" class="avatar-row">
          <li v-for="a in user.ai_avatars" :key="a.id">
            {{ a.name }} · {{ a.trading_style.replace(/_/g, ' ') }} · {{ pct(a.pnl_30d) }} · {{ a.is_public ? 'Public' : 'Private' }}
          </li>
        </ul>
        <p v-if="stats?.performance" class="copy">
          Trade log {{ stats.performance.win_rate }}% win across {{ stats.performance.total_trades }} trades
          · net {{ money(stats.performance.net_profit ?? 0) }}.
          <template v-if="stats.trading_platforms?.length"> Platforms {{ stats.trading_platforms.join(', ') }}.</template>
        </p>
      </section>
      <p v-else class="redacted">The trading history stays with friends.</p>

      <section v-if="sees('profile') && user.achievements.length" class="block">
        <header class="block-head"><h2>Marks</h2></header>
        <ul class="marks">
          <li v-for="a in user.achievements" :key="a.id">
            <span>{{ a.icon }} {{ a.name }}</span>
            <span class="dim">{{ a.rarity }} · {{ when(a.unlocked_date) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}
.skel-hero { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 0.7rem; align-items: center; }
.skel-stack { display: flex; flex-direction: column; gap: 0.4rem; }

.hero, .block, .audience, .desk, .redacted, .spread, .filters, .block-head, .rail, .chart-block {
  box-sizing: border-box;
  min-width: 0;
}
.block, .audience, .desk, .redacted {
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.06));
  border-radius: var(--radius-md, 8px);
  background: var(--surface-base, rgba(255,255,255,0.02));
}
.face {
  position: relative;
  width: 72px;
  height: 72px;
  display: block;
  color: inherit;
}
.face img, .face :deep(.mark) {
  width: 72px;
  height: 72px;
  display: block;
  object-fit: cover;
  border-radius: 14px 0 14px 0;
  box-shadow:
    inset 1px 1px 0 rgba(255,255,255,0.34),
    inset -2px -2px 5px rgba(0,0,0,0.45),
    0 1px 0 rgba(255,255,255,0.16),
    0 8px 16px rgba(0,0,0,0.38);
}
a.face:hover { color: inherit; filter: brightness(1.06); }
.presence {
  position: absolute; right: 2px; bottom: 2px; width: 10px; height: 10px; border-radius: 50%;
  background: #666; box-shadow: 0 0 0 2px #12141c;
}
.presence.on { background: var(--primary-green, #00ff88); }
.identity { min-width: 0; }
.name-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
h1 { margin: 0; font-size: 1.25rem; letter-spacing: -0.02em; }
.tick { color: var(--primary-blue, #00aaff); font-size: 0.8rem; }
.plan {
  font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; padding: 0.1rem 0.4rem;
}
.plan.paid { color: #f5d90a; border-color: rgba(245,217,10,0.45); }
h1 a { color: inherit; }
.handle, .persona, .bio, .face-note, .copy, .aud-line { margin: 0.15rem 0 0; font-size: 0.75rem; line-height: 1.4; }
.handle, .face-note, .copy, .aud-line, .dim { color: rgba(255,255,255,0.55); }
.persona { color: rgba(255,255,255,0.88); }
.spread {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  gap: 0.35rem 0.6rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.spread > span {
  flex: 1 1 6.5rem;
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0.28rem;
  min-width: 0;
}
.hero-stats { grid-column: 1 / -1; }
.desk { padding: 0.45rem 0.7rem; }
.desk b { font-weight: 600; }
.desk b.ahead, .up { color: var(--primary-green, #00ff88); }
.desk b.even { color: #f5d90a; }
.desk b.behind { color: #ff9f1a; }
.hero-stats em, .desk em {
  font-style: normal; letter-spacing: 0.08em; text-transform: uppercase;
  font-size: 0.58rem; color: rgba(255,255,255,0.45); margin-right: 0.25rem;
}
.audience { padding: 0.55rem 0.7rem; display: flex; flex-direction: column; gap: 0.35rem; }
.seg { display: flex; width: 100%; gap: 0.25rem; }
.seg button { flex: 1 1 0; }
.seg button, .filters button, .aud-controls button, .mini {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.75);
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
  font: inherit;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.seg button.on, .filters button.on { border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }
.aud-controls { display: flex; flex-wrap: wrap; width: 100%; gap: 0.3rem; }
.aud-controls button { flex: 1 1 8rem; }
.aud-controls button.on { border-color: #f5d90a; color: #f5d90a; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
.aud-line a { color: var(--primary-green, #00ff88); margin-left: 0.35rem; }

.block { padding: 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.45rem; }
.block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.7rem;
  width: 100%;
}
.block-head h2 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.block-head > span { flex: 1 1 auto; text-align: center; }
.block-head span, .redacted { font-size: 0.68rem; color: rgba(255,255,255,0.5); }
.redacted { margin: 0; padding: 0.55rem 0.7rem; }
.ico { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.filters { display: flex; flex-wrap: wrap; width: 100%; gap: 0.3rem; }
.filters button { flex: 1 1 5.5rem; text-align: center; }
.filter-gap { display: none; }
.chart-block { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.periods { width: auto; }
.periods button { flex: 1 1 0; }
.rail {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  width: 100%;
  min-width: 0;
  cursor: grab;
  user-select: none;
  padding-bottom: 0.15rem;
}
.rail:active { cursor: grabbing; }
.rail :deep(.person-card) { flex: 0 0 min(280px, 86%); }

.asset-list, .people, .cards, .dates, .marks, .avatar-row, .meters {
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.28rem;
}
.asset-list li, .people li, .cards li, .dates li, .marks li {
  display: flex;
  width: 100%;
  gap: 0.45rem;
  align-items: center;
  font-size: 0.75rem;
  min-width: 0;
}
.asset-list li .grow, .people li .dim { flex: 1 1 auto; min-width: 0; }
.tag {
  flex: 0 0 auto;
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.08rem 0.38rem;
}
.cards li > div { flex: 1 1 8rem; }
.dates li, .marks li { justify-content: space-between; }
.date-label, .date-meta { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; }
.date-meta { color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; }
.date-meta b { font-weight: 600; color: #f5d90a; }
.cards li > div { display: flex; flex-direction: column; min-width: 0; }
.cards li.dimmed { opacity: 0.4; }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--primary-green, #00ff88); }
.up { color: var(--primary-green, #00ff88); font-weight: 600; }
.down { color: #ff5555; font-weight: 600; }
.meters li { display: grid; grid-template-columns: 7.2rem minmax(0, 1fr) 2rem; gap: 0.4rem; align-items: center; font-size: 0.68rem; }
.meters i { display: block; height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; }
.meters b { display: block; height: 100%; border-radius: 99px; }
.meters em { font-style: normal; text-align: right; font-variant-numeric: tabular-nums; }
.tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; }
.tags span {
  font-size: 0.6rem; letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; padding: 0.1rem 0.4rem;
}
.avatar-row li { font-size: 0.7rem; color: rgba(255,255,255,0.7); }
strong { font-weight: 600; }
@media (max-width: 640px) {
  .face, .face img, .face :deep(.mark) { width: 56px; height: 56px; }
  .cards li { flex-wrap: wrap; }
}
</style>
