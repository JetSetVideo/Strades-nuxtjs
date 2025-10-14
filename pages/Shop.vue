<script setup>
import { ref, computed, onMounted } from 'vue'

const strategies = ref([])
const loading = ref(true)
const filter = ref({
  category: 'all',
  premium: 'all',
})

onMounted(async () => {
  try {
    // Prefer core path where available
    strategies.value = await $fetch('/data/core/strategies.json')
  } catch (e) {
    // Fallback to legacy
    strategies.value = await $fetch('/data/strategies/index.json')
  }
  loading.value = false
})

const categories = computed(() => {
  const set = new Set(['all'])
  strategies.value.forEach(s => set.add(s.category))
  return Array.from(set)
})

const filtered = computed(() => {
  return strategies.value.filter(s => {
    const byCategory = filter.value.category === 'all' || s.category === filter.value.category
    const byPremium = filter.value.premium === 'all' ||
      (filter.value.premium === 'premium' && s.is_premium === true) ||
      (filter.value.premium === 'free' && (s.is_premium === false || s.is_premium == null))
    return byCategory && byPremium
  })
})
</script>
<template>
  <div class="shop-page">
    <div class="header">
      <h1>Shop</h1>
      <p class="subtitle">Browse public strategies to buy, rent or share</p>
    </div>

    <div class="toolbar">
      <div class="filter-group">
        <label>Category</label>
        <select v-model="filter.category">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Type</label>
        <select v-model="filter.premium">
          <option value="all">all</option>
          <option value="premium">premium</option>
          <option value="free">free</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else class="grid">
      <div v-for="s in filtered" :key="s.id" class="card">
        <div class="card-header">
          <h3 class="name">{{ s.name }}</h3>
          <span v-if="s.is_premium" class="badge premium">Premium</span>
        </div>
        <p class="desc">{{ s.description }}</p>
        <div class="meta">
          <span class="chip">category: {{ s.category }}</span>
          <span class="chip">winRate: {{ s.winRate ?? '-' }}%</span>
          <span class="chip">monthlyGain: {{ s.monthlyGain ?? '-' }}%</span>
        </div>
      </div>
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