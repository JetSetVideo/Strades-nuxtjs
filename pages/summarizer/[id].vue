<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStrategies } from '@/composables/useStrategies'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import StrategyCodeView from '@/components/Strategy/CodeView.vue'

definePageMeta({
  title: 'Strategy Summary',
  description: 'Review your strategy before backtesting.',
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const { getStrategyById } = useStrategies()

const strategy = ref<any>(null)
const isLoading = ref(true)
const isTesting = ref(false)

onMounted(() => {
  // Strategy ids in this app are strings; tolerate both via coercion.
  const raw = route.params.id
  const lookup = Array.isArray(raw) ? raw[0] : raw
  strategy.value = getStrategyById(lookup as any) || getStrategyById(parseInt(lookup as string) as any)
  isLoading.value = false
  if (!strategy.value) {
    setTimeout(() => router.push('/strategies'), 1200)
  }
})

const summaryCode = computed(() => {
  if (!strategy.value) return {}
  const s = strategy.value
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    risk_level: s.risk_level,
    target_assets: s.target_assets,
    indicators: s.indicators,
    entry_conditions: s.entry_conditions,
    exit_conditions: s.exit_conditions,
    backtest_period: s.backtest_period
  }
})

async function testStrategy() {
  if (!strategy.value) return
  isTesting.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    router.push(`/strategy/${strategy.value.id}?tab=backtest`)
  } catch (error) {
    console.error('Strategy test failed:', error)
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div class="summarizer-page">
    <template v-if="isLoading">
      <AppSkeletonLoader height="20px" width="200px" />
      <AppSkeletonLoader height="14px" width="120px" />
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="200px" />
    </template>

    <template v-else-if="strategy">
      <UIPageHeader
        :title="`Review · ${strategy.name}`"
        subtitle="Final check before we run a backtest. Edit anything in the Creator."
      >
        <template #actions>
          <UIPill tone="info">{{ strategy.category || 'strategy' }}</UIPill>
          <NuxtLink to="/creator" class="cta secondary">↩ Back to Creator</NuxtLink>
          <button class="cta primary" :disabled="isTesting" @click="testStrategy">
            {{ isTesting ? 'Backtesting…' : '▶ Run backtest' }}
          </button>
        </template>
      </UIPageHeader>

      <UIMetricRow :cols="4">
        <UIStat label="Indicators"   :value="strategy.indicators?.length ?? 0" size="md" />
        <UIStat label="Target assets" :value="strategy.target_assets?.length ?? 0" size="md" />
        <UIStat label="Risk level"   :value="strategy.risk_level || '—'" size="md" />
        <UIStat label="Period"       :value="`${strategy.backtest_period?.start ?? '—'} → ${strategy.backtest_period?.end ?? '—'}`" size="sm" />
      </UIMetricRow>

      <div class="row two-col">
        <UICard title="Overview">
          <p class="prose">{{ strategy.description || 'No description.' }}</p>
        </UICard>

        <UICard title="Targets">
          <div v-if="strategy.target_assets?.length" class="asset-row">
            <span v-for="a in strategy.target_assets" :key="a" class="asset-chip">{{ a }}</span>
          </div>
          <UIEmptyState v-else size="sm" icon="◯" message="No target assets." />
        </UICard>
      </div>

      <UICard title="Strategy code">
        <template #action>
          <UIPill ghost tone="neutral">read-only</UIPill>
        </template>
        <StrategyCodeView :code="summaryCode" />
      </UICard>
    </template>

    <UIEmptyState
      v-else
      icon="◯"
      title="Strategy not found"
      message="Redirecting back to your strategies…"
    >
      <template #action>
        <NuxtLink to="/strategies" class="cta secondary">↩ Open Trading Lab</NuxtLink>
      </template>
    </UIEmptyState>
  </div>
</template>

<style scoped>
.summarizer-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.row { display: grid; gap: 0.6rem; align-items: stretch; min-width: 0; }
.row > * { min-width: 0; }
.row.two-col { grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }

.prose {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
  color: rgba(255,255,255,0.8);
}

.asset-row { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.asset-chip {
  background: rgba(0,170,255,0.08);
  border: 1px solid rgba(0,170,255,0.3);
  color: var(--primary-blue, #00aaff);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 4px;
}

.cta {
  padding: 0.4rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
  transition: transform 0.15s ease;
  text-decoration: none;
  display: inline-block;
}
.cta:hover:not(:disabled) { transform: translateY(-1px); }
.cta.primary {
  background: var(--primary-gradient);
  color: #000;
}
.cta.primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cta.secondary {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.85);
}
.cta.secondary:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
</style>
