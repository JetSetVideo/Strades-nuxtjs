<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'publish', post: Record<string, unknown>): void
}>()

const CATEGORIES = ['macro', 'crypto', 'stocks', 'commodities', 'geopolitics', 'tech']

const content = ref('')
const category = ref<string>('macro')
const sentiment = ref(0)          // −1 … +1
const attachAllocation = ref(false)

const maxLen = 500
const remaining = computed(() => maxLen - content.value.length)
const canPublish = computed(() => content.value.trim().length >= 3 && remaining.value >= 0)

const sentimentLabel = computed(() => {
  if (sentiment.value > 0.33) return 'Bullish'
  if (sentiment.value < -0.33) return 'Bearish'
  return 'Neutral'
})
const sentimentColor = computed(() => {
  if (sentiment.value > 0.33) return 'var(--primary-green, #00ff88)'
  if (sentiment.value < -0.33) return 'var(--error-red, #ff4d6a)'
  return 'var(--primary-blue, #00aaff)'
})

const close = () => emit('update:open', false)

const publish = () => {
  if (!canPublish.value) return
  const { getUserId } = useCurrentUser()
  const alloc = useAllocationStore().allocationPie
  const post: Record<string, unknown> = {
    id: `post_local_${Date.now()}`,
    author_id: getUserId(),
    content: content.value.trim(),
    category: category.value,
    sentiment: sentiment.value,
    political_leaning: 0,
    economic_leaning: sentiment.value * 0.5,
    controversy_index: Math.abs(sentiment.value) * 0.4,
    weight: 0.6,
    published_at: new Date().toISOString(),
    interactions: { likes: 0, comments: 0, shares: 0 },
    ...(attachAllocation.value
      ? { embedded_allocation: {
          fiat: Math.round(alloc.fiat),
          crypto: Math.round(alloc.crypto),
          stocks: Math.round(alloc.stocks),
          commodities: Math.round(alloc.commodities)
        } }
      : {})
  }
  emit('publish', post)
  content.value = ''
  sentiment.value = 0
  attachAllocation.value = false
  close()
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="composer-fade">
      <div v-if="open" class="composer-backdrop" @click="close">
        <div class="composer-modal" role="dialog" aria-label="Publish a note" @click.stop>
          <header class="head">
            <h3>Publish a note</h3>
            <button class="close" aria-label="Close" @click="close">✕</button>
          </header>

          <textarea
            v-model="content"
            class="body-input"
            :maxlength="maxLen"
            rows="5"
            placeholder="Your market take, signal or note…"
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
  z-index: 220;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem;
}
.composer-modal {
  width: min(560px, 100%);
  background: linear-gradient(180deg, rgba(18,20,26,0.98), rgba(10,12,16,0.98));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.65);
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
</style>
