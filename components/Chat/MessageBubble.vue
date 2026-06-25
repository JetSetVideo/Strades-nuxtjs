<script setup lang="ts">
import ChatSharePayload from '~/components/Chat/SharePayload.vue'

interface Reaction { user_id: string; reaction: string }
interface Attachment {
  type: string
  url?: string
  filename?: string
  title?: string
  share_kind?: string
  asset_id?: string
  asset_symbol?: string
  strategy_id?: string
  opinion_vector?: { fiat: number; crypto: number; stocks: number; commodities: number }
}
interface Message {
  id: string
  sender_id: string
  content: string
  timestamp: string
  edited_at?: string | null
  reactions?: Reaction[]
  attachments?: Attachment[]
}

const props = defineProps<{
  message: Message
  isMine: boolean
  reactions: string[]
  avatarUrl?: string
  avatarAlt?: string
}>()

defineEmits<{
  (e: 'react', messageId: string, reaction: string): void
  (e: 'edit', message: Message): void
  (e: 'delete', messageId: string): void
}>()

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const hours = (now.getTime() - d.getTime()) / 3_600_000
  if (hours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (hours < 168) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div :class="['msg', isMine ? 'sent' : 'received']">
    <img
      v-if="!isMine"
      :src="avatarUrl || '/avatars/Ellipse5.png'"
      :alt="avatarAlt || 'User'"
      class="msg-avatar"
    />
    <div class="msg-body">
      <div class="bubble">
        <p v-if="message.content" class="content">{{ message.content }}</p>
        <template v-for="(att, i) in message.attachments ?? []" :key="i">
          <ChatSharePayload
            v-if="att.type === 'share'"
            :attachment="att as any"
          />
          <a
            v-else-if="att.url"
            :href="att.url"
            target="_blank"
            rel="noopener"
            class="file-link"
          >{{ att.filename ?? att.title ?? 'Attachment' }}</a>
        </template>
        <div class="meta">
          <span class="time">{{ formatTime(message.timestamp) }}</span>
          <span v-if="message.edited_at" class="edited">edited</span>
        </div>
      </div>

      <div v-if="message.reactions?.length" class="reactions">
        <span
          v-for="r in message.reactions"
          :key="`${message.id}_${r.user_id}_${r.reaction}`"
          class="reaction-chip"
        >{{ r.reaction }}</span>
      </div>

      <div class="msg-actions">
        <button
          v-for="emo in reactions"
          :key="emo"
          class="react-btn"
          :aria-label="`React ${emo}`"
          @click="$emit('react', message.id, emo)"
        >{{ emo }}</button>
        <span class="spacer" v-if="isMine" />
        <button
          v-if="isMine"
          class="action-btn"
          title="Edit"
          @click="$emit('edit', message)"
        >✎</button>
        <button
          v-if="isMine"
          class="action-btn danger"
          title="Delete"
          @click="$emit('delete', message.id)"
        >✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg {
  display: grid;
  gap: 0.5rem;
  align-items: flex-end;
  min-width: 0;
}
.msg.received { grid-template-columns: 32px minmax(0, 1fr); }
.msg.sent { grid-template-columns: 1fr; justify-items: flex-end; }

.msg-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.msg-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: min(560px, 88%);
  min-width: 0;
}

.bubble {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 0.55rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.msg.sent .bubble {
  background: linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,255,136,0.06));
  border-color: rgba(0,255,136,0.25);
}

.content {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(255,255,255,0.95);
  white-space: pre-wrap;
  word-break: break-word;
}
.file-link {
  display: inline-block;
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: var(--primary-blue, #00aaff);
  text-decoration: none;
}
.file-link:hover { text-decoration: underline; }

.meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.06em;
}
.time { font-variant-numeric: tabular-nums; }
.edited {
  font-style: italic;
  color: rgba(255,255,255,0.35);
}

.reactions {
  display: flex;
  gap: 0.2rem;
  flex-wrap: wrap;
}
.reaction-chip {
  display: inline-flex;
  align-items: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 0.7rem;
}

.msg-actions {
  display: none;
  gap: 0.2rem;
  align-items: center;
}
.msg:hover .msg-actions { display: inline-flex; }
.react-btn,
.action-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.7);
  border-radius: 999px;
  width: 22px; height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0;
  transition: all 0.15s ease;
}
.react-btn:hover, .action-btn:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.action-btn.danger:hover {
  border-color: var(--error-red, #ff4d6a);
  color: var(--error-red, #ff4d6a);
}
.spacer { width: 0.6rem; }
</style>
