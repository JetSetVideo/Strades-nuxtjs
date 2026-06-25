<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  /** When true, hide the built-in trigger button (caller controls open externally). */
  controlled?: boolean
  open?: boolean
}>(), { controlled: false, open: false })

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const internalOpen = ref(false)
const isOpen = computed(() => (props.controlled ? props.open : internalOpen.value))

const setOpen = (v: boolean) => {
  if (props.controlled) emit('update:open', v)
  else internalOpen.value = v
}

const close = () => setOpen(false)
const toggle = () => setOpen(!isOpen.value)

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Lock scroll while open
watch(isOpen, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})

interface MenuItem { label: string; to: string; icon?: string; group: 'you' | 'discover' | 'support'; hint?: string }

const items: MenuItem[] = [
  { label: 'Profile', to: '/profile', icon: '◉', group: 'you' },
  { label: 'Settings', to: '/settings', icon: '⚙', group: 'you' },
  { label: 'Notifications', to: '/notifications', icon: '◔', group: 'you' },
  { label: 'API Sync', to: '/apis', icon: '⇄', group: 'you' },
  { label: 'Leaderboard', to: '/leaderboard', icon: '☷', group: 'discover' },
  { label: 'Quests', to: '/quest', icon: '◈', group: 'discover' },
  { label: 'Calendar', to: '/calendar', icon: '▦', group: 'discover' },
  { label: 'Historic', to: '/historic', icon: '⌖', group: 'discover' },
  { label: 'Shop', to: '/shop', icon: '◫', group: 'discover' },
  { label: 'Help', to: '/help', icon: '?', group: 'support' },
  { label: 'About', to: '/about', icon: '★', group: 'support' },
  { label: 'Contact', to: '/contact', icon: '✉', group: 'support' }
]

const grouped = computed(() => ({
  you: items.filter(i => i.group === 'you'),
  discover: items.filter(i => i.group === 'discover'),
  support: items.filter(i => i.group === 'support')
}))

defineExpose({ open: isOpen, toggle, close })
</script>

<template>
  <div class="drawer-wrapper">
    <button v-if="!controlled" class="trigger" @click="toggle" :aria-expanded="isOpen" aria-label="Menu">
      <span class="bars"><span /><span /><span /></span>
    </button>

    <Teleport to="body">
      <Transition name="backdrop">
        <div v-if="isOpen" class="backdrop" @click="close" />
      </Transition>
      <Transition name="drawer">
        <aside v-if="isOpen" class="drawer" role="dialog" aria-label="Menu">
          <header class="drawer-head">
            <span class="brand">STRADES</span>
            <button class="close" @click="close" aria-label="Close">✕</button>
          </header>

          <div class="group" v-for="(group, key) in grouped" :key="key">
            <h4>{{ key }}</h4>
            <NuxtLink v-for="item in group" :key="item.to" :to="item.to" class="item" @click="close">
              <span class="item-icon">{{ item.icon }}</span>
              <span class="item-label">{{ item.label }}</span>
              <span class="arrow">→</span>
            </NuxtLink>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.drawer-wrapper { display: inline-flex; }

.trigger {
  width: 2.25rem; height: 2.25rem;
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 8px);
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
}
.trigger:hover { border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }
.bars { display: inline-flex; flex-direction: column; gap: 3px; }
.bars span { display: block; width: 16px; height: 1.5px; background: currentColor; border-radius: 2px; }

.backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 100;
}
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.2s ease; }

.drawer {
  position: fixed; top: 0; right: 0;
  height: 100vh;
  width: min(340px, 92vw);
  background: linear-gradient(180deg, rgba(15,15,15,0.98), rgba(20,20,28,0.98));
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255,255,255,0.08);
  box-shadow: -8px 0 32px rgba(0,0,0,0.5);
  z-index: 101;
  display: flex; flex-direction: column;
  padding: 0.85rem 0.6rem;
  gap: 0.85rem;
  overflow-y: auto;
}

.drawer-enter-from { transform: translateX(100%); }
.drawer-leave-to { transform: translateX(100%); }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }

.drawer-head {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.brand {
  font-family: 'Poppins', sans-serif;
  font-weight: 800;
  letter-spacing: 0.2em;
  font-size: 0.9rem;
  background: var(--primary-gradient, linear-gradient(45deg, #00ff88, #00aaff));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.close {
  background: none; border: none;
  color: rgba(255,255,255,0.5);
  font-size: 1.1rem; cursor: pointer;
  width: 28px; height: 28px;
  border-radius: 4px;
}
.close:hover { color: #fff; background: rgba(255,255,255,0.05); }

.group { display: flex; flex-direction: column; gap: 0.15rem; }
.group h4 {
  margin: 0 0 0.4rem 0.5rem;
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}

.item {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.55rem 0.6rem;
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  font-size: 0.85rem;
  transition: background 0.15s ease, color 0.15s ease;
}
.item:hover { background: rgba(255,255,255,0.04); color: var(--primary-green, #00ff88); }
.item:hover .arrow { transform: translateX(2px); color: var(--primary-green, #00ff88); }

.item-icon {
  width: 22px; text-align: center;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.55);
}
.item-label { flex: 1; letter-spacing: 0.02em; }
.arrow {
  color: rgba(255,255,255,0.25);
  transition: transform 0.2s ease, color 0.2s ease;
  font-size: 0.85rem;
}

.router-link-exact-active {
  background: rgba(0,255,136,0.08);
  color: var(--primary-green, #00ff88);
}
</style>
