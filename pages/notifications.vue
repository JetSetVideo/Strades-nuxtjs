<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Notification } from '@/types'
import { useLocalJson } from '@/composables/useLocalJson'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

definePageMeta({ title: 'Notifications', layout: 'default' })

const { data: notifications, pending } = await useAsyncData<Notification[]>(
  'notifications',
  () => useLocalJson<Notification[]>('social/notifications.json'),
  { default: () => [] }
)

const unreadCount = computed(() => notifications.value?.filter(n => !n.read).length ?? 0)
const totalCount = computed(() => notifications.value?.length ?? 0)

onMounted(() => {
  if (notifications.value) notifications.value.forEach(n => { n.read = true })
})

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="notif-page">
    <UIPageHeader title="Notifications" :subtitle="`${unreadCount} unread of ${totalCount}`">
      <template #actions>
        <UIPill v-if="unreadCount > 0" tone="warning" show-dot>{{ unreadCount }} NEW</UIPill>
        <UIPill v-else tone="neutral" show-dot>ALL READ</UIPill>
      </template>
    </UIPageHeader>

    <div v-if="pending" class="loading">
      <AppSkeletonLoader height="60px" />
      <AppSkeletonLoader height="60px" />
      <AppSkeletonLoader height="60px" />
    </div>

    <UIEmptyState v-else-if="totalCount === 0" icon="◔" title="No notifications" message="You're all caught up." />

    <UICard v-else padding="tight">
      <ul class="list">
        <li v-for="n in notifications" :key="n.id" :class="{ unread: !n.read }">
          <span class="dot" :class="{ on: !n.read }" />
          <div class="body">
            <p>{{ n.message }}</p>
            <span class="time">{{ formatTime(n.timestamp) }}</span>
          </div>
        </li>
      </ul>
    </UICard>
  </div>
</template>

<style scoped>
.notif-page { display: flex; flex-direction: column; gap: 0.75rem; max-width: 760px; margin: 0 auto; }
.loading { display: flex; flex-direction: column; gap: 0.5rem; }

.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
.list li {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.list li:last-child { border-bottom: none; }

.dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,0.15);
  margin-top: 7px;
  justify-self: center;
}
.dot.on { background: var(--primary-green, #00ff88); box-shadow: 0 0 6px var(--primary-green, #00ff88); }

.body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.body p { margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.9); line-height: 1.4; }
.time { font-size: 0.65rem; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; }
.unread .body p { color: #fff; font-weight: 500; }
</style>
