<script setup lang="ts">
import UIPill from '@/components/UI/Pill.vue'

interface ConversationUser {
  id: string
  username?: string
  avatar_url?: string
}

interface Conversation {
  id: string
  participants: string[]
  last_message_at: string
  message_count: number
  metadata?: { topic?: string }
  [key: string]: any
}

const props = defineProps<{
  conversations: Conversation[]
  currentUserId: string
  getUser: (id: string) => ConversationUser | undefined | null
}>()

defineEmits<{ (e: 'open', conversationId: string): void }>()

const getOther = (c: Conversation) => c.participants.find(p => p !== props.currentUserId) ?? ''
const unread = (c: Conversation) => c[`unread_count_${props.currentUserId}`] || 0
const formatTime = (ts: string) => {
  const d = new Date(ts)
  const now = new Date()
  const hours = (now.getTime() - d.getTime()) / 3_600_000
  if (hours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (hours < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
</script>

<template>
  <ul class="conv-list">
    <li
      v-for="c in conversations"
      :key="c.id"
      class="conv-item"
      @click="$emit('open', c.id)"
    >
      <img
        :src="getUser(getOther(c))?.avatar_url || '/avatars/Ellipse5.png'"
        :alt="getUser(getOther(c))?.username || 'User'"
        class="conv-avatar"
      />
      <div class="conv-body">
        <div class="conv-head">
          <strong>{{ getUser(getOther(c))?.username || 'Unknown' }}</strong>
          <span class="time">{{ formatTime(c.last_message_at) }}</span>
        </div>
        <div class="conv-meta">
          <span class="topic">{{ c.metadata?.topic || 'General discussion' }}</span>
          <UIPill v-if="unread(c) > 0" tone="accent">{{ unread(c) }}</UIPill>
          <span v-else class="count">{{ c.message_count }} msgs</span>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.conv-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.conv-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 0.6rem;
  padding: 0.5rem;
  border-radius: var(--app-border-radius, 6px);
  border: 1px solid rgba(255,255,255,0.04);
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: all 0.18s ease;
  min-width: 0;
}
.conv-item:hover {
  background: rgba(0,255,136,0.04);
  border-color: rgba(0,255,136,0.25);
}
.conv-avatar {
  width: 36px; height: 36px;
  border-radius: 50%; object-fit: cover;
  border: 1px solid rgba(255,255,255,0.1);
}
.conv-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; overflow: hidden; }
.conv-head {
  display: flex; justify-content: space-between;
  gap: 0.4rem; align-items: baseline; min-width: 0;
}
.conv-head strong {
  font-size: 0.88rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.time { font-size: 0.62rem; color: rgba(255,255,255,0.45); flex-shrink: 0; }
.conv-meta {
  display: flex; justify-content: space-between;
  gap: 0.4rem; align-items: center;
  min-width: 0;
}
.topic {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
}
.count {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
