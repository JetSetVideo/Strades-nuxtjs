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

type MenuGroup = 'you' | 'together' | 'desk' | 'support'
interface MenuItem { label: string; to: string; icon: string; group: MenuGroup; hint: string }

const GROUP_COPY: Record<MenuGroup, { title: string; blurb: string }> = {
  you: { title: 'You', blurb: 'Identity, alerts, and the accounts that train your avatars' },
  together: { title: 'Together', blurb: 'Build avatars with other people and train them on shared trades' },
  desk: { title: 'Desk', blurb: 'Markets, deals, history, and how much you have at risk' },
  support: { title: 'Support', blurb: 'How the desk works' },
}

const items: MenuItem[] = [
  { label: 'Profile', to: '/profile', icon: '◉', group: 'you', hint: 'Your record and the avatars trained on it' },
  { label: 'Settings', to: '/settings', icon: '⚙', group: 'you', hint: 'Appearance, chart, and timezone' },
  { label: 'Notifications', to: '/notifications', icon: '◔', group: 'you', hint: 'Alerts from avatars, friends, and the desk' },
  { label: 'Connections', to: '/apis', icon: '⇄', group: 'you', hint: 'Broker feeds that train avatars' },
  { label: 'Avatars', to: '/agents', icon: '☰', group: 'together', hint: 'Bots you and friends train together' },
  { label: 'Arena', to: '/arena', icon: '⚔', group: 'together', hint: 'Post a read, stake free credits' },
  { label: 'Quests', to: '/quest', icon: '◈', group: 'together', hint: 'Shared drills for the swarm' },
  { label: 'Leaderboard', to: '/leaderboard', icon: '☷', group: 'desk', hint: 'Who is ahead on paper' },
  { label: 'Data', to: '/data', icon: '▦', group: 'desk', hint: 'Series you can pull into an avatar' },
  { label: 'Calendar', to: '/calendar', icon: '▣', group: 'desk', hint: 'Sessions and event days' },
  { label: 'Deals', to: '/deals', icon: '⟷', group: 'desk', hint: 'Pipeline from idea to fill' },
  { label: 'History', to: '/historic', icon: '⌖', group: 'desk', hint: 'What already printed' },
  { label: 'Monitor', to: '/monitor', icon: '◎', group: 'desk', hint: 'What is running now' },
  { label: 'Risk', to: '/risk', icon: '⚠', group: 'desk', hint: 'Exposure across the book' },
  { label: 'Shop', to: '/shop', icon: '◫', group: 'desk', hint: 'Add-ons for the desk' },
  { label: 'Help', to: '/help', icon: '?', group: 'support', hint: 'How to train an avatar' },
  { label: 'About', to: '/about', icon: '★', group: 'support', hint: 'What Strades is' },
  { label: 'Contact', to: '/contact', icon: '✉', group: 'support', hint: 'Reach the desk' },
]

const route = useRoute()
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const groups = computed(() => (Object.keys(GROUP_COPY) as MenuGroup[]).map(key => ({
  key,
  ...GROUP_COPY[key],
  items: items.filter(item => item.group === key),
})))

const activeItem = computed(() => items.find(item => isCurrent(item.to)) ?? null)
const here = computed(() => activeItem.value?.label ?? 'Menu')

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
            <div class="brand-block">
              <span class="brand">STRADES</span>
              <span class="here">{{ here }}</span>
            </div>
            <button class="close" @click="close" aria-label="Close">✕</button>
          </header>

          <div class="group" v-for="group in groups" :key="group.key">
            <h4>{{ group.title }}</h4>
            <p class="blurb">{{ group.blurb }}</p>
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="item"
              :class="{ 'is-current': isCurrent(item.to) }"
              :title="item.hint"
              :aria-current="isCurrent(item.to) ? 'page' : undefined"
              @click="close"
            >
              <span class="item-icon" aria-hidden="true">{{ item.icon }}</span>
              <span class="item-copy">
                <span class="item-label">{{ item.label }}</span>
                <span class="item-hint">{{ item.hint }}</span>
              </span>
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
  z-index: 1190;
}
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.2s ease; }

.drawer {
  position: fixed; top: 0; right: 0;
  height: 100dvh;
  width: min(calc(100vw - 2.75rem), var(--drawer-width, 20rem));
  min-width: min(16rem, calc(100vw - 2.75rem));
  max-width: var(--drawer-width-max, 22rem);
  background: linear-gradient(180deg, rgba(15,15,15,0.98), rgba(20,20,28,0.98));
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255,255,255,0.08);
  box-shadow: -8px 0 32px rgba(0,0,0,0.5);
  z-index: 1200;
  display: flex; flex-direction: column;
  padding: 0.55rem 0.55rem calc(0.55rem + env(safe-area-inset-bottom));
  gap: 0.35rem;
  overflow-y: auto;
}

.drawer-enter-from { transform: translateX(100%); }
.drawer-leave-to { transform: translateX(100%); }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }

.drawer-head {
  display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 1;
  padding-bottom: 0.45rem;
  background: rgba(15,15,15,0.96);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.brand-block { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.brand {
  font-family: var(--font-chrome, 'Poppins', sans-serif);
  font-weight: 800;
  letter-spacing: 0.2em;
  font-size: 0.9rem;
  background: var(--primary-gradient, linear-gradient(45deg, #00ff88, #00aaff));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.here {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.close {
  background: none; border: none;
  color: rgba(255,255,255,0.5);
  font-size: 1.1rem; cursor: pointer;
  width: 28px; height: 28px;
  border-radius: 4px;
}
.close:hover { color: #fff; background: rgba(255,255,255,0.05); }

.group { display: flex; flex-direction: column; gap: 0.1rem; }
.group h4 {
  margin: 0.35rem 0 0 0.45rem;
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}
.blurb {
  margin: 0 0.45rem 0.15rem;
  font-size: 0.66rem;
  line-height: 1.25;
  color: rgba(255,255,255,0.42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item {
  display: flex; align-items: flex-start; gap: 0.55rem;
  padding: 0.22rem 0.5rem;
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.item:hover { background: rgba(255,255,255,0.04); color: var(--primary-green, #00ff88); }

.item-icon {
  width: 1.1rem; text-align: center;
  font-size: 0.85rem;
  line-height: 1.35;
  color: rgba(255,255,255,0.55);
  flex: 0 0 auto;
}
.item-copy { display: flex; flex-direction: column; min-width: 0; gap: 0.05rem; }
.item-label { letter-spacing: 0.02em; font-size: 0.82rem; }
.item-hint {
  display: none;
  font-size: 0.66rem;
  line-height: 1.25;
  color: rgba(255,255,255,0.38);
}
.item:hover .item-hint,
.is-current .item-hint,
.router-link-exact-active .item-hint {
  display: block;
}

.is-current,
.router-link-exact-active {
  background: rgba(0,255,136,0.08);
  color: var(--primary-green, #00ff88);
}
.is-current .item-hint,
.router-link-exact-active .item-hint { color: rgba(0,255,136,0.72); }

@media (max-width: 640px) {
  .item-hint,
  .item:hover .item-hint,
  .is-current .item-hint { display: none; }
  .blurb { display: none; }
  .item { align-items: center; padding: 0.45rem 0.5rem; }
}
</style>
