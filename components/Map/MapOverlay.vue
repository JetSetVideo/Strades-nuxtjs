<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import WorldMap, { type MapMarker, type MapRoute } from '~/components/Map/WorldMap.vue'

const props = withDefaults(defineProps<{
  open: boolean
  markers?: MapMarker[]
  routes?: MapRoute[]
  title?: string
  subtitle?: string
}>(), {
  markers: () => [],
  routes: () => [],
  title: 'Geography',
  subtitle: ''
})

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const close = () => emit('update:open', false)

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) close()
}

const groupFilter = ref<string | null>(null)
const highlightId = ref<string | null>(null)

const availableGroups = computed(() => {
  const set = new Set<string>()
  props.markers.forEach(m => { if (m.group) set.add(m.group) })
  return Array.from(set)
})

const filteredMarkers = computed(() => {
  if (!groupFilter.value) return props.markers
  return props.markers.filter(m => m.group === groupFilter.value)
})

const filteredRoutes = computed(() => {
  if (!groupFilter.value) return props.routes
  // Keep only routes with at least one endpoint at a visible marker position
  const key = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`
  const visible = new Set(filteredMarkers.value.map(m => key(m.lat, m.lng)))
  return props.routes.filter(r =>
    visible.has(key(r.from.lat, r.from.lng)) || visible.has(key(r.to.lat, r.to.lng))
  )
})

// Group counts for filter chips
const groupCounts = computed(() => {
  const out: Record<string, number> = {}
  props.markers.forEach(m => {
    const k = m.group || 'other'
    out[k] = (out[k] ?? 0) + 1
  })
  return out
})

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="map-fade">
      <div v-if="open" class="map-backdrop" @click="close">
        <div class="map-modal" @click.stop role="dialog" :aria-label="title">
          <header class="modal-head">
            <div class="title-stack">
              <span class="head-icon">◯</span>
              <div>
                <h3>{{ title }}</h3>
                <p v-if="subtitle" class="sub">{{ subtitle }}</p>
              </div>
            </div>
            <button class="close" @click="close" aria-label="Close">✕</button>
          </header>

          <div class="filter-row" v-if="availableGroups.length > 1">
            <button
              :class="{ active: groupFilter === null }"
              @click="groupFilter = null"
            >All <em>{{ markers.length }}</em></button>
            <button
              v-for="g in availableGroups"
              :key="g"
              :class="{ active: groupFilter === g }"
              @click="groupFilter = g"
            >
              {{ g }} <em>{{ groupCounts[g] || 0 }}</em>
            </button>
          </div>

          <div class="map-area">
            <WorldMap
              :markers="filteredMarkers"
              :routes="filteredRoutes"
              :height="440"
              :show-grid="true"
              :show-labels="false"
              :fit-on-load="true"
              :highlight-id="highlightId"
              @marker-click="(id) => highlightId = id === highlightId ? null : id"
            />
          </div>

          <div class="legend-row">
            <ul v-if="filteredMarkers.length" class="markers-list">
              <li
                v-for="m in filteredMarkers.slice(0, 12)"
                :key="m.id"
                :class="['marker-item', `tone-${m.tone || 'neutral'}`, { active: highlightId === m.id }]"
                @mouseenter="highlightId = m.id"
                @mouseleave="highlightId = null"
              >
                <span class="dot" />
                <span class="m-label">{{ m.label || m.id }}</span>
                <span class="m-meta">{{ m.lat.toFixed(1) }}, {{ m.lng.toFixed(1) }}</span>
              </li>
              <li v-if="filteredMarkers.length > 12" class="more">+ {{ filteredMarkers.length - 12 }} more</li>
            </ul>
            <div v-else class="empty">No markers to show.</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.map-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(5px);
  z-index: 220;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 5vh 1rem 1rem 1rem;
}

.map-modal {
  width: min(1100px, 100%);
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(15,15,20,0.97), rgba(10,12,16,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.65);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 0.95rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  gap: 0.6rem;
}
.title-stack { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.head-icon {
  font-size: 1.05rem;
  color: var(--primary-blue, #00aaff);
  filter: drop-shadow(0 0 4px var(--primary-blue, #00aaff));
}
.title-stack h3 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
}
.sub {
  margin: 0;
  font-size: 0.68rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
}
.close {
  background: rgba(255,255,255,0.05);
  border: none;
  color: rgba(255,255,255,0.65);
  width: 1.6rem; height: 1.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}
.close:hover { color: #fff; background: rgba(255,255,255,0.12); }

.filter-row {
  display: flex;
  gap: 0.2rem;
  padding: 0.5rem 0.95rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  overflow-x: auto;
  scrollbar-width: none;
}
.filter-row::-webkit-scrollbar { display: none; }
.filter-row button {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  font-size: 0.62rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: inherit;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.filter-row button em {
  font-style: normal;
  margin-left: 0.25rem;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.45);
  font-weight: 600;
}
.filter-row button.active {
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
  background: rgba(0, 170, 255, 0.08);
}

.map-area {
  padding: 0.6rem 0.95rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.legend-row {
  padding: 0.5rem 0.95rem 0.9rem 0.95rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  overflow-y: auto;
  max-height: 30vh;
}
.markers-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 0.3rem;
}
.marker-item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: center;
  padding: 0.3rem 0.45rem;
  border-radius: 4px;
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  font-size: 0.72rem;
  min-width: 0;
}
.marker-item:hover, .marker-item.active {
  background: rgba(0,170,255,0.06);
}
.marker-item .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.marker-item.tone-positive { color: #00ff88; }
.marker-item.tone-negative { color: #ff4d6a; }
.marker-item.tone-warning  { color: #ffaa00; }
.marker-item.tone-info     { color: #00aaff; }
.marker-item.tone-accent   { color: #00ff88; }
.marker-item.tone-neutral  { color: rgba(255,255,255,0.85); }
.m-label {
  color: rgba(255,255,255,0.85);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.m-meta {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.4);
  font-family: ui-monospace, Menlo, monospace;
  white-space: nowrap;
}
.more {
  padding: 0.3rem 0.45rem;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.06em;
  text-align: center;
}
.empty {
  padding: 1rem;
  text-align: center;
  color: rgba(255,255,255,0.45);
  font-size: 0.78rem;
}

.map-fade-enter-from, .map-fade-leave-to { opacity: 0; }
.map-fade-enter-active, .map-fade-leave-active { transition: opacity 0.18s ease; }
</style>
