<script setup lang="ts">
import { computed } from 'vue'

interface Entity {
  id: string
  name: string
  country: string
  country_flag?: string
  share_pct?: number
}

const props = defineProps<{
  items: Entity[]
  label?: string
  riskLabel?: string
}>()

interface CountryRow {
  country: string
  flag: string
  share_pct: number
  count: number
  top_entity?: string
}

// Aggregate by country, summing share_pct
const byCountry = computed<CountryRow[]>(() => {
  const map: Record<string, CountryRow> = {}
  for (const item of props.items ?? []) {
    const key = item.country ?? '??'
    if (!map[key]) {
      map[key] = {
        country: key,
        flag: item.country_flag ?? '🏳',
        share_pct: 0,
        count: 0,
        top_entity: item.name
      }
    }
    const share = item.share_pct ?? 0
    map[key].share_pct += share
    map[key].count += 1
    // Track the largest entity per country for display
    if (share > (props.items.find(x => x.name === map[key].top_entity)?.share_pct ?? 0)) {
      map[key].top_entity = item.name
    }
  }
  return Object.values(map).sort((a, b) => b.share_pct - a.share_pct)
})

// Herfindahl-Hirschman Index (concentration). 0..1, higher = more concentrated.
// Computed in share_pct space (already in %), normalized.
const hhi = computed(() => {
  if (byCountry.value.length === 0) return 0
  const total = byCountry.value.reduce((s, c) => s + c.share_pct, 0) || 1
  return byCountry.value.reduce((acc, c) => acc + Math.pow(c.share_pct / total, 2), 0)
})

const topShare = computed(() => byCountry.value[0]?.share_pct ?? 0)
const topCountry = computed(() => byCountry.value[0])

const riskLevel = computed<'low' | 'medium' | 'high'>(() => {
  if (topShare.value > 50 || hhi.value > 0.5) return 'high'
  if (topShare.value > 30 || hhi.value > 0.3) return 'medium'
  return 'low'
})

const riskMessage = computed(() => {
  if (riskLevel.value === 'high') return `High concentration — ${topCountry.value?.country ?? '?'} carries ${topShare.value.toFixed(0)}% of ${props.riskLabel ?? 'flow'}.`
  if (riskLevel.value === 'medium') return `Moderate concentration — ${topCountry.value?.country ?? '?'} represents ${topShare.value.toFixed(0)}% of ${props.riskLabel ?? 'flow'}.`
  return 'Well diversified across countries.'
})
</script>

<template>
  <div class="country-breakdown">
    <header class="head">
      <span class="title">{{ label || 'By country' }}</span>
      <span :class="['risk-pill', `lv-${riskLevel}`]" :title="`HHI ${(hhi * 100).toFixed(0)}`">{{ riskLevel }}</span>
    </header>

    <div class="alert" :class="`lv-${riskLevel}`" v-if="byCountry.length">
      {{ riskMessage }}
    </div>

    <ul v-if="byCountry.length" class="list">
      <li v-for="(c, i) in byCountry" :key="c.country" :class="['row', { top: i === 0 }]">
        <span class="rank">{{ i + 1 }}</span>
        <span class="flag">{{ c.flag }}</span>
        <span class="info">
          <span class="cc">{{ c.country }}</span>
          <small>{{ c.count }} entit{{ c.count === 1 ? 'y' : 'ies' }} · {{ c.top_entity }}</small>
        </span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: `${Math.min(100, c.share_pct)}%` }" />
        </span>
        <span class="pct">{{ c.share_pct.toFixed(1) }}%</span>
      </li>
    </ul>
    <div v-else class="empty">No data.</div>
  </div>
</template>

<style scoped>
.country-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.title {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.risk-pill {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
}
.lv-low.risk-pill    { background: rgba(0,255,136,0.12); color: #00ff88; }
.lv-medium.risk-pill { background: rgba(255,170,0,0.15); color: #ffaa00; }
.lv-high.risk-pill   { background: rgba(255,77,106,0.15); color: #ff4d6a; }

.alert {
  font-size: 0.72rem;
  padding: 0.4rem 0.55rem;
  border-radius: 5px;
  line-height: 1.35;
}
.alert.lv-low    { background: rgba(0,255,136,0.05); color: rgba(0,255,136,0.85); border-left: 2px solid #00ff88; }
.alert.lv-medium { background: rgba(255,170,0,0.05); color: rgba(255,170,0,0.85); border-left: 2px solid #ffaa00; }
.alert.lv-high   { background: rgba(255,77,106,0.05); color: rgba(255,77,106,0.85); border-left: 2px solid #ff4d6a; }

.list {
  list-style: none; margin: 0; padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns: 18px 22px minmax(0, 1fr) minmax(60px, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: var(--app-border-radius, 5px);
  min-width: 0;
}
.row.top { border-color: rgba(0,170,255,0.2); }
.rank {
  font-size: 0.62rem;
  font-weight: 800;
  color: rgba(255,255,255,0.4);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.flag { font-size: 1.05rem; line-height: 1; }
.info { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; overflow: hidden; }
.cc {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.info small {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  transition: width 0.3s ease;
}
.pct {
  font-size: 0.78rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: rgba(255,255,255,0.85);
}

.empty {
  padding: 0.7rem;
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.45);
}

@media (max-width: 540px) {
  .row { grid-template-columns: 18px 22px minmax(0, 1fr) auto; }
  .bar-track { display: none; }
}
</style>
