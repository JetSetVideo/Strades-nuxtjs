<script setup lang="ts">
import { ref } from 'vue'
import MapOverlay from '~/components/Map/MapOverlay.vue'
import type { MapMarker, MapRoute } from '~/components/Map/WorldMap.vue'

const props = withDefaults(defineProps<{
  markers?: MapMarker[]
  routes?: MapRoute[]
  title?: string
  subtitle?: string
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'solid'
}>(), {
  markers: () => [],
  routes: () => [],
  title: 'Geography',
  subtitle: '',
  size: 'sm',
  variant: 'ghost'
})

const open = ref(false)
</script>

<template>
  <div class="map-button-root">
    <button
      :class="['map-btn', `size-${size}`, `variant-${variant}`]"
      @click="open = true"
      :aria-label="`Open ${title} map`"
    >
      <svg viewBox="0 0 24 24" class="globe-svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.4" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.2" fill="none" stroke="currentColor" stroke-width="1" />
        <ellipse cx="12" cy="12" rx="3.2" ry="9.5" fill="none" stroke="currentColor" stroke-width="1" />
        <circle cx="16" cy="9" r="0.9" fill="currentColor" />
        <circle cx="8" cy="14" r="0.9" fill="currentColor" />
      </svg>
      <span class="map-btn-label">Map</span>
      <span v-if="markers.length" class="map-btn-count">{{ markers.length }}</span>
    </button>

    <MapOverlay
      :open="open"
      :markers="markers"
      :routes="routes"
      :title="title"
      :subtitle="subtitle"
      @update:open="(v) => open = v"
    />
  </div>
</template>

<style scoped>
.map-button-root { display: inline-flex; }

.map-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.35rem 0.6rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.map-btn:hover {
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
  background: rgba(0, 170, 255, 0.06);
}

.map-btn.size-md {
  padding: 0.45rem 0.85rem;
  font-size: 0.75rem;
}

.map-btn.variant-solid {
  background: linear-gradient(135deg, rgba(0,170,255,0.16), rgba(0,255,136,0.1));
  border-color: rgba(0,170,255,0.35);
  color: var(--primary-blue, #00aaff);
}
.map-btn.variant-solid:hover {
  color: #fff;
  border-color: var(--primary-blue, #00aaff);
}

.globe-svg {
  width: 1em;
  height: 1em;
  display: block;
  flex-shrink: 0;
}

.map-btn-count {
  background: rgba(0,170,255,0.18);
  color: var(--primary-blue, #00aaff);
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
