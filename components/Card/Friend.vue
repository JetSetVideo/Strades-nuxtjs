<!-- Card/Friend.vue — Compact friend card with live perf data, links to /profile/:id -->
<script setup lang="ts">
import type { Friend } from '@/stores/FriendsStore'

const props = defineProps<{
  friend: Friend
}>()

const perfColor = (pct: number | undefined): string => {
  if (!pct) return 'var(--text-gray)'
  return pct >= 0 ? 'var(--success-green)' : 'var(--error-red)'
}
</script>

<template>
  <NuxtLink :to="`/profile/${friend.id}`" class="friend-card">
    <div class="portrait-wrap">
      <UAvatar :src="friend.image" :alt="friend.name" size="sm" />
      <span class="status-dot" :class="{ online: friend.online }" />
    </div>

    <div class="friend-info">
      <div class="friend-name">{{ friend.name }}</div>
      <div class="friend-handle">@{{ friend.username }}</div>
      <div
        v-if="friend.performance_30d !== undefined"
        class="friend-perf"
        :style="{ color: perfColor(friend.performance_30d) }"
      >
        {{ friend.performance_30d >= 0 ? '+' : '' }}{{ friend.performance_30d.toFixed(1) }}% (30d)
      </div>
    </div>

    <div class="friend-meta">
      <span class="friend-style">{{ friend.trading_style?.replace(/_/g, ' ') }}</span>
      <span class="friend-winrate" v-if="friend.win_rate">{{ friend.win_rate.toFixed(0) }}% WR</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.friend-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.friend-card:hover {
  border-color: var(--border-accent);
  background: rgba(255,255,255,0.06);
}

.portrait-wrap {
  position: relative;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--bg-secondary);
  background: var(--text-gray);
}

.status-dot.online {
  background: var(--success-green);
  box-shadow: 0 0 4px var(--success-green);
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-handle {
  font-size: 0.7rem;
  color: var(--text-gray);
}

.friend-perf {
  font-size: 0.7rem;
  font-weight: 600;
}

.friend-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 0.62rem;
  color: var(--text-gray);
  text-transform: capitalize;
  flex-shrink: 0;
}
</style>
