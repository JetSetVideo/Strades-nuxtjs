<script setup lang="ts">
import { computed } from 'vue'
import { useAssetsStore } from '~/stores/assets'

interface Supplier {
  id: string
  name: string
  country: string
  country_flag?: string
  city?: string
  product?: string
  share_pct?: number
  shipments_90d?: number
  value_usd?: number
  since?: string
  lat?: number
  lng?: number
  /** Optional explicit cross-link to another tracked asset on the platform */
  link_to_asset?: string
}

const props = defineProps<{
  items: Supplier[]
  label?: string
}>()

const assets = useAssetsStore()

// Auto-detect which entities map to a tracked asset (by name fuzzy-match or symbol)
const resolveLink = (s: Supplier): string | null => {
  if (s.link_to_asset) return s.link_to_asset
  if (!assets.assets?.length) return null
  const name = s.name.toLowerCase()
  // Match by name substring or symbol
  const match = assets.assets.find(a => {
    if (!a) return false
    const aName = (a.name ?? '').toLowerCase()
    const aSym = (a.symbol ?? '').toLowerCase()
    return (aName && name.includes(aName)) ||
           (aSym && name.includes(aSym)) ||
           (name.startsWith(aName))
  })
  return match?.id ?? null
}

const sorted = computed(() =>
  [...props.items]
    .map(s => ({ ...s, _link: resolveLink(s) }))
    .sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0))
)

const fmt = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${Math.round(n)}`
}
</script>

<template>
  <ul class="suppliers" v-if="sorted.length">
    <li v-for="s in sorted" :key="s.id" class="row">
      <span class="flag">{{ s.country_flag || '🏳' }}</span>
      <div class="info">
        <div class="head">
          <NuxtLink v-if="s._link" :to="`/assets/${s._link}`" class="name name-link" @click.stop>
            {{ s.name }} <span class="link-arrow">↗</span>
          </NuxtLink>
          <strong v-else class="name">{{ s.name }}</strong>
          <span v-if="s.since" class="since">since {{ s.since }}</span>
        </div>
        <div class="meta">
          <span class="loc">{{ s.city ? `${s.city}, ` : '' }}{{ s.country }}</span>
          <span class="product">{{ s.product || '—' }}</span>
        </div>
        <div class="bar-row">
          <span class="bar-track">
            <span class="bar-fill" :style="{ width: `${Math.min(100, s.share_pct ?? 0)}%` }" />
          </span>
          <span class="share">{{ (s.share_pct ?? 0).toFixed(1) }}%</span>
        </div>
      </div>
      <div class="numbers">
        <span class="val">{{ fmt(s.value_usd ?? 0) }}</span>
        <span class="sub" v-if="s.shipments_90d">{{ s.shipments_90d.toLocaleString() }} shipments / 90d</span>
      </div>
    </li>
  </ul>
  <div v-else class="empty">No data available.</div>
</template>

<style scoped>
.suppliers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0.65rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: var(--app-border-radius, 6px);
  min-width: 0;
}
.flag {
  font-size: 1.4rem;
  line-height: 1;
  filter: saturate(1.1);
}

.info { display: flex; flex-direction: column; gap: 0.18rem; min-width: 0; }
.head { display: flex; align-items: baseline; gap: 0.5rem; min-width: 0; }
.name {
  font-size: 0.85rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.name-link {
  color: var(--primary-green, #00ff88);
  text-decoration: none;
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
}
.name-link:hover { text-decoration: underline; }
.link-arrow {
  font-size: 0.65rem;
  opacity: 0.6;
}
.since {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 600;
  flex-shrink: 0;
}

.meta {
  display: flex;
  gap: 0.55rem;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.55);
  min-width: 0;
}
.loc, .product {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.product { color: rgba(255,255,255,0.7); }

.bar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 0.4rem;
  align-items: center;
}
.bar-track {
  display: block;
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--primary-blue, #00aaff), var(--primary-green, #00ff88));
  transition: width 0.4s ease;
}
.share {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.7);
  text-align: right;
}

.numbers {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  align-items: flex-end;
  min-width: 0;
}
.val {
  font-size: 0.88rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--success-green, #00ff88);
}
.sub {
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.4);
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

@media (max-width: 540px) {
  .row { grid-template-columns: 24px minmax(0, 1fr); }
  .flag { font-size: 1.2rem; }
  .numbers { display: none; }
  .head .since { display: none; }
}
</style>
