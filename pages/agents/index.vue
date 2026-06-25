<script setup lang="ts">
// Agents now live as a tab inside the Trading Lab (/strategies).
// This page redirects to keep old links and bookmarks working.
definePageMeta({ middleware: 'agents-redirect' })
</script>

<template>
  <div class="redirect-shell">
    <p>Redirecting to the Trading Lab…</p>
    <NuxtLink to="/strategies">Open Trading Lab →</NuxtLink>
  </div>
</template>

<style scoped>
.redirect-shell {
  padding: 3rem 1rem;
  text-align: center;
  color: rgba(255,255,255,0.5);
}
.redirect-shell a {
  display: inline-block;
  margin-top: 0.5rem;
  color: var(--primary-green, #00ff88);
}
</style>
