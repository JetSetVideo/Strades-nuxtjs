<script setup lang="ts">
import type { ExperienceLevel } from '@/stores/users'

const props = defineProps<{
  experience: ExperienceLevel
}>()

const progressPct = computed(() =>
  Math.round((props.experience.xp / props.experience.xp_next_level) * 100)
)

const rarityColor = (badge: string): string => {
  if (badge.includes('legend') || badge === 'btc_og') return '#ffd700'
  if (badge.includes('master') || badge === 'influencer') return '#c084fc'
  if (badge.includes('pro') || badge.includes('expert')) return '#60a5fa'
  return 'var(--text-light-gray)'
}
</script>

<template>
  <div class="exp-card">
    <div class="exp-top">
      <span class="level">Lv.{{ experience.level }}</span>
      <span class="title">{{ experience.title }}</span>
      <span class="xp">{{ experience.xp.toLocaleString() }} / {{ experience.xp_next_level.toLocaleString() }} XP</span>
    </div>

    <!-- XP progress bar -->
    <div class="xp-track">
      <div class="xp-fill" :style="{ width: `${progressPct}%` }" />
      <span class="xp-label">{{ progressPct }}%</span>
    </div>

    <!-- Badges -->
    <div class="badges">
      <span
        v-for="b in experience.badges"
        :key="b"
        class="badge"
        :style="{ color: rarityColor(b) }"
      >{{ b.replace(/_/g, ' ') }}</span>
    </div>
  </div>
</template>

<style scoped>
.exp-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.exp-top {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.level {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--primary-green);
}

.title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-white);
  flex: 1;
}

.xp {
  font-size: 0.7rem;
  color: var(--text-gray);
}

.xp-track {
  position: relative;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  overflow: visible;
}

.xp-fill {
  height: 100%;
  background: var(--primary-gradient);
  border-radius: 999px;
  transition: width 0.8s ease;
}

.xp-label {
  position: absolute;
  right: 0;
  top: -16px;
  font-size: 0.6rem;
  color: var(--text-gray);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  text-transform: capitalize;
}
</style>
