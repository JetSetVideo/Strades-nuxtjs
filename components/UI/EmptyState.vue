<template>
  <div class="empty-state" :class="`size-${size}`">
    <div v-if="icon || $slots.icon" class="icon-slot">
      <slot name="icon">{{ icon }}</slot>
    </div>
    <h3 v-if="title">{{ title }}</h3>
    <p v-if="message">{{ message }}</p>
    <div v-if="$slots.action" class="action-slot"><slot name="action" /></div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  message?: string
  icon?: string
  size?: 'sm' | 'md' | 'lg'
}>(), { size: 'md' })
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
  padding: 1.5rem 1rem;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 8px);
}
.size-sm { padding: 0.85rem; gap: 0.3rem; }
.size-lg { padding: 2.5rem 1.5rem; gap: 0.75rem; }

.icon-slot { font-size: 1.6rem; opacity: 0.5; }
.size-sm .icon-slot { font-size: 1.2rem; }
.size-lg .icon-slot { font-size: 2.4rem; }

h3 {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.85);
  font-weight: 600;
}
.size-sm h3 { font-size: 0.8rem; }

p {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.45);
  max-width: 380px;
  line-height: 1.4;
}
.size-sm p { font-size: 0.7rem; }

.action-slot { margin-top: 0.5rem; }
</style>
