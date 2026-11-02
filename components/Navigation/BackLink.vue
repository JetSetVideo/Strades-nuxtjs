<script setup lang="ts">
/**
 * C10 · "← <area home>" — the 1-click way back from a detail or secondary page to its area home,
 * named from utils/routes.ts (areaHomeLink). Renders nothing on an area home or an unknown path.
 *
 *   <NavigationBackLink />                 the current route
 *   <NavigationBackLink path="/bots/x" />  an explicit path (tests, previews)
 *
 * Same look as the existing `.back-link` on pages/articles/[id].vue ("← News").
 */
import { computed } from 'vue'
import { areaHomeLink } from '~/utils/routes'

const props = defineProps<{ path?: string }>()
const route = useRoute()
const link = computed(() => areaHomeLink(props.path ?? route.path))
</script>

<template>
  <NuxtLink v-if="link" :to="link.to" class="nav-back-link" data-testid="nav-back-link">← {{ link.label }}</NuxtLink>
</template>

<style scoped>
.nav-back-link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 0.15s ease;
}
.nav-back-link:hover { color: var(--primary-green, #00ff88); }
.nav-back-link:focus-visible { outline: 2px solid var(--primary-green, #00ff88); outline-offset: 2px; border-radius: 3px; }
@media (prefers-reduced-motion: reduce) { .nav-back-link { transition: none; } }
</style>
