<script setup lang="ts">
withDefaults(defineProps<{
  /** Where the link points. */
  to: string
  /** Image avatar (e.g. agent face) — mutually exclusive with `mark` */
  avatarUrl?: string
  /** Square mark variant: emoji/character + background colour */
  mark?: string
  markColor?: string
  markBg?: string
  /** Main label (top line, bold). */
  title: string
  /** Secondary line (small, dim). */
  subtitle?: string
  /** Visual variant: tints the hover state */
  variant?: 'agent' | 'strategy' | 'platform'
}>(), { variant: 'agent', markColor: '#fff', markBg: 'rgba(0,170,255,0.15)' })
</script>

<template>
  <NuxtLink :to="to" :class="['link-row', `v-${variant}`]">
    <img v-if="avatarUrl" :src="avatarUrl" :alt="title" class="link-avatar" />
    <span
      v-else
      class="link-mark"
      :style="{ background: markBg, color: markColor }"
    >{{ mark }}</span>
    <div class="link-info">
      <strong>{{ title }}</strong>
      <small v-if="subtitle">{{ subtitle }}</small>
    </div>
    <span class="link-arrow">→</span>
  </NuxtLink>
</template>

<style scoped>
.link-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: var(--app-border-radius, 6px);
  text-decoration: none;
  color: inherit;
  transition: all 0.15s ease;
  min-width: 0;
}
.link-row:hover {
  border-color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.04);
}
.link-arrow { color: var(--primary-green, #00ff88); font-size: 0.95rem; }

.link-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0,255,136,0.3);
}
.link-mark {
  width: 36px; height: 36px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
}

.link-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  overflow: hidden;
}
.link-info strong {
  font-size: 0.82rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link-info small {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
}
</style>
