<script setup lang="ts">
/**
 * WorldMap — where an asset lives: headquarters, facilities, suppliers,
 * clients and market hubs on a dot-matrix world (Natural Earth land, 4° grid,
 * shared with the nav globe). Suppliers link into the headquarters, the
 * headquarters links out to clients.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { landPoints } from '~/utils/navGlobe'
import type { MapPoint } from '~/utils/assetChart'

const props = defineProps<{ points: MapPoint[] }>()

const root = ref<HTMLElement | null>(null)
const width = ref(360)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  width.value = root.value.clientWidth
  ro = new ResizeObserver(([e]) => { if (e) width.value = Math.round(e.contentRect.width) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const LAT_TOP = 78
const LAT_BOTTOM = -58
const height = computed(() => Math.round(width.value * (LAT_TOP - LAT_BOTTOM) / 360))
const px = (lng: number) => ((lng + 180) / 360) * width.value
const py = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * height.value

const land = computed(() => {
  const pts = landPoints()
  const s = Math.max(1.6, width.value / 90 * 0.62)
  let d = ''
  for (let i = 0; i < pts.length; i += 2) {
    const lat = pts[i + 1]!
    if (lat > LAT_TOP || lat < LAT_BOTTOM) continue
    d += `M${px(pts[i]!).toFixed(1)},${py(lat).toFixed(1)}h${s.toFixed(1)}v${s.toFixed(1)}h-${s.toFixed(1)}z`
  }
  return d
})

const COLOR: Record<MapPoint['kind'], string> = {
  hq: '#ffffff', facility: '#ffd54f', supplier: 'rgb(120,170,255)', client: '#00ff88', hub: '#ff9f43',
}
const LABEL: Record<MapPoint['kind'], string> = {
  hq: 'Headquarters', facility: 'Facilities', supplier: 'Suppliers', client: 'Clients', hub: 'Market hubs',
}
const marks = computed(() => props.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => ({ ...p, x: px(p.lng), y: py(p.lat), color: COLOR[p.kind] })))
const hq = computed(() => marks.value.find(m => m.kind === 'hq') ?? marks.value.find(m => m.kind === 'hub') ?? null)
function arc(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2 - Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.25)
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`
}
const links = computed(() => {
  const h = hq.value
  if (!h) return []
  return marks.value.filter(m => m !== h && (m.kind === 'supplier' || m.kind === 'client'))
    .map(m => ({ d: m.kind === 'supplier' ? arc(m, h) : arc(h, m), color: m.color }))
})
const legend = computed(() => (Object.keys(LABEL) as MapPoint['kind'][]).filter(k => marks.value.some(m => m.kind === k)).map(k => ({ k, label: LABEL[k], color: COLOR[k], n: marks.value.filter(m => m.kind === k).length })))
</script>

<template>
  <div ref="root" class="wm">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`Map of ${marks.length} places`">
      <path :d="land" class="wm-land" />
      <path v-for="(l, i) in links" :key="'a' + i" :d="l.d" :stroke="l.color" class="wm-arc" />
      <g v-for="(m, i) in marks" :key="'m' + i" class="wm-mark">
        <title>{{ m.name }}{{ m.sub ? ` — ${m.sub}` : '' }} ({{ LABEL[m.kind] }})</title>
        <circle :cx="m.x" :cy="m.y" :r="m.kind === 'hq' ? 5 : 3.4" :fill="m.color" stroke="#0b0d10" stroke-width="1.2" />
        <circle v-if="m.kind === 'hq'" :cx="m.x" :cy="m.y" r="9" fill="none" :stroke="m.color" stroke-opacity=".5" />
        <text v-if="m.kind === 'hq'" :x="Math.min(m.x + 11, width - 60)" :y="m.y - 8" class="wm-label">{{ m.name }}</text>
      </g>
    </svg>
    <div class="wm-legend">
      <span v-for="l in legend" :key="l.k"><i :style="{ background: l.color }" />{{ l.label }} {{ l.n }}</span>
    </div>
  </div>
</template>

<style scoped>
.wm { width: 100%; }
svg { display: block; }
.wm-land { fill: rgba(255,255,255,.2); }
.wm-arc { fill: none; stroke-width: 1.3; stroke-opacity: .6; }
.wm-label { fill: #fff; font-size: 9.5px; font-weight: 700; paint-order: stroke; stroke: #0b0d10; stroke-width: 3px; font-family: var(--font-family-secondary, inherit); }
.wm-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 3px; font-size: 0.64rem; color: var(--text-gray, #9aa0a6); }
.wm-legend i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }
</style>
