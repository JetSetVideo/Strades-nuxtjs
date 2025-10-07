<script setup>
definePageMeta({
  title: 'Trading Calendar',
  description: 'Track your trading performance over time',
  layout: 'default',
})
</script>

<template>
  <div class="calendar-page">
    <div class="page-header">
      <h1>Trading Performance Calendar</h1>
      <p>Visualize your trading activity and performance across different time periods</p>
    </div>

    <Calendar />
  </div>
</template>

<style scoped>
.calendar-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: var(--spacing-lg);
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-primary);
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: bold;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.page-header p {
  color: var(--text-gray);
  font-size: 1rem;
  margin: 0;
  font-family: var(--font-family-secondary);
}

@media (max-width: 768px) {
  .calendar-page {
    padding: var(--spacing-md);
  }

  .page-header h1 {
    font-size: 2rem;
  }
}
</style>
