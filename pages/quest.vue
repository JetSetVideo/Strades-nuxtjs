<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useTrackingStore } from '@/stores/tracking'

const usersStore = useUsersStore()
const trackingStore = useTrackingStore()

const currentUser = computed(() => usersStore.currentUser)
const achievements = computed(() => currentUser.value?.achievements || [])
const interactions = ref([])

onMounted(async () => {
  await trackingStore.initializeStore()
  if (currentUser.value?.id) {
    interactions.value = trackingStore.getUserInteractions(currentUser.value.id) || []
  } else {
    interactions.value = []
  }
})

const getProgress = (achievement) => {
  // Example logic: count specific interactions for progress
  // Assume each achievement has a 'required_count' and 'type'
  const type = achievement.type || 'general' // placeholder
  const required = achievement.required_count || 10
  const count = interactions.value.filter(i => i.event_type === type).length
  return Math.min(100, (count / required) * 100)
}

const isUnlocked = (achievement) => !!achievement.unlocked_date
</script>

<template>
  <div class="quest-page">
    <h1>Quests and Achievements</h1>
    
    <div v-for="ach in achievements" :key="ach.id" class="achievement-card">
      <h3>{{ ach.name }}</h3>
      <p>{{ ach.description }}</p>
      <div class="progress-bar">
        <div :style="{ width: `${getProgress(ach)}%` }"></div>
      </div>
      <p v-if="isUnlocked(ach)">Unlocked on {{ ach.unlocked_date }}</p>
      <p v-else>Progress: {{ getProgress(ach).toFixed(0) }}%</p>
    </div>
  </div>
</template>

<style scoped>
.achievement-card {
  background: var(--card-bg);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
}

.progress-bar {
  height: 10px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-bar > div {
  height: 100%;
  background: var(--primary-gradient);
  transition: width 0.3s;
}
</style>
