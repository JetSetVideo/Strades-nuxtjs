<template>
  <div 
    class="news-globe-container" 
    :style="{ 
      width: `${size}px`, 
      height: `${size}px`,
      transform: `rotateX(${-coords.lat}deg) rotateY(${coords.lng}deg)`
    }"
  >
    <!-- Simple stylized globe icon that will "rotate" via CSS 3D transforms based on coords -->
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="globe-svg">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePrefetchStore } from '~/stores/prefetch'

const props = defineProps({
  size: {
    type: Number,
    default: 24
  }
})

const prefetchStore = usePrefetchStore()

// We get the coords of the latest news item.
// In reality, converting lat/lng to simple rotateX/rotateY creates a fun 3D orientation effect.
const coords = computed(() => {
  return prefetchStore.latestNewsCoords
})
</script>

<style scoped>
.news-globe-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 1.5s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform-style: preserve-3d;
  color: #fff;
}
.globe-svg {
  /* give it a slight global pulse or glow based on general styling */
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.5));
}
</style>
