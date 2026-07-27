<script setup lang="ts">
import { computed } from 'vue'
import type { SearchHistory, SearchSuggestion, Notification } from '@/types'
import NavigationTop from '~/components/Navigation/Top.vue'
import NavigationBar from '~/components/Navigation/Bar.vue'
import NotificationButton from '~/components/Button/Notification.vue'

const { data: searchHistory } = await useAsyncData<SearchHistory[]>(
  'searchHistory',
  () => useLocalJson<SearchHistory[]>('search/history.json'),
  { default: () => [] }
)
const { data: searchSuggestions } = await useAsyncData<SearchSuggestion[]>(
  'searchSuggestions',
  () => useLocalJson<SearchSuggestion[]>('search/suggestions.json'),
  { default: () => [] }
)
const { data: notifications } = await useAsyncData<Notification[]>(
  'notifications',
  () => useLocalJson<Notification[]>('social/notifications.json'),
  { default: () => [] }
)

const unreadCount = computed(() => {
  if (!Array.isArray(notifications.value)) return 0
  return notifications.value.filter(n => !n.read).length
})
</script>

<template>
  <div class="app-shell">
    <NavigationTop :search-history="searchHistory" :search-suggestions="searchSuggestions">
      <NotificationButton :unread-count="unreadCount" />
    </NavigationTop>
    <main class="page-frame">
      <slot />
    </main>
    <NavigationBar />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--bg-primary, #000);
  color: var(--text-white, #fff);
  position: relative;
}

/* Ambient depth field: two very faint color pools behind all content
   pull the eye toward the top (fresh data) and give the page a sense
   of volume instead of a flat black sheet. */
.app-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 80% 45% at 18% -8%, rgba(0, 255, 136, 0.05), transparent 60%),
    radial-gradient(ellipse 70% 40% at 88% 4%, rgba(0, 170, 255, 0.05), transparent 60%),
    radial-gradient(ellipse 100% 55% at 50% 108%, rgba(0, 0, 0, 0.55), transparent 62%);
}

.app-shell > * { position: relative; z-index: 1; }

.page-frame {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  /* Content starts exactly one page-gap below the fixed top bar and
     ends one page-gap above the fixed bottom bar (incl. iOS safe area). */
  padding:
    calc(var(--nav-top-height, 3.25rem) + var(--page-gap, 0.5rem))
    var(--page-gutter)
    calc(var(--nav-bottom-height, 4.1rem) + var(--page-gap, 0.5rem) + env(safe-area-inset-bottom, 0px))
    var(--page-gutter);
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  line-height: 1.45;
  transition: padding var(--app-animation-speed, 0.3s) ease;
  box-sizing: border-box;
}

@media (min-width: 640px) {
  .page-frame {
    padding-top: calc(var(--nav-top-height-md, 3.5rem) + var(--page-gap, 0.6rem));
  }
}

@media (min-width: 768px) {
  .page-frame {
    padding-bottom: calc(var(--nav-bottom-height-md, 4.4rem) + var(--page-gap, 0.6rem) + env(safe-area-inset-bottom, 0px));
  }
}

@media (min-width: 1024px) {
  .page-frame {
    max-width: 1440px;
    padding-top: calc(var(--nav-top-height-lg, 3.75rem) + var(--page-gap, 0.75rem));
  }
}
@media (min-width: 1536px) {
  .page-frame { max-width: 1680px; }
}
</style>
