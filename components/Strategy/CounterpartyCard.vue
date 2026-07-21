<script setup lang="ts">
/**
 * StrategyCounterpartyCard — Shows the dealers, clients, and commodities
 * a strategy is exposed to, using supply chain data. Helps the user understand
 * how their strategy connects to real-world counterparties.
 */
import { ref, computed, onMounted } from 'vue'
import { useAssetsStore } from '@/stores/assets'
import { useMacroStore } from '@/stores/macro'
import UIPill from '@/components/UI/Pill.vue'

const props = withDefaults(defineProps<{
  targetAssets?: string[]
  compact?: boolean
}>(), { targetAssets: () => [], compact: false })

const assetsStore = useAssetsStore()
const macroStore = useMacroStore()

const loading = ref(true)
const supplyData = ref<Record<string, any>>({})

onMounted(async () => {
  await Promise.all([
    assetsStore.initializeStore(),
    macroStore.initializeStore(),
  ])

  // Load supply chain data for target assets
  const symbols = props.targetAssets.map(a => a.toLowerCase().replace('/usd', '').replace('-usd', ''))
  const entries = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const data = await $fetch<any>(`/data/supply_chain/${sym}.json`)
        return [sym.toUpperCase(), data] as [string, any]
      } catch { return [sym.toUpperCase(), null] as [string, any] }
    })
  )
  supplyData.value = Object.fromEntries(entries.filter(([, d]) => d !== null))
  loading.value = false
})

// ─── Extract counterparties from supply chain data ───────────────────────────
interface Counterparty {
  name: string
  role: 'supplier' | 'customer' | 'facility' | 'commodity'
  weight: number
}

const counterparties = computed<Counterparty[]>(() => {
  const list: Counterparty[] = []
  for (const [, data] of Object.entries(supplyData.value)) {
    for (const s of data.suppliers ?? []) {
      list.push({ name: s.name, role: 'supplier', weight: s.share_pct ?? 10 })
    }
    for (const c of data.customers ?? []) {
      list.push({ name: c.name, role: 'customer', weight: c.share_pct ?? 10 })
    }
    for (const f of data.facilities ?? []) {
      list.push({ name: f.name, role: 'facility', weight: f.size === 'large' ? 30 : 15 })
    }
    // Commodity exposure from shipments
    const commodities = new Set<string>()
    for (const sh of data.shipments ?? []) {
      if (sh.product && !commodities.has(sh.product)) {
        commodities.add(sh.product)
        list.push({ name: sh.product, role: 'commodity', weight: sh.value_usd ? Math.min(50, sh.value_usd / 10000) : 10 })
      }
    }
  }
  return list.sort((a, b) => b.weight - a.weight).slice(0, 10)
})

const riskByRole = computed(() => {
  const volByClass = macroStore.macroState?.volatility_by_class ?? {}
  const map: Record<string, number> = { supplier: 0, customer: 0, facility: 0, commodity: 0 }
  for (const c of counterparties.value) {
    map[c.role] += c.weight
  }
  // Adjust by macro volatility
  for (const key of Object.keys(map)) {
    const volMultiplier = key === 'commodity' ? (volByClass.commodities ?? 0.3) * 2
      : key === 'facility' ? (volByClass.stocks ?? 0.3)
      : 0.2
    map[key] = Math.min(100, map[key] * (1 + volMultiplier))
  }
  return Object.entries(map).map(([role, risk]) => ({ role, risk: Math.round(risk) }))
})

const roleColor = (role: string): string => {
  const map: Record<string, string> = {
    supplier: 'var(--warning-orange)',
    customer: 'var(--primary-blue)',
    facility: 'var(--text-gray)',
    commodity: 'var(--asset-btc)',
  }
  return map[role] ?? 'var(--text-gray)'
}
</script>

<template>
  <div class="counterparty-card" :class="{ compact }">
    <div v-if="loading" class="loading-pulse">
      <div class="pulse-line" /><div class="pulse-line short" />
    </div>

    <div v-else-if="counterparties.length === 0" class="empty">
      No counterparty data for {{ targetAssets.join(', ') || 'these assets' }}.
    </div>

    <template v-else>
      <!-- Risk by role -->
      <div class="role-risks">
        <div v-for="r in riskByRole" :key="r.role" class="role-row">
          <span class="role-name" :style="{ color: roleColor(r.role) }">{{ r.role }}</span>
          <div class="role-bar-track">
            <div class="role-bar-fill" :style="{ width: `${r.risk}%`, background: roleColor(r.role) }" />
          </div>
          <span class="role-risk">{{ r.risk }}%</span>
        </div>
      </div>

      <!-- Counterparty list -->
      <div class="cp-list">
        <div v-for="c in counterparties.slice(0, compact ? 5 : 10)" :key="c.name" class="cp-row">
          <span class="cp-dot" :style="{ background: roleColor(c.role) }" />
          <span class="cp-name">{{ c.name }}</span>
          <UIPill size="sm" :tone="c.role === 'supplier' ? 'warning' : c.role === 'customer' ? 'info' : c.role === 'commodity' ? 'neutral' : 'success'">
            {{ c.role }}
          </UIPill>
          <span class="cp-weight">{{ c.weight }}%</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.counterparty-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.counterparty-card.compact { gap: 0.35rem; }

.loading-pulse { display: flex; flex-direction: column; gap: 0.35rem; }
.pulse-line { height: 7px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }
.pulse-line.short { width: 60%; }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

.empty { font-size: 0.75rem; color: var(--text-gray); font-style: italic; }

/* Role risks */
.role-risks { display: flex; flex-direction: column; gap: 0.3rem; }
.role-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 36px;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.68rem;
}
.role-name { font-weight: 600; text-transform: capitalize; }
.role-bar-track { height: 5px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.role-bar-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
.role-risk { font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

/* Counterparty list */
.cp-list { display: flex; flex-direction: column; gap: 0.2rem; }
.cp-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.35rem;
  background: rgba(255,255,255,0.015);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
}
.cp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cp-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-weight { font-variant-numeric: tabular-nums; color: var(--text-gray); }
</style>
