<script setup lang="ts">
import type { Friend } from '@/stores/FriendsStore'

const props = defineProps<{
  friends: Friend[]
}>()

const perfColor = (pct: number | undefined): string => {
  if (!pct) return 'var(--text-gray)'
  return pct >= 0 ? 'var(--success-green)' : 'var(--error-red)'
}
</script>

<template>
  <div class="contacts-rail">
    <div v-if="!friends?.length" class="empty">No contacts.</div>

    <NuxtLink
      v-for="f in friends"
      :key="f.id"
      :to="`/profile/${f.id}`"
      class="contact-card"
    >
      <div class="contact-avatar-wrap">
        <img :src="f.image" :alt="f.name" class="contact-avatar" />
        <span class="status-dot" :class="{ online: f.online }" />
      </div>

      <div class="contact-info">
        <div class="contact-name">{{ f.name }}</div>
        <div class="contact-handle">@{{ f.username }}</div>
        <div
          v-if="f.performance_30d !== undefined"
          class="contact-perf"
          :style="{ color: perfColor(f.performance_30d) }"
        >
          {{ f.performance_30d >= 0 ? '+' : '' }}{{ f.performance_30d.toFixed(1) }}% (30d)
        </div>
      </div>

      <div class="contact-style">{{ f.trading_style?.replace(/_/g, ' ') }}</div>
    </NuxtLink>
  </div>
</template>

<style scoped>
.contacts-rail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.contact-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.contact-card:hover {
  border-color: var(--border-secondary);
  background: rgba(255,255,255,0.03);
}

.contact-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.contact-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--border-secondary);
}

.status-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
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

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-white);
}

.contact-handle {
  font-size: 0.7rem;
  color: var(--text-gray);
}

.contact-perf {
  font-size: 0.7rem;
  font-weight: 600;
}

.contact-style {
  font-size: 0.62rem;
  color: var(--text-gray);
  text-transform: capitalize;
  text-align: right;
}
</style>
