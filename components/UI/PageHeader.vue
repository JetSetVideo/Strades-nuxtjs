<template>
  <header class="page-header">
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
    <div class="actions" v-if="$slots.actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  badge?: string | number
}>()
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
}
.title-stack { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
.title-row { display: flex; align-items: baseline; gap: 0.55rem; }
h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: var(--font-family-primary, 'Poppins', sans-serif);
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
.actions { display: flex; gap: 0.4rem; flex-shrink: 0; align-items: center; }

@media (min-width: 768px) {
  h1 { font-size: 1.4rem; }
}
</style>
