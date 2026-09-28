<script setup lang="ts">
import { ref } from 'vue'
import type { PropType } from 'vue'
import type { SearchHistory, SearchSuggestion } from '@/types'
import SearchBar from '~/components/Navigation/SearchBar.vue'
import DrawerMenu from '~/components/Navigation/DrawerMenu.vue'

defineProps({
  searchHistory: { type: Array as PropType<SearchHistory[]>, default: () => [] },
  searchSuggestions: { type: Array as PropType<SearchSuggestion[]>, default: () => [] }
})

const drawerOpen = ref(false)
const toggleDrawer = () => { drawerOpen.value = !drawerOpen.value }
const { playHover, playClick } = useNavSound()
</script>

<template>
  <header class="top-nav" role="banner">
    <div class="brand-cluster">
      <NuxtLink
        to="/wallet"
        class="brand-link"
        @mouseenter="playHover"
        @click="drawerOpen = false; playClick()"
      >
        <span class="brand-mark">◈</span>
        <span class="brand-word">STRADES</span>
      </NuxtLink>
      <span class="brand-divider" aria-hidden="true" />
      <button
        class="menu-btn"
        aria-label="Open menu"
        @mouseenter="playHover"
        @click="toggleDrawer(); playClick()"
      >
        <span class="bars"><span /><span /><span /></span>
      </button>
    </div>

    <SearchBar
      class="search-bar"
      :search-history="searchHistory"
      :search-suggestions="searchSuggestions"
    />

    <div class="right-cluster">
      <NavigationTopContextActions />
      <span class="right-divider" aria-hidden="true" />
      <NavigationTopGmtClock />
      <NavigationTopCalendarBtn />
      <slot />
    </div>

    <DrawerMenu controlled :open="drawerOpen" @update:open="(v) => drawerOpen = v" />
  </header>
</template>

<style scoped>
.top-nav {
  position: fixed; top: 0; left: 0; right: 0;
  display: flex; flex-direction: row; align-items: center;
  width: 100%;
  height: var(--nav-top-height, 3.25rem);
  padding: 0.35rem var(--page-gutter, 0.75rem);
  gap: 0.5rem;
  background: linear-gradient(180deg, rgba(12,12,16,0.92) 0%, rgba(18,18,24,0.88) 100%);
  backdrop-filter: blur(var(--app-glass-blur, 14px));
  -webkit-backdrop-filter: blur(var(--app-glass-blur, 14px));
  border-bottom: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35), inset 0 -1px 0 rgba(255,255,255,0.02);
  color: #fff;
  z-index: 50;
  animation: nav-enter 0.35s cubic-bezier(0.22,1,0.36,1) both;
}

@keyframes nav-enter {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

/* One cohesive unit: brand identity (plain, no button chrome) + a thin
   divider + the menu trigger (the only actual "button" in this cluster).
   Previously both brand-link and menu-btn had independent box/border/hover-bg
   styling, which at ≥1024px read as two competing, near-identical buttons
   sitting side by side. */
.brand-cluster {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  font-family: 'Poppins', sans-serif;
  text-decoration: none;
  flex-shrink: 0;
  transition: color 0.2s, filter 0.2s;
}
.brand-link:hover {
  color: var(--primary-green, #00ff88);
}
.brand-link:hover .brand-mark {
  filter: drop-shadow(0 0 9px rgba(0,255,136,0.6));
}

.brand-divider {
  display: none;
  width: 1px;
  height: 1.1rem;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  flex-shrink: 0;
}
.menu-btn:hover { border-color: var(--primary-green, #00ff88); }
.bars {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}
.bars span {
  display: block;
  width: 12px;
  height: 1.5px;
  background: rgba(255,255,255,0.5);
  border-radius: 2px;
}

.brand-mark {
  font-size: 1rem;
  background: var(--primary-gradient, linear-gradient(45deg, #00ff88, #00aaff));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 6px rgba(0,255,136,0.4));
}
.brand-word { display: none; }

.search-bar {
  flex: 1;
  min-width: 0;
}

.right-cluster {
  display: flex; align-items: center; gap: 0.4rem;
  flex-shrink: 0;
}
.right-divider {
  width: 1px;
  height: 1.1rem;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
}
/* The contextual action pill only exists on some pages — don't leave a
   floating divider with nothing to its left when it's absent. */
.right-cluster:not(:has(.ctx-btn)) .right-divider {
  display: none;
}

@media (min-width: 640px) {
  .top-nav {
    padding: 0.45rem var(--page-gutter, 1rem);
    height: var(--nav-top-height-md, 3.5rem);
    gap: 0.75rem;
  }
  .brand-word { display: inline; }
  .brand-divider { display: block; }
  .search-bar { max-width: 32rem; margin: 0 auto; }
}

@media (min-width: 1024px) {
  .top-nav { padding: 0.5rem var(--page-gutter, 1.5rem); height: var(--nav-top-height-lg, 3.75rem); gap: 1rem; }
  .search-bar { max-width: 36rem; }
}

@media (min-width: 1536px) {
  .top-nav { padding: 0.5rem 2rem; }
  .search-bar { max-width: 44rem; }
}
</style>
