<script setup>
import { computed } from 'vue';

const props = defineProps({
  strategies: {
    type: Array,
    required: true,
    validator: (value) => value.length === 2,
  },
});

const strategy1 = computed(() => props.strategies[0]);
const strategy2 = computed(() => props.strategies[1]);

function getDifference(value1, value2) {
  const diff = value1 - value2;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}`;
}

function getColor(value) {
  if (value > 0) return 'rgba(0, 255, 0, 1)';
  if (value < 0) return 'rgba(255, 165, 0, 1)';
  return 'rgba(128, 128, 128, 1)';
}
</script>

<template>
  <div class="comparator">
    <div class="strategy-column">
      <h3>{{ strategy1.name }}</h3>
      <p>Monthly Gain: {{ strategy1.monthlyGain }}%</p>
      <p>Monthly Drawdown: {{ strategy1.monthlyDrawdown }}%</p>
      <p>Total Profit: ${{ strategy1.totalProfit }}</p>
      <p>Win Rate: {{ strategy1.winRate }}%</p>
    </div>
    <div class="strategy-column">
      <h3>{{ strategy2.name }}</h3>
      <p>Monthly Gain: {{ strategy2.monthlyGain }}%</p>
      <p>Monthly Drawdown: {{ strategy2.monthlyDrawdown }}%</p>
      <p>Total Profit: ${{ strategy2.totalProfit }}</p>
      <p>Win Rate: {{ strategy2.winRate }}%</p>
    </div>
    <div class="difference-column">
      <h3>Difference</h3>
      <p :style="{ color: getColor(strategy1.monthlyGain - strategy2.monthlyGain) }">
        {{ getDifference(strategy1.monthlyGain, strategy2.monthlyGain) }}%
      </p>
      <p :style="{ color: getColor(strategy2.monthlyDrawdown - strategy1.monthlyDrawdown) }">
        {{ getDifference(strategy2.monthlyDrawdown, strategy1.monthlyDrawdown) }}%
      </p>
      <p :style="{ color: getColor(strategy1.totalProfit - strategy2.totalProfit) }">
        ${{ getDifference(strategy1.totalProfit, strategy2.totalProfit) }}
      </p>
      <p :style="{ color: getColor(strategy1.winRate - strategy2.winRate) }">
        {{ getDifference(strategy1.winRate, strategy2.winRate) }}%
      </p>
    </div>
  </div>
</template>

<style scoped>
.comparator {
  display: flex;
  justify-content: space-between;
  background-color: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.strategy-column, .difference-column {
  flex: 1;
  padding: 0 10px;
}

h3 {
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 5px;
}

p {
  margin: 5px 0;
}
</style>