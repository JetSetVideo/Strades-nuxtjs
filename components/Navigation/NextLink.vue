<script setup lang="ts">
/**
 * The obvious next action of a page as one quiet link ("Make a call on Prices →").
 * Secondary pages put it in their UIPageHeader actions or inside an empty state, so a
 * newcomer always has somewhere to go (3-click rule, swarm 2026-11-02 Wave 2 lane `nav`).
 *
 *   <NavigationNextLink to="/prices" label="Make a call on Prices" />
 */
defineProps<{ to: string, label: string }>()
</script>

<template>
  <NuxtLink :to="to" class="nav-next-link">{{ label }} <span aria-hidden="true">→</span></NuxtLink>
</template>

<style scoped>
.nav-next-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 24px;
  color: var(--primary-green, #00ff88);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
  white-space: nowrap;
}
.nav-next-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.nav-next-link:focus-visible { outline: 2px solid var(--primary-green, #00ff88); outline-offset: 2px; border-radius: 3px; }
</style>
