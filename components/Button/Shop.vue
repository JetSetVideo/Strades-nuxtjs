<script setup lang="ts">
const { playHover, playClick } = useNavSound()
</script>

<template>
  <NuxtLink
    to="/Shop"
    class="nav-icon-btn"
    title="Shop"
    @mouseenter="playHover"
    @click="playClick"
  >
    <!-- Shopping bag icon -->
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="3" y1="6" x2="21" y2="6"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M16 10a4 4 0 0 1-8 0"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </NuxtLink>
</template>

<style scoped>
.nav-icon-btn {
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
  width:  1.1rem;
  height: 1.1rem;
}

.nav-icon-btn:hover {
  color: var(--primary-green, #00ff88);
  border-color: rgba(0, 255, 136, 0.35);
  background: rgba(0, 255, 136, 0.08);
  transform: scale(1.08);
  box-shadow: 0 0 0.5rem rgba(0, 255, 136, 0.12);
}

.nav-icon-btn:active {
  transform: scale(0.94);
  transition-duration: 0.08s;
}

.router-link-active.nav-icon-btn {
  color: var(--primary-green, #00ff88);
  background: rgba(0, 255, 136, 0.12);
  border-color: rgba(0, 255, 136, 0.4);
}
</style>
