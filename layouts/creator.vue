<script setup lang="ts">
import { computed } from 'vue'

const strategyTitle  = useState<string>('creator:title',  () => '')
const strategyStatus = useState<string>('creator:status', () => 'draft')
const savingState    = useState<'idle' | 'saving' | 'saved' | 'error'>('creator:saving', () => 'idle')

const statusMeta = computed(() => {
  const m: Record<string, { label: string; color: string }> = {
    draft:   { label: 'Draft',   color: '#607d8b' },
    saved:   { label: 'Saved',   color: '#2196f3' },
    active:  { label: 'Active',  color: '#4caf50' },
    paused:  { label: 'Paused',  color: '#ff9800' },
    stopped: { label: 'Stopped', color: '#9e9e9e' },
  }
  return m[strategyStatus.value] ?? m.draft
})

const savingLabel = computed(() => {
  const m = { idle: '', saving: 'Saving…', saved: '✓ Saved', error: '⚠ Error' }
  return m[savingState.value]
})

const savingColor = computed(() => {
  const m = {
    idle: 'transparent',
    saving: 'var(--text-gray, #888)',
    saved: 'var(--success-green, #00ff88)',
    error: 'var(--error-red, #ff4444)',
  }
  return m[savingState.value]
})

const { playHover, playClick, playBack } = useNavSound()
</script>

<template>
  <div class="creator-shell">

    <!-- ── Builder top bar ── -->
    <header class="builder-bar">

      <!-- Back to Strategies -->
      <NuxtLink
        to="/strategies"
        class="back-btn"
        title="Back to Strategies"
        @mouseenter="playHover"
        @click="playBack"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </NuxtLink>

      <!-- Strategy name + status -->
      <div class="bar-identity">
        <span class="bar-title" :class="{ placeholder: !strategyTitle }">
          {{ strategyTitle || 'New Strategy' }}
        </span>
        <span
          class="status-badge"
          :style="{
            color: statusMeta.color,
            borderColor: statusMeta.color + '55',
            background: statusMeta.color + '18',
          }"
        >{{ statusMeta.label }}</span>
      </div>

      <!-- Quick nav: Wallet | Shop | Strategies -->
      <nav class="quick-nav" aria-label="Quick navigation">
        <NuxtLink
          to="/wallet"
          class="qnav-btn"
          title="Wallet"
          @mouseenter="playHover"
          @click="playClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <span>Wallet</span>
        </NuxtLink>

        <NuxtLink
          to="/Shop"
          class="qnav-btn qnav-shop"
          title="Shop"
          @mouseenter="playHover"
          @click="playClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <span>Shop</span>
        </NuxtLink>

        <NuxtLink
          to="/strategies"
          class="qnav-btn"
          title="Strategies"
          @mouseenter="playHover"
          @click="playClick"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <span>Strategies</span>
        </NuxtLink>
      </nav>

      <!-- Save indicator -->
      <span
        class="saving-indicator"
        :style="{ color: savingColor }"
        aria-live="polite"
      >{{ savingLabel }}</span>

    </header>

    <!-- ── Page content ── -->
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
  font-family: var(--font-family-secondary, 'Kanit'), sans-serif;
  color: white;
}

/* ── Builder bar ── */
.builder-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: var(--z-fixed, 1030);
  height: var(--nav-top-height, 3rem);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 var(--nav-padding-x, 0.875rem);
  background: var(--nav-glass-bg, rgba(12,12,14,0.88));
  backdrop-filter: blur(var(--nav-glass-blur, 14px));
  border-bottom: 1px solid var(--nav-border, rgba(255,255,255,0.07));
  box-shadow: 0 0.125rem 0.75rem rgba(0,0,0,0.3);
  animation: nav-enter 0.35s cubic-bezier(0.22,1,0.36,1) both;
}

@keyframes nav-enter {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

/* Back button */
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid var(--nav-border, rgba(255,255,255,0.08));
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  flex-shrink: 0;
  transition: all var(--transition-fast, 0.2s ease);
}
.back-btn:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
  border-color: rgba(255,255,255,0.18);
  transform: translateX(-2px);
}

/* Identity block */
.bar-identity {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex-shrink: 1;
}

.bar-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 9rem;
}
.bar-title.placeholder { color: rgba(255,255,255,0.28); font-style: italic; }

.status-badge {
  font-size: 0.55rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}

/* Quick nav */
.quick-nav {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex: 1;
  justify-content: center;
}

.qnav-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid transparent;
  color: rgba(255,255,255,0.45);
  text-decoration: none;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all var(--transition-fast, 0.2s ease);
}
.qnav-btn svg {
  width: 0.85rem;
  height: 0.85rem;
  flex-shrink: 0;
}
.qnav-btn:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.07);
  transform: translateY(-1px);
}
.qnav-btn.router-link-active {
  color: var(--nav-active-color, #00ff88);
  background: var(--nav-active-bg, rgba(0,255,136,0.1));
  border-color: rgba(0,255,136,0.25);
}

/* Shop button — accent highlight */
.qnav-shop:hover {
  color: var(--primary-green, #00ff88);
  border-color: rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.08);
}

/* Saving indicator */
.saving-indicator {
  font-size: 0.58rem;
  flex-shrink: 0;
  white-space: nowrap;
  transition: color var(--transition-normal, 0.3s ease);
  min-width: 3.5rem;
  text-align: right;
}

/* ── Main ── */
.builder-main {
  flex: 1;
  padding-top: var(--nav-top-height, 3rem);
}

/* Tablet+ */
@media (min-width: 768px) {
  .builder-bar {
    height: var(--nav-top-height-md, 3.5rem);
    padding: 0 var(--nav-padding-x-md, 1.5rem);
    gap: 0.75rem;
  }
  .builder-main { padding-top: var(--nav-top-height-md, 3.5rem); }
  .bar-title { max-width: 14rem; font-size: 0.85rem; }
  .qnav-btn { font-size: 0.72rem; padding: 0.3rem 0.65rem; }
  .qnav-btn svg { width: 0.95rem; height: 0.95rem; }
}

@media (min-width: 1024px) {
  .builder-bar {
    height: var(--nav-top-height-lg, 3.75rem);
    padding: 0 var(--nav-padding-x-lg, 2.5rem);
  }
  .builder-main { padding-top: var(--nav-top-height-lg, 3.75rem); }
}
</style>
