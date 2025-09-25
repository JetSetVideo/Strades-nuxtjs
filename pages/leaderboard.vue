<script setup>
import { ref, computed } from 'vue';

const tabs = ['Most Profitable', 'Most Diverse Wallet'];
const selectedTab = ref(tabs[0]);

const traders = ref([
  { name: 'Agathe', profit: 1500000, walletDiversity: 2 },
  { name: 'Agatha', profit: 15000, walletDiversity: 5 },
  { name: 'Frank', profit: 15000, walletDiversity: 5 },
  { name: 'Alice', profit: 1000, walletDiversity: 7 },
  { name: 'Bob', profit: 20000, walletDiversity: 3 },
  { name: 'Charlie', profit: 12000, walletDiversity: 8 },
  // Add more traders as needed
]);

const sortedByProfit = computed(() => {
  return [...traders.value].sort((a, b) => b.profit - a.profit);
});

const sortedByDiversity = computed(() => {
  return [...traders.value].sort((a, b) => b.walletDiversity - a.walletDiversity);
});
</script>
<template>
  <div>
    <h1>Trader Leaderboard</h1>
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        @click="selectedTab = tab"
        :class="{ active: selectedTab === tab }"
      >
        {{ tab }}
      </button>
    </div>
    <div class="leaderboard">
      <ul v-if="selectedTab === 'Most Profitable'">
        <li v-for="(trader, index) in sortedByProfit" :key="index">
          {{ index + 1 }}. {{ trader.name }} - ${{ trader.profit }}
        </li>
      </ul>
      <ul v-else-if="selectedTab === 'Most Diverse Wallet'">
        <li v-for="(trader, index) in sortedByDiversity" :key="index">
          {{ index + 1 }}. {{ trader.name }} - {{ trader.walletDiversity }} assets
        </li>
      </ul>
      <!-- Add more criteria as needed -->
    </div>
  </div>
</template>
<style>
/* General Styles */
body {
  background-color: rgba(18, 18, 18, 1);
  color: rgba(255, 255, 255, 0.87);
  font-family: 'Roboto', sans-serif;
}

/* Leaderboard Page Styles */
.leaderboard-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: rgba(33, 33, 33, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

h1 {
  color: rgba(255, 255, 255, 0.87);
  text-align: center;
  margin-bottom: 20px;
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}

.tabs button {
  background-color: rgba(97, 97, 97, 1);
  color: rgba(255, 255, 255, 0.87);
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.tabs button.active {
  font-weight: bold;
  background-color: rgba(63, 81, 181, 1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
}

.leaderboard ul {
  list-style-type: none;
  padding: 0;
}

.leaderboard li {
  background-color: rgba(50, 50, 50, 1);
  color: rgba(255, 255, 255, 0.87);
  padding: 10px;
  margin-bottom: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

/* Responsive Styles */
@media (max-width: 600px) {
  .leaderboard-container {
    padding: 10px;
  }

  .tabs button {
    padding: 5px 10px;
  }
}
</style>