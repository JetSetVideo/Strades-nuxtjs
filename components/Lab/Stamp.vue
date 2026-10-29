<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppearanceStore } from '~/stores/appearance'
import { useUsersStore } from '~/stores/users'

const appearance = useAppearanceStore()
const users = useUsersStore()

const line = ref('reading this machine…')
let onResize: (() => void) | null = null

function readStamp() {
  const nav = navigator
  const memory = (nav as Navigator & { deviceMemory?: number }).deviceMemory
  const who = users.currentUser?.username || users.currentUser?.id || 'demo'
  const parts = [
    who,
    appearance.resolvedTimezone || 'UTC',
    `${window.innerWidth}×${window.innerHeight}`,
    nav.hardwareConcurrency ? `${nav.hardwareConcurrency} cores` : '',
    memory ? `${memory} GB` : '',
    nav.platform || '',
  ]
  line.value = parts.filter(Boolean).join(' · ')
}

onMounted(async () => {
  appearance.hydrate()
  if (!users.currentUser) {
    if (!users.users.length) await users.fetchUsers()
    await users.initializeCurrentUser()
  }
  readStamp()
  onResize = () => readStamp()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  if (onResize) window.removeEventListener('resize', onResize)
})
</script>

<template>
  <p class="stamp" aria-label="This machine">{{ line }}</p>
</template>

<style scoped>
.stamp {
  margin: 0;
  font-size: 0.62rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.55);
  font-variant-numeric: tabular-nums;
}
</style>
