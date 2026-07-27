<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({ unreadCount: { type: Number, default: 0 } })
const { playHover, playClick } = useNavSound()

const badgeLabel = computed(() => props.unreadCount > 99 ? '99+' : String(props.unreadCount))
</script>

<template>
  <NuxtLink
    to="/notifications"
    class="nav-icon-btn"
    title="Notifications"
    @mouseenter="playHover"
    @click="playClick"
  >
    <!-- Bell icon -->
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <!-- Bell body -->
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Clapper -->
      <path d="M13.73 21a2 2 0 0 1-3.46 0"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>

    <!-- Unread badge -->
    <span
      v-if="unreadCount > 0"
      class="badge"
      :aria-label="`${unreadCount} notifications`"
    >
      {{ badgeLabel }}
    </span>
  </NuxtLink>
</template>

<style scoped>
.nav-icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width:  var(--nav-icon-btn-size, 2rem);
  height: var(--nav-icon-btn-size, 2rem);
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  flex-shrink: 0;
  transition: all var(--transition-fast, 0.2s ease);
}

.nav-icon-btn svg {
  width:  1.15rem;
  height: 1.15rem;
}

.nav-icon-btn:hover {
  color: var(--primary-blue, #00aaff);
  border-color: rgba(0, 170, 255, 0.35);
  background: rgba(0, 170, 255, 0.08);
  transform: scale(1.08);
  box-shadow: 0 0 0.5rem rgba(0, 170, 255, 0.12);
}

.nav-icon-btn:active {
  transform: scale(0.94);
  transition-duration: 0.08s;
}

.router-link-active.nav-icon-btn {
  color: var(--primary-blue, #00aaff);
  background: rgba(0, 170, 255, 0.1);
  border-color: rgba(0, 170, 255, 0.4);
}

/* Badge */
.badge {
  position: absolute;
  top:   -0.22rem;
  right: -0.28rem;
  background: #ff4444;
  color: #fff;
  font-size: 0.48rem;
  font-weight: 700;
  font-family: var(--font-family-primary, 'Poppins'), sans-serif;
  line-height: 1;
  min-width: 0.95rem;
  height: 0.95rem;
  padding: 0 0.18rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1.5px #0e0e0f;
}
</style>
