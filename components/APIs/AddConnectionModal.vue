<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'pick', kind: 'crypto_exchange' | 'stock_broker' | 'bank' | 'commodity_vault'): void
}>()

const close = () => emit('update:open', false)

interface Kind {
  id: 'crypto_exchange' | 'stock_broker' | 'bank' | 'commodity_vault'
  label: string
  icon: string
}

const kinds: Kind[] = [
  { id: 'crypto_exchange', label: 'Crypto exchange', icon: '₿' },
  { id: 'stock_broker',    label: 'Stock broker',    icon: 'RH' },
  { id: 'bank',            label: 'Bank',            icon: 'C' },
  { id: 'commodity_vault', label: 'Commodity vault', icon: 'Au' }
]
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal-back" @click="close">
        <div class="modal" @click.stop>
          <header class="modal-head">
            <h3>Add connection</h3>
            <button class="modal-close" @click="close" aria-label="Close">✕</button>
          </header>
          <div class="modal-body">
            <p class="modal-intro">
              Connect a broker, exchange, bank, or vault. Strades reads balances + positions
              and (with trade permission) routes orders from your strategies.
            </p>
            <div class="kind-grid">
              <button
                v-for="k in kinds"
                :key="k.id"
                class="kind-btn"
                @click="emit('pick', k.id)"
              >
                <span class="k-icon">{{ k.icon }}</span>
                {{ k.label }}
              </button>
            </div>
            <p class="modal-note">Connection setup is mocked in this prototype.</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem 1rem;
}
.modal {
  width: min(540px, 100%);
  background: linear-gradient(180deg, rgba(20,20,28,0.97), rgba(14,14,18,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 0.95rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.modal-head h3 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}
.modal-close {
  background: rgba(255,255,255,0.05);
  border: none;
  color: rgba(255,255,255,0.7);
  width: 1.5rem; height: 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
}
.modal-body {
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.modal-intro {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
}
.modal-note {
  margin: 0;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  font-style: italic;
}

.kind-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
}
.kind-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.6rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.15s ease;
}
.kind-btn:hover {
  border-color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.06);
}
.k-icon {
  width: 24px; height: 24px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,170,255,0.15);
  color: var(--primary-blue, #00aaff);
  font-weight: 800;
  font-size: 0.78rem;
}

.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
</style>
