<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface DataSource {
  id: string
  name: string
  category: string
  icon: string
  description: string
  latency: string
  cost: number
  reliability: number
  supported_assets: string[]
  tags: string[]
}

const props = defineProps<{
  modelValue: string[]
  searchQuery?: string       // passed from parent (section header)
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string[]] }>()

const sources   = ref<DataSource[]>([])
const activecat = ref('all')
const expanded  = ref(false)

const VISIBLE_ROWS = 2  // rows visible before expand
const COLS         = 2  // grid columns

const CATS = [
  { id: 'all',         label: 'All',        icon: '🌐' },
  { id: 'market',      label: 'Market',     icon: '📊' },
  { id: 'sentiment',   label: 'Sentiment',  icon: '💬' },
  { id: 'blockchain',  label: 'On-Chain',   icon: '⛓' },
  { id: 'macro',       label: 'Macro',      icon: '🌍' },
  { id: 'fundamental', label: 'Fund.',      icon: '🧮' },
  { id: 'derivatives', label: 'Deriv.',     icon: '⚡' },
  { id: 'ai',          label: 'AI',         icon: '🤖' },
]

onMounted(async () => {
  try { sources.value = await $fetch<DataSource[]>('/data/Datasources.json') }
  catch { sources.value = [] }
})

const filtered = computed(() => {
  let list = sources.value
  if (activecat.value !== 'all') list = list.filter(s => s.category === activecat.value)
  const q = (props.searchQuery ?? '').trim().toLowerCase()
  if (q) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return list
})

const visibleCards    = computed(() => expanded.value ? filtered.value : filtered.value.slice(0, VISIBLE_ROWS * COLS))
const hiddenCount     = computed(() => Math.max(0, filtered.value.length - visibleCards.value.length))
const selected        = computed(() => props.modelValue ?? [])

const isSelected = (id: string) => selected.value.includes(id)

function toggle(id: string) {
  const current = [...selected.value]
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  emit('update:modelValue', current)
}

const pulseMs = (latency: string): string => {
  const map: Record<string, string> = {
    'real-time': '0.8s', '1min': '1.2s', '5min': '1.8s',
    '15min': '2.4s', '1h': '3.5s', 'daily': '6s',
  }
  return map[latency] ?? '3s'
}

const reliabilityColor = (r: number) => {
  if (r >= 0.97) return 'var(--success-green)'
  if (r >= 0.9)  return 'var(--primary-green)'
  if (r >= 0.8)  return 'var(--warning-orange)'
  return 'var(--error-red)'
}
</script>

<template>
  <div class="datasources-selector">

    <!-- Category filter strip -->
    <div class="cat-strip">
      <button
        v-for="c in CATS"
        :key="c.id"
        class="cat-btn"
        :class="{ active: activecat === c.id }"
        @click="activecat = c.id"
      >
        {{ c.icon }} {{ c.label }}
      </button>
    </div>

    <!-- Grid of cards (height-limited) -->
    <div class="ds-grid" :class="{ expanded }">
      <button
        v-for="src in visibleCards"
        :key="src.id"
        type="button"
        class="ds-card"
        :class="{ selected: isSelected(src.id) }"
        :style="{ '--pulse-dur': pulseMs(src.latency) }"
        @click="toggle(src.id)"
      >
        <div v-if="isSelected(src.id)" class="sel-ring" />

        <div class="ds-card-head">
          <span class="ds-icon">{{ src.icon }}</span>
          <span class="ds-name">{{ src.name }}</span>
          <span class="ds-check">{{ isSelected(src.id) ? '✓' : '' }}</span>
        </div>

        <p class="ds-desc">{{ src.description }}</p>

        <div class="ds-meta">
          <span class="latency-badge">
            <span class="latency-dot" :class="{ pulsing: isSelected(src.id) }" />
            {{ src.latency }}
          </span>
          <span class="reliability" :style="{ color: reliabilityColor(src.reliability) }">
            ●{{ Math.round(src.reliability * 100) }}%
          </span>
          <span class="cost-badge" :class="{ free: src.cost === 0 }">
            {{ src.cost === 0 ? 'FREE' : `+${src.cost} cr` }}
          </span>
        </div>

        <div class="asset-tags">
          <span v-for="a in src.supported_assets" :key="a" class="a-tag">{{ a }}</span>
        </div>
      </button>
    </div>

    <!-- Expand / collapse control -->
    <button
      v-if="filtered.length > VISIBLE_ROWS * COLS"
      class="expand-btn"
      @click="expanded = !expanded"
    >
      <span v-if="!expanded">▼ Show {{ hiddenCount }} more source{{ hiddenCount !== 1 ? 's' : '' }}</span>
      <span v-else>▲ Show less</span>
    </button>

    <p v-if="!filtered.length" class="ds-empty">
      <template v-if="searchQuery">No sources match "{{ searchQuery }}".</template>
      <template v-else>No sources in this category.</template>
    </p>
  </div>
</template>

<style scoped>
.datasources-selector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* ── Category strip ── */
.cat-strip {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 4px;
}

.cat-strip::-webkit-scrollbar { display: none; }

.cat-btn {
  white-space: nowrap;
  font-size: 0.62rem;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.cat-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-white); }
.cat-btn.active {
  background: rgba(0,255,136,0.1);
  border-color: rgba(0,255,136,0.4);
  color: var(--primary-green);
}

/* ── Cards grid ── */
.ds-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
  /* Clip to ~2 rows of content; smooth expand */
  max-height: 300px;
  overflow: hidden;
  transition: max-height 0.35s ease;
}

.ds-grid.expanded {
  max-height: 2000px;
}

@media (max-width: 480px) {
  .ds-grid { grid-template-columns: 1fr; max-height: 480px; }
  .ds-grid.expanded { max-height: 4000px; }
}

.ds-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
  overflow: hidden;
}

.ds-card:hover {
  border-color: var(--border-primary);
  background: rgba(255,255,255,0.04);
  transform: translateY(-1px);
}

.ds-card.selected {
  border-color: var(--primary-green);
  background: rgba(0,255,136,0.06);
}

.sel-ring {
  position: absolute;
  inset: -1px;
  border: 2px solid var(--primary-green);
  border-radius: inherit;
  pointer-events: none;
  animation: ring-pulse 2s ease infinite;
}

@keyframes ring-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

.ds-card-head { display: flex; align-items: center; gap: 6px; }
.ds-icon  { font-size: 1rem; flex-shrink: 0; }
.ds-name  { font-size: 0.78rem; font-weight: 700; color: var(--text-white); flex: 1; }
.ds-check { font-size: 0.8rem; color: var(--primary-green); font-weight: 700; width: 14px; text-align: center; }

.ds-desc {
  font-size: 0.63rem;
  color: var(--text-gray);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ds-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.latency-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.58rem;
  color: var(--text-light-gray);
}

.latency-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-gray);
  flex-shrink: 0;
}

.latency-dot.pulsing {
  background: var(--primary-green);
  animation: latency-pulse var(--pulse-dur) ease infinite;
}

@keyframes latency-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(2.2); opacity: 0.3; }
}

.reliability { font-size: 0.58rem; font-weight: 600; }

.cost-badge {
  margin-left: auto;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--warning-orange);
  background: rgba(255,160,0,0.12);
  padding: 2px 6px;
  border-radius: 999px;
}

.cost-badge.free {
  color: var(--success-green);
  background: rgba(76,175,80,0.12);
}

.asset-tags { display: flex; flex-wrap: wrap; gap: 3px; }

.a-tag {
  font-size: 0.52rem;
  color: var(--text-gray);
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 999px;
  text-transform: capitalize;
}

/* ── Expand button ── */
.expand-btn {
  align-self: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primary-green);
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.25);
  border-radius: 999px;
  padding: 5px 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.expand-btn:hover {
  background: rgba(0,255,136,0.16);
  border-color: rgba(0,255,136,0.5);
}

.ds-empty {
  font-size: 0.72rem;
  color: var(--text-gray);
  text-align: center;
  padding: var(--spacing-md);
  font-style: italic;
}
</style>
