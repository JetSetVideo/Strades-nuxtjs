<script setup>
defineProps({
  preferences: {
    type: Object,
    required: true,
  },
  privacy: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="preferences">
    <h2>Preferences</h2>
    <div>Email: {{ preferences.email }}</div>
    <div>SMS: {{ preferences.sms }}</div>
    <div>Push: {{ preferences.push }}</div>
    <h2>Privacy</h2>
    <div>Portfolio Visibility: {{ privacy.portfolio_visibility }}</div>
  </div>
</template>

<style scoped>
/* Styles for preferences */
</style>
