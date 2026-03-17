<template>
  <div 
    class="prices-icon-container" 
    :style="{ 
      width: `${size}px`, 
      height: `${size}px`,
      animationDuration: `${pulseDuration}s` 
    }"
  >
    <!-- Simple sparkline-like graphic that vibrates based on volatility -->
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMacroStore } from '~/stores/macro'

const props = defineProps({
  size: {
    type: Number,
    default: 24
  }
})

const macroStore = useMacroStore()

const pulseDuration = computed(() => {
  // Lower volatility = slower pulse (e.g. 2s)
  // Higher volatility = faster pulse (e.g. 0.2s)
  return Math.max(0.2, 2.0 - (macroStore.global_volatility_index * 1.8))
})
</script>

<style scoped>
.prices-icon-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  width: 100%;
  height: 100%;
  /* Bind the duration inline */
  animation: pulse-vibrate infinite ease-in-out;
}

@keyframes pulse-vibrate {
  0% { transform: scale(1) translateY(0); color: inherit; }
  25% { transform: scale(1.05) translateY(-1px); color: var(--success-green, #31d0aa); /* flash green */ }
  50% { transform: scale(1) translateY(0); color: inherit; }
  75% { transform: scale(1.05) translateY(1px); color: var(--error-red, #ed4b9e); /* flash red */ }
  100% { transform: scale(1) translateY(0); color: inherit; }
}
</style>
