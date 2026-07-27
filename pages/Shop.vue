<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStrategiesStore } from '@/stores/strategies'
import { useActivityLog } from '@/composables/useActivityLog'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import StrategyCard from '@/components/Strategy/Card.vue'

definePageMeta({ title: 'Strategy Shop', description: 'Browse public strategies to buy, rent or share.', layout: 'default' })

interface Strategy {
  id: string
  name: string
  category: string
  is_premium?: boolean
  is_public?: boolean
  description?: string
  price?: number
  [key: string]: unknown
}

const strategiesStore = useStrategiesStore()
const activityLog = useActivityLog()

const loading = ref(true)
const category = ref<'all' | string>('all')
const tier = ref<'all' | 'free' | 'premium'>('all')

onMounted(async () => {
  await strategiesStore.initializeStore()
  loading.value = false
})

const publicStrategies = computed<Strategy[]>(() =>
  strategiesStore.strategies.filter((s: Strategy) => s.is_public !== false)
)

const categories = computed(() => {
  const counts: Record<string, number> = {}
  for (const s of publicStrategies.value) counts[s.category] = (counts[s.category] ?? 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }))
})

const categoryTabs = computed<TabItem[]>(() => [
  { id: 'all', label: 'All', count: publicStrategies.value.length },
  ...categories.value.map(c => ({ id: c.id, label: c.id, count: c.count }))
])

const tierTabs: TabItem[] = [
  { id: 'all', label: 'All tiers' },
  { id: 'free', label: 'Free' },
  { id: 'premium', label: 'Premium' }
]

const filtered = computed(() =>
  publicStrategies.value.filter(s => {
    const byCat = category.value === 'all' || s.category === category.value
    const byTier = tier.value === 'all'
      || (tier.value === 'premium' && s.is_premium)
      || (tier.value === 'free' && !s.is_premium)
    return byCat && byTier
  })
)

const stats = computed(() => {
  const free = publicStrategies.value.filter(s => !s.is_premium).length
  const premium = publicStrategies.value.length - free
  return {
    total: publicStrategies.value.length,
    free,
    premium,
    categories: categories.value.length
  }
})

function openStrategy(id: string) {
  activityLog.interact({
    action: 'open',
    target: id,
    category: 'content',
    why: { intent: 'browse_shop', component: 'shop_card' },
  })
  navigateTo(`/strategy/${id}`)
}
</script>

<template>
  <div class="shop-page">
    <UIPageHeader
      title="Strategy Shop"
      subtitle="Browse community strategies — fork the free ones, rent the premium ones, contribute your own."
    >
      <template #actions>
        <NuxtLink to="/creator" class="cta-publish">+ Publish a strategy</NuxtLink>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="Public strategies" :value="stats.total"      size="md" />
      <UIStat label="Free"              :value="stats.free"       tone="positive" size="md" />
      <UIStat label="Premium"           :value="stats.premium"    size="md" />
      <UIStat label="Categories"        :value="stats.categories" size="md" />
    </UIMetricRow>

    <UISectionTabs v-model="category" :tabs="categoryTabs" />

    <div class="tier-row">
      <span class="tier-label">Tier</span>
      <button
        v-for="t in tierTabs"
        :key="t.id"
        :class="['tier-chip', { active: tier === t.id }]"
        @click="tier = t.id as any"
      >{{ t.label }}</button>
    </div>

    <div v-if="loading" class="loading">
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="80px" />
    </div>

    <UIEmptyState
      v-else-if="filtered.length === 0"
      icon="◯"
      title="No strategies match"
      message="Try a different category or tier filter, or publish your own from the Creator."
    >
      <template #action>
        <NuxtLink to="/creator" class="cta-publish">+ Open Creator</NuxtLink>
      </template>
    </UIEmptyState>

    <div v-else class="grid">
      <StrategyCard
        v-for="s in filtered"
        :key="s.id"
        :strategy="s"
        @select="openStrategy"
      >
        <template #footer-extra>
          <UIPill v-if="s.is_premium" tone="accent">Premium</UIPill>
          <UIPill v-else ghost tone="success">Free</UIPill>
        </template>
      </StrategyCard>
    </div>
  </div>
</template>

<style scoped>
.shop-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.75rem);
  min-width: 0;
}

.cta-publish {
  background: var(--primary-gradient);
  color: #000;
  border: none;
  padding: 0.4rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
}
.cta-publish:hover { transform: translateY(-1px); }

.tier-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.tier-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.45);
}
.tier-chip {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
  font-size: 0.7rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}
.tier-chip.active {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}

.loading { display: flex; flex-direction: column; gap: 0.5rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 0.65rem;
  min-width: 0;
}
.grid > * { min-width: 0; }
</style>
