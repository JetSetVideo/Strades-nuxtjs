<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAgentsStore } from '~/stores/agents'
import { useOpinionsStore } from '~/stores/opinions'
import { useAgentTracker } from '~/composables/useAgentTracker'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AgentOpinionVector from '@/components/Agent/OpinionVector.vue'
import AgentPersonalityRadar from '@/components/Agent/PersonalityRadar.vue'
import AgentTrainingTimeline from '@/components/Agent/TrainingTimeline.vue'
import ProfilePersonalityMatrix from '@/components/Profile/PersonalityMatrix.vue'

definePageMeta({ title: 'Agent', layout: 'default' })

const route = useRoute()
const agents = useAgentsStore()
const opinions = useOpinionsStore()
const tracker = useAgentTracker()

const agent = computed(() => agents.getAvatarById(String(route.params.id)))

const parent = computed(() =>
  agent.value?.lineage.parent_id ? agents.getAvatarById(agent.value.lineage.parent_id) : null
)

const weight = ref(0.5)

onMounted(async () => {
  if (!agents.hydrated) await agents.fetchAgents()
  if (agent.value) {
    const existing = opinions.plugs.find(p => p.agent_id === agent.value!.id)
    if (existing) weight.value = existing.weight
  }
})

const isPlugged = computed(() => agent.value ? opinions.isPlugged(agent.value.id) : false)

const statusTone = computed(() => {
  switch (agent.value?.training_state.status) {
    case 'live':     return 'success'
    case 'training': return 'info'
    case 'paused':   return 'warning'
    case 'error':    return 'danger'
    default:         return 'neutral'
  }
})

function plug() {
  if (!agent.value) return
  opinions.plug(agent.value.id, weight.value)
  tracker.track('agent_plug', {
    agent_id: agents.personalId,
    source_aggression: agent.value.personality_matrix.aggression
  })
}

function unplug() {
  if (agent.value) opinions.unplug(agent.value.id)
}

function fork() {
  if (!agent.value) return
  const { getUserId } = useCurrentUser()
  const fk = agents.forkAgent(agent.value.id, getUserId())
  if (fk) {
    tracker.track('agent_fork', { source_id: agent.value.id })
    navigateTo(`/agents/${fk.id}`)
  }
}

const { userId: currentUserId } = useCurrentUser()
</script>

<template>
  <div v-if="agent" class="agent-detail">
    <UIPageHeader :title="agent.name" :subtitle="agent.tagline">
      <template #actions>
        <UIPill tone="neutral" ghost>{{ agent.kind }}</UIPill>
        <UIPill :tone="statusTone" show-dot>{{ agent.training_state.status }}</UIPill>
        <button v-if="!isPlugged" class="cta primary" @click="plug">Plug into swarm</button>
        <button v-else class="cta unplug" @click="unplug">Unplug</button>
        <button
          v-if="agent.share_state.is_public && agent.owner_id !== currentUserId"
          class="cta secondary"
          @click="fork"
        >⑂ Fork ({{ agent.share_state.price_credits }} cr)</button>
      </template>
    </UIPageHeader>

    <nav v-if="parent" class="breadcrumb">
      forked from <NuxtLink :to="`/agents/${parent.id}`">{{ parent.name }}</NuxtLink>
    </nav>

    <!-- Hero card -->
    <UICard padding="loose">
      <div class="hero">
        <img :src="agent.avatar_url" :alt="agent.name" class="hero-avatar" />
        <div class="hero-stack">
          <h2>{{ agent.name }}</h2>
          <p class="tagline">{{ agent.tagline }}</p>
          <div class="specs">
            <span v-for="s in agent.specialization" :key="s" :class="['spec', `spec-${s}`]">{{ s }}</span>
            <span class="spec spec-style">{{ agent.trading_style }}</span>
          </div>
        </div>
        <div class="hero-meta">
          <UIStat label="Live PnL" :value="agent.performance.live_pnl_pct" tone="auto" suffix="%" :precision="1" size="lg" />
          <UIStat label="Confidence" :value="agent.confidence * 100" :precision="0" suffix="%" size="md" />
        </div>
      </div>
    </UICard>

    <!-- Plug controls -->
    <UICard v-if="isPlugged" title="Swarm weight">
      <template #action>
        <UIPill tone="success" show-dot>PLUGGED · {{ Math.round(weight * 100) }}%</UIPill>
      </template>
      <div class="plug-controls">
        <input
          type="range"
          min="0" max="1" step="0.05"
          v-model.number="weight"
          @change="plug"
          aria-label="Swarm weight"
        />
        <span class="weight-pct">{{ Math.round(weight * 100) }}%</span>
      </div>
    </UICard>

    <!-- 3-col -->
    <div class="grid-3">
      <UICard title="Live opinion">
        <AgentOpinionVector :vector="agent.opinion_vector" variant="full" />
        <template #footer>
          <span class="muted">
            Refreshed on each pipeline tick (~4s) · Confidence {{ Math.round(agent.confidence * 100) }}%
          </span>
        </template>
      </UICard>

      <UICard title="Performance">
        <UIMetricRow :cols="2">
          <UIStat label="Live PnL"     :value="agent.performance.live_pnl_pct"     tone="auto" suffix="%" :precision="1" size="md" />
          <UIStat label="Backtest"     :value="agent.performance.backtest_pnl_pct" suffix="%" :precision="1" size="md" />
          <UIStat label="Sharpe"       :value="agent.performance.sharpe"           :precision="2" size="sm" />
          <UIStat label="Win rate"     :value="agent.performance.win_rate * 100"   suffix="%" :precision="0" size="sm" />
          <UIStat label="Max DD"       :value="-agent.performance.max_drawdown_pct" tone="negative" suffix="%" :precision="1" size="sm" />
          <UIStat label="Total trades" :value="agent.performance.trades_total"     size="sm" />
        </UIMetricRow>
      </UICard>

      <UICard title="Training">
        <UIMetricRow :cols="2">
          <UIStat label="Version"     :value="`v${agent.training_state.version}`"               size="md" />
          <UIStat label="Epochs"      :value="agent.training_state.epochs"                       size="md" />
          <UIStat label="Samples"     :value="agent.training_state.samples_observed"             size="sm" />
          <UIStat label="Reward EMA"  :value="agent.training_state.reward_ema_pnl" tone="auto"   :precision="3" size="sm" />
          <UIStat label="Loss EMA"    :value="agent.training_state.loss_ema"                     :precision="3" size="sm" />
          <UIStat label="Queued"      :value="agent.training_state.samples_since_last_train"     size="sm" />
        </UIMetricRow>
      </UICard>
    </div>

    <!-- Personality matrix -->
    <UICard title="Trader DNA — Personality matrix">
      <template #action>
        <UIPill tone="info">v{{ agent.training_state.version }}</UIPill>
      </template>
      <div class="dna-grid">
        <AgentPersonalityRadar :matrix="agent.personality_matrix" :size="220" />
        <ProfilePersonalityMatrix :matrix="agent.personality_matrix" />
      </div>
    </UICard>

    <!-- Training stream — live feed of tracked interactions -->
    <AgentTrainingTimeline />
  </div>

  <UIEmptyState
    v-else
    icon="◯"
    title="Agent not found"
    message="The agent you're looking for doesn't exist or was unforked."
  >
    <template #action>
      <NuxtLink to="/strategies" class="back-link">← Back to Trading Lab</NuxtLink>
    </template>
  </UIEmptyState>
</template>

<style scoped>
.agent-detail {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
  padding-bottom: 1.5rem;
}

.dna-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}
@media (max-width: 720px) {
  .dna-grid { grid-template-columns: 1fr; justify-items: center; }
}

.breadcrumb {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
}
.breadcrumb a { color: var(--primary-green, #00ff88); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  min-width: 0;
}
@media (max-width: 720px) {
  .hero { grid-template-columns: 60px minmax(0, 1fr); }
  .hero-meta { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
}

.hero-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(0,255,136,0.3);
  box-shadow: 0 0 20px rgba(0,255,136,0.18);
}
@media (max-width: 720px) {
  .hero-avatar { width: 60px; height: 60px; border-width: 2px; }
}

.hero-stack { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.hero-stack h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.tagline {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  line-height: 1.4;
}

.specs { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.spec {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 800;
}
.spec-fiat        { background: rgba(74,144,226,0.18);  color: #4A90E2; }
.spec-crypto      { background: rgba(245,166,35,0.18);  color: #F5A623; }
.spec-stocks      { background: rgba(126,211,33,0.18);  color: #7ED321; }
.spec-commodities { background: rgba(248,231,28,0.18);  color: #F8E71C; }
.spec-style       { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); }

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 140px;
}

/* CTAs (in header actions) */
.cta {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  color: #fff;
  padding: 0.4rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: inherit;
  transition: transform 0.15s ease;
}
.cta:hover { transform: translateY(-1px); }
.cta.primary {
  background: var(--primary-gradient);
  color: #000;
  border-color: transparent;
}
.cta.unplug {
  background: rgba(255,77,106,0.12);
  color: #ff4d6a;
  border-color: rgba(255,77,106,0.35);
}
.cta.secondary {
  background: rgba(0,170,255,0.1);
  color: var(--primary-blue, #00aaff);
  border-color: rgba(0,170,255,0.3);
}

/* Plug controls */
.plug-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
}
.plug-controls input {
  width: 100%;
  accent-color: var(--primary-green, #00ff88);
}
.weight-pct {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  min-width: 3rem;
  text-align: right;
  color: var(--primary-green, #00ff88);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 0.6rem;
}
.grid-3 > * { min-width: 0; }

.muted { font-size: 0.7rem; color: rgba(255,255,255,0.45); }

.back-link {
  color: var(--primary-green, #00ff88);
  font-weight: 700;
  text-decoration: none;
}
.back-link:hover { text-decoration: underline; }
</style>
