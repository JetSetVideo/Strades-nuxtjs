<script setup lang="ts">
const { playHover, playClick } = useNavSound()
</script>

<template>
  <NuxtLink
    to="/quest"
    class="nav-icon-btn"
    title="Daily Quests"
    @mouseenter="playHover"
    @click="playClick"
  >
    <!-- Crosshair / target — quests are objectives to aim for -->
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8"  stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"  opacity="0.75"/>
      <line x1="12" y1="2"  x2="12" y2="6"  stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="2"  y1="12" x2="6"  y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
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
  box-shadow: 0 0 0.5rem rgba(0, 255, 136, 0.15);
}
</style>
