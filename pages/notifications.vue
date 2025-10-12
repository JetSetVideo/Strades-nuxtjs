<script setup>
import { ref, onMounted, computed } from 'vue'

// Legacy user notifications (fallback) and preferences from core (if present later)
const notifications = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const userData = await $fetch('/data/Users.json')
    notifications.value = Array.isArray(userData?.notifications) ? userData.notifications : []
  } catch (e) {
    notifications.value = []
  } finally {
    loading.value = false
  }
})

const sortedNotifications = computed(() => {
  return [...notifications.value].sort((a, b) => {
    const ta = new Date(a.timestamp || a.date || 0).getTime()
    const tb = new Date(b.timestamp || b.date || 0).getTime()
    return tb - ta
  })
})

function formatTime(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}
</script>

<template>
  <div class="notifications-page">
    <div class="header">
      <h1>Notifications</h1>
      <p class="subtitle">Chronological activity and alerts from local data</p>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="sortedNotifications.length" class="list">
      <div
        v-for="(n, idx) in sortedNotifications"
        :key="idx"
        class="item"
      >
        <div class="item-main">
          <span class="title">{{ n.title || n.type || 'Notification' }}</span>
          <span class="time">{{ formatTime(n.timestamp || n.date) }}</span>
        </div>
        <div class="desc">{{ n.message || n.description || '' }}</div>
      </div>
    </div>

    <div v-else class="empty">No notifications available.</div>
  </div>
</template>

<style scoped>
.notifications-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: var(--spacing-lg);
}

.header {
  margin-bottom: var(--spacing-lg);
}

.subtitle {
  color: var(--text-gray);
  margin: 0;
}

.loading {
  color: var(--text-gray);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.item {
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.title {
  font-weight: 600;
}

.time {
  color: var(--text-gray);
  font-size: 0.85rem;
}

.desc {
  color: var(--text-light-gray);
}

.empty {
  color: var(--text-gray);
}
</style>