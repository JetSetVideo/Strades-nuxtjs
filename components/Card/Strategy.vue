<script setup>
import { computed } from 'vue';

const props = defineProps({
  strategy: {
    type: Object,
    required: true,
  },
});

const profitColor = computed(() => {
  const gain = props.strategy.monthlyGain;
  if (gain > 0) return 'rgba(0, 255, 0, 1)';
  if (gain < 0) return 'rgba(255, 0, 0, 1)';
  return 'rgba(128, 128, 128, 1)';
});

const drawdownColor = computed(() => {
  const drawdown = props.strategy.monthlyDrawdown;
  if (drawdown > 0) return 'rgba(255, 0, 0, 1)';
  if (drawdown < 0) return 'rgba(0, 255, 0, 1)';
  return 'rgba(128, 128, 128, 1)';
});
</script>

<template>
  <div class="strategy-card">
    <h2 class="strategy-name">{{ strategy.name }}</h2>
    <p class="creator-name">Created by: {{ strategy.creator }}</p>
    <div class="assets">
      <div v-for="trade in strategy.trades" :key="trade.asset" class="asset">
        <img :src="`/assets/${trade.asset.toLowerCase()}.png`" :alt="trade.asset" class="asset-icon" @error="$event.target.src='/assets/default.png'">
        <span>{{ trade.asset }}</span>
      </div>
    </div>
    <p>Number of trades: {{ strategy.numberOfTrades }}</p>
    <p>Profit: <span :style="{ color: profitColor }">{{ strategy.monthlyGain }}%</span></p>
    <p>Drawdown: <span :style="{ color: drawdownColor }">{{ strategy.monthlyDrawdown }}%</span></p>
  </div>
</template>

<style scoped>
.strategy-card {
  background-color: rgba(60, 60, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 15px;
  margin: 10px;
  min-width: 250px;
  transition: all 0.3s ease;
}

.strategy-name {
  font-size: 18px;
  margin-bottom: 5px;
}

.creator-name {
  font-size: 14px;
  color: rgba(200, 200, 200, 1);
  margin-bottom: 10px;
}

.assets {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.asset {
  display: flex;
  align-items: center;
  margin-right: 10px;
  margin-bottom: 5px;
}

.asset-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 5px;
  background-color: rgba(128, 128, 128, 0.5);
}
</style>