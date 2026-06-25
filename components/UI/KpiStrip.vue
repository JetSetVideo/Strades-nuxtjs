<template>
  <div class="kpi-strip" :class="`cols-${Math.min(items.length, 4)}`">
    <div v-for="item in items" :key="item.label" class="kpi" :class="item.tone ?? 'neutral'">
      <span class="kpi-label">{{ item.label }}</span>
      <span class="kpi-value">
        {{ format(item.value) }}<span v-if="item.suffix" class="kpi-suffix">{{ item.suffix }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface KpiItem {
  label: string
  value: string | number | null | undefined
  suffix?: string
  tone?: 'neutral' | 'positive' | 'negative'
}

defineProps<{ items: KpiItem[] }>()

function format(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    return Number.isInteger(v) ? String(v) : v.toFixed(1)
  }
  return v
}
</script>

<style scoped>
.kpi-strip {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.15rem;
}
.cols-1 { grid-template-columns: 1fr; }
.cols-2 { grid-template-columns: repeat(2, 1fr); }
.cols-3 { grid-template-columns: repeat(3, 1fr); }
.cols-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 640px) {
  .cols-3, .cols-4 { grid-template-columns: repeat(2, 1fr); }
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  min-width: 0;
}
.kpi-label {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.kpi-value {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.95);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kpi-suffix { font-size: 0.65rem; font-weight: 600; opacity: 0.6; margin-left: 0.15rem; }
.kpi.positive .kpi-value { color: var(--primary-green, #00ff88); }
.kpi.negative .kpi-value { color: var(--error-red, #ff4d6a); }
</style>
