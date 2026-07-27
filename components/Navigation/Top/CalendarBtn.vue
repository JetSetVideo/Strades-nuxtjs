<script setup lang="ts">
const { playHover, playClick } = useNavSound()
</script>

<template>
  <NuxtLink
    to="/calendar"
    class="cal-btn"
    title="Trading Calendar"
    @mouseenter="playHover"
    @click="playClick"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  </NuxtLink>
</template>

<style scoped>
.cal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width:  var(--nav-icon-btn-size, 2rem);
  height: var(--nav-icon-btn-size, 2rem);
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  flex-shrink: 0;
  transition: all var(--transition-fast, 0.2s ease);
}
.cal-btn svg { width: 1.05rem; height: 1.05rem; }
.cal-btn:hover {
  color: var(--primary-blue, #00aaff);
  border-color: rgba(0,170,255,0.35);
  background: rgba(0,170,255,0.08);
  transform: scale(1.08);
  box-shadow: 0 0 0.5rem rgba(0,170,255,0.12);
}
.cal-btn:active { transform: scale(0.94); transition-duration: 0.08s; }
.router-link-active.cal-btn {
  color: var(--primary-blue, #00aaff);
  background: rgba(0,170,255,0.1);
  border-color: rgba(0,170,255,0.4);
}
</style>
