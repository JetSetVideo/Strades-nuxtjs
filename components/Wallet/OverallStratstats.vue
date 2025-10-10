<script setup>
import { ref, onMounted, computed } from 'vue';
import { useStrategiesStore } from '@/stores/strategies';

const props = defineProps({
  selectedCurrency: {
    type: String,
    required: true
  }
});

const strategiesStore = useStrategiesStore();
const strategies = ref([]);
const stats = ref({});

onMounted(async () => {
  try {
    await strategiesStore.initializeStore();
    strategies.value = strategiesStore.strategies.slice(0, 3); // Get first 3 strategies
    calculateStats();
  } catch (error) {
    console.error('Failed to load strategies:', error);
  }
});

const calculateStats = () => {
  let biggestWin = 0;
  let biggestLoss = 0;
  let biggestMonthlyGain = 0;
  let biggestMonthlyDrawdown = 0;
  let totalGain = 0;
  let totalLoss = 0;
  let totalTrades = 0;
  let totalDuration = 0;

  strategies.value.forEach(strategy => {
    strategy.trades.forEach(trade => {
      const profitPercent = (trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100;
      if (profitPercent > biggestWin) biggestWin = profitPercent;
      if (profitPercent < biggestLoss) biggestLoss = profitPercent;

      if (profitPercent > 0) {
        totalGain += profitPercent;
      } else {
        totalLoss += Math.abs(profitPercent);
      }

      totalTrades++;
      totalDuration += trade.duration;
    });

    if (strategy.monthlyGain > biggestMonthlyGain) biggestMonthlyGain = strategy.monthlyGain;
    if (strategy.monthlyDrawdown < biggestMonthlyDrawdown) biggestMonthlyDrawdown = strategy.monthlyDrawdown;
  });

  stats.value = {
    biggestWin,
    biggestLoss,
    biggestMonthlyGain,
    biggestMonthlyDrawdown,
    averageGain: totalGain / totalTrades,
    averageLoss: totalLoss / totalTrades,
    averageDuration: totalDuration / totalTrades
  };
};

const formattedStats = computed(() => ({
  biggestWin: `${stats.value.biggestWin.toFixed(2)}%`,
  biggestLoss: `${stats.value.biggestLoss.toFixed(2)}%`,
  biggestMonthlyGain: `${stats.value.biggestMonthlyGain.toFixed(2)}%`,
  biggestMonthlyDrawdown: `${stats.value.biggestMonthlyDrawdown.toFixed(2)}%`,
  averageGain: `${stats.value.averageGain.toFixed(2)}%`,
  averageLoss: `${stats.value.averageLoss.toFixed(2)}%`,
  averageDuration: `${stats.value.averageDuration.toFixed(1)} days`
}));
</script>

<template>
  <div class="overall-stratstats">
    <h2 class="stats-title">Overall Strategy Statistics</h2>
    <table class="stats-table">
      <tr>
        <td class="stat-label">Biggest Win:</td>
        <td class="stat-value win">{{ formattedStats.biggestWin }}</td>
      </tr>
      <tr>
        <td class="stat-label">Biggest Loss:</td>
        <td class="stat-value loss">{{ formattedStats.biggestLoss }}</td>
      </tr>
      <tr>
        <td class="stat-label">Biggest Monthly Gain:</td>
        <td class="stat-value win">{{ formattedStats.biggestMonthlyGain }}</td>
      </tr>
      <tr>
        <td class="stat-label">Biggest Monthly Drawdown:</td>
        <td class="stat-value loss">{{ formattedStats.biggestMonthlyDrawdown }}</td>
      </tr>
      <tr>
        <td class="stat-label">Average Gain per Trade:</td>
        <td class="stat-value win">{{ formattedStats.averageGain }}</td>
      </tr>
      <tr>
        <td class="stat-label">Average Loss per Trade:</td>
        <td class="stat-value loss">{{ formattedStats.averageLoss }}</td>
      </tr>
      <tr>
        <td class="stat-label">Average Trade Duration:</td>
        <td class="stat-value">{{ formattedStats.averageDuration }}</td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.overall-stratstats {
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 15px;
  padding: 20px;
  margin-top: 20px;
  width: 100%;
  max-width: 600px;
}

.stats-title {
  color: #ffffff;
  font-size: 1.5rem;
  margin-bottom: 15px;
  text-align: center;
}

.stats-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
}

.stat-label {
  color: #a0a0a0;
  font-weight: bold;
  padding: 10px;
  border-radius: 10px 0 0 10px;
  background-color: rgba(50, 50, 50, 0.6);
}

.stat-value {
  color: #ffffff;
  padding: 10px;
  border-radius: 0 10px 10px 0;
  background-color: rgba(60, 60, 60, 0.6);
  text-align: right;
}

.win {
  color: #4caf50;
}

.loss {
  color: #f44336;
}
</style>