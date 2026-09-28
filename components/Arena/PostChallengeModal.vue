<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="backdrop" @click="close">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Post a data challenge" @click.stop>
          <header class="header">
            <div>
              <p class="eyebrow">Arena · free credits only</p>
              <h3>Post data for the community to bet on</h3>
            </div>
            <button class="close" type="button" aria-label="Close" @click="close">✕</button>
          </header>

          <div class="kind-toggle" role="group" aria-label="Challenge kind">
            <button :class="{ active: form.kind === 'market' }" @click="form.kind = 'market'">
              Pick against a real asset
            </button>
            <button :class="{ active: form.kind === 'custom' }" @click="form.kind = 'custom'">
              Post my own data/claim
            </button>
          </div>

          <div class="grid">
            <label class="full">
              <span>Title</span>
              <input v-model="form.title" type="text" maxlength="140" placeholder="What's the claim?" />
            </label>
            <label class="full">
              <span>Description</span>
              <textarea
                v-model="form.description"
                rows="3"
                maxlength="500"
                :placeholder="form.kind === 'custom'
                  ? 'Describe your dataset/indicator and what counts as it coming true.'
                  : 'Optional context for the auto-settled market pick.'"
              />
            </label>

            <template v-if="form.kind === 'market'">
              <label>
                <span>Asset</span>
                <select v-model="form.asset_id">
                  <option v-for="a in assetOptions" :key="a.id" :value="a.id">{{ a.symbol }} — {{ a.name }}</option>
                </select>
              </label>
              <label>
                <span>Direction</span>
                <select v-model="form.comparator">
                  <option value="above">Closes above</option>
                  <option value="below">Closes below</option>
                </select>
              </label>
              <label>
                <span>Target price</span>
                <input v-model.number="form.target_price" type="number" min="0" step="0.01" />
              </label>
            </template>

            <label>
              <span>Resolves in (hours)</span>
              <input v-model.number="form.resolves_in_hours" type="number" min="1" max="720" />
            </label>
          </div>

          <p class="hint">
            {{ form.kind === 'custom'
              ? 'Community-voted challenges resolve by majority vote of everyone who bet — no real money, ever.'
              : 'Market challenges settle automatically against the live price feed at the deadline.' }}
          </p>

          <footer class="actions">
            <button class="btn ghost" @click="close">Cancel</button>
            <button class="btn primary" :disabled="!canSubmit" @click="submit">Post challenge</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAssetsStore } from '~/stores/assets'
import type { ChallengeKind } from '~/types/dataBet'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', payload: {
    kind: ChallengeKind
    title: string
    description: string
    resolves_in_hours: number
    asset_id?: string
    asset_symbol?: string
    comparator?: 'above' | 'below'
    target_price?: number
  }): void
}>()

const assets = useAssetsStore()
const assetOptions = computed(() => assets.assets.slice(0, 40))

const form = ref({
  kind: 'market' as ChallengeKind,
  title: '',
  description: '',
  resolves_in_hours: 48,
  asset_id: '',
  comparator: 'above' as 'above' | 'below',
  target_price: 0
})

const canSubmit = computed(() => {
  if (form.value.title.trim().length < 4) return false
  if (form.value.kind === 'market') {
    return !!form.value.asset_id && form.value.target_price > 0
  }
  return form.value.description.trim().length >= 12
})

const close = () => emit('update:open', false)

const submit = () => {
  if (!canSubmit.value) return
  const asset = form.value.kind === 'market' ? assets.getAssetById(form.value.asset_id) : undefined
  emit('submit', {
    kind: form.value.kind,
    title: form.value.title.trim(),
    description: form.value.description.trim() || (form.value.kind === 'market'
      ? `${asset?.symbol ?? ''} ${form.value.comparator} ${form.value.target_price}`
      : ''),
    resolves_in_hours: form.value.resolves_in_hours,
    asset_id: form.value.kind === 'market' ? form.value.asset_id : undefined,
    asset_symbol: form.value.kind === 'market' ? asset?.symbol : undefined,
    comparator: form.value.kind === 'market' ? form.value.comparator : undefined,
    target_price: form.value.kind === 'market' ? form.value.target_price : undefined
  })
  form.value = { kind: 'market', title: '', description: '', resolves_in_hours: 48, asset_id: '', comparator: 'above', target_price: 0 }
  close()
}
</script>

<style scoped>
.backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  background: #14141c;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 1.2rem;
  width: min(560px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.header { display: flex; justify-content: space-between; align-items: flex-start; }
.eyebrow { margin: 0; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.45); }
.header h3 { margin: 0.2rem 0 0; font-size: 1.05rem; }
.close { background: transparent; border: none; color: rgba(255,255,255,0.6); font-size: 1rem; cursor: pointer; }

.kind-toggle { display: flex; gap: 0.4rem; }
.kind-toggle button {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.7);
  font-size: 0.75rem;
  cursor: pointer;
}
.kind-toggle button.active {
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
  background: rgba(0,170,255,0.08);
}

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
.grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem; color: rgba(255,255,255,0.6); min-width: 0; }
.grid label.full { grid-column: 1 / -1; }
.grid input, .grid select, .grid textarea {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: inherit;
}
.grid textarea { resize: vertical; }
@media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }

.hint { margin: 0; font-size: 0.68rem; color: rgba(255,255,255,0.45); }

.actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; border: 1px solid transparent; }
.btn.ghost { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.btn.primary { background: var(--primary-gradient); color: #000; }
.btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
