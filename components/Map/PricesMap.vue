<template>
  <div class="prices-map">
    <WorldMap
      :markers="markers"
      :height="mapHeight"
      :highlight-id="selectedIso"
      :show-labels="true"
      @marker-click="onMarkerClick"
    />
    <p class="map-hint">Click a region to filter the list below to assets there. {{ markers.length }} region{{ markers.length === 1 ? '' : 's' }} on screen.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WorldMap, { type MapMarker } from '~/components/Map/WorldMap.vue'
import { regionOf } from '~/composables/useAssetRegion'
import type { Asset } from '~/types/asset'

const props = withDefaults(defineProps<{
  assets: Asset[]
  priceChanges: Record<string, number>
  selectedIso?: string | null
  mapHeight?: number
}>(), { mapHeight: 260, selectedIso: null })

const emit = defineEmits<{ (e: 'select', iso: string | null): void }>()

/** One marker per region, weighted by how many visible assets sit there and
 * toned by that region's average price move — a region-level pulse, not a
 * per-asset pin (a country doesn't need 5 overlapping dots for 5 stocks). */
const markers = computed<MapMarker[]>(() => {
  const byRegion = new Map<string, { label: string; latlng: { lat: number; lng: number }; count: number; changeSum: number }>()
  for (const a of props.assets) {
    const r = regionOf(a)
    const entry = byRegion.get(r.iso) ?? { label: r.label, latlng: r.latlng, count: 0, changeSum: 0 }
    entry.count++
    entry.changeSum += props.priceChanges[a.id] ?? 0
    byRegion.set(r.iso, entry)
  }
  const maxCount = Math.max(1, ...Array.from(byRegion.values()).map(v => v.count))
  return Array.from(byRegion.entries()).map(([iso, v]) => ({
    id: iso,
    lat: v.latlng.lat,
    lng: v.latlng.lng,
    label: `${v.label} (${v.count})`,
    weight: Math.min(1, 0.35 + (v.count / maxCount) * 0.65),
    tone: v.changeSum >= 0 ? 'positive' : 'negative'
  }))
})

function onMarkerClick(iso: string) {
  emit('select', props.selectedIso === iso ? null : iso)
}
</script>

<style scoped>
.prices-map { display: flex; flex-direction: column; gap: 0.4rem; }
.map-hint { margin: 0; font-size: 0.68rem; color: var(--text-gray, rgba(255,255,255,0.5)); text-align: center; }
</style>
