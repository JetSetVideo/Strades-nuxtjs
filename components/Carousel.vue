<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import StrategyCard from '@/components/Card/Strategy.vue'

const props = defineProps<{
  strategies: Record<string, any>[]
  selectedStrategies?: Record<string, any>[]
}>()

const emit = defineEmits<{
  'select-strategy': [s: Record<string, any>]
  'copy': [s: Record<string, any>]
  'share': [s: Record<string, any>]
  'view': [s: Record<string, any>]
  'toggle': [s: Record<string, any>]
  'delete': [s: Record<string, any>]
}>()

// The featured index is the highlighted strategy
const featuredIdx = ref(0)

// Reset when strategies list changes
watch(() => props.strategies.length, () => { featuredIdx.value = 0 })

const featured = computed(() => props.strategies[featuredIdx.value] ?? null)
const others   = computed(() => props.strategies.filter((_, i) => i !== featuredIdx.value))

const isSelected = (s: Record<string, any>) =>
  (props.selectedStrategies ?? []).some(sel => sel.id === s.id)

function promote(strategy: Record<string, any>) {
  const idx = props.strategies.findIndex(s => s.id === strategy.id)
  if (idx > -1) featuredIdx.value = idx
}

// Scroll the compact row
const scrollEl = ref<HTMLElement | null>(null)
function scrollLeft()  { scrollEl.value?.scrollBy({ left: -240, behavior: 'smooth' }) }
function scrollRight() { scrollEl.value?.scrollBy({ left:  240, behavior: 'smooth' }) }
</script>

<template>
  <div class="carousel-root">

    <!-- ── Featured card ── -->
    <div v-if="featured" class="featured-wrap">
      <StrategyCard
        :strategy="featured"
        variant="featured"
        :selected="isSelected(featured)"
        @select="emit('select-strategy', featured)"
        @copy="emit('copy', featured)"
        @share="emit('share', featured)"
        @view="emit('view', featured)"
        @toggle="emit('toggle', featured)"
        @delete="emit('delete', featured)"
      />
    </div>

    <!-- ── Compact scroll row ── -->
    <div v-if="others.length" class="compact-row">
      <div class="compact-row-header">
        <span class="row-label">All strategies</span>
        <div class="row-nav">
          <button class="nav-btn" @click="scrollLeft">‹</button>
          <button class="nav-btn" @click="scrollRight">›</button>
        </div>
      </div>

      <div class="compact-scroll" ref="scrollEl">
        <div
          v-for="s in others"
          :key="s.id"
          class="compact-slot"
          :class="{ featured: strategies.indexOf(s) === featuredIdx }"
          @click="promote(s); emit('select-strategy', s)"
        >
          <StrategyCard
            :strategy="s"
            variant="compact"
            :selected="isSelected(s)"
          />
          <!-- Promote to featured indicator -->
          <div class="promote-hint">Tap to feature ↑</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!strategies.length" class="empty-carousel">
      <span class="empty-icon">📊</span>
      <p>No strategies match your filters.</p>
      <NuxtLink to="/creator" class="create-link">+ Create your first strategy →</NuxtLink>
    </div>

  </div>
</template>

<style scoped>
.carousel-root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── Featured ── */
.featured-wrap {
  width: 100%;
  animation: feat-enter 0.3s ease;
}

@keyframes feat-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Compact scroll row ── */
.compact-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

.row-nav { display: flex; gap: 4px; }

.nav-btn {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background: rgba(255,255,255,0.08);
  color: var(--text-white);
  border-color: var(--border-primary);
}

.compact-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
  scroll-snap-type: x mandatory;
}

.compact-scroll::-webkit-scrollbar { display: none; }

.compact-slot {
  position: relative;
  flex-shrink: 0;
  scroll-snap-align: start;
  cursor: pointer;
  border-radius: inherit;
}

.compact-slot:hover .promote-hint { opacity: 1; }

.promote-hint {
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  font-size: 0.55rem;
  color: var(--primary-green);
  text-align: center;
  padding: 3px;
  opacity: 0;
  transition: opacity 0.15s ease;
  border-radius: 0 0 inherit inherit;
}

/* ── Empty ── */
.empty-carousel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background: rgba(0,0,0,0.15);
  border: 1px dashed var(--border-primary);
  border-radius: var(--radius-md);
}

.empty-icon { font-size: 2.5rem; opacity: 0.3; }

.empty-carousel p {
  font-size: 0.82rem;
  color: var(--text-gray);
  margin: 0;
}

.create-link {
  font-size: 0.75rem;
  color: var(--primary-green);
  text-decoration: none;
  font-weight: 700;
}

.create-link:hover { text-decoration: underline; }
</style>
