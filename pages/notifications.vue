<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Notification } from '@/types';
import { useLocalJson } from '@/composables/useLocalJson';

const { data: notifications, pending } = await useAsyncData<Notification[]>('notifications', () => useLocalJson<Notification[]>('social/notifications.json'), { default: () => [] });
const unreadCount = ref(0);

onMounted(() => {
  if (notifications.value) {
    unreadCount.value = notifications.value.filter(n => !n.read).length;
    // For development, we can simulate marking as read.
    // In a real app, this would be a state change persisted to a backend or localStorage.
    notifications.value.forEach(n => n.read = true);
    unreadCount.value = 0; // Reset after opening
  }
});
</script>

<template>
  <div class="notifications-page">
    <h1>Notifications</h1>
    <div v-if="pending">Loading...</div>
    <ul v-else-if="notifications">
      <li
        v-for="notification in notifications"
        :key="notification.id"
        :class="{ read: notification.read }"
      >
        <p>{{ notification.message }}</p>
        <span>{{ new Date(notification.timestamp).toLocaleString() }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.read {
  color: grey;
}
</style>