<script setup>
import { ref, computed, onMounted } from 'vue'
import Carousel from '@/components/Carousel.vue'
import Filters from '@/components/Filters.vue'
import NavigationCreator from '@/components/Navigation/Creator.vue'
import Comparator from '@/components/Comparator.vue'
import { useStrategies } from '@/composables/useStrategies'
import { useStrategiesStore } from '@/stores/strategies'

const { strategies, fetchStrategies, updateStrategy, deleteStrategy, toggleStrategyStatus } = useStrategies()
const strategiesStore = useStrategiesStore()

const selectedStrategies = ref([])
const showComparator = ref(false)
const currentFilters = ref({
  profitRange: [0, 100],
  drawdownRange: [0, 100],
  assets: [],
  status: 'all', // 'all', 'active', 'paused', 'stopped'
})

const filteredStrategies = computed(() => {
  return strategies.value.filter(strategy => {
    // Profit range filter
    if (strategy.total_return_percentage < currentFilters.value.profitRange[0] ||
        strategy.total_return_percentage > currentFilters.value.profitRange[1]) {
      return false
    }

    // Drawdown range filter
    if (strategy.max_drawdown < currentFilters.value.drawdownRange[0] ||
        strategy.max_drawdown > currentFilters.value.drawdownRange[1]) {
      return false
    }

    // Status filter
    if (currentFilters.value.status !== 'all' && strategy.status !== currentFilters.value.status) {
      return false
    }

    // Asset filter (if assets are specified)
    if (currentFilters.value.assets.length > 0) {
      const strategyAssets = strategy.target_assets || []
      const hasMatchingAsset = currentFilters.value.assets.some(asset =>
        strategyAssets.includes(asset)
      )
      if (!hasMatchingAsset) return false
    }

    return true
  })
})

function handleStrategySelect(strategy) {
  const index = selectedStrategies.value.findIndex(s => s.id === strategy.id)
  if (index > -1) {
    selectedStrategies.value.splice(index, 1)
  } else {
    selectedStrategies.value.push(strategy)
  }

  if (selectedStrategies.value.length === 2) {
    showComparator.value = true
  } else {
    showComparator.value = false
  }
}

function handleFilterChange(filters) {
  currentFilters.value = { ...currentFilters.value, ...filters }
}

function handleDeleteStrategy(strategyId) {
  if (confirm('Are you sure you want to delete this strategy?')) {
    deleteStrategy(strategyId)
  }
}

function handleToggleStatus(strategyId) {
  toggleStrategyStatus(strategyId)
}

onMounted(async () => {
  await fetchStrategies()
  // Set data-driven ranges
  const profitRange = strategiesStore.getRange('total_return_percentage')
  const drawdownRange = strategiesStore.getRange('max_drawdown')
  currentFilters.value.profitRange = [profitRange.min, profitRange.max]
  currentFilters.value.drawdownRange = [drawdownRange.min, drawdownRange.max]
})
</script>

<template>
  <div class="strategies-page">
    <div class="header">
      <h1>My Strategies</h1>
      <div class="strategy-count">
        {{ filteredStrategies.length }} of {{ strategies.length }} strategies
      </div>
    </div>

    <div class="content-container">
      <Filters @filter-changed="handleFilterChange" />

      <div class="strategies-controls">
        <div class="status-filter">
          <label>Status:</label>
          <select v-model="currentFilters.status" @change="handleFilterChange">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      <Carousel
        :strategies="filteredStrategies"
        @select-strategy="handleStrategySelect"
        :selectedStrategies="selectedStrategies"
      />

      <div v-if="filteredStrategies.length === 0" class="no-strategies">
        <p>No strategies match your filters.</p>
        <p v-if="strategies.length === 0">Create your first strategy to get started!</p>
      </div>

      <!-- Strategy Management Actions -->
      <div v-if="selectedStrategies.length === 1" class="strategy-actions">
        <h3>Strategy Actions</h3>
        <div class="action-buttons">
          <button
            @click="handleToggleStatus(selectedStrategies[0].id)"
            :class="['status-btn', selectedStrategies[0].status]"
          >
            {{ selectedStrategies[0].status === 'active' ? 'Pause' : 'Start' }}
          </button>
          <button
            @click="navigateTo(`/strategy/${selectedStrategies[0].id}`)"
            class="edit-btn"
          >
            Edit
          </button>
          <button
            @click="handleDeleteStrategy(selectedStrategies[0].id)"
            class="delete-btn"
          >
            Delete
          </button>
        </div>
      </div>

      <NavigationCreator :selectedStrategies="selectedStrategies" />
      <Comparator v-if="showComparator" :strategies="selectedStrategies" />
    </div>
  </div>
</template>

<style scoped>
.strategies-page {
  padding: 1rem;
  background-color: var(--bg-primary, rgba(14, 14, 15, 1));
  border-radius: var(--app-border-radius, 12px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-direction: column;
  gap: 0.5rem;
}

.header h1 {
  font-size: 1.5rem;
  margin: 0;
  text-shadow:
    0 1px 3px rgba(255, 255, 255, 0.9),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
}

@media (min-width: 768px) {
  .strategies-page {
    padding: 2rem;
  }
  .header {
    flex-direction: row;
    margin-bottom: 1.5rem;
  }
  .header h1 {
    font-size: 2.2rem;
  }
}

.strategy-count {
  font-size: 0.9em;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.content-container {
  margin-top: 20px;
}

.strategies-controls {
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
  align-items: center;
}

.status-filter {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-filter select {
  padding: 8px 12px;
  border-radius: 5px;
  background-color: rgba(60, 60, 60, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.no-strategies {
  text-align: center;
  padding: 40px;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.strategy-actions {
  background-color: rgba(50, 50, 50, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 20px;
  margin: 20px 0;
}

.strategy-actions h3 {
  margin-bottom: 15px;
  color: rgba(255, 255, 255, 0.9);
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.status-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.status-btn.active {
  background-color: rgba(255, 165, 0, 0.8);
  color: black;
}

.status-btn.paused,
.status-btn.stopped {
  background-color: rgba(0, 255, 0, 0.8);
  color: black;
}

.edit-btn {
  background-color: rgba(0, 0, 255, 0.8);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.edit-btn:hover {
  background-color: rgba(0, 0, 150, 0.8);
}

.delete-btn {
  background-color: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.delete-btn:hover {
  background-color: rgba(150, 0, 0, 0.8);
}

.action-buttons button:hover {
  transform: translateY(-2px);
}
</style>