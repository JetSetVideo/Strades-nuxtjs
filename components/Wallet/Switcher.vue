<script setup lang="ts">
interface Wallet {
  id: string
  name: string
  type?: string
  total_value: number
  daily_change_percentage?: number
  currency?: string
}

const props = defineProps<{
  wallets: Wallet[]
  activeId: string
  /** Portfolio total across wallets — shown left of the chips. */
  totalBalance?: number | null
  /** Value-weighted daily % across all wallets. */
  totalChangePct?: number | null
}>()
const emit = defineEmits<{ (e: 'switch', id: string): void }>()

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

const fmtFull = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`

const totalPct = computed(() => props.totalChangePct ?? 0)
const totalPctLabel = computed(() =>
  `${totalPct.value >= 0 ? '+' : ''}${totalPct.value.toFixed(2)}%`
)

// The "+ Add wallet" chip used to be a button with NO handler — clicking it did
// nothing. /trade is where a wallet is created or imported, and it had no entry
// point anywhere in the app, so this was the only visible way in for a user who
// already had a wallet... and it was dead. `navigateTo` is auto-imported by Nuxt.
const openTrade = () => navigateTo('/trade')
</script>

<template>
  <nav class="wallet-switcher" aria-label="Wallets">
    <div
      v-if="totalBalance != null"
      :class="['chip', 'total', { neg: totalPct < 0 }]"
      title="Total balance across your wallets"
    >
      <span class="label">Total Balance</span>
      <span class="meta">
        <span class="bal">{{ fmtFull(totalBalance) }}</span>
        <span class="pct">{{ totalPctLabel }}</span>
      </span>
    </div>

    <button
      v-for="w in wallets"
      :key="w.id"
      type="button"
      :class="['chip', { active: w.id === activeId, neg: (w.daily_change_percentage ?? 0) < 0 }]"
      @click="emit('switch', w.id)"
    >
      <span class="head">
        <span class="dot" aria-hidden="true" />
        <span class="name">{{ w.name }}</span>
      </span>
      <span class="meta">
        <span class="bal">{{ fmt(w.total_value) }}</span>
        <span class="pct">{{ (w.daily_change_percentage ?? 0) >= 0 ? '+' : '' }}{{ (w.daily_change_percentage ?? 0).toFixed(2) }}%</span>
      </span>
    </button>

    <button type="button" class="chip add" aria-label="Add wallet" @click="openTrade">
      <span class="plus" aria-hidden="true">+</span>
      <span class="add-label">Add wallet</span>
    </button>
  </nav>
</template>

<style scoped>
.wallet-switcher {
  display: flex;
  align-items: stretch;
  gap: 0.3rem;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.chip {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.12rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--app-border-radius, 8px);
  cursor: pointer;
  color: rgba(255, 255, 255, 0.88);
  text-align: left;
  font: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
  box-sizing: border-box;
}
.chip:hover {
  border-color: rgba(0, 255, 136, 0.4);
  background: rgba(0, 255, 136, 0.04);
}

.chip.active {
  border-color: var(--primary-green, #00ff88);
  background: rgba(0, 255, 136, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.chip.total {
  cursor: default;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  border-color: rgba(255, 255, 255, 0.12);
}
.chip.total:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
}
.chip.total .label {
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.45);
}
.chip.total .meta {
  gap: 0.35rem;
}
.chip.total .bal {
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.chip.total .pct {
  font-size: 0.62rem;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  width: 100%;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
}
.chip.active .dot {
  background: var(--primary-green, #00ff88);
  box-shadow: 0 0 5px var(--primary-green, #00ff88);
}
.name {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  font-variant-numeric: tabular-nums;
  min-width: 0;
  width: 100%;
}
.bal {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pct {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--app-color-up, var(--success-green, #00ff88));
  flex-shrink: 0;
}
.chip.neg .pct { color: var(--app-color-down, #ff4d6a); }

.chip.add {
  border-style: dashed;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 0.25rem;
  color: rgba(255, 255, 255, 0.5);
  flex: 0.7 1 0;
}
.chip.add:hover { color: var(--primary-green, #00ff88); }
.plus { font-size: 0.85rem; font-weight: 700; line-height: 1; }
.add-label {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

@media (max-width: 480px) {
  .chip.add .add-label { display: none; }
  .chip.add { flex: 0 0 auto; min-width: 2.2rem; padding: 0.35rem; }
}
</style>
