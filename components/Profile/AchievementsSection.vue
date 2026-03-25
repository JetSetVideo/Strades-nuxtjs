<script setup lang="ts">
import type { Achievement } from '@/stores/users'

const props = defineProps<{
  achievements: Achievement[]
}>()

const rarityClass = (r: string) => `rarity-${r}`

const rarityLabel = (r: string): string => {
  const map: Record<string, string> = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡'
  }
  return map[r] ?? '⚪'
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
</script>

<template>
  <div class="achievements-list">
    <div v-if="!achievements?.length" class="empty">No achievements yet.</div>

    <div
      v-for="a in achievements"
      :key="a.id"
      class="ach-card"
      :class="rarityClass(a.rarity)"
    >
      <div class="ach-icon">{{ a.icon }}</div>
      <div class="ach-info">
        <div class="ach-name">{{ a.name }} <span class="rarity-dot">{{ rarityLabel(a.rarity) }}</span></div>
        <div class="ach-desc">{{ a.description }}</div>
        <div class="ach-date">{{ formatDate(a.unlocked_date) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.achievements-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.ach-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

/* Rarity border accents */
.rarity-common    { border-left: 3px solid #888; }
.rarity-uncommon  { border-left: 3px solid var(--success-green); }
.rarity-rare      { border-left: 3px solid var(--primary-blue); }
.rarity-epic      { border-left: 3px solid #c084fc; }
.rarity-legendary { border-left: 3px solid #ffd700; }

.ach-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.ach-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ach-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-white);
}

.ach-desc {
  font-size: 0.72rem;
  color: var(--text-light-gray);
}

.ach-date {
  font-size: 0.65rem;
  color: var(--text-gray);
}
</style>
