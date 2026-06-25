<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useWorldProjection } from '~/composables/useWorldProjection'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label?: string
  weight?: number    // 0..1 — scales the dot size
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'neutral'
  group?: string
}

export interface MapRoute {
  id: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  weight?: number    // 0..1 — scales line thickness / opacity
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'neutral'
  label?: string
}

const props = withDefaults(defineProps<{
  markers?: MapMarker[]
  routes?: MapRoute[]
  height?: number
  showGrid?: boolean
  showLabels?: boolean
  showRegionLabels?: boolean
  showControls?: boolean
  highlightId?: string | null
  /** Auto-zoom to fit all markers on mount + when markers change */
  fitOnLoad?: boolean
}>(), {
  markers: () => [],
  routes: () => [],
  height: 320,
  showGrid: true,
  showLabels: false,
  showRegionLabels: true,
  showControls: true,
  highlightId: null,
  fitOnLoad: false
})

const emit = defineEmits<{ (e: 'marker-click', id: string): void }>()

const wrap = ref<HTMLDivElement | null>(null)
const W = ref(640)
const H = computed(() => props.height)

let ro: ResizeObserver | null = null
const widthSettled = ref(false)
onMounted(() => {
  if (wrap.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      if (w > 0) {
        W.value = w
        if (!widthSettled.value) {
          widthSettled.value = true
          if (props.fitOnLoad) fitToMarkers()
        }
      }
    })
    ro.observe(wrap.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

// Re-fit when markers change after initial settle
watch(() => props.markers, () => {
  if (props.fitOnLoad && widthSettled.value) fitToMarkers()
}, { deep: false })

const { project, route } = useWorldProjection(W, H)

// ─── Zoom + Pan state ──────────────────────────────────────────────────
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)

const MIN_ZOOM = 1
const MAX_ZOOM = 6

const viewBox = computed(() => {
  const vw = W.value / zoom.value
  const vh = H.value / zoom.value
  return `${panX.value} ${panY.value} ${vw} ${vh}`
})

const clampPan = () => {
  const vw = W.value / zoom.value
  const vh = H.value / zoom.value
  panX.value = Math.max(0, Math.min(W.value - vw, panX.value))
  panY.value = Math.max(0, Math.min(H.value - vh, panY.value))
}

const zoomAt = (delta: number, anchorX = W.value / 2, anchorY = H.value / 2) => {
  const oldZoom = zoom.value
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta))
  if (next === oldZoom) return
  const factor = oldZoom / next
  panX.value = anchorX - (anchorX - panX.value) * factor
  panY.value = anchorY - (anchorY - panY.value) * factor
  zoom.value = next
  clampPan()
}

const reset = () => { zoom.value = 1; panX.value = 0; panY.value = 0 }

// Fit-to-markers: compute the bounding box of projected markers and zoom in
const fitToMarkers = () => {
  if (!props.markers || props.markers.length === 0) return
  if (W.value < 100) return // wait for layout

  const points = props.markers.map(m => project(m.lat, m.lng))
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  // Pad the box by 12% of width/height
  const padX = Math.max(40, (maxX - minX) * 0.18)
  const padY = Math.max(40, (maxY - minY) * 0.22)
  const bx = Math.max(0, minX - padX)
  const by = Math.max(0, minY - padY)
  const bw = Math.min(W.value - bx, (maxX - minX) + padX * 2)
  const bh = Math.min(H.value - by, (maxY - minY) + padY * 2)

  if (bw <= 0 || bh <= 0) return

  // Pick the zoom factor that lets the box fill the viewport in both dims
  const zx = W.value / bw
  const zy = H.value / bh
  const z = Math.min(zx, zy)
  zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  // Recentre on the box
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  panX.value = cx - (W.value / zoom.value) / 2
  panY.value = cy - (H.value / zoom.value) / 2
  clampPan()
}

const svgRef = ref<SVGSVGElement | null>(null)

const clientToSvg = (clientX: number, clientY: number) => {
  if (!svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  const xRatio = (clientX - rect.left) / rect.width
  const yRatio = (clientY - rect.top) / rect.height
  return {
    x: panX.value + xRatio * (W.value / zoom.value),
    y: panY.value + yRatio * (H.value / zoom.value)
  }
}

const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  const pt = clientToSvg(e.clientX, e.clientY)
  const delta = e.deltaY < 0 ? 0.4 : -0.4
  zoomAt(delta, pt.x, pt.y)
}

// Drag-to-pan
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, panX: 0, panY: 0 })
const onPointerDown = (e: PointerEvent) => {
  if (e.button !== 0) return
  dragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
  ;(e.target as Element)?.setPointerCapture?.(e.pointerId)
}
const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value || !svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const dx = (e.clientX - dragStart.value.x) * (W.value / zoom.value) / rect.width
  const dy = (e.clientY - dragStart.value.y) * (H.value / zoom.value) / rect.height
  panX.value = dragStart.value.panX - dx
  panY.value = dragStart.value.panY - dy
  clampPan()
}
const onPointerUp = () => { dragging.value = false }

const onDoubleClick = (e: MouseEvent) => {
  if (zoom.value > 1) { reset(); return }
  const pt = clientToSvg(e.clientX, e.clientY)
  zoomAt(1.5, pt.x, pt.y)
}

// ─── Refined continent silhouettes (640×320 reference) ────────────────
const SILHOUETTES = [
  // North America (mainland + Florida tail)
  'M 90 95 Q 90 70 130 60 Q 175 55 200 80 Q 220 100 218 130 Q 215 165 195 180 Q 175 195 145 185 Q 120 175 105 155 Q 92 130 90 110 Z',
  // Central America strip
  'M 165 170 Q 180 180 178 195 Q 173 205 162 200 Q 158 188 165 170 Z',
  // South America
  'M 180 195 Q 210 195 218 215 Q 222 250 208 280 Q 195 300 178 295 Q 168 270 168 240 Q 170 215 180 195 Z',
  // Greenland
  'M 230 60 Q 250 55 260 70 Q 258 88 245 92 Q 232 85 230 60 Z',
  // Europe mainland
  'M 295 85 Q 320 75 350 78 Q 372 85 372 105 Q 365 130 340 138 Q 320 142 305 132 Q 290 115 295 85 Z',
  // UK + Ireland
  'M 286 92 Q 295 90 296 102 Q 290 110 282 105 Q 278 98 286 92 Z',
  // Africa
  'M 305 145 Q 345 140 370 160 Q 385 185 378 220 Q 365 250 340 255 Q 320 252 308 235 Q 295 210 300 180 Q 300 160 305 145 Z',
  // Middle East / Arabia
  'M 380 155 Q 405 152 410 175 Q 405 190 390 188 Q 378 178 380 155 Z',
  // Russia / Northern Asia
  'M 370 60 Q 430 50 510 55 Q 555 60 575 75 Q 580 95 555 100 Q 510 105 460 102 Q 410 100 380 95 Q 370 80 370 60 Z',
  // Mainland Asia south of Russia
  'M 395 105 Q 440 105 480 115 Q 510 125 520 145 Q 510 162 480 165 Q 440 162 410 155 Q 395 135 395 105 Z',
  // India
  'M 440 158 Q 460 158 470 175 Q 465 195 450 197 Q 438 188 440 158 Z',
  // SE Asia mainland
  'M 485 165 Q 500 170 502 188 Q 495 198 485 195 Q 480 178 485 165 Z',
  // Indonesia
  'M 505 198 Q 525 195 540 205 Q 545 218 530 222 Q 510 218 505 198 Z',
  // Philippines
  'M 525 175 Q 535 178 535 188 Q 528 195 521 190 Q 520 180 525 175 Z',
  // Japan
  'M 555 115 Q 565 115 568 130 Q 562 138 553 132 Q 550 122 555 115 Z',
  // Australia
  'M 530 225 Q 580 220 600 235 Q 605 255 585 265 Q 555 268 535 258 Q 525 245 530 225 Z',
  // New Zealand
  'M 612 270 Q 620 270 622 282 Q 617 288 610 285 Q 608 278 612 270 Z',
  // Madagascar
  'M 372 230 Q 380 232 380 248 Q 374 252 369 245 Q 368 235 372 230 Z',
  // Iceland
  'M 280 80 Q 287 78 289 86 Q 285 91 278 88 Q 277 83 280 80 Z'
]

const silhouetteTransform = computed(() => {
  const sx = W.value / 640
  const sy = H.value / 320
  return `scale(${sx} ${sy})`
})

const REGION_LABELS = [
  { name: 'NORTH AMERICA', lng: -98,  lat: 45,  fade: 'low' },
  { name: 'SOUTH AMERICA', lng: -60,  lat: -15, fade: 'low' },
  { name: 'EUROPE',        lng: 15,   lat: 53,  fade: 'low' },
  { name: 'AFRICA',        lng: 22,   lat: 5,   fade: 'low' },
  { name: 'ASIA',          lng: 90,   lat: 45,  fade: 'low' },
  { name: 'OCEANIA',       lng: 135,  lat: -25, fade: 'low' },
  { name: 'MIDDLE EAST',   lng: 47,   lat: 27,  fade: 'high' },
  { name: 'SE ASIA',       lng: 110,  lat: 5,   fade: 'high' }
]

const projectedRegionLabels = computed(() => {
  if (!props.showRegionLabels) return []
  return REGION_LABELS.map(r => {
    const p = project(r.lat, r.lng)
    return { ...r, x: p.x, y: p.y }
  })
})

const gridLines = computed(() => {
  if (!props.showGrid) return { latitudes: [], longitudes: [], equator: H.value / 2 }
  const lats: number[] = []
  const lngs: number[] = []
  for (let l = -60; l <= 60; l += 30) lats.push(project(l, 0).y)
  for (let l = -150; l <= 150; l += 30) lngs.push(project(0, l).x)
  return { latitudes: lats, longitudes: lngs, equator: H.value / 2 }
})

const projectedMarkers = computed(() => {
  return props.markers.map(m => {
    const p = project(m.lat, m.lng)
    return { ...m, x: p.x, y: p.y, r: 2.5 + (m.weight ?? 0.4) * 6 }
  })
})

const projectedRoutes = computed(() => {
  return props.routes.map(r => ({
    ...r,
    d: route(r.from, r.to),
    width: 0.6 + (r.weight ?? 0.4) * 2.2
  }))
})

const toneToColor = (tone?: string) => {
  switch (tone) {
    case 'positive': return '#00ff88'
    case 'negative': return '#ff4d6a'
    case 'warning': return '#ffaa00'
    case 'info': return '#00aaff'
    case 'accent': return '#00ff88'
    default: return 'rgba(255,255,255,0.8)'
  }
}

// ─── Marker hover tooltip ───────────────────────────────────────────────
const hoverMarkerId = ref<string | null>(null)
const tooltipPinned = ref(false)

const hoveredMarker = computed(() => {
  if (!hoverMarkerId.value) return null
  return projectedMarkers.value.find(m => m.id === hoverMarkerId.value) || null
})

const tooltipPos = computed(() => {
  if (!hoveredMarker.value || !svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  const xRatio = (hoveredMarker.value.x - panX.value) / (W.value / zoom.value)
  const yRatio = (hoveredMarker.value.y - panY.value) / (H.value / zoom.value)
  return {
    x: xRatio * rect.width,
    y: yRatio * rect.height
  }
})

const onMarkerEnter = (id: string) => {
  if (!tooltipPinned.value) hoverMarkerId.value = id
}
const onMarkerLeave = () => {
  if (!tooltipPinned.value) hoverMarkerId.value = null
}
const onMarkerClick = (id: string) => {
  if (hoverMarkerId.value === id && tooltipPinned.value) {
    tooltipPinned.value = false
    hoverMarkerId.value = null
  } else {
    hoverMarkerId.value = id
    tooltipPinned.value = true
  }
  emit('marker-click', id)
}

watch(() => props.highlightId, (val) => {
  if (val && val !== hoverMarkerId.value) {
    hoverMarkerId.value = val
    tooltipPinned.value = true
  }
})
</script>

<template>
  <div class="world-map" ref="wrap">
    <svg
      ref="svgRef"
      :viewBox="viewBox"
      :width="W"
      :height="H"
      preserveAspectRatio="none"
      class="map-svg"
      :class="{ dragging }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
    >
      <defs>
        <radialGradient id="map-bg" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stop-color="rgba(0, 170, 255, 0.07)" />
          <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>
      <rect :x="0" :y="0" :width="W" :height="H" fill="url(#map-bg)" />

      <g v-if="showGrid" class="grid">
        <line v-for="(y, i) in gridLines.latitudes" :key="`la${i}`" :x1="0" :y1="y" :x2="W" :y2="y" />
        <line v-for="(x, i) in gridLines.longitudes" :key="`ln${i}`" :x1="x" :y1="0" :x2="x" :y2="H" />
        <line :x1="0" :y1="gridLines.equator" :x2="W" :y2="gridLines.equator" class="equator" />
      </g>

      <g class="silhouettes" :transform="silhouetteTransform">
        <path v-for="(d, i) in SILHOUETTES" :key="`s${i}`" :d="d" />
      </g>

      <g v-if="showRegionLabels" class="regions" :class="{ zoomed: zoom > 2 }">
        <text
          v-for="r in projectedRegionLabels"
          :key="r.name"
          :x="r.x"
          :y="r.y"
          text-anchor="middle"
          :class="['region-label', `fade-${r.fade}`]"
          :style="{ fontSize: `${10 / Math.max(1, zoom * 0.6)}px` }"
        >{{ r.name }}</text>
      </g>

      <g class="routes">
        <template v-for="r in projectedRoutes" :key="r.id">
          <path
            :id="`path-${r.id}`"
            :d="r.d"
            fill="none"
            :stroke="toneToColor(r.tone)"
            :stroke-width="r.width / Math.max(1, zoom * 0.5)"
            stroke-linecap="round"
            stroke-dasharray="4 4"
            :class="['route', { dim: (highlightId || hoverMarkerId) && (highlightId || hoverMarkerId) !== r.id }]"
          />
          <circle
            v-if="!(highlightId || hoverMarkerId) || (highlightId || hoverMarkerId) === r.id"
            :r="2.4 / Math.max(1, zoom * 0.5)"
            :fill="toneToColor(r.tone)"
            class="flow-dot"
          >
            <animateMotion :dur="`${6 + (r.weight ?? 0.4) * 4}s`" repeatCount="indefinite" rotate="auto">
              <mpath :href="`#path-${r.id}`" />
            </animateMotion>
          </circle>
        </template>
      </g>

      <g class="markers">
        <g
          v-for="m in projectedMarkers"
          :key="m.id"
          :class="['marker', `tone-${m.tone || 'neutral'}`, { dim: (highlightId || hoverMarkerId) && (highlightId || hoverMarkerId) !== m.id }]"
          @pointerenter="onMarkerEnter(m.id)"
          @pointerleave="onMarkerLeave"
          @click.stop="onMarkerClick(m.id)"
        >
          <circle :cx="m.x" :cy="m.y" :r="(m.r + 4) / Math.max(1, zoom * 0.6)" class="halo" />
          <circle :cx="m.x" :cy="m.y" :r="m.r / Math.max(1, zoom * 0.6)" :fill="toneToColor(m.tone)" class="dot" />
          <text
            v-if="showLabels && m.label"
            :x="m.x + (m.r / Math.max(1, zoom * 0.6)) + 4"
            :y="m.y + 3"
            class="label"
            :fill="toneToColor(m.tone)"
            :style="{ fontSize: `${8.5 / Math.max(1, zoom * 0.6)}px` }"
          >{{ m.label }}</text>
        </g>
      </g>
    </svg>

    <div
      v-if="hoveredMarker && hoveredMarker.label"
      class="tooltip"
      :class="{ pinned: tooltipPinned }"
      :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
    >
      <span class="t-dot" :class="`tone-${hoveredMarker.tone || 'neutral'}`" />
      <span class="t-label">{{ hoveredMarker.label }}</span>
      <span v-if="hoveredMarker.group" class="t-group">{{ hoveredMarker.group }}</span>
    </div>

    <div v-if="showControls" class="controls" aria-label="Map controls">
      <button @click="zoomAt(0.5)" title="Zoom in (or scroll up)">＋</button>
      <button @click="zoomAt(-0.5)" :disabled="zoom <= MIN_ZOOM" title="Zoom out (or scroll down)">−</button>
      <button @click="reset" :disabled="zoom === 1 && panX === 0 && panY === 0" title="Reset (or double-click)">⟲</button>
      <span class="zoom-pill">{{ zoom.toFixed(1) }}×</span>
    </div>
  </div>
</template>

<style scoped>
.world-map {
  width: 100%;
  min-width: 0;
  position: relative;
  border-radius: var(--app-border-radius, 8px);
  overflow: hidden;
  background: linear-gradient(135deg, rgba(10,12,18,0.9), rgba(6,8,12,0.95));
  border: 1px solid rgba(255,255,255,0.05);
}
.map-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: grab;
  touch-action: none;
}
.map-svg.dragging { cursor: grabbing; }

.grid line {
  stroke: rgba(255,255,255,0.04);
  stroke-width: 0.5;
}
.grid .equator {
  stroke: rgba(255,255,255,0.07);
  stroke-dasharray: 2 6;
}

.silhouettes path {
  fill: rgba(255,255,255,0.05);
  stroke: rgba(255,255,255,0.09);
  stroke-width: 0.6;
  stroke-linejoin: round;
}

.regions .region-label {
  fill: rgba(255,255,255,0.35);
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.regions .region-label.fade-high { opacity: 0.7; }
.regions.zoomed .region-label.fade-low { opacity: 0.35; }
.regions.zoomed .region-label.fade-high { opacity: 1; }

.routes .route {
  opacity: 0.85;
  transition: opacity 0.2s ease;
  filter: drop-shadow(0 0 4px currentColor);
}
.routes .route.dim { opacity: 0.15; }
@keyframes route-dash {
  to { stroke-dashoffset: -16; }
}
.routes .route {
  animation: route-dash 18s linear infinite;
}
.routes .flow-dot {
  filter: drop-shadow(0 0 4px currentColor);
}

.markers .marker { cursor: pointer; }
.markers .marker .halo {
  fill: currentColor;
  opacity: 0.18;
  transform-origin: center;
  animation: marker-pulse 2.2s infinite ease-out;
}
.markers .marker.tone-positive { color: #00ff88; }
.markers .marker.tone-negative { color: #ff4d6a; }
.markers .marker.tone-warning  { color: #ffaa00; }
.markers .marker.tone-info     { color: #00aaff; }
.markers .marker.tone-accent   { color: #00ff88; }
.markers .marker.tone-neutral  { color: rgba(255,255,255,0.85); }
.markers .marker.dim { opacity: 0.35; }
.markers .marker:hover, .markers .marker.dim:hover { opacity: 1; }

@keyframes marker-pulse {
  0%   { transform: scale(0.7); opacity: 0.45; }
  100% { transform: scale(1.8); opacity: 0; }
}

.label {
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 600;
  pointer-events: none;
}

/* Tooltip */
.tooltip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, calc(-100% - 12px));
  background: rgba(10, 12, 16, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 0.35rem 0.55rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  font-size: 0.72rem;
  color: rgba(255,255,255,0.9);
  max-width: 280px;
}
.tooltip.pinned {
  pointer-events: auto;
  border-color: var(--primary-blue, #00aaff);
}
.tooltip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%) rotate(45deg);
  width: 8px; height: 8px;
  background: rgba(10, 12, 16, 0.95);
  border-right: 1px solid rgba(255,255,255,0.1);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.t-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.t-dot.tone-positive { background: #00ff88; box-shadow: 0 0 4px #00ff88; }
.t-dot.tone-negative { background: #ff4d6a; box-shadow: 0 0 4px #ff4d6a; }
.t-dot.tone-warning  { background: #ffaa00; box-shadow: 0 0 4px #ffaa00; }
.t-dot.tone-info     { background: #00aaff; box-shadow: 0 0 4px #00aaff; }
.t-dot.tone-accent   { background: #00ff88; box-shadow: 0 0 4px #00ff88; }
.t-dot.tone-neutral  { background: rgba(255,255,255,0.8); }
.t-label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-group {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  padding: 1px 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 999px;
  font-weight: 700;
}

/* Controls */
.controls {
  position: absolute;
  bottom: 0.45rem;
  right: 0.45rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: rgba(10, 12, 16, 0.85);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: 0.2rem 0.3rem;
  backdrop-filter: blur(8px);
}
.controls button {
  background: none;
  border: none;
  color: rgba(255,255,255,0.75);
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 0.15s ease;
}
.controls button:hover:not(:disabled) {
  background: rgba(0,170,255,0.15);
  color: var(--primary-blue, #00aaff);
}
.controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.zoom-pill {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.55);
  padding: 0 0.45rem;
  font-variant-numeric: tabular-nums;
}
</style>
