<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useAllocationStore } from '@/stores/allocation'
import { usePlatformsStore } from '@/stores/platforms'
import { useBotsStore } from '@/stores/bots'
import { useMacroStore } from '@/stores/macro'
import { useAgentsStore } from '@/stores/agents'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
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
import { ALL_WALLETS, aggregateWallets } from '@/utils/walletBook'

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
const { userId } = useCurrentUser()

const selectedWalletId = ref<string>('wallet_001')
const period = ref<'1d' | '7d' | '30d' | '90d' | '1y'>('30d')

onMounted(async () => {
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

const kpis = computed(() => [
  { label: 'Value', value: currentWallet.value ? `$${Math.round(currentWallet.value.total_value).toLocaleString(APP_LOCALE)}` : '—' },
  { label: 'Today', value: currentWallet.value ? `${currentWallet.value.daily_change_percentage >= 0 ? '+' : ''}${currentWallet.value.daily_change_percentage.toFixed(2)}` : '—', suffix: '%', tone: (currentWallet.value?.daily_change_percentage ?? 0) >= 0 ? 'positive' as const : 'negative' as const },
  { label: 'Platforms', value: platforms.connectedCount }
])

const todayPctMap = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const p of positions.value) {
    let hash = 0
    for (let i = 0; i < (p.asset_id ?? '').length; i++) hash = (hash * 31 + p.asset_id.charCodeAt(i)) >>> 0
    out[p.asset_id] = ((hash % 1000) / 1000 - 0.45) * 10
  }
  return out
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

      <div class="row two-col">
        <UICard title="Bots & platforms">
          <WalletBotContribution :total-today="currentWallet?.daily_change ?? 0" />
        </UICard>

        <UICard v-if="personalAvatar" title="Your avatar" padding="tight">
          <AgentAvatarCard :agent="personalAvatar" @select="(id) => navigateTo(`/agents/${id}`)" />
        </UICard>
      </div>

      <UICard title="Holdings">
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
</style>
