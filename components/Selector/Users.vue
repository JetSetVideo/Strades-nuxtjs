<script setup>
import { ref, computed } from 'vue';
import { useStrategies } from '@/composables/useStrategies';
import SelectorAssets from '@/components/Selector/Assets.vue';
import SelectorDatasources from '@/components/Selector/Datasources.vue';
import SelectorConditions from '@/components/Selector/Conditions.vue';
import SelectorUsers from '@/components/Selector/Users.vue';
import DateRangePicker from '@/components/DateRangePicker.vue';
import NavigationAnalyse from '@/components/Navigation/Analyse.vue';

definePageMeta({
  title: "Strategy Creator",
  description: "Create your custom investment strategy",
  layout: "default",
});

const { createStrategy } = useStrategies();

const strategy = ref({
  name: '',
  description: '',
  dataSources: [],
  assets: [],
  conditions: [],
  users: [],
  period: { start: null, end: null },
  riskRating: 0,
  complexityRating: '0/10',
});

const credit = ref(1000);
const neededCredit = computed(() => {
  return strategy.value.assets.length * 100 + strategy.value.conditions.length * 50;
});

const hasEnoughCredit = computed(() => credit.value >= neededCredit.value);
const isStrategyValid = computed(() => 
  strategy.value.dataSources.length > 0 && 
  strategy.value.assets.length > 0 &&
  strategy.value.name.trim() !== '' &&
  strategy.value.description.trim() !== ''
);

const CreditPriceCost = computed(() => {
  return credit.value * 0.000000001;
});

async function analyseStrategy() {
  if (hasEnoughCredit.value && isStrategyValid.value) {
    try {
      const newStrategy = await createStrategy(strategy.value);
      navigateTo(`/summarizer/${newStrategy.id}`);
    } catch (error) {
      console.error('Failed to create strategy:', error);
      alert('Failed to create strategy. Please try again.');
    }
  } else if (!isStrategyValid.value) {
    alert('Please fill in all required fields and select at least one data source and one asset');
  } else {
    alert('Not enough credits to analyse strategy');
  }
}
</script>

<template>
  <div class="strategy-creator">
    <h1>Create Your Strategy</h1>
    <div class="strategy-form">
      <input v-model="strategy.name" placeholder="Strategy Name" required />
      <textarea v-model="strategy.description" placeholder="Strategy Description" required></textarea>
      <SelectorDatasources v-model="strategy.dataSources" />
      <SelectorAssets v-model="strategy.assets" />
      <SelectorConditions v-model="strategy.conditions" />
      <SelectorUsers v-model="strategy.users" />
      <DateRangePicker v-model="strategy.period" />
      <div class="credit-info">
        <p>Available Credits: {{ credit }}</p>
        <p>Needed Credits: {{ neededCredit }}</p>
        <p>Credit Cost: ${{ CreditPriceCost.toFixed(8) }}</p>
      </div>
      <NavigationAnalyse 
        :disabled="!hasEnoughCredit || !isStrategyValid"
        @click="analyseStrategy"
      >
        Analyse Strategy
      </NavigationAnalyse>
    </div>
  </div>
</template>

<style scoped>
.strategy-creator {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 10px;
  color: white;
}

.strategy-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

input, textarea {
  padding: 12px;
  border-radius: 5px;
  background-color: rgba(60, 60, 60, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 1em;
}

input:focus, textarea:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
}

.credit-info {
  background-color: rgba(60, 60, 60, 0.6);
  padding: 15px;
  border-radius: 5px;
  font-size: 0.9em;
}
</style>