<script setup>
import NavigationTopPrices from '@/components/Navigation/Top/Prices.vue'
import NavigationBar from '@/components/Navigation/Bar.vue'
</script>

<template>
    <div class="pricesLayout">
        <NavigationTopPrices />
        <div class="content">
            <slot />
        </div>
        <NavigationBar />
    </div>
</template>

<style scoped>
.pricesLayout {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
}

.content {
  padding: var(--spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
}
</style>