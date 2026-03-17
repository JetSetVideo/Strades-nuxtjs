<template>
  <div class="strategy-orbit-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <!-- Center Hub -->
    <svg viewBox="0 0 24 24" class="hub" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline>
      <polyline points="2 12 12 17 22 12"></polyline>
    </svg>
    <!-- Orbiting Nodes -->
    <div class="orbit-container">
      <div class="node node-1"></div>
      <div class="node node-2"></div>
      <div class="node node-3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  size: {
    type: Number,
    default: 24
  }
})
</script>

<style scoped>
.strategy-orbit-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.hub {
  width: 70%;
  height: 70%;
  z-index: 2;
}

.orbit-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  animation: spin 8s linear infinite;
  z-index: 1;
}

.node {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--primary-green, #31d0aa);
  border-radius: 50%;
  box-shadow: 0 0 4px var(--primary-green, #31d0aa);
}

.node-1 { top: 0; left: 50%; transform: translateX(-50%); }
.node-2 { bottom: 20%; left: 0; }
.node-3 { bottom: 20%; right: 0; }

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
