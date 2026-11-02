<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useAllocationStore } from '@/stores/allocation'
import { usePlatformsStore } from '@/stores/platforms'
import { useBotsStore } from '@/stores/bots'
import { useMacroStore } from '@/stores/macro'
import { useAgentsStore } from '@/stores/agents'
import { useAssetsStore } from '@/stores/assets'
import { useOwnBook } from '@/composables/useOwnBook'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UISourceChip from '@/components/UI/SourceChip.vue'
import AgentAvatarCard from '@/components/Agent/AvatarCard.vue'
import WalletSwitcher from '@/components/Wallet/Switcher.vue'
import WalletHero from '@/components/Wallet/Hero.vue'
import WalletPositions from '@/components/Wallet/Positions.vue'
import WalletBotContribution from '@/components/Wallet/BotContribution.vue'
import WalletTrades from '@/components/Wallet/Trades.vue'
import WalletAllocationSlider from '@/components/Wallet/AllocationSlider.vue'
import WalletFlowVisualizer from '@/components/Wallet/FlowVisualizer.vue'
import WalletPlatformBreakdown from '@/components/Wallet/PlatformBreakdown.vue'
import WalletPaperPanel from '@/components/Wallet/PaperPanel.vue'
import MapButton from '@/components/Map/MapButton.vue'
import type { MapMarker } from '@/components/Map/WorldMap.vue'
import {
  ALL_WALLETS,
  NO_EQUITY_HISTORY,
  SAMPLE_WALLETS_NOTE,
  TODAY_PENDING_NOTE,
  aggregateWallets,
  holdingTodayPct,
} from '@/utils/walletBook'
import { OWN_BOOK_NOTE, emptyOwnBook } from '@/utils/ownBook'
import { ownPaperTree } from '@/utils/walletTree'
import { usePrimarySettings } from '@/composables/usePrimarySettings'
import UIValueTree from '@/components/UI/ValueTree.vue'
import { fmtPctFromPercent, pctDecimals } from '~/utils/format'
import { fmtMoneyKpi, signTone } from '~/utils/valueTree'

definePageMeta({ title: 'Wallet', layout: 'default' })

const PLATFORM_LL: Record<string, { lat: number; lng: number }> = {
  plat_coinbase: { lat: 37.7749, lng: -122.4194 },
  plat_ibkr: { lat: 41.0262, lng: -73.6285 },
  plat_kraken: { lat: 37.7749, lng: -122.4194 },
  plat_chase: { lat: 40.7128, lng: -74.0060 },
  plat_robinhood: { lat: 37.4848, lng: -122.1484 },
  plat_metals: { lat: 51.5074, lng: -0.1278 }
}

const walletStore = useWalletStore()
const allocation = useAllocationStore()
const platforms = usePlatformsStore()
const bots = useBotsStore()
const macro = useMacroStore()
const agents = useAgentsStore()
const assetsStore = useAssetsStore()
const { userId } = useCurrentUser()

const selectedWalletId = ref<string>('wallet_001')
const period = ref<'1d' | '7d' | '30d' | '90d' | '1y'>('30d')

/**
 * The signed-in account's own paper book (custody wallets + bots + portfolio).
 * The platform wallets below are the bundled demo book (user_001): sample, never
 * the user's money (swarm 2026-10-30b board-finance F7).
 */
// C8: one shared read (composables/useOwnBook.ts) for this KPI, the value tree, the hand-trade form
// and the dock; refreshed once per visit (PERF-6: /api/portfolio/ used to be read twice here).
const own = useOwnBook()
const ownBook = computed(() => own.book.value ?? emptyOwnBook())
const ownBookState = computed(() => (own.state.value === 'idle' ? 'loading' : own.state.value))
/** The raw rows the loader read: the "Your paper" value tree shows each part from them. */
const ownRaw = computed(() => own.raw.value)
const primary = usePrimarySettings()

/** "Your paper" -> its inputs -> the Settings primary values (first value tree, DESIGN-AUDIT §3). */
const paperTree = computed(() => ownPaperTree({
  state: ownBookState.value,
  raw: ownRaw.value,
  settings: primary.values.value,
  settingsDefaults: primary.defaults.value,
}))

onMounted(async () => {
  own.refresh()
  primary.load()
  if (!assetsStore.assets.length) assetsStore.initializeStore()
  if (!walletStore.hydrated) await walletStore.initializeStore()
  if (!platforms.hydrated) await platforms.fetchPlatforms()
  if (!bots.hydrated) await bots.fetchBots()
  if (!agents.hydrated) await agents.fetchAgents().catch(() => {})
  const selected = selectedWalletId.value
  if (selected !== ALL_WALLETS && !walletStore.getWalletById(selected)) {
    const def = walletStore.getDefaultWallet(userId.value)
    selectedWalletId.value = def?.id ?? walletStore.wallets[0]?.id
  }
})

// ── Market pulse (merged from the former Dashboard page) ─────────────────
const marketPulse = computed(() => {
  const bullish = macro.market_sentiment > 0.15
  const stress = macro.geopolitical_stress > 0.5
  return {
    mood: bullish ? 'Bullish' : 'Bearish',
    moodTone: bullish ? ('success' as const) : ('danger' as const),
    stress: stress ? 'Elevated' : 'Normal',
    stressTone: stress ? ('danger' as const) : ('success' as const),
    volLabel: macro.global_volatility_index > 0.6 ? 'High' : 'Low',
  }
})

const personalAvatar = computed(() => agents.personal)

const isAll = computed(() => selectedWalletId.value === ALL_WALLETS)
const currentWallet = computed<any>(() =>
  isAll.value ? aggregateWallets(walletStore.wallets) : walletStore.getWalletById(selectedWalletId.value)
)
const positions = computed(() => currentWallet.value?.assets ?? [])
const transactions = computed(() => currentWallet.value?.transactions ?? [])

/**
 * Totals across every connected platform — the SAME definition the bottom bar
 * uses for its Wallet readout. The hero used to label one platform's balance
 * "Total Balance", so the page and the bar disagreed by the size of the other
 * platforms and each looked like a bug from the other's side.
 *
 * `invested_amount` is cost basis (Σ amount × average_price); `unrealized` is the
 * market-minus-cost gap, surfaced so the row reconciles instead of looking short.
 */
const portfolioTotals = computed(() => {
  const ws = walletStore.wallets ?? []
  const sum = (pick: (w: any) => number) => ws.reduce((s, w) => s + (pick(w) ?? 0), 0)
  const total = sum(w => w.total_value)
  const available = sum(w => w.available_balance)
  const invested = sum(w => w.invested_amount)
  const daily = sum(w => w.daily_change)
  const prior = total - daily
  return {
    total_value: total,
    available_balance: available,
    invested_amount: invested,
    unrealized: total - available - invested,
    daily_change: daily,
    daily_change_percentage: prior !== 0 ? (daily / prior) * 100 : 0,
    platform_count: ws.length
  }
})

// KPI money: fmtMoneyKpi (2 dp below $1M, compact above) — the same rule as the "Your paper" tree below,
// so the strip and the tree print the same total ("$9,756.84" in both).
const ownValueLabel = computed(() => {
  if (ownBookState.value === 'ready') return fmtMoneyKpi(ownBook.value.total)
  return '—'
})

const sampleTodayPct = computed(() => currentWallet.value?.daily_change_percentage ?? null)

const kpis = computed(() => [
  { label: 'Your paper', value: ownValueLabel.value },
  // REVIEW-2: every sample figure names its scope; the platform count matches the breakdown below.
  { label: isAll.value ? 'Sample · all wallets' : 'Sample · this wallet', value: currentWallet.value ? fmtMoneyKpi(currentWallet.value.total_value) : '—' },
  { label: 'Sample today', value: fmtPctFromPercent(sampleTodayPct.value, { signed: true }), tone: signTone(sampleTodayPct.value, pctDecimals(sampleTodayPct.value ?? 0)) },
  { label: 'Platforms', value: platforms.list.length ? `${platforms.list.length} (${platforms.connectedCount} connected)` : '0' }
])

/** Real 24h move of each held asset when it has a live quote; absent otherwise (never a hash). */
const todayPctMap = computed<Record<string, number>>(() =>
  holdingTodayPct(positions.value, symbol => assetsStore.getAssetBySymbol(symbol)),
)

const ownBookLine = computed(() => {
  if (ownBookState.value === 'loading') return 'Reading your paper wallets…'
  if (ownBookState.value === 'signed-out') return 'Sign in to see your own paper wallets.'
  if (ownBookState.value === 'error') return 'Your paper wallets could not be read right now.'
  if (ownBook.value.empty) return 'You have no paper wallet yet: create one in Trade.'
  return `${ownBook.value.walletCount} custody wallet${ownBook.value.walletCount === 1 ? '' : 's'}${ownBook.value.hasPortfolio ? ' + your portfolio' : ''}. Open Your paper to see each part and the settings behind it.`
})

const walletMapMarkers = computed<MapMarker[]>(() =>
  platforms.list.filter(p => PLATFORM_LL[p.id]).map(p => ({
    id: p.id,
    lat: PLATFORM_LL[p.id].lat,
    lng: PLATFORM_LL[p.id].lng,
    label: `${p.name}`,
    tone: (p.daily_pnl_pct >= 0 ? 'positive' : 'negative') as any,
    weight: Math.min(1, p.balance_usd / 60000),
    group: p.type
  }))
)
</script>

<template>
  <WalletFlowVisualizer>
    <NavigationAreaLinks area="portfolio" />
    <UIScreenShell :kpis="kpis">
      <template #actions>
        <UIPill :tone="marketPulse.moodTone" show-dot>{{ marketPulse.mood }}</UIPill>
        <UIPill :tone="marketPulse.stressTone">Stress: {{ marketPulse.stress }}</UIPill>
        <UIPill :tone="marketPulse.volLabel === 'High' ? 'danger' : 'success'">Vol: {{ marketPulse.volLabel }}</UIPill>
        <MapButton v-if="walletMapMarkers.length" :markers="walletMapMarkers" title="Platforms" :subtitle="`${walletMapMarkers.length} connected`" />
        <UIPill :tone="allocation.is100Percent ? 'success' : 'warning'" show-dot>
          {{ allocation.is100Percent ? '100%' : 'REBAL' }}
        </UIPill>
      </template>

      <WalletHandTrade />

      <div class="own-paper">
        <UIValueTree :node="paperTree" size="lg" />
        <p class="src-line own" aria-live="polite">
          <UISourceChip v-if="ownBookState === 'ready'" source="paper" :note="OWN_BOOK_NOTE" />
          <UISourceChip v-else source="pending" :note="ownBookLine" />
          <span>{{ ownBookLine }}</span>
          <NuxtLink to="/trade" class="src-link">Trade →</NuxtLink>
        </p>
      </div>

      <p v-if="walletStore.wallets.length" class="src-line">
        <UISourceChip source="sample" :note="SAMPLE_WALLETS_NOTE" />
        <span>The platform wallets, totals, chart and holdings below are a sample book (demo account), not your money.</span>
      </p>

      <WalletSwitcher
        v-if="walletStore.wallets.length"
        :wallets="walletStore.wallets"
        :active-id="selectedWalletId"
        :total-balance="portfolioTotals.total_value"
        :total-change-pct="portfolioTotals.daily_change_percentage"
        @switch="selectedWalletId = $event"
      />

      <WalletHero :wallet="currentWallet" :portfolio="portfolioTotals" v-model:period="period" />

      <WalletPaperPanel />

      <WalletAllocationSlider
        v-if="currentWallet"
        :wallet="currentWallet"
        :wallets="walletStore.wallets"
        :scope="isAll ? 'all' : 'wallet'"
        :period="period"
      />

      <p v-if="currentWallet" class="src-line">
        <UISourceChip source="pending" :note="NO_EQUITY_HISTORY" />
        <span>Equity line joins the stored period start to today. Best, Worst, Max DD and Sharpe: not computed, needs a daily equity history (not recorded yet).</span>
      </p>

      <div class="row two-col">
        <UICard title="Bots & platforms">
          <WalletBotContribution :total-today="currentWallet?.daily_change ?? 0" />
        </UICard>

        <UICard v-if="personalAvatar" title="Your avatar" padding="tight">
          <AgentAvatarCard :agent="personalAvatar" @select="(id) => navigateTo(`/agents/${id}`)" />
        </UICard>
      </div>

      <UICard title="Holdings">
        <p class="src-line in-card">
          <UISourceChip source="pending" :note="TODAY_PENDING_NOTE" />
          <span>Today = the asset's live 24h quote move. Without a live quote it is not computed.</span>
        </p>
        <WalletPositions
          :positions="positions"
          :total-value="currentWallet?.total_value"
          :today-pct-map="todayPctMap"
          @open-asset="(id) => navigateTo(`/assets/${id}`)"
        />
      </UICard>

      <UICard v-if="transactions.length" title="Recent activity" padding="tight">
        <WalletTrades :trades="transactions.slice(0, 5)" />
      </UICard>

      <!-- Platform breakdown — the centralized hub view -->
      <UICard title="Connected platforms" padding="tight">
        <WalletPlatformBreakdown />
      </UICard>
    </UIScreenShell>
  </WalletFlowVisualizer>
</template>

<style scoped>
:deep(.screen-shell) { position: relative; z-index: 1; }
.row { display: grid; gap: 0.6rem; }
.row.two-col { grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
/* Where the numbers come from (wave 2 honest data): one quiet line, no new chrome. */
.src-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--text-gray, rgba(255,255,255,0.55));
}
.src-line.own { color: var(--text-light-gray, rgba(255,255,255,0.75)); }
/* "Your paper" value tree: same stat card as the tree primitive, kept to one column. */
.own-paper { display: grid; gap: 0.35rem; max-width: min(100%, 34rem); }
.src-line.in-card { margin-bottom: 0.4rem; }
.src-link { color: var(--primary-blue, #5b9cff); text-decoration: none; font-weight: 600; }
.src-link:hover { text-decoration: underline; }
</style>
