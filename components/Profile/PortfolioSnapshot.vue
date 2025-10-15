<script setup>
defineProps({
  portfolio: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="portfolio-snapshot">
    <h2>Portfolio Snapshot</h2>
    <ul>
      <li v-for="asset in portfolio" :key="asset.id">
        {{ asset.name }} ({{ asset.symbol }}): {{ asset.quantity }} @ ${{ asset.average_purchase_price }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Styles for portfolio snapshot */
</style>
