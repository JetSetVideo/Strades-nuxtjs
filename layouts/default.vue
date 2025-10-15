<script setup lang="ts">
import { ref } from 'vue';
import type { SearchHistory, SearchSuggestion, Notification } from '@/types';
import { useLocalJson } from '@/composables/useLocalJson';
import NavigationTop from '~/components/Navigation/Top.vue';
import NavigationBar from '~/components/Navigation/Bar.vue';
import NotificationButton from '~/components/Button/Notification.vue';

const { data: searchHistory } = useLocalJson<SearchHistory[]>('search/history.json');
const { data: searchSuggestions } = useLocalJson<SearchSuggestion[]>('search/suggestions.json');
const { data: notifications } = useLocalJson<Notification[]>('social/notifications.json');

const unreadCount = ref(0);
if (notifications.value) {
  unreadCount.value = notifications.value.filter(n => !n.read).length;
}
</script>

<template>
  <NavigationTop :search-history="searchHistory" :search-suggestions="searchSuggestions">
    <NotificationButton :unread-count="unreadCount" />
  </NavigationTop>
  <div class="bg-[#0e0e0f]">
    <div class="defaultLayout font-[kanit]">
      <slot />
    </div>
  </div>
  <NavigationBar />
</template>
<style scoped>
.defaultLayout {
  /* Layout and Positioning */
  position: relative; /* Establishes a positioning context */
  top: 2.5rem; /* Starts 2rem down from the top */
  width: 100%; /* Takes full width of the viewport */
  min-height: 100vh; /* Minimum height of 100% of the viewport height */
  align-items: center; /* Center the content vertically */
  align-content: center; /* Center the content vertically */
  /* Spacing */
  margin-left: auto; /* Center the layout with equal margins on both sides */
  margin-right: auto;
  margin-bottom: 150px;
  padding: 1rem; /* Optional padding inside the layout */

  /* Background and Colors */
  /* background-color: rgba(20,20,20,0.5);  */
  color: white; /* White text color */

  /* Typography */
  font-family: "Arial", sans-serif; /* Example font */
  line-height: 1.6; /* Spacing between lines */
  text-align: justify; /* Justified text for better readability */

  /* Box Model */
  box-sizing: border-box; /* Include padding and border in the width and height */
  border: 1px solid #444; /* Optional border */

  /* Visual Effects */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
  border-radius: 5px; /* Rounded corners */

  /* Responsiveness */
  max-width: 1200px; /* Maximum width to ensure content readability on large screens */
  @media (max-width: 768px) {
    padding: 0.5rem; /* Smaller padding on smaller screens */
  }

  /* Transitions */
  transition: all 0.3s ease; /* Smooth transition for any changes */
}
</style>
