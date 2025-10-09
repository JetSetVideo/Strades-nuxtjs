<script setup lang="ts">
const props = defineProps<{ 
  risk: number;
  complexity: string;
  computationalCost: number;
}>()
</script>

<template>
  <div class="rating-card">
    <div class="item">
      <span class="label">Risk</span>
      <div class="bar">
        <div class="fill" :style="{ width: Math.min(10, Math.max(0, risk)) * 10 + '%'}"></div>
      </div>
      <span class="value">{{ risk }}/10</span>
    </div>
    <div class="item">
      <span class="label">Complexity</span>
      <span class="value">{{ complexity }}</span>
    </div>
    <div class="item">
      <span class="label">Computational cost</span>
      <span class="value">{{ computationalCost }} pts</span>
    </div>
  </div>
</template>

<style scoped>
.rating-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  color: var(--text-white);
  display: grid;
  gap: var(--spacing-sm);
}
.item { display: grid; grid-template-columns: 120px 1fr auto; gap: var(--spacing-sm); align-items: center; }
.label { color: var(--text-light-gray); }
.value { font-weight: 600; }
.bar { height: 8px; background: #2a2a2a; border-radius: 999px; overflow: hidden; border: 1px solid var(--border-secondary); }
.fill { height: 100%; background: var(--primary-gradient); }
</style>


