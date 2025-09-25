<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['trades']);
const showMore = ref(false);

const visibleTrades = computed(() => {
  return showMore.value ? props.trades.slice(0, 10) : props.trades.slice(0, 5);
});

const toggleShowMore = () => {
  showMore.value = !showMore.value;
};

const calculatePercentageChange = (trade) => {
  const previousTrade = props.trades.find(t => t.asset === trade.asset && t.date < trade.date);
  if (!previousTrade) return 0;
  return ((trade.price - previousTrade.price) / previousTrade.price) * 100;
};
</script>

<template>
  <div class="trades-history">
    <h3>Trades History</h3>
    <ul>
      <li v-for="trade in visibleTrades" :key="trade.date">
        {{ trade.date }} - {{ trade.asset }} - {{ trade.type }} 
        Amount: {{ trade.amount }} - Price: ${{ trade.price }}
        <span :class="{ 'positive': calculatePercentageChange(trade) >= 0, 'negative': calculatePercentageChange(trade) < 0 }">
          {{ calculatePercentageChange(trade).toFixed(2) }}%
        </span>
      </li>
    </ul>
    <button v-if="props.trades.length > 5" @click="toggleShowMore">
      {{ showMore ? 'Show Less' : 'Show More' }}
    </button>
  </div>
</template>

<style scoped>
.trades-history {
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
}

.positive {
  color: green;
}

.negative {
  color: red;
}
</style>