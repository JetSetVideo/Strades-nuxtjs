<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useAllocationStore } from '@/stores/allocation'
import { usePlatformsStore } from '@/stores/platforms'
import { useBotsStore } from '@/stores/bots'
import { useOpinionsStore } from '@/stores/opinions'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import WalletSwitcher from '@/components/Wallet/Switcher.vue'
import WalletHero from '@/components/Wallet/Hero.vue'
import WalletPositions from '@/components/Wallet/Positions.vue'
import WalletEquityCurve from '@/components/Wallet/EquityCurve.vue'
import WalletRiskPanel from '@/components/Wallet/RiskPanel.vue'
import WalletBotContribution from '@/components/Wallet/BotContribution.vue'
import WalletTrades from '@/components/Wallet/Trades.vue'
import WalletAllocationSlider from '@/components/Wallet/AllocationSlider.vue'
import WalletFlowVisualizer from '@/components/Wallet/FlowVisualizer.vue'
import WalletPlatformBreakdown from '@/components/Wallet/PlatformBreakdown.vue'
import WalletPaperPanel from '@/components/Wallet/PaperPanel.vue'
import MapButton from '@/components/Map/MapButton.vue'
import type { MapMarker } from '@/components/Map/WorldMap.vue'

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
const opinions = useOpinionsStore()
const { userId } = useCurrentUser()

const selectedWalletId = ref<string>('wallet_001')
const period = ref<'1d' | '7d' | '30d' | '90d' | '1y'>('30d')

onMounted(async () => {
  if (!walletStore.hydrated) await walletStore.initializeStore()
  if (!platforms.hydrated) await platforms.fetchPlatforms()
  if (!bots.hydrated) await bots.fetchBots()
  if (!selectedWalletId.value || !walletStore.getWalletById(selectedWalletId.value)) {
    const def = walletStore.getDefaultWallet(userId.value)
    selectedWalletId.value = def?.id ?? walletStore.wallets[0]?.id
  }
})

const currentWallet = computed<any>(() => walletStore.getWalletById(selectedWalletId.value))
const positions = computed(() => currentWallet.value?.assets ?? [])
const transactions = computed(() => currentWallet.value?.transactions ?? [])

const kpis = computed(() => [
  { label: 'Value', value: currentWallet.value ? `$${Math.round(currentWallet.value.total_value).toLocaleString()}` : '—' },
  { label: 'Today', value: currentWallet.value?.daily_change_percentage ?? 0, suffix: '%', tone: (currentWallet.value?.daily_change_percentage ?? 0) >= 0 ? 'positive' as const : 'negative' as const },
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
    <UIScreenShell
      title="Wallet"
      :subtitle="`${platforms.connectedCount} platforms · ${opinions.activeCount} agents plugged`"
      :kpis="kpis"
    >
      <template #actions>
        <MapButton v-if="walletMapMarkers.length" :markers="walletMapMarkers" title="Platforms" :subtitle="`${walletMapMarkers.length} connected`" />
        <UIPill :tone="allocation.is100Percent ? 'success' : 'warning'" show-dot>
          {{ allocation.is100Percent ? '100%' : 'REBAL' }}
        </UIPill>
      </template>

      <WalletSwitcher
        v-if="walletStore.wallets.length"
        :wallets="walletStore.wallets"
        :active-id="selectedWalletId"
        @switch="selectedWalletId = $event"
      />

      <WalletHero :wallet="currentWallet" v-model:period="period" />

      <WalletPaperPanel />

      <WalletAllocationSlider />

      <div class="row two-col">
        <UICard title="Performance">
          <WalletEquityCurve
            v-if="currentWallet"
            :wallet-id="currentWallet.id"
            :total-value="currentWallet.total_value"
            :performance-history="currentWallet.performance_history"
            :period="period"
          />
          <WalletRiskPanel
            v-if="currentWallet"
            class="risk-inline"
            :positions="positions"
            :performance-history="currentWallet.performance_history"
            :wallet-id="currentWallet.id"
          />
        </UICard>

        <UICard title="Bots & platforms">
          <WalletBotContribution :total-today="currentWallet?.daily_change ?? 0" />
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
.risk-inline { margin-top: 0.5rem; }
</style>
