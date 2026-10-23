<template>
  <article
    class="agent-card"
    :class="[`kind-${agent.kind}`, { plugged: opinions.isPlugged(agent.id) }]"
    :style="dynamicStyles"
    @click="$emit('select', agent.id)"
  >
    <header class="card-head">
      <!-- Avatar frame: shape encodes personality (hexagon = aggressive, circle = conservative) -->
      <div
        class="avatar-frame"
        :title="isClassifier
          ? `Calibration ${((agent.classifier_state?.calibration ?? 0) * 100).toFixed(0)}% · Predicted ${agent.classifier_state?.predicted_regime}`
          : `Risk ${(agent.personality_matrix.risk * 100).toFixed(0)}% · Aggression ${(agent.personality_matrix.aggression * 100).toFixed(0)}%`"
      >
        <ProfileMark
          class="avatar"
          :seed="agent.id"
          :trade-style="maskStyle"
          :risk="agent.personality_matrix.risk"
          :discipline="agent.confidence"
          :patience="patienceScore"
          :aggression="agent.personality_matrix.aggression"
        />
        <!-- Training progress ring driven by loss_ema -->
        <svg class="training-ring" viewBox="0 0 56 56">
          <circle class="ring-bg" cx="28" cy="28" r="26" />
          <circle
            class="ring-fill"
            cx="28" cy="28" r="26"
            :stroke-dasharray="ringCircumference"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
      </div>
      <div class="head-text">
        <div class="name-line">
          <h3 class="name">{{ agent.name }}</h3>
          <span class="kind-pill" :class="{ 'model-classifier': isClassifier }">
            {{ isClassifier ? 'classifier' : agent.kind }}
          </span>
        </div>
        <p class="tagline">{{ agent.tagline }}</p>
        <div class="spec-row">
          <span v-for="s in agent.specialization" :key="s" :class="['spec', `spec-${s}`]">{{ s }}</span>
        </div>
      </div>
    </header>

    <div v-if="isClassifier && agent.classifier_state" class="regime-strip" title="Regime probability simplex (sums to 100%)">
      <div
        v-for="r in regimeBars"
        :key="r.key"
        class="regime-seg"
        :class="[`regime-${r.key}`, { predicted: r.key === agent.classifier_state.predicted_regime }]"
        :style="{ width: `${r.pct}%` }"
      >
        <span v-if="r.pct >= 12" class="regime-label">{{ r.key }} {{ Math.round(r.pct) }}%</span>
      </div>
    </div>
    <div v-else class="regime-strip alloc" title="Allocation across classes">
      <div
        v-for="seg in allocationBars"
        :key="seg.key"
        class="regime-seg"
        :style="{ width: `${seg.pct}%`, background: seg.color }"
      >
        <span v-if="seg.pct >= 12" class="regime-label light">{{ seg.key }} {{ Math.round(seg.pct) }}%</span>
      </div>
    </div>

    <div class="metrics-row">
      <div class="metric" :class="{ positive: agent.performance.live_pnl_pct >= 0, negative: agent.performance.live_pnl_pct < 0 }">
        <span class="m-label">PnL</span>
        <span class="m-value">{{ agent.performance.live_pnl_pct.toFixed(1) }}%</span>
      </div>
      <div class="metric">
        <span class="m-label">Sharpe</span>
        <span class="m-value">{{ agent.performance.sharpe.toFixed(2) }}</span>
      </div>
      <div class="metric" v-if="!isClassifier">
        <span class="m-label">Win</span>
        <span class="m-value">{{ Math.round(agent.performance.win_rate * 100) }}%</span>
      </div>
      <div class="metric" v-else :title="'1 - Brier score against realized regimes'">
        <span class="m-label">Calib.</span>
        <span class="m-value">{{ Math.round((agent.classifier_state?.calibration ?? 0) * 100) }}%</span>
      </div>
      <div class="metric">
        <span class="m-label">DD</span>
        <span class="m-value">{{ agent.performance.max_drawdown_pct.toFixed(1) }}%</span>
      </div>
    </div>

    <svg class="sparkline" :viewBox="`0 0 ${sparkW} ${sparkH}`" preserveAspectRatio="none">
      <polyline
        :points="sparkPoints"
        fill="none"
        :stroke="agent.performance.live_pnl_pct >= 0 ? 'var(--app-color-up, var(--success-green, #00ff88))' : 'var(--app-color-down, var(--error-red, #ff4444))'"
        stroke-width="1.5"
      />
    </svg>

    <div class="training-bar" :title="`v${agent.training_state.version} · ${agent.training_state.epochs} epochs`">
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: `${trainingFill * 100}%` }" />
      </div>
      <span class="bar-label">{{ agent.training_state.status }} · v{{ agent.training_state.version }}</span>
    </div>

    <footer class="card-footer">
      <button
        class="plug-btn"
        :class="{ active: opinions.isPlugged(agent.id) }"
        @click.stop="togglePlug"
        :title="opinions.isPlugged(agent.id) ? 'Unplug from swarm' : 'Plug into swarm'"
      >
        {{ opinions.isPlugged(agent.id) ? '✓ Plugged' : '+ Plug' }}
      </button>
      <button
        v-if="canFork"
        class="fork-btn"
        @click.stop="fork"
        :title="`Fork into your roster (${agent.share_state.price_credits} cr)`"
      >
        Fork · {{ agent.share_state.price_credits }} cr
      </button>
      <button class="compare-btn" @click.stop="$emit('compare', agent.id)" title="Add to comparison">⇄</button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '~/stores/agents'
import { useAgentsStore } from '~/stores/agents'
import { useOpinionsStore } from '~/stores/opinions'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { useLivingUI } from '~/composables/useLivingUI'
import ProfileMark from '@/components/Profile/Mark.vue'
import { assetClassTheme } from '~/utils/assetClass'
import { profileMask } from '~/utils/profileMask'

const props = defineProps<{ agent: Agent }>()
defineEmits<{
  (e: 'select', id: string): void
  (e: 'compare', id: string): void
}>()

const agents = useAgentsStore()
const opinions = useOpinionsStore()
const tracker = useAgentTracker()

// Living UI: card morphs with the agent's confidence and dominant specialization
const living = useLivingUI({
  assetClass: props.agent.specialization[0],
  confidence: props.agent.confidence,
  liquidity: Math.min(1, props.agent.performance.sharpe / 3)
})

const STYLE_ALIAS: Record<string, string> = {
  swing_intraday: 'swing_trader',
  generalist_multi_asset: 'position_trader',
  capital_preservation: 'buy_hold',
  diversified_systematic: 'carry',
  high_octane_contrarian: 'scalper',
  community_consensus: 'macro_overlay',
  regime_classifier: 'day_trader',
}

const isClassifier = computed(() => props.agent.model_type === 'classifier')
const maskStyle = computed(() => STYLE_ALIAS[props.agent.trading_style] || props.agent.trading_style)
const patienceScore = computed(() => {
  const fromBook = Math.min(1, Math.max(0, 0.5 + props.agent.performance.live_pnl_pct / 80))
  return props.agent.personality_matrix.patience * 0.65 + fromBook * 0.35
})
const look = computed(() => profileMask(props.agent.id, {
  style: maskStyle.value,
  risk: props.agent.personality_matrix.risk,
  discipline: props.agent.confidence,
  patience: patienceScore.value,
  aggression: props.agent.personality_matrix.aggression,
}))
const dynamicStyles = computed(() => ({
  ...living.dynamicStyles.value,
  opacity: 1,
  transform: 'none',
  padding: 'clamp(0.4rem, 1vw, 0.65rem)',
  background: look.value.wash,
  borderColor: look.value.edge,
}))

const sparkW = 240
const sparkH = 36
const sparkPoints = computed(() => {
  const curve = props.agent.performance.last_30d_curve
  if (!curve.length) return ''
  const min = Math.min(...curve)
  const max = Math.max(...curve)
  const range = max - min || 1
  const stepX = sparkW / Math.max(1, curve.length - 1)
  return curve.map((v, i) => {
    const x = Math.round(i * stepX)
    const y = Math.round(sparkH - ((v - min) / range) * sparkH)
    return `${x},${y}`
  }).join(' ')
})

const REGIME_ORDER = ['bull', 'chop', 'bear', 'crisis'] as const
const regimeBars = computed(() => {
  const probs = props.agent.classifier_state?.regime_probs
  if (!probs) return []
  return REGIME_ORDER.map(key => ({ key, pct: probs[key] * 100 }))
})

const allocationBars = computed(() => {
  const pie = props.agent.opinion_vector
  const keys = ['fiat', 'crypto', 'stocks', 'commodities'] as const
  const total = keys.reduce((sum, key) => sum + Number(pie[key] ?? 0), 0) || 1
  return keys.map(key => ({
    key,
    pct: (Number(pie[key] ?? 0) / total) * 100,
    color: assetClassTheme(key).color,
  }))
})

const trainingFill = computed(() => {
  const samples = props.agent.training_state.samples_since_last_train
  return Math.min(1, samples / 100)
})

// ── Training progress ring (Phase 22.3) ──────────────────────────────────
// loss_ema is an exponential moving average of training loss (lower = better).
// Map it to a 0-1 "trainedness" score: loss 0.5 → 0%, loss 0.05 → 100%.
const ringCircumference = 2 * Math.PI * 26 // r = 26
const trainedness = computed(() => {
  const loss = props.agent.training_state.loss_ema
  // Sigmoid-ish mapping: 1 at loss=0, 0 at loss≥0.5
  return Math.max(0, Math.min(1, 1 - (loss / 0.5)))
})
const ringOffset = computed(() => ringCircumference * (1 - trainedness.value))

const canFork = computed(() => {
  const { getUserId } = useCurrentUser()
  return props.agent.share_state.is_public && props.agent.owner_id !== getUserId()
})

const togglePlug = () => {
  if (opinions.isPlugged(props.agent.id)) {
    opinions.unplug(props.agent.id)
  } else {
    opinions.plug(props.agent.id, 0.5)
    tracker.track('agent_plug', { agent_id: agents.personalId, source_aggression: props.agent.personality_matrix.aggression })
  }
}

const fork = () => {
  const { getUserId } = useCurrentUser()
  const fk = agents.forkAgent(props.agent.id, getUserId())
  if (fk) tracker.track('agent_fork', { source_id: props.agent.id })
}
</script>

<style scoped>
.agent-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  cursor: pointer;
  position: relative;
  /* dynamicStyles supplies padding, borderRadius, transition, opacity, scale, boxShadow */
}

.agent-card.plugged { border-color: var(--primary-green, #00ff88); }
.agent-card.kind-personal {
  background: linear-gradient(135deg, rgba(0,255,136,0.08), rgba(14,14,18,0.92));
  border-color: rgba(0,255,136,0.35);
}
.agent-card.kind-forked { border-left: 3px solid var(--primary-blue, #00aaff); }

.card-head { display: flex; align-items: flex-start; gap: 0.6rem; }

/* Personality-shaped avatar frame (Phase 22.2) */
.avatar-frame {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}
.avatar-frame :deep(.mark) {
  width: 56px;
  height: 56px;
}

/* Training progress ring (Phase 22.3) */
.training-ring {
  position: absolute;
  inset: -4px;
  width: 64px; height: 64px;
  transform: rotate(-90deg);
  pointer-events: none;
}
.ring-bg {
  fill: none;
  stroke: rgba(255,255,255,0.08);
  stroke-width: 2;
}
.ring-fill {
  fill: none;
  stroke: var(--primary-green, #00ff88);
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}
.head-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
.name-line { display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; }
.name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kind-pill {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}
.tagline {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.spec-row { display: flex; gap: 0.25rem; margin-top: 0.15rem; flex-wrap: wrap; }
.spec {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}
.spec-fiat { background: rgba(74,144,226,0.18); color: #4A90E2; }
.spec-crypto { background: rgba(245,166,35,0.18); color: #F5A623; }
.spec-stocks { background: rgba(126,211,33,0.18); color: #7ED321; }
.spec-commodities { background: rgba(248,231,28,0.18); color: #F8E71C; }

.kind-pill.model-classifier {
  background: rgba(150,150,255,0.16);
  color: #b3b3ff;
}

/* Regime probability simplex — classifier agents only (Phase: Jev) */
.regime-strip {
  display: flex;
  width: 100%;
  height: 18px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
}
.regime-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2px;
  transition: width 0.4s ease;
}
.regime-label {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(0,0,0,0.72);
  text-transform: uppercase;
  white-space: nowrap;
}
.regime-label.light {
  color: #fff;
  text-shadow: 0 1px 1px rgba(0,0,0,0.45);
}
.regime-bull    { background: var(--success-green, #00ff88); }
.regime-chop    { background: rgba(255,255,255,0.25); }
.regime-bear    { background: var(--error-red, #ff4444); }
.regime-crisis  { background: #7a1fd6; }
.regime-seg.predicted { outline: 2px solid rgba(255,255,255,0.7); outline-offset: -2px; }

.metrics-row {
  display: flex;
  width: 100%;
  gap: 0.3rem;
}
.metric {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  padding: 0.28rem 0.15rem;
}
.m-label { font-size: 0.55rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.45); text-transform: uppercase; }
.m-value { font-family: var(--font-market-data, inherit); font-size: 0.85rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.metric.positive .m-value { color: var(--app-color-up, var(--success-green, #00ff88)); }
.metric.negative .m-value { color: var(--app-color-down, var(--error-red, #ff4444)); }

.sparkline {
  width: 100%;
  height: 36px;
  display: block;
}

.training-bar {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.bar-track {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-green, #00ff88), var(--primary-blue, #00aaff));
  transition: width 0.4s ease;
}
.bar-label {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card-footer {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.1rem;
}
.plug-btn, .fork-btn, .compare-btn {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: all 0.2s ease;
}
.compare-btn { flex: 0 0 36px; padding: 0.4rem; font-size: 0.9rem; }
.plug-btn.active {
  background: rgba(0,255,136,0.12);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.plug-btn:hover, .fork-btn:hover, .compare-btn:hover {
  background: rgba(0,255,136,0.1);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
</style>
