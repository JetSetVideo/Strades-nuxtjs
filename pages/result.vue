<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStrategies } from '@/composables/useStrategies';
import StrategyCard from '@/components/Card/Strategy.vue';

definePageMeta({
  title: 'Strategy Results',
  description: 'View your strategy test results',
  layout: 'default',
});

const route = useRoute();
const router = useRouter();
const { getStrategyById } = useStrategies();

const strategy = ref(null);
const results = ref(null);

onMounted(() => {
  const strategyId = parseInt(route.query.strategyId);
  strategy.value = getStrategyById.value(strategyId);
  if (!strategy.value) {
    router.push('/strategies');
    return;
  }

  results.value = JSON.parse(route.query.results);
});

function modifyStrategy() {
  router.push(`/creator/${strategy.value.id}`);
}

function saveStrategy() {
  // Implement save functionality
  alert('Strategy saved!');
}

function shareStrategy() {
  // Implement share functionality
  alert('Sharing strategy...');
}

function deleteStrategy() {
  // Implement delete functionality
  alert('Strategy deleted!');
  router.push('/strategies');
}
</script>

<template>
  <div v-if="strategy && results" class="results-page">
    <h1>Strategy Results: {{ strategy.name }}</h1>
    <StrategyCard :strategy="strategy" />
    <div class="results-summary">
      <h2>Test Results</h2>
      <p>Profit/Loss: {{ results.profitLoss }} USD</p>
      <p>Variation: {{ results.variation * 100 }}%</p>
      <p>Period: {{ results.period }}</p>
    </div>
    <div class="action-buttons">
      <button @click="modifyStrategy">Modify</button>
      <button @click="saveStrategy">Save</button>
      <button @click="shareStrategy">Share</button>
      <button @click="deleteStrategy">Delete</button>
    </div>
  </div>
  <div v-else>Loading results...</div>
</template>

<style scoped>
/* Add styles for the results page */
</style>

