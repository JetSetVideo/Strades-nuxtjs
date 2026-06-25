<template>
  <span class="ui-pill" :class="[`tone-${tone}`, { dot: showDot, ghost }]">
    <span v-if="showDot" class="pill-dot" />
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent'
  showDot?: boolean
  ghost?: boolean
}>(), {
  tone: 'neutral'
})
</script>

<style scoped>
.ui-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
  line-height: 1.4;
}

.tone-neutral { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
.tone-success { background: rgba(0,255,136,0.12); color: var(--primary-green, #00ff88); }
.tone-danger { background: rgba(255,68,68,0.12); color: var(--error-red, #ff4444); }
.tone-warning { background: rgba(255,165,0,0.15); color: var(--warning-orange, #ffa500); }
.tone-info { background: rgba(0,170,255,0.12); color: var(--primary-blue, #00aaff); }
.tone-accent { background: var(--primary-gradient); color: #000; }

.ui-pill.ghost { background: transparent; border: 1px solid currentColor; }

.pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 4px currentColor;
}
</style>
