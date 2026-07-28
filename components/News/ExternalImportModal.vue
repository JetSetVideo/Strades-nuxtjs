<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', payload: {
    url: string
    title: string
    summary: string
    sourceLabel?: string
    company?: string
    currencies?: string[]
    commodities?: string[]
    category?: string
    politicalLeaning?: number
    sentiment?: number
    area?: string
  }): void
}>()

const form = ref({
  url: '',
  title: '',
  summary: '',
  sourceLabel: '',
  company: '',
  currencies: '',
  commodities: '',
  category: 'macro',
  politicalLeaning: 0,
  sentiment: 0,
  area: '',
})

const canSubmit = computed(() =>
  /^https?:\/\//i.test(form.value.url) &&
  form.value.title.trim().length >= 4 &&
  form.value.summary.trim().length >= 12
)

const close = () => emit('update:open', false)

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    url: form.value.url.trim(),
    title: form.value.title.trim(),
    summary: form.value.summary.trim(),
    sourceLabel: form.value.sourceLabel.trim() || undefined,
    company: form.value.company.trim() || undefined,
    currencies: form.value.currencies.split(',').map(value => value.trim().toUpperCase()).filter(Boolean),
    commodities: form.value.commodities.split(',').map(value => value.trim().toUpperCase()).filter(Boolean),
    category: form.value.category,
    politicalLeaning: form.value.politicalLeaning,
    sentiment: form.value.sentiment,
    area: form.value.area.trim() || undefined,
  })
  form.value = {
    url: '',
    title: '',
    summary: '',
    sourceLabel: '',
    company: '',
    currencies: '',
    commodities: '',
    category: 'macro',
    politicalLeaning: 0,
    sentiment: 0,
    area: '',
  }
  close()
}

watch(() => props.open, isOpen => {
  if (typeof document !== 'undefined') document.body.style.overflow = isOpen ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="backdrop" @click="close">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Import external article" @click.stop>
          <header class="header">
            <div>
              <p class="eyebrow">External link import</p>
              <h3>Capture a source manually</h3>
            </div>
            <button class="close" type="button" aria-label="Close" @click="close">✕</button>
          </header>

          <div class="grid">
            <label>
              <span>URL</span>
              <input v-model="form.url" type="url" placeholder="https://example.com/article" />
            </label>
            <label>
              <span>Source</span>
              <input v-model="form.sourceLabel" type="text" placeholder="Reuters, Bloomberg, company blog..." />
            </label>
            <label class="full">
              <span>Title</span>
              <input v-model="form.title" type="text" placeholder="Headline from the external source" />
            </label>
            <label class="full">
              <span>Summary</span>
              <textarea v-model="form.summary" rows="5" placeholder="Summarize the article. The app will treat this as manual provenance, not scraped enrichment." />
            </label>
            <label>
              <span>Company or ticker</span>
              <input v-model="form.company" type="text" placeholder="TSLA, EUR/USD, XAU..." />
            </label>
            <label>
              <span>Category</span>
              <select v-model="form.category">
                <option value="macro">Macro</option>
                <option value="crypto">Crypto</option>
                <option value="stocks">Stocks</option>
                <option value="forex">Forex</option>
                <option value="commodities">Commodities</option>
              </select>
            </label>
            <label>
              <span>Currencies</span>
              <input v-model="form.currencies" type="text" placeholder="USD, EUR, JPY" />
            </label>
            <label>
              <span>Commodities</span>
              <input v-model="form.commodities" type="text" placeholder="XAU, BRN, HG" />
            </label>
            <label>
              <span>Area</span>
              <input v-model="form.area" type="text" placeholder="Tokyo, Kyiv, United States..." />
            </label>
            <label>
              <span>Political leaning</span>
              <input v-model.number="form.politicalLeaning" type="range" min="-1" max="1" step="0.1" />
            </label>
            <label class="full">
              <span>Market sentiment</span>
              <input v-model.number="form.sentiment" type="range" min="-1" max="1" step="0.1" />
            </label>
          </div>

          <footer class="footer">
            <button class="ghost" type="button" @click="close">Cancel</button>
            <button class="primary" type="button" :disabled="!canSubmit" @click="submit">Import article</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(10px);
}

.modal {
  width: min(840px, 100%);
  max-height: min(90vh, 920px);
  overflow: auto;
  border-radius: var(--radius-xl, 16px);
  background: var(--surface-overlay, linear-gradient(180deg, rgba(35, 38, 50, 0.97), rgba(20, 22, 30, 0.98)));
  border: 1px solid var(--edge-lit, rgba(255, 255, 255, 0.14));
  box-shadow: var(--shadow-depth-3, 0 14px 36px rgba(0,0,0,0.55));
  padding: 1rem;
  color: rgba(255, 255, 255, 0.88);
}

.header,
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.header h3 {
  margin: 0;
}

.close,
.ghost,
.primary {
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
}

.primary {
  background: rgba(0, 255, 136, 0.12);
  color: var(--primary-green, #00ff88);
  border-color: rgba(0, 255, 136, 0.35);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin: 1rem 0;
}

.full {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

label span {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.58);
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.9);
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active {
    transition: none;
  }
}
</style>
