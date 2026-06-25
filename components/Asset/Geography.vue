<script setup lang="ts">
import { computed } from 'vue'
import WorldMap, { type MapMarker, type MapRoute } from '~/components/Map/WorldMap.vue'

interface Location {
  id: string
  name?: string
  city?: string
  country?: string
  lat?: number
  lng?: number
  type?: string
  size?: string
  status?: string
  share_pct?: number
}

interface Shipment {
  id: string
  from_country: string
  to_country: string
  product?: string
  value_usd?: number
}

interface CountryRef {
  country: string
  lat?: number
  lng?: number
}

const props = defineProps<{
  facilities?: Location[]
  suppliers?: Array<Location & CountryRef & { name?: string; share_pct?: number }>
  customers?: Array<Location & CountryRef & { name?: string; share_pct?: number }>
  shipments?: Shipment[]
  headquarters?: { lat?: number; lng?: number; city?: string; country?: string; name?: string } | null
}>()

// Convert all entities to map markers grouped
const markers = computed<MapMarker[]>(() => {
  const out: MapMarker[] = []

  if (props.headquarters?.lat !== undefined && props.headquarters?.lng !== undefined) {
    out.push({
      id: 'hq',
      lat: props.headquarters.lat,
      lng: props.headquarters.lng,
      label: props.headquarters.name ?? props.headquarters.city ?? 'HQ',
      weight: 1,
      tone: 'accent',
      group: 'HQ'
    })
  }

  for (const f of props.facilities ?? []) {
    if (f.lat === undefined || f.lng === undefined) continue
    out.push({
      id: `fac-${f.id}`,
      lat: f.lat,
      lng: f.lng,
      label: f.name || f.city,
      weight: f.size === 'large' ? 0.9 : f.size === 'medium' ? 0.6 : 0.4,
      tone: f.status === 'planned' ? 'warning' : 'info',
      group: 'Facilities'
    })
  }

  for (const s of props.suppliers ?? []) {
    if (s.lat === undefined || s.lng === undefined) continue
    out.push({
      id: `sup-${s.id}`,
      lat: s.lat,
      lng: s.lng,
      label: s.name,
      weight: Math.min(1, (s.share_pct ?? 5) / 25),
      tone: 'positive',
      group: 'Suppliers'
    })
  }

  for (const c of props.customers ?? []) {
    if (c.lat === undefined || c.lng === undefined) continue
    out.push({
      id: `cus-${c.id}`,
      lat: c.lat,
      lng: c.lng,
      label: c.name,
      weight: Math.min(1, (c.share_pct ?? 5) / 25),
      tone: 'warning',
      group: 'Customers'
    })
  }

  return out
})

// Build country → lat/lng map (rough centroids) for shipment routes
const COUNTRY_LL: Record<string, { lat: number; lng: number }> = {
  US: { lat: 37.0902, lng: -95.7129 }, CN: { lat: 35.8617, lng: 104.1954 },
  JP: { lat: 36.2048, lng: 138.2529 }, KR: { lat: 35.9078, lng: 127.7669 },
  TW: { lat: 23.6978, lng: 120.9605 }, DE: { lat: 51.1657, lng: 10.4515 },
  FR: { lat: 46.2276, lng: 2.2137 },  GB: { lat: 55.3781, lng: -3.4360 },
  IT: { lat: 41.8719, lng: 12.5674 }, ES: { lat: 40.4637, lng: -3.7492 },
  IN: { lat: 20.5937, lng: 78.9629 }, BR: { lat: -14.2350, lng: -51.9253 },
  RU: { lat: 61.5240, lng: 105.3188 }, AE: { lat: 23.4241, lng: 53.8478 },
  CH: { lat: 46.8182, lng: 8.2275 },  CL: { lat: -35.6751, lng: -71.5430 },
  HK: { lat: 22.3193, lng: 114.1694 }, SA: { lat: 23.8859, lng: 45.0792 },
  SG: { lat: 1.3521, lng: 103.8198 }, IR: { lat: 32.4279, lng: 53.6880 },
  IE: { lat: 53.4129, lng: -8.2439 }, NL: { lat: 52.1326, lng: 5.2913 },
  CA: { lat: 56.1304, lng: -106.3468 }, MX: { lat: 23.6345, lng: -102.5528 },
  AU: { lat: -25.2744, lng: 133.7751 }, EU: { lat: 50.1109, lng: 8.6821 },
  VN: { lat: 14.0583, lng: 108.2772 }, GLOBAL: { lat: 0, lng: 0 }
}

const routes = computed<MapRoute[]>(() => {
  const list: MapRoute[] = []
  let maxVal = 1
  for (const s of props.shipments ?? []) maxVal = Math.max(maxVal, s.value_usd ?? 0)

  for (const s of props.shipments ?? []) {
    const from = COUNTRY_LL[s.from_country]
    const to = COUNTRY_LL[s.to_country]
    if (!from || !to) continue
    list.push({
      id: `r-${s.id}`,
      from,
      to,
      weight: Math.min(1, (s.value_usd ?? 0) / maxVal),
      tone: 'info',
      label: s.product
    })
  }
  return list
})

const summary = computed(() => {
  const countries = new Set<string>()
  ;[...(props.suppliers ?? []), ...(props.customers ?? []), ...(props.facilities ?? [])].forEach(x => {
    if (x.country) countries.add(x.country)
  })
  return {
    countries: countries.size,
    facilities: props.facilities?.length ?? 0,
    suppliers: props.suppliers?.length ?? 0,
    customers: props.customers?.length ?? 0,
    shipments: props.shipments?.length ?? 0
  }
})
</script>

<template>
  <div class="geo">
    <div class="stat-row">
      <div class="stat">
        <span class="s-label">Countries</span>
        <span class="s-value">{{ summary.countries }}</span>
      </div>
      <div class="stat">
        <span class="s-label">Facilities</span>
        <span class="s-value">{{ summary.facilities }}</span>
      </div>
      <div class="stat">
        <span class="s-label">Suppliers</span>
        <span class="s-value">{{ summary.suppliers }}</span>
      </div>
      <div class="stat">
        <span class="s-label">Customers</span>
        <span class="s-value">{{ summary.customers }}</span>
      </div>
      <div class="stat">
        <span class="s-label">Lanes</span>
        <span class="s-value">{{ summary.shipments }}</span>
      </div>
    </div>

    <WorldMap
      :markers="markers"
      :routes="routes"
      :height="300"
      :show-grid="true"
      :fit-on-load="true"
    />

    <div class="legend">
      <span class="lg"><i class="dot accent" /> HQ</span>
      <span class="lg"><i class="dot info" /> Facilities</span>
      <span class="lg"><i class="dot positive" /> Suppliers</span>
      <span class="lg"><i class="dot warning" /> Customers</span>
      <span class="lg" v-if="routes.length"><i class="line" /> Trade lane</span>
    </div>
  </div>
</template>

<style scoped>
.geo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.35rem;
  min-width: 0;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  padding: 0.45rem 0.55rem;
  background: rgba(255,255,255,0.03);
  border-radius: 5px;
  min-width: 0;
}
.s-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.s-value {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: #fff;
}

@media (max-width: 640px) {
  .stat-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 420px) {
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.legend {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  font-weight: 700;
}
.lg { display: inline-flex; align-items: center; gap: 0.3rem; }
.lg .dot { width: 7px; height: 7px; border-radius: 50%; }
.lg .dot.accent  { background: #00ff88; }
.lg .dot.info    { background: #00aaff; }
.lg .dot.positive{ background: #00ff88; }
.lg .dot.warning { background: #ffaa00; }
.lg .dot.negative{ background: #ff4d6a; }
.lg .line {
  display: inline-block;
  width: 18px;
  height: 1.5px;
  background: repeating-linear-gradient(90deg, #00aaff 0 4px, transparent 4px 8px);
  border-radius: 1px;
}
</style>
