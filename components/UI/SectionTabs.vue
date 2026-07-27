<template>
  <nav class="section-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :class="{ active: modelValue === tab.id }"
      @click="$emit('update:modelValue', tab.id)"
    >
      <span v-if="tab.icon" class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
      <span v-if="tab.count !== undefined && tab.count !== null" class="tab-count">{{ tab.count }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
export interface TabItem {
  id: string
  label: string
  count?: number | string | null
  icon?: string
}

defineProps<{
  tabs: TabItem[]
  modelValue: string
}>()

defineEmits<{ (e: 'update:modelValue', id: string): void }>()
</script>

<style scoped>
.section-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--edge-soft, rgba(255,255,255,0.06));
  padding-bottom: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.section-tabs::-webkit-scrollbar { display: none; }

button {
  background: none;
  border: 1px solid transparent;
  color: rgba(255,255,255,0.55);
  padding: 0.4rem 0.75rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

button:hover { color: #fff; }

button.active {
  background: linear-gradient(180deg, rgba(0,255,136,0.12) 0%, rgba(0,255,136,0.03) 100%);
  color: var(--primary-green, #00ff88);
  border-color: rgba(0,255,136,0.25);
  box-shadow: var(--shadow-depth-1, 0 1px 2px rgba(0,0,0,0.4));
}

.tab-count {
  font-size: 0.6rem;
  background: rgba(255,255,255,0.08);
  padding: 1px 5px;
  border-radius: 999px;
  letter-spacing: 0.04em;
  font-weight: 700;
}
button.active .tab-count {
  background: rgba(0,255,136,0.15);
}

.tab-icon { font-size: 0.85em; }
</style>
