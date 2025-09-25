<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  strategies: {
    type: Array,
    required: true
  }
});

const allTransactions = computed(() => {
  return props.strategies.flatMap(strategy => 
    strategy.trades.map(trade => ({
      ...trade,
      strategyName: strategy.name
    }))
  );
});
</script>

<template>
    <div class="transaction-history">
      <p>Transaction History</p>
      <ul>
        <li v-for="(transaction, index) in allTransactions" :key="index">
          {{ transaction.strategyName }} - {{ transaction.asset }}: 
          Entry: {{ transaction.entryPrice }}, 
          Exit: {{ transaction.exitPrice }}, 
          Date: {{ transaction.date }}
        </li>
      </ul>
    </div>
  </template>
  
  <style scoped>
  .transaction-history {
    /* Add styles for transaction history */
  }
  </style>