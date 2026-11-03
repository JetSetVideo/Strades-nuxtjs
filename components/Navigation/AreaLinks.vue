<script setup lang="ts">
/**
 * The pages of one area as chips. Strategy Creator stays in the drawer and the
 * top-bar action; it is not a chip, because that page is already one click away.
 */
import { computed } from 'vue'
import { areaById, areaPageLinks, pathMatches, type AreaId } from '~/utils/routes'

const props = defineProps<{ area: AreaId }>()
const route = useRoute()
const links = computed(() => areaPageLinks(props.area).filter(link => link.path !== '/creator'))
const title = computed(() => areaById(props.area).label)
const isCurrent = (path: string) => pathMatches(path, route.path)

/** Stroke icons, 16×16. Bigger than the old glyphs, and not the drawer set. */
const CHIP_ICON: Record<string, string> = {
  '/prices': '<path d="M2 12 L6 7 L9 9.5 L14 3"/><path d="M10 3 H14 V7"/>',
  '/predict': '<path d="M8 2.5 A5.5 5.5 0 1 0 8 13.5"/><path d="M8 2.5 V8 H13.2"/>',
  '/CandleChart': '<path d="M4 3 V13"/><path d="M2.5 6 H5.5"/><path d="M8 2 V14"/><path d="M6.5 5 H9.5"/><path d="M12 4 V12"/><path d="M10.5 7 H13.5"/>',
  '/calendar': '<rect x="2.5" y="3.5" width="11" height="10" rx="1"/><path d="M2.5 7 H13.5"/><path d="M6 3.5 V7"/><path d="M10 3.5 V7"/>',
  '/deals': '<path d="M3 5 H11"/><path d="M8 2.5 L11 5 L8 7.5"/><path d="M13 11 H5"/><path d="M8 8.5 L5 11 L8 13.5"/>',
  '/news': '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>',
  '/wallet': '<circle cx="8" cy="8" r="5.5"/><path d="M8 5 V8 L10.2 9.4"/>',
  '/trade': '<path d="M5 3 V13"/><path d="M3 5 L5 3 L7 5"/><path d="M11 13 V3"/><path d="M9 11 L11 13 L13 11"/>',
  '/risk': '<path d="M8 2.5 L14 13.5 H2 Z"/><path d="M8 6.5 V9.5"/><path d="M8 11.2 V11.8"/>',
  '/historic': '<circle cx="8" cy="8" r="5"/><path d="M8 3 V8 H13"/>',
  '/strategies': '<path d="M8 1.6 L13.6 4.8 V11.2 L8 14.4 L2.4 11.2 V4.8 Z"/>',
  '/agents': '<circle cx="8" cy="5.2" r="2.3"/><path d="M3.2 13.2 C3.6 10.2 5.5 8.8 8 8.8 C10.5 8.8 12.4 10.2 12.8 13.2"/>',
  '/community': '<circle cx="6" cy="8" r="3.2"/><circle cx="10.2" cy="8" r="3.2"/>',
  '/bots': '<rect x="4" y="5" width="8" height="7" rx="1.2"/><path d="M8 5 V3"/><circle cx="8" cy="3" r="0.7" fill="currentColor" stroke="none"/><path d="M6.2 8 H6.3"/><path d="M9.7 8 H9.8"/>',
  '/shop': '<path d="M3 6.5 H13 L12 13.5 H4 Z"/><path d="M5.5 6.5 L6.5 3 H9.5 L10.5 6.5"/>',
  '/chat': '<path d="M3 4.5 H13 V10.5 H7 L4 13 V10.5 H3 Z"/>',
  '/leaderboard': '<path d="M3 12 V8"/><path d="M8 12 V4"/><path d="M13 12 V6.5"/>',
  '/arena': '<path d="M3.5 3.5 L12.5 12.5"/><path d="M12.5 3.5 L3.5 12.5"/>',
  '/quest': '<path d="M8 2 L9.4 6.2 L14 6.4 L10.4 9.2 L11.6 13.6 L8 11 L4.4 13.6 L5.6 9.2 L2 6.4 L6.6 6.2 Z"/>',
  '/profile': '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="6.6" r="1.6"/><path d="M4.6 12 C5.2 10.2 6.4 9.4 8 9.4 C9.6 9.4 10.8 10.2 11.4 12"/>',
  '/insights': '<path d="M8 2.5 A5.5 5.5 0 1 1 2.5 8"/><path d="M8 8 L8 2.5"/><path d="M8 8 L12.5 10.5"/>',
  '/notifications': '<path d="M8 2.5 C6 2.5 4.5 4.2 4.5 6.4 V9.2 L3.2 11.2 H12.8 L11.5 9.2 V6.4 C11.5 4.2 10 2.5 8 2.5 Z"/><path d="M6.8 11.2 A1.2 1.2 0 0 0 9.2 11.2"/>',
  '/settings': '<circle cx="8" cy="8" r="2.2"/><path d="M8 2.2 V4"/><path d="M8 12 V13.8"/><path d="M2.2 8 H4"/><path d="M12 8 H13.8"/><path d="M3.8 3.8 L5.1 5.1"/><path d="M10.9 10.9 L12.2 12.2"/><path d="M12.2 3.8 L10.9 5.1"/><path d="M5.1 10.9 L3.8 12.2"/>',
  '/apis': '<path d="M3 6 H10"/><path d="M7.5 3.5 L10 6 L7.5 8.5"/><path d="M13 10 H6"/><path d="M8.5 7.5 L6 10 L8.5 12.5"/>',
  '/data': '<rect x="2.5" y="2.5" width="4.5" height="4.5"/><rect x="9" y="2.5" width="4.5" height="4.5"/><rect x="2.5" y="9" width="4.5" height="4.5"/><rect x="9" y="9" width="4.5" height="4.5"/>',
}

function iconOf(path: string): string | null {
  const body = CHIP_ICON[path]
  if (!body) return null
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

function place(index: number, count: number): number {
  if (count < 2) return 0.5
  return index / (count - 1)
}
</script>

<template>
  <nav v-if="links.length" class="nav-area-links" :aria-label="`${title} pages`" data-testid="nav-area-links">
    <NuxtLink
      v-for="(l, index) in links"
      :key="l.path"
      :to="l.path"
      class="chip"
      :class="{ current: isCurrent(l.path) }"
      :style="{ '--t': place(index, links.length) }"
      :aria-current="isCurrent(l.path) ? 'page' : undefined"
      :title="l.hint"
    >
      <span v-if="iconOf(l.path)" class="ic" aria-hidden="true" v-html="iconOf(l.path)" />
      <span v-else class="ic glyph" aria-hidden="true">{{ l.icon }}</span>
      {{ l.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nav-area-links {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: clamp(0.28rem, 0.65vw, 0.8rem);
  margin: 0 0 var(--page-gap, 0.5rem);
}
.chip {
  flex: 1 1 0;
  min-width: max-content;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 32px;
  padding: 0.28rem clamp(0.55rem, 1.35vw, 1.4rem);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.06);
  background-image: linear-gradient(
    calc(135deg + var(--t) * 90deg),
    rgba(255, 255, 255, 0.1),
    transparent
  );
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.chip .ic {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex: none;
}
.chip .ic svg { width: 16px; height: 16px; display: block; }
.chip:hover { color: #fff; border-color: rgba(255, 255, 255, 0.4); }
.chip.current {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.72);
  background: linear-gradient(
    calc(135deg + var(--t) * 90deg),
    rgba(255, 255, 255, 0.22),
    rgba(255, 255, 255, 0.05)
  );
  box-shadow: calc((0.5 - var(--t)) * 14px) 8px 16px rgba(255, 255, 255, 0.32);
}
.chip:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
</style>
