<script setup>
import { computed } from 'vue';

const props = defineProps({
  trades: {
    type: Array,
    default: () => []
  },
  strategies: {
    type: Array,
    default: () => []
  }
});

const allTransactions = computed(() => {
  if (props.trades && props.trades.length > 0) {
    return props.trades;
  }
  if (props.strategies && props.strategies.length > 0) {
    return props.strategies.flatMap(strategy => 
      (strategy.trades || []).map(trade => ({
        ...trade,
        strategyName: strategy.name
      }))
    );
  }
  return [];
});
</script>

<template>
    <div class="transaction-history">
      <p>Transaction History</p>
      <ul>
        <li v-for="(transaction, index) in allTransactions" :key="index">
          {{ transaction.strategyName || 'Trade' }} - {{ transaction.asset || 'Asset' }}: 
          Entry: {{ transaction.entryPrice || '-' }}, 
          Exit: {{ transaction.exitPrice || '-' }}, 
          Date: {{ transaction.date || '-' }}
        </li>
      </ul>
    </div>
  </template>
  
  <style scoped>
  .transaction-history {
    /* Add styles for transaction history */
  }
  </style>