<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted, onBeforeUnmount } from 'vue'

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

watch(isOpen, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})

const { logout } = useAuth()
const signOut = () => logout()

interface MenuItem { label: string; to: string; hint: string; icon: string }
interface MenuGroup {
  key: string
  title: string
  blurb: string
  items: MenuItem[]
  /** Detail routes that belong here even though their index is not a child link. */
  also: string[]
}

// Bottom bar already covers Prices, News, Wallet, Lab (/strategies), and Chat.
// Landing (/) and sign-in (/auth) sit outside the app. Detail routes need an id.
const GROUPS: MenuGroup[] = [
  {
    key: 'trade',
    title: 'Trade',
    blurb: 'Paper wallets, prediction bots, public bots, and the strategies that run them',
    also: ['/bots', '/strategy', '/summarizer'],
    items: [
      { label: 'Trade', to: '/trade', hint: 'Wallet, bots, and the ledger', icon: '⇅' },
      { label: 'Predict', to: '/predict', hint: 'Paper bot on a market', icon: '◐' },
      { label: 'Community bots', to: '/community', hint: 'Public bots from other traders', icon: '◎' },
      { label: 'Strategy Creator', to: '/creator', hint: 'Build rules and backtest them', icon: '✎' },
    ],
  },
  {
    key: 'markets',
    title: 'Markets',
    blurb: 'Chart, data catalog, calendar, deal pipeline, history, and exposure',
    also: [],
    items: [
      { label: 'Candle Chart', to: '/CandleChart', hint: 'Full-screen chart', icon: '▥' },
      { label: 'Data Catalog', to: '/data', hint: 'Series an avatar can pull', icon: '▦' },
      { label: 'Calendar', to: '/calendar', hint: 'Sessions and event days', icon: '▣' },
      { label: 'Deals', to: '/deals', hint: 'Pipeline from idea to fill', icon: '⟷' },
      { label: 'History', to: '/historic', hint: 'What already printed', icon: '⌖' },
      { label: 'Risk & Exposure', to: '/risk', hint: 'Exposure across the book', icon: '⚠' },
    ],
  },
  {
    key: 'compete',
    title: 'Compete',
    blurb: 'Avatars, arena, quests, standings, and strategies other people sell',
    also: [],
    items: [
      { label: 'Avatar Marketplace', to: '/agents', hint: 'Bots trained with other people', icon: '☰' },
      { label: 'Arena', to: '/arena', hint: 'Post a read, stake credits', icon: '⚔' },
      { label: 'Quests', to: '/quest', hint: 'Shared drills', icon: '◈' },
      { label: 'Leaderboard', to: '/leaderboard', hint: 'Who is ahead on paper', icon: '☷' },
      { label: 'Strategy Shop', to: '/shop', hint: 'Browse strategies to buy or rent', icon: '◫' },
    ],
  },
  {
    key: 'you',
    title: 'You',
    blurb: 'Profile, settings, alerts, and the API accounts tied to you',
    also: [],
    items: [
      { label: 'Profile', to: '/profile', hint: 'Your record and trained avatars', icon: '◉' },
      { label: 'Insights', to: '/insights', hint: 'How you trade, who you trade well with', icon: '◎' },
      { label: 'Settings', to: '/settings', hint: 'Appearance, chart, and timezone', icon: '⚙' },
      { label: 'Notifications', to: '/notifications', hint: 'Alerts from avatars and the desk', icon: '◔' },
      { label: 'API Connections', to: '/apis', hint: 'Broker feeds that train avatars', icon: '⇄' },
    ],
  },
  {
    key: 'help',
    title: 'Help',
    blurb: 'How the desk works, what Strades is, and how to reach the team',
    also: [],
    items: [
      { label: 'Help', to: '/help', hint: 'How to train an avatar', icon: '?' },
      { label: 'About', to: '/about', hint: 'What Strades is', icon: '★' },
      { label: 'Contact', to: '/contact', hint: 'Reach the desk', icon: '✉' },
    ],
  },
]

const route = useRoute()

const matches = (path: string, to: string) => path === to || path.startsWith(`${to}/`)

const groupHasRoute = (group: MenuGroup) => {
  const path = route.path
  return group.items.some(item => matches(path, item.to))
    || group.also.some(to => matches(path, to))
}

const openGroups = reactive<Record<string, boolean>>(
  Object.fromEntries(GROUPS.map(group => [group.key, true]))
)

function expandCurrent() {
  for (const group of GROUPS) {
    if (groupHasRoute(group)) openGroups[group.key] = true
  }
}

watch(() => route.path, expandCurrent, { immediate: true })
watch(isOpen, (v) => { if (v) expandCurrent() })

const toggleGroup = (key: string) => { openGroups[key] = !openGroups[key] }

const here = computed(() => {
  const path = route.path
  for (const group of GROUPS) {
    const item = group.items.find(entry => matches(path, entry.to))
    if (item) return `${group.title} / ${item.label}`
    if (group.also.some(to => matches(path, to))) return group.title
  }
  return 'Menu'
})

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
            <button type="button" class="drawer-brand" aria-label="Close menu" @click="close">
              <span class="brand-logo" aria-hidden="true">
                <img src="/logos/strades-mark.png" alt="" />
              </span>
              <span class="brand-word">STRADES</span>
            </button>
            <span class="here">{{ here }}</span>
          </header>

          <nav class="drawer-tree" aria-label="Pages">
            <div
              v-for="group in GROUPS"
              :key="group.key"
              class="tree-branch"
              :class="{ 'is-open': openGroups[group.key] }"
            >
              <h3 class="tree-parent-heading">
                <button
                  type="button"
                  class="tree-parent"
                  :class="{ 'has-current': !openGroups[group.key] && groupHasRoute(group) }"
                  :aria-expanded="!!openGroups[group.key]"
                  :title="group.blurb"
                  @click="toggleGroup(group.key)"
                >
                  <svg class="chevron" viewBox="0 0 8 8" aria-hidden="true">
                    <path d="M2 1.5 L5.5 4 L2 6.5" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" />
                  </svg>
                  <span class="tree-parent-label">{{ group.title }}</span>
                </button>
              </h3>
              <div class="tree-children">
                <div class="tree-children-clip" :inert="!openGroups[group.key]">
                  <NuxtLink
                    v-for="item in group.items"
                    :key="item.to"
                    :to="item.to"
                    class="tree-child"
                    :class="{ 'is-current': matches(route.path, item.to) }"
                    :title="item.hint"
                    :aria-current="matches(route.path, item.to) ? 'page' : undefined"
                    @click="close"
                  >
                    <span class="tree-child-icon" aria-hidden="true">{{ item.icon }}</span>
                    <span class="tree-child-label">{{ item.label }}</span>
                    <span class="tree-child-hint">{{ item.hint }}</span>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </nav>

          <footer class="drawer-foot">
            <button type="button" class="signout" @click="close(); signOut()">Sign out</button>
          </footer>
        </aside>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.drawer-wrapper { display: inline-flex; }

.trigger {
  width: 2.25rem;
  height: 2.25rem;
  background: none;
  border: 1px solid var(--drawer-tree-edge);
  border-radius: var(--drawer-tree-radius);
  color: var(--text-light-gray);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.trigger:hover { color: var(--drawer-tree-current-color); }
.trigger:focus-visible {
  outline: var(--drawer-tree-focus-width) solid var(--drawer-tree-focus);
  outline-offset: var(--drawer-tree-focus-offset);
}
.bars { display: inline-flex; flex-direction: column; gap: 3px; }
.bars span {
  display: block;
  width: 16px;
  height: var(--drawer-tree-rule-width);
  background: currentColor;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: var(--drawer-tree-backdrop);
  z-index: var(--drawer-tree-backdrop-z);
}
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity var(--drawer-tree-motion); }

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: var(--drawer-tree-width);
  box-sizing: border-box;
  background: var(--drawer-tree-bg);
  backdrop-filter: blur(var(--drawer-tree-blur));
  border-right: var(--drawer-tree-rule-width) solid var(--drawer-tree-edge);
  box-shadow: var(--drawer-tree-shadow);
  z-index: var(--drawer-tree-z);
  display: flex;
  flex-direction: column;
  padding:
    0
    max(var(--drawer-tree-pad-x), env(safe-area-inset-right))
    0
    max(var(--drawer-tree-pad-x), env(safe-area-inset-left));
  font-family: var(--drawer-tree-font);
  color: var(--drawer-tree-child-color);
  container-type: inline-size;
  container-name: drawer;
}

.drawer-enter-from, .drawer-leave-to { transform: translateX(-100%); }
.drawer-enter-active, .drawer-leave-active { transition: transform var(--drawer-tree-motion); }

.drawer-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
  min-height: var(--drawer-tree-header-min);
  padding-block: var(--drawer-tree-pad-y);
  background: var(--drawer-tree-header-bg);
  border-bottom: var(--drawer-tree-rule-width) solid var(--drawer-tree-edge);
}
.drawer-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  height: 30px;
  padding: 0 0.55rem 0 0.35rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 6px);
  color: var(--text-white, #fff);
  cursor: pointer;
  font-family: var(--drawer-tree-font);
}
.drawer-brand:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.brand-logo {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  box-sizing: border-box;
  border: 1.5px solid transparent;
  border-radius: 5px 0 5px 0;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(
      from 225deg at 50% 50%,
      rgba(255, 26, 26, 0.59) 0deg,
      #ff1a1a 18deg,
      #ff1a1a 70deg,
      #ffffff 96deg,
      #ffffff 128deg,
      #00e25a 158deg,
      rgba(0, 226, 90, 0.59) 180deg,
      #00e25a 202deg,
      #00e25a 220deg,
      #ffffff 242deg,
      #ffffff 272deg,
      #ff1a1a 310deg,
      #ff1a1a 342deg,
      rgba(255, 26, 26, 0.59) 360deg
    ) border-box;
}
.brand-logo img {
  width: 112%;
  height: 112%;
  object-fit: contain;
  display: block;
  pointer-events: none;
  transform: translateY(-0.5px);
}
.brand-word {
  display: none;
  font-weight: 700;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
}
.here {
  font-family: var(--drawer-tree-here-font);
  font-size: var(--drawer-tree-here-size);
  color: var(--drawer-tree-here-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.drawer-brand:focus-visible,
.tree-parent:focus-visible,
.tree-child:focus-visible,
.signout:focus-visible {
  outline: var(--drawer-tree-focus-width) solid var(--drawer-tree-focus);
  outline-offset: var(--drawer-tree-focus-offset);
}

.drawer-tree {
  flex: 1;
  overflow-y: auto;
  padding-block: var(--drawer-tree-pad-y);
}

.tree-branch { margin-bottom: var(--drawer-tree-branch-gap); width: 100%; }
.tree-parent-heading { margin: 0; font: inherit; }

.tree-parent {
  display: flex;
  align-items: center;
  gap: var(--drawer-tree-chevron-gap);
  width: 100%;
  min-height: var(--drawer-tree-row-min);
  padding: 0 0.4rem;
  border: none;
  border-radius: var(--drawer-tree-radius);
  background: transparent;
  color: var(--drawer-tree-parent-color);
  font-family: inherit;
  font-size: var(--drawer-tree-parent-size);
  font-weight: var(--drawer-tree-parent-weight);
  letter-spacing: var(--drawer-tree-parent-track);
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
}
.tree-parent:hover { background: var(--drawer-tree-hover-bg); color: var(--drawer-tree-parent-color-open); }
.tree-branch.is-open .tree-parent {
  color: var(--drawer-tree-parent-color-open);
  background: var(--nav-hover-bg);
  box-shadow: inset var(--drawer-tree-current-bar) 0 0 var(--drawer-tree-current-color);
}
.tree-parent.has-current { color: var(--drawer-tree-current-color); }

.chevron {
  width: var(--drawer-tree-chevron-slot);
  height: var(--drawer-tree-chevron-slot);
  flex: 0 0 var(--drawer-tree-chevron-slot);
  color: var(--drawer-tree-chevron);
  transform: rotate(0deg);
  transition: transform var(--drawer-tree-motion);
}
.tree-branch.is-open .chevron {
  transform: rotate(90deg);
  color: var(--drawer-tree-current-color);
}

.tree-children {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--drawer-tree-motion);
}
.tree-branch.is-open .tree-children { grid-template-rows: 1fr; }
.tree-children-clip { overflow: hidden; min-height: 0; }

.tree-child {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--drawer-tree-chevron-gap);
  min-height: var(--drawer-tree-row-min);
  margin-left: var(--drawer-tree-rule-inset);
  padding-left: var(--drawer-tree-elbow);
  padding-right: var(--drawer-tree-pad-x);
  border-radius: var(--drawer-tree-radius);
  color: var(--drawer-tree-child-color);
  font-size: var(--drawer-tree-child-size);
  font-weight: var(--drawer-tree-child-weight);
  letter-spacing: var(--drawer-tree-child-track);
  text-decoration: none;
}
.tree-child::before {
  content: "";
  position: absolute;
  left: calc(var(--drawer-tree-rule-inset) * -1);
  top: 0;
  bottom: 0;
  width: var(--drawer-tree-rule-width);
  background: var(--drawer-tree-rule);
}
.tree-child:last-child::before { bottom: 50%; }
.tree-child::after {
  content: "";
  position: absolute;
  left: calc(var(--drawer-tree-rule-inset) * -1);
  top: 50%;
  width: var(--drawer-tree-elbow);
  height: var(--drawer-tree-rule-width);
  background: var(--drawer-tree-rule);
}
.tree-child:hover {
  background: var(--drawer-tree-hover-bg);
  color: var(--drawer-tree-child-color-hover);
}
.tree-child.is-current,
.tree-child.router-link-exact-active {
  background: var(--drawer-tree-current-bg);
  color: var(--drawer-tree-current-color);
  box-shadow: inset var(--drawer-tree-current-bar) 0 0 var(--drawer-tree-current-color);
}
.tree-child-icon {
  flex: 0 0 1.5rem;
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  font-size: 1rem;
  line-height: 1;
  color: var(--text-gray);
}
.tree-child-label {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-child-hint {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--drawer-tree-hint-font);
  font-size: var(--drawer-tree-hint-size);
  font-style: italic;
  color: var(--drawer-tree-hint-color);
}

.drawer-foot {
  flex-shrink: 0;
  padding-block: var(--drawer-tree-pad-y) calc(var(--drawer-tree-pad-y) + env(safe-area-inset-bottom));
  border-top: var(--drawer-tree-rule-width) solid var(--drawer-tree-edge);
}
.signout {
  padding: 0.4rem 0.2rem;
  border: none;
  background: transparent;
  color: var(--drawer-tree-signout-color);
  font-family: inherit;
  font-size: var(--drawer-tree-signout-size);
  font-weight: var(--drawer-tree-signout-weight);
  cursor: pointer;
  border-radius: var(--drawer-tree-radius);
}
.signout:hover { background: var(--drawer-tree-signout-hover-bg); }

@media (min-width: 640px) {
  .brand-word { display: inline; }
}

/* A narrow panel keeps one column and lets a long hint sit under its label. */
@container drawer (max-width: 28rem) {
  .tree-child { flex-wrap: wrap; row-gap: 0.05rem; }
  .tree-child-label { flex: 1 1 auto; }
  .tree-child-hint {
    flex: 1 0 calc(100% - 2rem);
    margin-left: calc(1.5rem + var(--drawer-tree-chevron-gap));
  }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop-enter-active,
  .backdrop-leave-active,
  .drawer-enter-active,
  .drawer-leave-active,
  .tree-children,
  .chevron { transition: none; }
}
</style>
