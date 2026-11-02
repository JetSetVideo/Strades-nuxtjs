<script setup lang="ts">
/**
 * C10 · The pages of one area as compact chips (the area's drawer group from utils/routes.ts),
 * the current one highlighted. For area homes, so e.g. the Lab home links Your bots, the
 * Avatar Marketplace and the Shop without the logo menu (board-ia IA-3).
 *
 *   <NavigationAreaLinks area="lab" />
 */
import { computed } from 'vue'
import { areaById, areaPageLinks, pathMatches, type AreaId } from '~/utils/routes'

const props = defineProps<{ area: AreaId }>()
const route = useRoute()
const links = computed(() => areaPageLinks(props.area))
const title = computed(() => areaById(props.area).label)
const isCurrent = (path: string) => pathMatches(path, route.path)
</script>

<template>
  <nav v-if="links.length" class="nav-area-links" :aria-label="`${title} pages`" data-testid="nav-area-links">
    <NuxtLink
      v-for="l in links"
      :key="l.path"
      :to="l.path"
      class="chip"
      :class="{ current: isCurrent(l.path) }"
      :aria-current="isCurrent(l.path) ? 'page' : undefined"
      :title="l.hint"
    >
      <span v-if="l.icon" class="ic" aria-hidden="true">{{ l.icon }}</span>{{ l.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nav-area-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 var(--page-gap, 0.5rem);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 24px;
  padding: 0.15rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.chip .ic { opacity: 0.7; }
.chip:hover { color: #fff; border-color: rgba(0, 255, 136, 0.35); }
.chip.current {
  color: var(--primary-green, #00ff88);
  border-color: rgba(0, 255, 136, 0.45);
  background: rgba(0, 255, 136, 0.06);
}
.chip:focus-visible { outline: 2px solid var(--primary-green, #00ff88); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
</style>
