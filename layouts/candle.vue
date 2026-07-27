<template>
  <div class="candle-layout">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.candle-layout {
  width: 100%;
  height: 100vh;
  background: var(--candle-bg, #2a2e39);
}
</style>
