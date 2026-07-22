<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMacroStore } from '@/stores/macro'
import { useWalletStore } from '@/stores/wallet'
import { useAllocationStore } from '@/stores/allocation'
import { useAgentsStore } from '@/stores/agents'
import { useOpinionsStore } from '@/stores/opinions'
import { usePaperStore } from '@/stores/paper'

import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import AgentAvatarCard from '@/components/Agent/AvatarCard.vue'
import WidgetDisplayAsset from '@/components/Widget/DisplayAsset.vue'

definePageMeta({ title: 'Dashboard', layout: 'default' })

const macro = useMacroStore()
const wallet = useWalletStore()
const allocation = useAllocationStore()
const agents = useAgentsStore()
const opinions = useOpinionsStore()
const paper = usePaperStore()

const loading = ref(true)

onMounted(async () => {
  await Promise.all([
    wallet.hydrated ? Promise.resolve() : wallet.initializeStore(),
    agents.hydrated ? Promise.resolve() : agents.fetchAvatars().catch(() => {}),
  ])
  paper.hydrate()
  loading.value = false
})

// ── Aggregated KPIs ──────────────────────────────────────────────────────
const kpis = computed(() => [
  {
    label: 'Portfolio',
    value: wallet.wallets.reduce((s, w) => s + (w.total_value ?? 0), 0),
    prefix: '$',
    precision: 0,
    size: 'lg' as const,
  },
  {
    label: 'Allocation',
    value: `${allocation.allocationPie.crypto.toFixed(0)}/${allocation.allocationPie.stocks.toFixed(0)}/${allocation.allocationPie.fiat.toFixed(0)}`,
    suffix: ' C/S/F',
    size: 'md' as const,
  },
  {
    label: 'Volatility',
    value: macro.fear_greed,
    suffix: '%',
    tone: macro.fear_greed > 60 ? 'positive' : macro.fear_greed < 40 ? 'negative' : 'neutral',
    size: 'md' as const,
  } as const,
  {
    label: 'Swarm confidence',
    value: Math.round(opinions.swarmConfidence * 100),
    suffix: '%',
    size: 'md' as const,
  } as const,
  {
    label: 'Paper P&L',
    value: paper.realizedPnlValue + paper.openPnlValue,
    prefix: '$',
    precision: 0,
    tone: (paper.realizedPnlValue + paper.openPnlValue) >= 0 ? 'positive' : 'negative',
    size: 'md' as const,
  } as const,
])

// ── Quick-entry cards ────────────────────────────────────────────────────
const QUICK_LINKS = [
  { to: '/prices', label: 'Prices', icon: '📊', desc: 'Live markets' },
  { to: '/wallet', label: 'Wallet', icon: '💼', desc: 'Allocation + paper' },
  { to: '/news', label: 'News', icon: '📰', desc: 'Feed + editorial' },
  { to: '/profile', label: 'Profile', icon: '👤', desc: 'Your trader DNA' },
  { to: '/historic', label: 'History', icon: '📜', desc: 'Paper ledger' },
  { to: '/creator', label: 'Creator', icon: '🔧', desc: 'Build strategies' },
]

// ── Market pulse ─────────────────────────────────────────────────────────
const marketTicker = computed(() => {
  const bullish = macro.market_sentiment > 0.15
  const stress = macro.geopolitical_stress > 0.5
  return {
    mood: bullish ? 'Bullish' : 'Bearish',
    stress: stress ? 'Elevated' : 'Normal',
    moodTone: bullish ? ('positive' as const) : ('negative' as const),
    stressTone: stress ? ('negative' as const) : ('positive' as const),
    volLabel: macro.global_volatility_index > 0.6 ? 'High' : 'Low',
  }
})

// ── Personal avatar ────────────────────────────────────────────────────
const personalAvatar = computed(() => agents.personal)
</script>

<template>
  <div class="dashboard">
    <!-- Welcome + macro pulse -->
    <header class="dash-head">
      <div class="head-left">
        <h1 class="greeting">Dashboard</h1>
        <p class="subtitle">All your trading intelligence in one place</p>
      </div>
      <div class="head-pulse">
        <span class="pulse-chip" :data-tone="marketTicker.moodTone">{{ marketTicker.mood }}</span>
        <span class="pulse-chip" :data-tone="marketTicker.stressTone">Stress: {{ marketTicker.stress }}</span>
        <span class="pulse-chip" :data-tone="marketTicker.volLabel === 'High' ? 'negative' : 'positive'">
          Vol: {{ marketTicker.volLabel }}
        </span>
      </div>
    </header>

    <!-- Global KPIs -->
    <UIMetricRow :cols="kpis.length >= 5 ? 5 : kpis.length">
      <UIStat v-for="k in kpis" :key="k.label" v-bind="k" />
    </UIMetricRow>

    <!-- Two-column break: avatar + quick links -->
    <div class="row two-col">
      <!-- Personal avatar card -->
      <UICard v-if="personalAvatar" title="Your Avatar" padding="tight">
        <AgentAvatarCard :agent="personalAvatar" @select="(id) => navigateTo(`/agents/${id}`)" />
      </UICard>

      <!-- Quick links grid -->
      <UICard title="Quick access" padding="tight">
        <div class="quick-grid">
          <NuxtLink
            v-for="link in QUICK_LINKS"
            :key="link.to"
            :to="link.to"
            class="quick-item"
          >
            <span class="qi-icon">{{ link.icon }}</span>
            <span class="qi-label">{{ link.label }}</span>
            <span class="qi-desc">{{ link.desc }}</span>
          </NuxtLink>
        </div>
      </UICard>
    </div>

    <!-- Paper trading snapshot -->
    <UICard title="Paper trading" padding="tight" v-if="paper.trades.length > 0">
      <div class="paper-snapshot">
        <div class="paper-kpis">
          <div class="paper-kpi">
            <span class="pk-label">Positions</span>
            <span class="pk-value">{{ paper.openTrades.length }}</span>
          </div>
          <div class="paper-kpi">
            <span class="pk-label">Realized</span>
            <span class="pk-value" :data-tone="paper.realizedPnlValue >= 0 ? 'pos' : 'neg'">
              {{ paper.realizedPnlValue >= 0 ? '+' : '' }}${{ paper.realizedPnlValue.toFixed(0) }}
            </span>
          </div>
          <div class="paper-kpi">
            <span class="pk-label">Win rate</span>
            <span class="pk-value">{{ paper.winRate.toFixed(0) }}%</span>
          </div>
        </div>
        <div class="paper-open">
          <div v-for="t in paper.openTrades.slice(0, 3)" :key="t.id" class="paper-row">
            <span class="pr-sym">{{ t.asset_symbol }}</span>
            <span class="pr-meta">{{ t.side.toUpperCase() }} · {{ t.wallet_pct.toFixed(1) }}% wallet</span>
            <span class="pr-pnl" :data-tone="t.hypothetical_pnl_value >= 0 ? 'pos' : 'neg'">
              {{ t.hypothetical_pnl_value >= 0 ? '+' : '' }}${{ t.hypothetical_pnl_value.toFixed(0) }}
            </span>
          </div>
        </div>
        <NuxtLink to="/historic" class="paper-link">View full paper ledger →</NuxtLink>
      </div>
    </UICard>

    <!-- Swarm plugged agents -->
    <div v-if="opinions.activeCount > 0" class="swarm-strip">
      <UIPill tone="info">{{ opinions.activeCount }} agent(s) plugged</UIPill>
      <span class="swarm-info">
        Divergence {{ opinions.divergence.toFixed(0) }}% · Diversity {{ (opinions.diversityScore * 100).toFixed(0) }}%
      </span>
      <NuxtLink to="/wallet" class="swarm-go">See overlay →</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
  padding-bottom: 1.5rem;
}

.dash-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}
.greeting { margin: 0; font-size: 1.3rem; font-weight: 700; }
.subtitle { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-gray); }

.head-pulse {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.pulse-chip {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pulse-chip[data-tone="positive"] { border-color: oklch(0.7 0.2 145 / 0.4); color: oklch(0.75 0.2 145); }
.pulse-chip[data-tone="negative"] { border-color: oklch(0.65 0.2 25 / 0.4); color: oklch(0.7 0.2 25); }

.row { display: grid; gap: 0.6rem; }
.row.two-col { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
@media (max-width: 720px) { .row.two-col { grid-template-columns: 1fr; } }

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.4rem;
}
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.6rem 0.3rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.quick-item:hover { background: rgba(255,255,255,0.06); }
.qi-icon { font-size: 1.3rem; }
.qi-label { font-size: 0.7rem; font-weight: 600; }
.qi-desc { font-size: 0.6rem; color: var(--text-gray); }

/* Paper snapshot */
.paper-snapshot { display: flex; flex-direction: column; gap: 0.5rem; }
.paper-kpis { display: flex; gap: 1rem; }
.paper-kpi { display: flex; flex-direction: column; gap: 0.05rem; }
.pk-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-gray); }
.pk-value { font-size: 0.95rem; font-weight: 600; }
.pk-value[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pk-value[data-tone="neg"] { color: oklch(0.65 0.2 25); }

.paper-open { display: flex; flex-direction: column; gap: 0.25rem; }
.paper-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-left: 2px dotted rgba(255,255,255,0.15);
  font-size: 0.78rem;
}
.pr-sym { font-weight: 600; min-width: 3rem; }
.pr-meta { font-size: 0.7rem; color: var(--text-gray); flex: 1; }
.pr-pnl { font-weight: 600; }
.pr-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pr-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }
.paper-link {
  font-size: 0.72rem;
  color: var(--primary-blue);
  text-decoration: none;
}

/* Swarm strip */
.swarm-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: color-mix(in oklch, var(--primary-blue) 6%, transparent);
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.75rem;
}
.swarm-info { color: var(--text-gray); flex: 1; }
.swarm-go {
  color: var(--primary-blue);
  text-decoration: none;
  font-weight: 600;
}
</style>
