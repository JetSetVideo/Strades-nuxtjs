<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStrategiesStore } from '@/stores/strategies';
import { useTrackingStore } from '@/stores/tracking';
import StrategyCard from '@/components/Card/Strategy.vue';

const strategiesStore = useStrategiesStore();
const trackingStore = useTrackingStore();

interface Strategy {
  id: string;
  name: string;
  category: string;
  is_premium: boolean;
  description: string;
  price?: number;
  is_public?: boolean;
  // Add other fields as per data
}

const loading = ref<boolean>(true);
const filter = ref<{ category: string; premium: string }>({
  category: 'all',
  premium: 'all',
});

onMounted(async () => {
  await strategiesStore.initializeStore();
  await trackingStore.initializeStore();
  loading.value = false;
});

const categories = computed(() => {
  const set = new Set<string>(['all']);
  strategiesStore.strategies.forEach((s: Strategy) => set.add(s.category));
  return Array.from(set);
});

const filteredStrategies = computed(() => {
  return strategiesStore.strategies.filter((s: Strategy) => {
    const byCategory = filter.value.category === 'all' || s.category === filter.value.category;
    const byPremium = filter.value.premium === 'all' ||
      (filter.value.premium === 'premium' && s.is_premium) ||
      (filter.value.premium === 'free' && !s.is_premium);
    return byCategory && byPremium;
  });
});

const handleAction = (strategyId: string, action: string) => {
  trackingStore.trackUserInteraction({
    user_id: 'user_001', // Example user ID
    session_id: 'session_123', // Example session ID
    event_type: 'component_interaction',
    component: 'shop_card',
    action: action,
    target: `${action}_strategy`,
    context: { strategy_id: strategyId },
    duration_ms: 0,
    metadata: {}
  });
  console.log(`Tracked: ${action} on strategy ${strategyId}`);
};
</script>
<template>
  <div class="shop-page">
    <div class="header">
      <h1>Shop</h1>
      <p class="subtitle">Browse public strategies to buy, rent or share</p>
    </div>

    <div class="toolbar">
      <!-- Filter controls -->
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else class="grid">
      <StrategyCard
        v-for="s in filteredStrategies"
        :key="s.id"
        :strategy="s"
        @buy="handleAction(s.id, 'buy')"
        @rent="handleAction(s.id, 'rent')"
        @share="handleAction(s.id, 'share')"
      />
    </div>
  </div>
</template>
<style scoped>
.shop-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: var(--spacing-lg);
}

.header {
  margin-bottom: var(--spacing-lg);
}

.subtitle {
  color: var(--text-gray);
  margin: 0;
}

.toolbar {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

select {
  background: var(--bg-secondary);
  color: var(--text-white);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
}

.loading {
  color: var(--text-gray);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-lg);
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.name {
  margin: 0;
}

.badge.premium {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: 0.8rem;
  font-weight: 600;
}

.desc {
  color: var(--text-light-gray);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.chip {
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: 0.8rem;
}
</style>