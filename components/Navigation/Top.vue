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
    <button
      type="button"
      class="brand-btn"
      :class="{ 'is-covered': drawerOpen }"
      :aria-label="drawerOpen ? 'Close menu' : 'Open menu'"
      title="Menu: trade, strategies, profile, settings, help"
      :aria-expanded="drawerOpen"
      @mouseenter="playHover"
      @click="toggleDrawer(); playClick()"
    >
      <span class="brand-logo" aria-hidden="true">
        <img src="/logos/strades-mark.png" alt="" />
      </span>
      <span class="brand-word">STRADES</span>
    </button>

    <SearchBar
      class="search-bar"
      :search-history="searchHistory"
      :search-suggestions="searchSuggestions"
    />

    <div class="right-cluster">
      <NavigationTopContextActions />
      <span class="right-divider" aria-hidden="true" />
      <NavigationTopGmtClock />
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
  box-sizing: border-box;
  height: var(--nav-top-height, 3.25rem);
  padding-block: 0.35rem;
  padding-inline: var(--page-gutter, 0.75rem);
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

/* Brand mark and menu trigger are one control. */
.brand-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  height: 30px;
  padding: 0 0.55rem 0 0.35rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 6px);
  color: #fff;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
}
.brand-btn:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.brand-btn.is-covered { visibility: hidden; }
.brand-word {
  display: none;
  font-weight: 700;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
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
.brand-word { display: none; }

.search-bar {
  flex: 1;
  min-width: 0;
}

.right-cluster {
  display: flex; align-items: center; gap: 0.4rem;
  flex-shrink: 0;
}
/* The drawer anchor is only a teleport host. Kept in flow, the nav gap
   leaves a strip between the cluster and the page edge. */
.top-nav :deep(.drawer-wrapper) {
  position: absolute;
  width: 0;
  height: 0;
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
    padding-block: 0.45rem;
    height: var(--nav-top-height-md, 3.5rem);
    gap: 0.75rem;
  }
  .brand-word { display: inline; }
  .search-bar { max-width: 32rem; margin: 0 auto; }
}

@media (min-width: 1024px) {
  .top-nav {
    padding-block: 0.5rem;
    padding-inline: max(var(--page-gutter), calc((100% - 1440px) / 2 + var(--page-gutter)));
    height: var(--nav-top-height-lg, 3.75rem);
    gap: 1rem;
  }
  .search-bar { max-width: 36rem; }
}

@media (min-width: 1536px) {
  .top-nav {
    padding-inline: max(var(--page-gutter), calc((100% - 1680px) / 2 + var(--page-gutter)));
  }
  .search-bar { max-width: 44rem; }
}
</style>
