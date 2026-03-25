<script setup lang="ts">
const props = defineProps<{
  communities: any[]
}>()

const categoryColor = (cat: string): string => {
  const map: Record<string, string> = {
    crypto: 'var(--asset-btc)',
    stocks: 'var(--primary-blue)',
    forex: 'var(--warning-orange)',
    macro: 'var(--text-gray)',
    defi: 'var(--asset-sol)',
  }
  return map[cat] ?? 'var(--text-gray)'
}

const timeAgo = (ts: string): string => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}
</script>

<template>
  <div class="communities">
    <div v-if="!communities?.length" class="empty">No communities joined yet.</div>

    <NuxtLink
      v-for="c in communities"
      :key="c.id"
      :to="`/discussions/${c.id}`"
      class="community-card"
    >
      <div class="comm-header">
        <span class="comm-name">{{ c.name }}</span>
        <span class="comm-cat" :style="{ color: categoryColor(c.category) }">{{ c.category }}</span>
      </div>

      <p class="comm-last">{{ c.last_message?.text }}</p>

      <div class="comm-footer">
        <span class="comm-members">{{ c.members?.length }} members</span>
        <span class="comm-msgs">{{ c.message_count }} messages</span>
        <span class="comm-time">{{ timeAgo(c.last_message?.timestamp) }} ago</span>
        <span v-if="c.unread_count > 0" class="unread-badge">{{ c.unread_count }}</span>
      </div>
    </NuxtLink>
  </div>
</template>

<style scoped>
.communities {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.community-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  transition: border-color var(--transition-fast);
}

.community-card:hover {
  border-color: var(--border-accent);
}

.comm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comm-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-white);
}

.comm-cat {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.comm-last {
  font-size: 0.75rem;
  color: var(--text-gray);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comm-footer {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 0.65rem;
  color: var(--text-gray);
  align-items: center;
}

.comm-time { margin-left: auto; }

.unread-badge {
  background: var(--primary-green);
  color: #000;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
}
</style>
