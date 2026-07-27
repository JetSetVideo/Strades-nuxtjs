<script setup lang="ts">
const { playHover, playClick } = useNavSound()
</script>

<template>
  <NuxtLink
    to="/leaderboard"
    class="nav-icon-btn"
    title="Leaderboard"
    @mouseenter="playHover"
    @click="playClick"
  >
    <!-- Bar-chart podium icon -->
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <!-- Bars: left (3rd), centre (1st), right (2nd) -->
      <rect x="3"  y="13" width="4.5" height="8"  rx="1" fill="currentColor" opacity="0.65"/>
      <rect x="9.75" y="7" width="4.5" height="14" rx="1" fill="currentColor"/>
      <rect x="16.5" y="10" width="4.5" height="11" rx="1" fill="currentColor" opacity="0.65"/>
      <!-- Star above the tallest bar -->
      <path d="M12 1.5l.9 2.6h2.8l-2.3 1.7.9 2.7-2.3-1.7-2.3 1.7.9-2.7L8.3 4.1h2.8z"
            fill="currentColor" opacity="0.9"/>
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
  color: #f5a623;
  border-color: rgba(245, 166, 35, 0.4);
  background: rgba(245, 166, 35, 0.08);
  transform: scale(1.08);
  box-shadow: 0 0 0.5rem rgba(245, 166, 35, 0.12);
}

.nav-icon-btn:active {
  transform: scale(0.94);
  transition-duration: 0.08s;
}

.router-link-active.nav-icon-btn {
  color: #f5a623;
  background: rgba(245, 166, 35, 0.12);
  border-color: rgba(245, 166, 35, 0.4);
}
</style>
