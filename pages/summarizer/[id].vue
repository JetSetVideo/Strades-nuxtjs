<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStrategies } from '@/composables/useStrategies';

definePageMeta({
  title: 'Strategy Summarizer',
  description: 'Summarize and test your strategy',
  layout: 'default',
});

const route = useRoute();
const router = useRouter();
const { getStrategyById } = useStrategies();

const strategy = ref(null);
const isLoading = ref(false);

onMounted(() => {
  const strategyId = parseInt(route.params.id);
  strategy.value = getStrategyById(strategyId);
  if (!strategy.value) {
    router.push('/strategies');
  }
});

async function testStrategy() {
  isLoading.value = true;
  try {
    // Simulated API call for backtesting
    await new Promise(resolve => setTimeout(resolve, 2000));
    const testResults = {
      profitLoss: 250,
      variation: 0.15,
      period: "3 months"
    };
    router.push({ 
      path: '/result', 
      query: { 
        strategyId: strategy.value.id,
        results: JSON.stringify(testResults)
      } 
    });
  } catch (error) {
    console.error('Strategy test failed:', error);
    alert('Failed to test strategy. Please try again.');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div v-if="strategy" class="summarizer-page">
    <h1>Strategy Summary: {{ strategy.name }}</h1>
    <div class="strategy-summary">
      <div v-for="(value, key) in strategy" :key="key" class="strategy-detail">
        <strong>{{ key }}:</strong> {{ JSON.stringify(value) }}
      </div>
    </div>
    <button @click="testStrategy" :disabled="isLoading" class="button-test">
      {{ isLoading ? 'Testing Strategy...' : 'Test Strategy' }}
    </button>
  </div>
  <div v-else>Loading strategy...</div>
</template>

<style scoped>
.summarizer-page {
  padding: 20px;
}

.strategy-summary {
  margin-top: 20px;
}

.strategy-detail {
  margin-bottom: 10px;
}

.button-test {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(64, 76, 129, 0.5);
  border-radius: 0.5rem;
  cursor: pointer;
  border: none;
  color: white;
  font-size: 16px;
}

.button-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
