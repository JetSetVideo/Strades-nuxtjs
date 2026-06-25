<script setup lang="ts">
import { computed } from 'vue'

interface Shipment {
  id: string
  from_country: string
  to_country: string
  product: string
  containers?: number
  value_usd?: number
  date?: string
}

const props = defineProps<{ items: Shipment[] }>()

const sorted = computed(() => {
  return [...props.items].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0
    const tb = b.date ? new Date(b.date).getTime() : 0
    return tb - ta
  })
})

const fmt = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${Math.round(n)}`
}

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const CC_FLAG: Record<string, string> = {
  US: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷', TW: '🇹🇼',
  DE: '🇩🇪', FR: '🇫🇷', GB: '🇬🇧', IT: '🇮🇹', ES: '🇪🇸',
  IN: '🇮🇳', BR: '🇧🇷', RU: '🇷🇺', AE: '🇦🇪', CH: '🇨🇭',
  CL: '🇨🇱', HK: '🇭🇰', SA: '🇸🇦', SG: '🇸🇬', IR: '🇮🇷',
  IE: '🇮🇪', NL: '🇳🇱', SV: '🇸🇻', KZ: '🇰🇿', CA: '🇨🇦',
  OM: '🇴🇲', DK: '🇩🇰', VN: '🇻🇳', LU: '🇱🇺', MT: '🇲🇹',
  EU: '🇪🇺', UA: '🇺🇦', EE: '🇪🇪', AU: '🇦🇺', MX: '🇲🇽',
  GLOBAL: '🌐'
}
const flag = (c: string) => CC_FLAG[c] || '🏳'
</script>

<template>
  <ul class="shipments" v-if="sorted.length">
    <li v-for="s in sorted" :key="s.id" class="row">
      <span class="route">
        <span class="flag">{{ flag(s.from_country) }}</span>
        <span class="cc">{{ s.from_country }}</span>
        <span class="arrow">→</span>
        <span class="flag">{{ flag(s.to_country) }}</span>
        <span class="cc">{{ s.to_country }}</span>
      </span>
      <span class="product">{{ s.product }}</span>
      <span class="containers" v-if="s.containers">{{ s.containers.toLocaleString() }} <em>cont</em></span>
      <span class="containers" v-else>—</span>
      <span class="value">{{ fmt(s.value_usd ?? 0) }}</span>
      <span class="date">{{ fmtDate(s.date) }}</span>
    </li>
  </ul>
  <div v-else class="empty">No recent shipment activity.</div>
</template>

<style scoped>
.shipments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns:
    minmax(0, auto)    /* route flags */
    minmax(0, 2fr)     /* product */
    minmax(0, 0.7fr)   /* containers */
    minmax(0, 0.7fr)   /* value */
    minmax(0, 0.6fr);  /* date */
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: var(--app-border-radius, 6px);
  min-width: 0;
}

.route {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.78rem;
}
.flag { font-size: 1rem; }
.cc {
  color: rgba(255,255,255,0.75);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.arrow {
  color: rgba(255,255,255,0.4);
  margin: 0 0.1rem;
}

.product {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.containers {
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
}
.containers em {
  font-style: normal;
  color: rgba(255,255,255,0.4);
  font-size: 0.6rem;
  font-weight: 500;
  margin-left: 0.15rem;
}

.value {
  font-size: 0.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--success-green, #00ff88);
  white-space: nowrap;
}

.date {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
  text-align: right;
  white-space: nowrap;
}

.empty {
  padding: 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.45);
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
  }
  .containers, .date { display: none; }
}
</style>
