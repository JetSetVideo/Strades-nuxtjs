<script setup lang="ts">
import { useUsersStore } from '@/stores/users'

const usersStore = useUsersStore()

// Wait for the store to hydrate then redirect to the current user's profile
onMounted(async () => {
  await usersStore.initializeStore()
  const id = usersStore.currentUser?.id
  if (id) {
    await navigateTo(`/profile/${id}`, { replace: true })
  }
})
</script>

<template>
  <div class="redirect-loader">
    <div class="spinner" />
    <p>Loading your profile…</p>
  </div>
</template>

<style scoped>
.redirect-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
  color: var(--text-gray);
  font-size: 0.9rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-secondary);
  border-top-color: var(--primary-green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
