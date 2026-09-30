<template>
  <article class="challenge-card" :class="`status-${challenge.status}`">
    <header class="c-head">
      <span class="kind-pill" :class="`kind-${challenge.kind}`">
        {{ challenge.kind === 'market' ? 'market-settled' : 'community-voted' }}
      </span>
      <span class="countdown" :title="challenge.resolves_at">{{ countdownLabel }}</span>
    </header>

    <h3 class="title">{{ challenge.title }}</h3>
    <p class="desc">{{ challenge.description }}</p>

    <div v-if="challenge.kind === 'market'" class="market-line">
      <span class="asset-sym">{{ challenge.asset_symbol }}</span>
      <span class="comparator">{{ challenge.comparator }}</span>
      <span class="target">{{ formatMoney(challenge.target_price) }}</span>
      <span v-if="challenge.resolution_price !== undefined" class="resolved-at">
        resolved @ {{ formatMoney(challenge.resolution_price) }}
      </span>
    </div>

    <!-- Pool / odds bar -->
    <div class="pool-bar" :title="`${Math.round(split.yesPct)}% YES · ${Math.round(split.noPct)}% NO`">
      <div class="pool-yes" :style="{ width: `${split.yesPct}%` }" />
      <div class="pool-no" :style="{ width: `${split.noPct}%` }" />
    </div>
    <div class="pool-labels">
      <span>YES {{ Math.round(split.yesPct) }}% · {{ challenge.pool_yes }} cr</span>
      <span>NO {{ Math.round(split.noPct) }}% · {{ challenge.pool_no }} cr</span>
    </div>

    <!-- Resolved banner -->
    <div v-if="challenge.status !== 'open'" class="resolved-banner" :class="`res-${challenge.status}`">
      {{ resolvedLabel }}
      <span v-if="myBet" class="my-payout">
        · your {{ myBet.side.toUpperCase() }} bet ({{ myBet.stake }} cr) →
        {{ myBet.settled ? `${myBet.payout ?? 0} cr back` : 'settling…' }}
      </span>
    </div>

    <!-- Bet controls (open challenges, no existing bet) -->
    <div v-else-if="!myBet" class="bet-controls">
      <input
        v-model.number="stake"
        type="number"
        :min="1" :max="maxStake"
        class="stake-input"
        aria-label="Stake in free credits"
      />
      <span class="stake-unit">cr</span>
      <button class="side-btn yes" :disabled="!canBet" @click="bet('yes')">Bet YES</button>
      <button class="side-btn no" :disabled="!canBet" @click="bet('no')">Bet NO</button>
    </div>
    <div v-else class="already-bet">
      You bet <strong>{{ myBet.side.toUpperCase() }}</strong> · {{ myBet.stake }} cr staked
    </div>

    <!-- Custom challenge community vote (open, past nothing required — anyone can vote before resolution) -->
    <div v-if="challenge.kind === 'custom' && challenge.status === 'open'" class="vote-row">
      <span class="vote-label">Did it happen?</span>
      <button class="vote-btn" @click="vote('yes')">👍 {{ challenge.votes_yes?.length ?? 0 }}</button>
      <button class="vote-btn" @click="vote('no')">👎 {{ challenge.votes_no?.length ?? 0 }}</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDataBetsStore, type DataChallenge } from '~/stores/dataBets'
import { useCreditsStore } from '~/stores/credits'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { MAX_STAKE } from '~/types/dataBet'

const props = defineProps<{ challenge: DataChallenge }>()

const dataBets = useDataBetsStore()
const credits = useCreditsStore()
const tracker = useAgentTracker()
const { getUserId } = useCurrentUser()

const stake = ref(10)
const maxStake = computed(() => Math.min(MAX_STAKE, credits.balance))
const canBet = computed(() => credits.balance >= 1 && stake.value >= 1)

const split = computed(() => dataBets.poolSplit(props.challenge))
const myBet = computed(() =>
  dataBets.betsForChallenge(props.challenge.id).find(b => b.user_id === getUserId())
)

const countdownLabel = computed(() => {
  if (props.challenge.status !== 'open') return 'closed'
  const ms = new Date(props.challenge.resolves_at).getTime() - Date.now()
  if (ms <= 0) return 'resolving…'
  const hrs = ms / 3_600_000
  if (hrs < 1) return `${Math.round(ms / 60_000)}m left`
  if (hrs < 48) return `${Math.round(hrs)}h left`
  return `${Math.round(hrs / 24)}d left`
})

const resolvedLabel = computed(() => {
  switch (props.challenge.status) {
    case 'resolved_yes': return '✓ Resolved YES'
    case 'resolved_no':  return '✓ Resolved NO'
    case 'void':         return '⟲ Void — everyone refunded'
    default:             return ''
  }
})

function formatMoney(v?: number) {
  if (v === undefined) return '—'
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`
}

function bet(side: 'yes' | 'no') {
  const balanceBefore = credits.balance
  const result = dataBets.placeBet(props.challenge.id, side, stake.value)
  if (!result) return
  tracker.track('data_bet_placed', {
    id: props.challenge.id,
    challenge_id: props.challenge.id,
    side,
    stake_fraction: result.stakeFraction,
    against_majority: result.againstMajority,
    balance_before: balanceBefore
  })
}

function vote(side: 'yes' | 'no') {
  dataBets.castVote(props.challenge.id, getUserId(), side)
}
</script>

<style scoped>
.challenge-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 8px);
  padding: 0.85rem;
  min-width: 0;
}
.status-resolved_yes { border-left: 3px solid var(--app-color-up, var(--success-green, #00ff88)); }
.status-resolved_no  { border-left: 3px solid var(--app-color-down, var(--error-red, #ff4444)); }
.status-void         { border-left: 3px solid rgba(255,255,255,0.25); }

.c-head { display: flex; justify-content: space-between; align-items: center; }
.kind-pill {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
}
.kind-market { background: rgba(0,170,255,0.15); color: var(--primary-blue, #00aaff); }
.kind-custom { background: rgba(245,166,35,0.15); color: #F5A623; }
.countdown { font-size: 0.65rem; color: rgba(255,255,255,0.45); }

.title { margin: 0; font-size: 0.9rem; font-weight: 700; }
.desc { margin: 0; font-size: 0.75rem; color: rgba(255,255,255,0.6); line-height: 1.35; }

.market-line {
  display: flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap;
  font-size: 0.72rem; color: rgba(255,255,255,0.7);
}
.asset-sym { font-weight: 800; }
.comparator { text-transform: uppercase; color: rgba(255,255,255,0.4); }
.target { font-weight: 700; font-variant-numeric: tabular-nums; }
.resolved-at { color: rgba(255,255,255,0.4); }

.pool-bar {
  display: flex;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255,255,255,0.06);
}
.pool-yes { background: var(--app-color-up, var(--success-green, #00ff88)); }
.pool-no  { background: var(--app-color-down, var(--error-red, #ff4444)); }
.pool-labels {
  display: flex; justify-content: space-between;
  font-size: 0.6rem; color: rgba(255,255,255,0.5);
}

.resolved-banner {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
}
.res-resolved_yes { color: var(--app-color-up, var(--success-green, #00ff88)); }
.res-resolved_no  { color: var(--app-color-down, var(--error-red, #ff4444)); }
.res-void         { color: rgba(255,255,255,0.6); }
.my-payout { font-weight: 400; color: rgba(255,255,255,0.55); }

.bet-controls { display: flex; gap: 0.35rem; align-items: center; }
.stake-input {
  width: 4.5rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  font-size: 0.75rem;
}
.stake-unit { font-size: 0.65rem; color: rgba(255,255,255,0.4); }
.side-btn {
  flex: 1;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  background: transparent;
}
.side-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.side-btn.yes { color: var(--app-color-up, var(--success-green, #00ff88)); border-color: var(--app-color-up, var(--success-green, #00ff88)); }
.side-btn.no  { color: var(--app-color-down, var(--error-red, #ff4444)); border-color: var(--app-color-down, var(--error-red, #ff4444)); }
.side-btn.yes:hover:not(:disabled) { background: rgba(0,255,136,0.1); }
.side-btn.no:hover:not(:disabled)  { background: rgba(255,68,68,0.1); }

.already-bet { font-size: 0.72rem; color: rgba(255,255,255,0.6); }

.vote-row { display: flex; align-items: center; gap: 0.5rem; }
.vote-label { font-size: 0.68rem; color: rgba(255,255,255,0.5); }
.vote-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  cursor: pointer;
}
.vote-btn:hover { background: rgba(255,255,255,0.09); }
</style>
