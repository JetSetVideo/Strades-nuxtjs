<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePlatformsStore, type TradingPlatform } from '@/stores/platforms'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'

import APIsPlatformCard from '@/components/APIs/PlatformCard.vue'
import APIsAddConnectionModal from '@/components/APIs/AddConnectionModal.vue'

definePageMeta({ title: 'API Connections', layout: 'default' })

const platforms = usePlatformsStore()

const filter = ref<'all' | 'connected' | 'rate_limited' | 'disconnected'>('all')
const showAddModal = ref(false)
const testingId = ref<string | null>(null)

onMounted(async () => {
  if (!platforms.hydrated) await platforms.fetchPlatforms()
})

const filteredPlatforms = computed<TradingPlatform[]>(() => {
  if (filter.value === 'all') return platforms.list
  return platforms.list.filter(p => p.status === filter.value)
})

const tabs = computed<TabItem[]>(() => [
  { id: 'all',          label: 'All',           count: platforms.list.length },
  { id: 'connected',    label: 'Healthy',       count: platforms.list.filter(p => p.status === 'connected').length },
  { id: 'rate_limited', label: 'Rate-limited',  count: platforms.list.filter(p => p.status === 'rate_limited').length },
  { id: 'disconnected', label: 'Disconnected',  count: platforms.list.filter(p => p.status === 'disconnected').length }
])

const healthTone = (h: number) =>
  h > 0.9 ? 'positive' : h > 0.6 ? 'warning' : 'negative'

const totalFees30d = computed(() =>
  platforms.list.reduce((s, p) => s + (p.fees_30d_usd ?? 0), 0)
)

async function testConnection(id: string) {
  testingId.value = id
  await new Promise(r => setTimeout(r, 800))
  testingId.value = null
}

function reconnect(id: string) {
  const p = platforms.list.find(x => x.id === id)
  if (!p) return
  p.status = 'connected'
  p.api_health = Math.min(1, p.api_health + 0.3)
  p.last_sync_at = new Date().toISOString()
}

function disconnect(id: string) {
  if (!confirm('Disconnect this platform? Bots running on it will pause.')) return
  const p = platforms.list.find(x => x.id === id)
  if (p) p.status = 'disconnected'
}

const emptyMessage = computed(() =>
  filter.value === 'all'
    ? 'Add a broker to get started.'
    : `No platforms with status \`${filter.value}\`.`
)
</script>

<template>
  <div class="apis-page">
    <UIPageHeader
      title="API Connections"
      :subtitle="`${platforms.connectedCount} of ${platforms.list.length} platforms connected`"
    >
      <template #actions>
        <button class="cta-add" @click="showAddModal = true">+ Add connection</button>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4" class="overview">
      <UIStat label="Connected"      :value="platforms.connectedCount" tone="positive" size="md" />
      <UIStat label="Avg API health" :value="platforms.healthAvg * 100" :precision="0" suffix="%" :tone="healthTone(platforms.healthAvg)" size="md" />
      <UIStat label="Total balance"  :value="platforms.totalBalance"   :precision="0" suffix="USD" size="md" />
      <UIStat label="Fees 30d"       :value="totalFees30d"             :precision="0" suffix="USD" tone="negative" size="md" />
    </UIMetricRow>

    <UISectionTabs v-model="filter" :tabs="tabs" />

    <UIEmptyState
      v-if="filteredPlatforms.length === 0"
      icon="◯"
      title="No platforms here"
      :message="emptyMessage"
    >
      <template #action>
        <button class="cta-add" @click="showAddModal = true">+ Add connection</button>
      </template>
    </UIEmptyState>

    <div v-else class="plat-grid">
      <APIsPlatformCard
        v-for="p in filteredPlatforms"
        :key="p.id"
        :platform="p"
        :testing="testingId === p.id"
        @test="testConnection"
        @reconnect="reconnect"
        @disconnect="disconnect"
      />
    </div>

    <APIsAddConnectionModal v-model:open="showAddModal" />
  </div>
</template>

<style scoped>
.apis-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.cta-add {
  background: var(--primary-gradient);
  color: #000;
  border: none;
  padding: 0.4rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease;
}
.cta-add:hover { transform: translateY(-1px); }

.overview { margin-bottom: 0.1rem; }

.plat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.plat-grid > * { min-width: 0; }
</style>
