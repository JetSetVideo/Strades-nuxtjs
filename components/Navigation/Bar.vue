<script setup lang="ts">
/**
 * Bottom navigation — five living icons, each a micro-dashboard of its panel.
 * Data and wording: composables/useNavPanels.ts. Icon maths: utils/navIcons.ts.
 * This file only lays the tabs out and marks the selected one, which grows and
 * zooms in (the icon itself also switches to its "active" drawing).
 */
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { useNavPanels } from '~/composables/useNavPanels'
import { activePanelFor, type PanelId } from '~/utils/navIcons'
import PricesIcon from '~/components/Navigation/Icons/PricesIcon.vue'
import NewsGlobeIcon from '~/components/Navigation/Icons/NewsGlobeIcon.vue'
import WalletIcon from '~/components/Navigation/Icons/WalletIcon.vue'
import LabSphereIcon from '~/components/Navigation/Icons/LabSphereIcon.vue'
import ChatBadgeIcon from '~/components/Navigation/Icons/ChatBadgeIcon.vue'

const ICONS: Record<PanelId, Component> = {
  prices: PricesIcon,
  news: NewsGlobeIcon,
  wallet: WalletIcon,
  lab: LabSphereIcon,
  chat: ChatBadgeIcon,
}

const route = useRoute()
const { panels } = useNavPanels()
// aria-current: "page" on the tab's own route, "true" on its detail pages (e.g. /strategy/42 under Lab).
const current = (p: { id: PanelId; to: string }) =>
  p.id !== activeId.value ? undefined : route.path === p.to ? 'page' : 'true'
const { playHover, playClick, playActiveRoute } = useNavSound()
const activeId = computed(() => activePanelFor(route.path, panels.value))
watch(activeId, () => playActiveRoute())

// Live per-user readouts differ between the server render and the client, so
// icons draw a static placeholder and the value line stays empty until mounted.
const mounted = ref(false)

// Icon geometry is in px (the Lab globe is real CSS 3-D), so pick the size per
// breakpoint instead of scaling with CSS. The server renders the common phone
// size (36). Sizes leave room for the selected icon's 1.2x zoom inside the bar.
const iconSize = ref(36)
const BREAKS: Array<[string, number]> = [['(min-width: 1600px)', 40], ['(min-width: 768px)', 38], ['(max-width: 379px)', 32]]
let queries: MediaQueryList[] = []
const pickSize = () => { iconSize.value = BREAKS.find((_, i) => queries[i]?.matches)?.[1] ?? 36 }
onMounted(() => {
  mounted.value = true
  queries = BREAKS.map(([q]) => window.matchMedia(q))
  queries.forEach(q => q.addEventListener('change', pickSize))
  pickSize()
})
onUnmounted(() => queries.forEach(q => q.removeEventListener('change', pickSize)))
</script>

<template>
  <nav class="nav-bar" aria-label="Main navigation">
    <div class="nav-row">
      <NuxtLink
        v-for="p in panels"
        :key="p.id"
        :to="p.to"
        class="nav-btn"
        :class="{ 'is-active': p.id === activeId }"
        :style="{ '--accent': p.accent }"
        :aria-label="mounted ? p.summary : p.label"
        :aria-current="current(p)"
        :data-panel="p.id"
        @mouseenter="playHover"
        @click="playClick"
      >
        <span class="halo" aria-hidden="true" />
        <span class="indicator" aria-hidden="true" />
        <span class="icon-wrap">
          <component :is="ICONS[p.id]" v-bind="p.icon" :size="iconSize" :active="p.id === activeId" :ready="mounted" />
        </span>
        <span class="nav-label">{{ p.label }}</span>
        <span class="nav-value" aria-hidden="true">
          <template v-if="mounted">
            <span v-for="(part, i) in p.value" :key="i" :class="part.tone">
              <span :class="{ 'v-short': part.long }">{{ part.text }}</span>
              <span v-if="part.long" class="v-long">{{ part.long }}</span>
            </span>
          </template>
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.nav-bar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: var(--z-fixed, 1030);
  /* Content height + the home-indicator inset on top (never squeezed out of it).
     --nav-bottom-height is a global clamp in assets/css/variables.css. */
  height: calc(var(--nav-bottom-height) + env(safe-area-inset-bottom, 0px));
  padding: 0 max(0.25rem, env(safe-area-inset-left, 0px)) env(safe-area-inset-bottom, 0px) max(0.25rem, env(safe-area-inset-right, 0px));
  background: linear-gradient(180deg, rgba(17,17,20,0.88) 0%, rgba(12,12,14,0.97) 100%);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border-top: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 -1px 0 rgba(0,255,136,0.05), 0 -8px 22px rgba(0,0,0,0.45);
}

/* Tabs stay grouped on wide screens instead of drifting to the edges. */
.nav-row {
  display: flex;
  align-items: stretch;
  height: 100%;
  max-width: 46rem;
  margin: 0 auto;
}

.nav-btn {
  --accent: 0,255,136;
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  margin: 0.2rem 0.1rem;
  border-radius: var(--radius-md, 0.5rem);
  color: rgba(255,255,255,0.58);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  contain: layout style;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-btn:focus-visible {
  outline: 2px solid rgb(var(--accent));
  outline-offset: -2px;
}

/* Selected tab — one style for all five: white bold label, accent bar on top,
   accent wash + halo, and the icon zooms 1.2x (transform only). */
.nav-btn.is-active {
  color: #fff;
  background: linear-gradient(180deg, rgba(var(--accent), 0.16) 0%, rgba(var(--accent), 0.03) 100%);
}
.indicator {
  position: absolute;
  top: -0.2rem;
  left: 50%;
  width: 1.6rem;
  height: 2px;
  margin-left: -0.8rem;
  border-radius: 0 0 2px 2px;
  background: rgb(var(--accent));
  box-shadow: 0 0 6px rgba(var(--accent), 0.8);
  transform: scaleX(0);
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
.is-active .indicator { transform: scaleX(1); }

.halo {
  position: absolute;
  top: -0.6rem;
  left: 50%;
  width: 4.6rem;
  height: 4.6rem;
  margin-left: -2.3rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--accent), 0.3) 0%, rgba(var(--accent), 0) 66%);
  opacity: 0;
  transform: scale(0.4);
  pointer-events: none;
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1);
}
.is-active .halo { opacity: 1; transform: scale(1); }

.icon-wrap {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transform-origin: 50% 60%;
  transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1);
}
.is-active .icon-wrap { transform: scale(1.2); }

.nav-label {
  position: relative;
  font-family: var(--font-family-primary, 'Poppins'), sans-serif;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
}
.is-active .nav-label { font-weight: 700; letter-spacing: 0.08em; }

/* Value line: always reserved so the five labels stay on one baseline. */
.nav-value {
  position: relative;
  display: flex;
  gap: 0.3em;
  justify-content: center;
  max-width: 100%;
  min-height: 0.62rem;
  overflow: hidden;
  font-family: var(--font-market-data, 'Poppins', monospace);
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.v-long { display: none; }
.nav-value .up     { color: var(--app-color-up, #00ff88); }
.nav-value .down   { color: var(--app-color-down, #ff4444); }
.nav-value .wait   { color: var(--warning-orange, #ffa500); }
.nav-value .muted,
.nav-value .accent { color: rgba(255,255,255,0.62); }
/* Accent colour only on the selected tab; up / down / waiting stay coloured because they are state. */
.is-active .nav-value .accent { color: rgb(var(--accent)); }

@media (hover: hover) and (pointer: fine) {
  .nav-btn:hover { color: rgba(255,255,255,0.88); background-color: rgba(255,255,255,0.045); }
  .nav-btn:not(.is-active):hover .icon-wrap { transform: translateY(-0.12rem) scale(1.07); }
}
.nav-btn:active .icon-wrap { transform: scale(0.92); transition-duration: 0.08s; }
.nav-btn.is-active:active .icon-wrap { transform: scale(1.12); }

@media (max-width: 379px) {
  .nav-btn { margin: 0.15rem 0.04rem; }
  .nav-label { font-size: 0.58rem; letter-spacing: 0.02em; }
  .nav-value { font-size: 0.55rem; }
}
@media (min-width: 768px) {
  .nav-bar { height: calc(var(--nav-bottom-height-md) + env(safe-area-inset-bottom, 0px)); }
  .nav-label { font-size: 0.72rem; }
  .nav-value { font-size: 0.62rem; }
  .v-short { display: none; }
  .v-long { display: inline; }
}

/* Reduced motion: nothing in the bar or its icons transitions or animates. */
@media (prefers-reduced-motion: reduce) {
  .nav-btn, .nav-btn :deep(*), .nav-btn :deep(*)::after { transition: none !important; animation: none !important; }
}
</style>
