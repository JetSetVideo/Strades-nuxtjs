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

.page-frame {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding:
    calc(3.25rem + 0.5rem)
    var(--page-gutter)
    calc(4rem + 0.5rem)
    var(--page-gutter);
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  line-height: 1.45;
  transition: padding var(--app-animation-speed, 0.3s) ease;
  box-sizing: border-box;
}

@media (min-width: 640px) {
  .page-frame {
    padding-top: calc(3.5rem + 0.5rem);
  }
}

@media (min-width: 1024px) {
  .page-frame {
    max-width: 1440px;
    padding-top: calc(3.75rem + 0.5rem);
  }
}
@media (min-width: 1536px) {
  .page-frame { max-width: 1680px; }
}
</style>
