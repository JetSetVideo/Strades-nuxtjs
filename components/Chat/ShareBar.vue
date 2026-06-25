<script setup lang="ts">
defineEmits<{
  (e: 'share-asset'): void
  (e: 'share-opinion'): void
  (e: 'share-strategy'): void
}>()
</script>

<template>
  <div class="share-bar">
    <span class="share-label">Share</span>
    <button type="button" class="share-btn" @click="$emit('share-asset')">Asset</button>
    <button type="button" class="share-btn" @click="$emit('share-opinion')">Allocation</button>
    <button type="button" class="share-btn" @click="$emit('share-strategy')">Strategy</button>
  </div>
</template>

<style scoped>
.share-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.share-label {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}
.share-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.75);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}
.share-btn:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}
</style>
