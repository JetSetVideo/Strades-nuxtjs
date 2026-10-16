<template>
  <!-- Actions-only: one element — children spread evenly. With a title, keep the classic split. -->
  <header
    v-if="showHeader"
    class="page-header"
    :class="{ 'actions-only': !showTitle }"
  >
    <template v-if="showTitle">
      <div class="title-stack">
        <div class="title-row">
          <slot name="icon" />
          <h1>{{ title }}</h1>
          <span v-if="badge" class="badge">{{ badge }}</span>
        </div>
        <p v-if="subtitle || $slots.subtitle" class="sub">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
      </div>
    </template>
    <slot v-else name="actions" />
  </header>
</template>


<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = defineProps<{
  title?: string
  subtitle?: string
  badge?: string | number
}>()

const slots = useSlots()
const showTitle = computed(() => !!props.title)
const showHeader = computed(() => showTitle.value || !!slots.actions)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  /* ScreenShell already spaces sections via --page-gap; avoid double gaps */
  margin-bottom: 0;
  flex-wrap: wrap;
  width: 100%;
}

/* Single bar: pills / map / status sit as direct children, equal share */
.page-header.actions-only {
  align-items: stretch;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 0.35rem;
}
.page-header.actions-only > :slotted(*) {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.title-stack { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
.title-row { display: flex; align-items: baseline; gap: 0.55rem; }
h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: var(--font-chrome, var(--font-family-primary, 'Poppins', sans-serif));
  line-height: 1.1;
}
.badge {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(0,255,136,0.1);
  color: var(--primary-green, #00ff88);
  border: 1px solid rgba(0,255,136,0.25);
}
.sub {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.35;
}
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
@media (max-width: 480px) {
  .actions { width: 100%; }
  .page-header.actions-only {
    flex-wrap: wrap;
  }
}

@media (min-width: 768px) {
  h1 { font-size: 1.4rem; }
}
</style>
