<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'publish', post: {
    title?: string
    content: string
    category: string
    sentiment: number
    allocation?: { fiat: number; crypto: number; stocks: number; commodities: number }
    assets?: string[]
    geographicOrigin?: { lat: number; lng: number; name?: string; area?: string }
  }): void
}>()

const CATEGORIES = ['macro', 'crypto', 'stocks', 'commodities', 'forex']
const title = ref('')
const content = ref('')
const category = ref<string>('macro')
const sentiment = ref(0)
const attachAllocation = ref(false)
const assets = ref('')
const locationName = ref('')
const maxLen = 700
const remaining = computed(() => maxLen - content.value.length)
const canPublish = computed(() => content.value.trim().length >= 12 && remaining.value >= 0)

const sentimentLabel = computed(() => {
  if (sentiment.value > 0.33) return 'Bullish'
  if (sentiment.value < -0.33) return 'Bearish'
  return 'Neutral'
})
const sentimentColor = computed(() => {
  if (sentiment.value > 0.33) return 'var(--primary-green, #00ff88)'
  if (sentiment.value < -0.33) return '#ff667a'
  return 'var(--primary-blue, #00aaff)'
})

const close = () => emit('update:open', false)

const reset = () => {
  title.value = ''
  content.value = ''
  category.value = 'macro'
  sentiment.value = 0
  attachAllocation.value = false
  assets.value = ''
  locationName.value = ''
}

const publish = () => {
  if (!canPublish.value) return
  const alloc = useAllocationStore().allocationPie
  emit('publish', {
    title: title.value.trim() || undefined,
    content: content.value.trim(),
    category: category.value,
    sentiment: sentiment.value,
    assets: assets.value.split(',').map(value => value.trim().toUpperCase()).filter(Boolean),
    geographicOrigin: locationName.value.trim()
      ? { lat: 0, lng: 0, name: locationName.value.trim(), area: locationName.value.trim() }
      : undefined,
    allocation: attachAllocation.value
      ? {
          fiat: Math.round(alloc.fiat),
          crypto: Math.round(alloc.crypto),
          stocks: Math.round(alloc.stocks),
          commodities: Math.round(alloc.commodities),
        }
      : undefined,
  })
  reset()
  close()
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, v => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) reset()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="composer-fade">
      <div v-if="open" class="composer-backdrop" @click="close">
        <div class="composer-modal" role="dialog" aria-modal="true" aria-label="Publish a note" @click.stop>
          <header class="head">
            <h3>Write an article or signal</h3>
            <button class="close" aria-label="Close" @click="close">✕</button>
          </header>

          <input
            v-model="title"
            class="body-input"
            type="text"
            maxlength="120"
            placeholder="Headline or thesis"
          >

          <textarea
            v-model="content"
            class="body-input"
            :maxlength="maxLen"
            rows="5"
            placeholder="Your market take, source summary, note or analysis..."
            autofocus
          />
          <div class="meta-row">
            <span class="counter" :class="{ low: remaining < 40 }">{{ remaining }}</span>
          </div>

          <div class="section">
            <span class="section-label">Category</span>
            <div class="chips">
              <button
                v-for="c in CATEGORIES"
                :key="c"
                :class="['chip', { active: category === c }]"
                @click="category = c"
              >{{ c }}</button>
            </div>
          </div>

          <div class="grid">
            <label class="field">
              <span class="section-label">Assets</span>
              <input v-model="assets" class="body-input compact" type="text" placeholder="BTC, TSLA, EUR/USD" />
            </label>
            <label class="field">
              <span class="section-label">Area</span>
              <input v-model="locationName" class="body-input compact" type="text" placeholder="New York, Singapore..." />
            </label>
          </div>

          <div class="section">
            <span class="section-label">
              Sentiment — <strong :style="{ color: sentimentColor }">{{ sentimentLabel }}</strong>
            </span>
            <input
              v-model.number="sentiment"
              type="range" min="-1" max="1" step="0.05"
              class="sentiment-slider"
              :style="{ '--thumb-color': sentimentColor }"
            >
            <div class="slider-scale"><span>Bearish</span><span>Neutral</span><span>Bullish</span></div>
          </div>

          <label class="alloc-toggle">
            <input v-model="attachAllocation" type="checkbox">
            <span>Attach my current allocation</span>
          </label>

          <footer class="foot">
            <button class="cancel" @click="close">Cancel</button>
            <button class="publish" :disabled="!canPublish" @click="publish">Publish</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.composer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(5px);
  z-index: var(--z-modal-backdrop, 1040);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem;
}
.composer-modal {
  width: min(560px, 100%);
  background: var(--surface-overlay, linear-gradient(180deg, rgba(35,38,50,0.97), rgba(20,22,30,0.98)));
  border: 1px solid var(--edge-lit, rgba(255,255,255,0.14));
  border-radius: var(--radius-xl, 16px);
  box-shadow: var(--shadow-depth-3, 0 24px 60px rgba(0,0,0,0.65));
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.head h3 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
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

.body-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 96px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.92);
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
  padding: 0.6rem 0.7rem;
  outline: none;
  transition: border-color 0.2s;
}
.compact { min-height: auto; }
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.body-input:focus { border-color: var(--primary-green, #00ff88); }

.meta-row { display: flex; justify-content: flex-end; margin-top: -0.35rem; }
.counter {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.35);
  font-variant-numeric: tabular-nums;
}
.counter.low { color: var(--warning-orange, #ffaa00); }

.section { display: flex; flex-direction: column; gap: 0.35rem; }
.section-label {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.chips { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.chip {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.7);
  font-size: 0.62rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  transition: all 0.15s ease;
}
.chip.active {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}

.sentiment-slider {
  width: 100%;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff4d6a, rgba(255,255,255,0.25), #00ff88);
  outline: none;
  cursor: pointer;
}
.sentiment-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--thumb-color, #00aaff);
  border: 2px solid rgba(0,0,0,0.6);
  box-shadow: 0 0 6px var(--thumb-color, #00aaff);
  cursor: grab;
}
.slider-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.alloc-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.65);
  cursor: pointer;
  user-select: none;
}
.alloc-toggle input { accent-color: var(--primary-green, #00ff88); }

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 0.7rem;
}
.cancel {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  font-size: 0.7rem;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.cancel:hover { color: #fff; background: rgba(255,255,255,0.05); }
.publish {
  background: linear-gradient(135deg, rgba(0,255,136,0.9), rgba(0,200,110,0.9));
  border: none;
  color: #001a0d;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.4rem 1.1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.publish:hover:not(:disabled) { box-shadow: 0 0 12px rgba(0,255,136,0.4); transform: translateY(-1px); }
.publish:disabled { opacity: 0.35; cursor: not-allowed; }

.composer-fade-enter-from, .composer-fade-leave-to { opacity: 0; }
.composer-fade-enter-active, .composer-fade-leave-active { transition: opacity 0.18s ease; }
.composer-fade-enter-from .composer-modal { transform: translateY(12px); }
.composer-fade-enter-active .composer-modal { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1); }

@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .composer-fade-enter-active,
  .composer-fade-leave-active,
  .composer-fade-enter-active .composer-modal {
    transition: none;
  }
}
</style>
