<script setup>
defineProps({
  user: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="user-stats">
    <div>Risk Tolerance: {{ user.risk_tolerance }}</div>
    <div>Win Rate: {{ user.win_rate }}%</div>
    <div>Active Strategies: {{ user.active_strategies_count }}</div>
    <div>Followers: {{ user.followers_count }}</div>
  </div>
</template>

<style scoped>
/* Styles for stats */
</style>
