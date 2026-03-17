<script setup lang="ts">
import type { PropType } from 'vue';
import type { SearchHistory, SearchSuggestion } from '@/types';
import SearchBar from '~/components/SearchBar.vue';
import WalletIcon from '~/components/Navigation/Icons/WalletIcon.vue';
import PricesIcon from '~/components/Navigation/Icons/PricesIcon.vue';
import NewsGlobeIcon from '~/components/Navigation/Icons/NewsGlobeIcon.vue';
import { usePrefetchStore } from '~/stores/prefetch'

defineProps({
  searchHistory: {
    type: Array as PropType<SearchHistory[]>,
    default: () => [],
  },
  searchSuggestions: {
    type: Array as PropType<SearchSuggestion[]>,
    default: () => [],
  },
});

const prefetchStore = usePrefetchStore()

// For Phase 7: Predictive UX
const handleHover = (route: string) => {
  // A simple timeout could be used here to measure 200ms
  prefetchStore.prefetchRoute(route)
}
</script>
<template>
 <header>
    <div class="logo">Strades</div>
    
    <SearchBar class="search-bar" :search-history="searchHistory" :search-suggestions="searchSuggestions" />
    
    <nav class="living-icons">
      <NuxtLink to="/prices" class="nav-item" @mouseenter="handleHover('prices')">
        <PricesIcon :size="24" />
      </NuxtLink>
      <NuxtLink to="/news" class="nav-item" @mouseenter="handleHover('news')">
        <NewsGlobeIcon :size="24" />
      </NuxtLink>
      <NuxtLink to="/wallet" class="nav-item" @mouseenter="handleHover('wallet')">
        <WalletIcon :size="24" />
      </NuxtLink>
    </nav>
    
    <slot></slot>
  </header>
</template>

<style scoped>
header {
  display: flex;
  position: fixed;
  top: 0;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 3.5rem; /* responsive height */
  padding: 0.5rem 1rem;
  background: linear-gradient(270deg, rgba(17,17,17,0.9) 0%, rgba(33, 33, 33, 0.7) 50.06%, rgba(17,17,17,0.9) 100%);
  backdrop-filter: blur(var(--app-glass-blur, 10px));
  box-shadow: 0px 0.25rem 0.75rem rgba(0, 0, 0, 0.25);
  color: #ffffff;
  z-index: 50;
  transition: all var(--app-animation-speed, 0.5s) ease;
}

.logo {
  font-family: 'Ethnocentric', sans-serif;
  font-weight: bold;
  font-size: 1.2rem;
  display: none; /* hidden on very small screens */
}

.search-bar {
  flex: 1;
  max-width: 25rem;
  margin: 0 0.5rem;
}

.living-icons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--app-border-radius, 0.5rem);
  transition: background 0.3s ease, border-radius var(--app-animation-speed, 0.5s) ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Responsive adjustments */
@media (min-width: 768px) {
  header {
    padding: 0.5rem 2rem;
    height: 4rem;
  }
  .logo {
    display: block;
  }
  .search-bar {
    margin: 0 1rem;
  }
  .living-icons {
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  header {
    padding: 1rem 5rem;
    height: 5rem;
  }
  .living-icons {
    gap: 2.5rem;
  }
  .nav-item {
    width: 3rem;
    height: 3rem;
  }
}
</style>
  