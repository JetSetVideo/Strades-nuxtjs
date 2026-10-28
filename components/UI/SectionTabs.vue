<template>
  <div class="section-tabs" :class="{ panels, 'tone-white': tone === 'white' }">
    <nav role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="modelValue === tab.id"
        :class="{ active: modelValue === tab.id }"
        @click="$emit('update:modelValue', tab.id)"
      >
        <span v-if="tab.icon" class="tab-icon">{{ tab.icon }}</span>
        <span v-if="countFirst && tab.count !== undefined && tab.count !== null" class="tab-count lead">{{ tab.count }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="!countFirst && tab.count !== undefined && tab.count !== null" class="tab-count">{{ tab.count }}</span>
      </button>
    </nav>
    <slot name="end" />
  </div>
</template>

<script setup lang="ts">
export interface TabItem {
  id: string
  label: string
  count?: number | string | null
  icon?: string
}

withDefaults(defineProps<{
  tabs: TabItem[]
  modelValue: string
  /** Draw the total before the label. */
  countFirst?: boolean
  /** Selected tab is a white panel. Other pages keep the green accent. */
  tone?: 'accent' | 'white'
  /** Tabs share the row as equal panels. */
  panels?: boolean
}>(), { countFirst: false, tone: 'accent', panels: false })

defineEmits<{ (e: 'update:modelValue', id: string): void }>()
</script>

<style scoped>
.section-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--edge-soft, rgba(255,255,255,0.06));
  padding-bottom: 0.35rem;
  min-width: 0;
}
.section-tabs > nav {
  display: flex;
  gap: inherit;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.section-tabs > nav::-webkit-scrollbar { display: none; }

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
.count-first .tab-count.lead {
  background: none;
  padding: 0;
  font-size: inherit;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

/* Equal panels. The selected one is white, with its total on the left. */
.section-tabs.panels {
  border-bottom: none;
  padding-bottom: 0;
  gap: 0.25rem;
}
.section-tabs.panels > nav { flex: 3 1 0; }
.section-tabs.panels > nav > button {
  flex: 1 1 0;
  justify-content: flex-start;
  min-width: 0;
}
.section-tabs.tone-white button.active {
  background: #fff;
  color: #141414;
  border-color: #fff;
  box-shadow: none;
}
.section-tabs.tone-white button.active .tab-count {
  background: none;
  color: inherit;
}
.section-tabs.panels :slotted(.tab-filter) {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
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
  justify-content: flex-start;
  gap: 0.4rem;
  white-space: nowrap;
}
.section-tabs.panels :slotted(.tab-filter:hover) { color: #fff; }
.section-tabs.tone-white :slotted(.tab-filter.on) {
  background: #fff;
  color: #141414;
  border-color: #fff;
}
.section-tabs :slotted(.tab-filter .tab-count) {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0;
}

@media (max-width: 640px) {
  .section-tabs.panels > nav > button,
  .section-tabs.panels :slotted(.tab-filter) { flex: 0 0 auto; }
}
:global([data-theme="light"]) .section-tabs.tone-white button.active,
:global([data-theme="light"]) .section-tabs.tone-white :slotted(.tab-filter.on) {
  background: #141414;
  color: #fff;
  border-color: #141414;
}

.tab-icon { font-size: 0.85em; }
</style>
