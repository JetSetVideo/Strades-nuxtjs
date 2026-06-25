<script setup lang="ts">
import { computed } from 'vue'

interface Wallet {
  id: string
  name: string
  type?: string
  total_value: number
  daily_change_percentage?: number
  currency?: string
}

const props = defineProps<{ wallets: Wallet[]; activeId: string }>()
const emit = defineEmits<{ (e: 'switch', id: string): void }>()

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n)}`
}
</script>

<template>
  <nav class="wallet-switcher" aria-label="Wallets">
    <button
      v-for="w in wallets"
      :key="w.id"
      :class="['chip', { active: w.id === activeId, neg: (w.daily_change_percentage ?? 0) < 0 }]"
      @click="emit('switch', w.id)"
    >
      <span class="head">
        <span class="dot" />
        <span class="name">{{ w.name }}</span>
      </span>
      <span class="meta">
        <span class="bal">{{ fmt(w.total_value) }}</span>
        <span class="pct">{{ (w.daily_change_percentage ?? 0) >= 0 ? '+' : '' }}{{ (w.daily_change_percentage ?? 0).toFixed(2) }}%</span>
      </span>
    </button>

    <button class="chip add" aria-label="Add wallet">
      <span class="plus">+</span>
      <span class="add-label">Add wallet</span>
    </button>
  </nav>
</template>

<style scoped>
.wallet-switcher {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.15rem;
  scroll-snap-type: x proximity;
  min-width: 0;
}
.wallet-switcher::-webkit-scrollbar { display: none; }

.chip {
  flex: 0 0 auto;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: 0.45rem 0.7rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 8px);
  cursor: pointer;
  color: rgba(255,255,255,0.85);
  text-align: left;
  font-family: inherit;
  min-width: 130px;
  transition: border-color 0.2s ease, transform 0.18s ease;
}
.chip:hover { border-color: rgba(0,255,136,0.35); transform: translateY(-1px); }

.chip.active {
  border-color: var(--primary-green, #00ff88);
  background: linear-gradient(135deg, rgba(0,255,136,0.05), rgba(14,14,18,0.92));
  box-shadow: 0 4px 14px rgba(0,255,136,0.08);
}

.head { display: flex; align-items: center; gap: 0.35rem; min-width: 0; }
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,0.25);
  flex-shrink: 0;
}
.chip.active .dot { background: var(--primary-green, #00ff88); box-shadow: 0 0 6px var(--primary-green, #00ff88); }
.name {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 9rem;
}

.meta {
  display: flex; align-items: baseline; gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.bal { font-size: 0.85rem; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
.pct {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--success-green, #00ff88);
}
.chip.neg .pct { color: #ff4d6a; }

.chip.add {
  border-style: dashed;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 0.35rem;
  color: rgba(255,255,255,0.55);
}
.chip.add:hover { color: var(--primary-green, #00ff88); }
.plus { font-size: 0.95rem; font-weight: 700; }
.add-label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}
</style>
