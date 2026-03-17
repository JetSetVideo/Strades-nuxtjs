<template>
  <div 
    class="skeleton-loader" 
    :style="{ 
      width: width, 
      height: height, 
      borderRadius: macroStore.appBorderRadius 
    }"
  >
  </div>
</template>

<script setup lang="ts">
import { useMacroStore } from '~/stores/macro'

defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '100px' }
})

const macroStore = useMacroStore()
</script>

<style scoped>
.skeleton-loader {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 1rem;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
