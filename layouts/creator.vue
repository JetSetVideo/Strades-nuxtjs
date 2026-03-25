<script setup lang="ts">
import { computed } from 'vue'
import NavigationBar from '~/components/Navigation/Bar.vue'

// Strategy title shared between page and layout via useState
const strategyTitle   = useState<string>('creator:title',  () => '')
const strategyStatus  = useState<string>('creator:status', () => 'draft')
const savingState     = useState<'idle' | 'saving' | 'saved' | 'error'>('creator:saving', () => 'idle')

const statusMeta = computed(() => {
  const m: Record<string, { label: string; color: string; icon: string }> = {
    draft:    { label: 'Draft',    color: '#607d8b', icon: '📝' },
    saved:    { label: 'Saved',   color: '#2196f3', icon: '💾' },
    active:   { label: 'Active',  color: '#4caf50', icon: '▶' },
    paused:   { label: 'Paused',  color: '#ff9800', icon: '⏸' },
    stopped:  { label: 'Stopped', color: '#9e9e9e', icon: '⏹' },
  }
  return m[strategyStatus.value] ?? m.draft
})

const savingLabel = computed(() => {
  const m = { idle: '', saving: 'Saving…', saved: '✓ Saved', error: '⚠ Save failed' }
  return m[savingState.value]
})

const savingColor = computed(() => {
  const m = { idle: 'transparent', saving: 'var(--text-gray)', saved: 'var(--success-green)', error: 'var(--error-red)' }
  return m[savingState.value]
})
</script>

<template>
  <div class="creator-shell">

    <!-- ── Builder top bar ─────────────────────────────────────────────── -->
    <header class="builder-bar">
      <!-- Back -->
      <NuxtLink to="/strategies" class="back-btn" title="Back to strategies">
        <span class="back-icon">←</span>
      </NuxtLink>

      <!-- Name + status -->
      <div class="bar-center">
        <span class="bar-title" :class="{ placeholder: !strategyTitle }">
          {{ strategyTitle || 'New Strategy' }}
        </span>
        <span class="status-badge" :style="{ color: statusMeta.color, borderColor: statusMeta.color + '44', background: statusMeta.color + '18' }">
          {{ statusMeta.icon }} {{ statusMeta.label }}
        </span>
      </div>

      <!-- Save indicator -->
      <span class="saving-indicator" :style="{ color: savingColor }">
        {{ savingLabel }}
      </span>
    </header>

    <!-- ── Main content ────────────────────────────────────────────────── -->
    <main class="builder-main">
      <slot />
    </main>

  </div>
</template>

<style scoped>
.creator-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #0e0e0f;
  font-family: 'Kanit', sans-serif;
  color: white;
}

/* ── Builder bar ── */
.builder-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: rgba(14, 14, 15, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
}

.back-icon { font-size: 1rem; line-height: 1; }

.bar-center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bar-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.bar-title.placeholder { color: rgba(255, 255, 255, 0.3); font-style: italic; }

.status-badge {
  font-size: 0.58rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.saving-indicator {
  font-size: 0.6rem;
  flex-shrink: 0;
  white-space: nowrap;
  transition: color 0.3s ease;
}

/* ── Main content ── */
.builder-main {
  flex: 1;
  padding-top: 48px; /* offset fixed bar */
}
</style>
