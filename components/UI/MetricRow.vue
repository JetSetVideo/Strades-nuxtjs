<template>
  <div class="metric-row" :class="`cols-${cols}`">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  cols?: 2 | 3 | 4 | 5 | 6
}>(), { cols: 4 })
</script>

<style scoped>
.metric-row {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
.metric-row > * { min-width: 0; }
.cols-2 { grid-template-columns: repeat(2, 1fr); }
.cols-3 { grid-template-columns: repeat(3, 1fr); }
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.cols-5 { grid-template-columns: repeat(5, 1fr); }
.cols-6 { grid-template-columns: repeat(6, 1fr); }

@media (max-width: 640px) {
  .cols-4, .cols-5, .cols-6 { grid-template-columns: repeat(2, 1fr); }
  .cols-3 { grid-template-columns: repeat(2, 1fr); }
}
</style>
