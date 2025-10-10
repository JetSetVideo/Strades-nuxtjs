<script setup lang="ts">
const props = defineProps<{
  profile: {
    id: string
    name: string
    avatar_url?: string
    pnl?: number
    traits?: string[]
  }
}>()

const getAvatarUrl = () => {
  return props.profile.avatar_url || '/avatars/Ellipse5.png'
}

const pnlColor = (pnl: number | undefined) => {
  if (!pnl) return 'var(--text-gray)'
  return pnl >= 0 ? 'var(--success-green)' : 'var(--error-red)'
}
</script>

<template>
  <div class="avatar-card">
    <div class="avatar-image-container">
      <img :src="getAvatarUrl()" :alt="profile.name" class="avatar-image" />
    </div>
    <div class="avatar-info">
      <div class="avatar-name">{{ profile.name }}</div>
      <div v-if="profile.pnl !== undefined" class="avatar-pnl" :style="{ color: pnlColor(profile.pnl) }">
        {{ profile.pnl >= 0 ? '+' : '' }}{{ profile.pnl.toFixed(2) }}%
      </div>
      <div v-if="profile.traits?.length" class="avatar-traits">
        <span v-for="trait in profile.traits.slice(0, 2)" :key="trait" class="trait-tag">{{ trait }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  transition: all var(--transition-fast);
}

.avatar-card:hover {
  border-color: var(--border-accent);
  box-shadow: var(--shadow-accent);
}

.avatar-image-container {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border-accent);
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.avatar-name {
  font-weight: 600;
  color: var(--text-white);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-pnl {
  font-size: 12px;
  font-weight: 600;
}

.avatar-traits {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.trait-tag {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-secondary);
  border-radius: 999px;
  padding: 2px 6px;
  color: var(--text-light-gray);
}
</style>

