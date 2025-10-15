<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useStrategiesStore } from '@/stores/strategies'
import { useWalletsStore } from '@/stores/wallets'
import Competition from '@/components/Leaderboard/Competition.vue';
import { useLocalJson } from '@/composables/useLocalJson';

const usersStore = useUsersStore()
const strategiesStore = useStrategiesStore()
const walletsStore = useWalletsStore()

const { data: competitions } = useLocalJson('competitions/competitions.json');
const { data: contributions, refresh: refreshContributions } = useLocalJson('competitions/contributions.json');

const entityType = ref('users') // or 'strategies'
const selectedCategory = ref('')

const categories = computed(() => {
  if (entityType.value === 'users') {
    return ['Most Profitable', 'Most Diverse Wallet', 'Most Consistent', 'Most Trades']
  } else {
    return ['Most Profitable', 'Most Followed', 'Highest Sharpe', 'Best Win Rate']
  }
})

onMounted(async () => {
  await Promise.all([
    usersStore.fetchUsers(),
    strategiesStore.fetchStrategies(),
    walletsStore.fetchWallets()
  ])
  selectedCategory.value = categories.value[0]
})

const rankedList = computed(() => {
  let list = []
  if (entityType.value === 'users') {
    switch (selectedCategory.value) {
      case 'Most Profitable':
        list = usersStore.users.sort((a, b) => (b.total_returns || 0) - (a.total_returns || 0))
        break
      case 'Most Diverse Wallet':
        list = walletsStore.wallets.map(w => {
          const user = usersStore.getUserById(w.user_id)
          return { ...user, diversity: w.assets?.length || 0 }
        }).sort((a, b) => b.diversity - a.diversity)
        break
      case 'Most Consistent':
        list = usersStore.users.sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0))
        break
      case 'Most Trades':
        list = usersStore.users.sort((a, b) => (b.total_trades || 0) - (a.total_trades || 0))
        break
    }
  } else {
    switch (selectedCategory.value) {
      case 'Most Profitable':
        list = strategiesStore.strategies.sort((a, b) => (b.total_return_percentage || 0) - (a.total_return_percentage || 0))
        break
      case 'Most Followed':
        list = strategiesStore.strategies.sort((a, b) => (b.followers_count || 0) - (a.followers_count || 0))
        break
      case 'Highest Sharpe':
        list = strategiesStore.strategies.sort((a, b) => (b.sharpe_ratio || 0) - (a.sharpe_ratio || 0))
        break
      case 'Best Win Rate':
        list = strategiesStore.strategies.sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0))
        break
    }
  }
  return list.slice(0, 10) // top 10
})

const getValue = (item, category) => {
  if (entityType.value === 'users') {
    switch (category) {
      case 'Most Profitable': return `${(item.total_returns || 0).toFixed(2)}`
      case 'Most Diverse Wallet': return `${item.diversity} assets`
      case 'Most Consistent': return `${(item.win_rate || 0).toFixed(1)}%`
      case 'Most Trades': return `${item.total_trades || 0} trades`
    }
  } else {
    switch (category) {
      case 'Most Profitable': return `${(item.total_return_percentage || 0).toFixed(1)}%`
      case 'Most Followed': return `${item.followers_count || 0} followers`
      case 'Highest Sharpe': return (item.sharpe_ratio || 0).toFixed(2)
      case 'Best Win Rate': return `${(item.win_rate || 0).toFixed(1)}%`
    }
  }
  return ''
}

const getMedalClass = (index) => {
  if (index === 0) return 'gold'
  if (index === 1) return 'silver'
  if (index === 2) return 'bronze'
  return ''
}

const handleAddContribution = (newContribution) => {
  // This is a local simulation. In a real app, this would be an API call.
  if (contributions.value) {
      contributions.value.push({
          id: `contrib_${Date.now()}`,
          userId: 'user_001', // Mocked user
          ...newContribution
      });
  }
};
</script>

<template>
  <div class="leaderboard-page">
    <h1>Leaderboard</h1>

    <Competition
        v-if="competitions && contributions"
        :competitions="competitions"
        :contributions="contributions"
        @add:contribution="handleAddContribution"
    />
    
    <div class="entity-tabs">
      <button 
        :class="{ active: entityType === 'users' }"
        @click="entityType = 'users'; selectedCategory = categories[0]"
      >
        Users
      </button>
      <button 
        :class="{ active: entityType === 'strategies' }"
        @click="entityType = 'strategies'; selectedCategory = categories[0]"
      >
        Strategies
      </button>
    </div>

    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        @click="selectedCategory = cat"
        :class="{ active: selectedCategory === cat }"
      >
        {{ cat }}
      </button>
    </div>

    <div class="ranked-list">
      <div 
        v-for="(item, index) in rankedList" 
        :key="index"
        :class="['rank-item', getMedalClass(index)]"
      >
        <span class="position">{{ index + 1 }}</span>
        <span class="name">{{ item.username || item.name }}</span>
        <span class="value">
          {{ getValue(item, selectedCategory) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add styles for .leaderboard-page, tabs, ranked-list, rank-item, .gold (background gold gradient light to dark), .silver, .bronze, etc. */
.leaderboard-page {
  padding: var(--spacing-lg);
}

.entity-tabs, .category-tabs {
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

button.active {
  background: var(--primary-gradient);
  color: var(--text-white);
}

.ranked-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.rank-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--card-bg);
}

.gold {
  background: linear-gradient(to right, #ffd700, #b8860b);
}

.silver {
  background: linear-gradient(to right, #c0c0c0, #808080);
}

.bronze {
  background: linear-gradient(to right, #cd7f32, #8b4513);
}
</style>