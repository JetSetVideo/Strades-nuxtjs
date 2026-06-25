<template>
  <div class="compare-pane">
    <header class="head">
      <h2>Compare Avatars</h2>
      <button class="clear" @click="clear" v-if="agents.comparisonSlots[0] || agents.comparisonSlots[1]">Clear</button>
    </header>

    <div class="slots">
      <div class="slot" :class="{ filled: !!left }">
        <AgentAvatarCard v-if="left" :agent="left" />
        <div v-else class="empty-slot">Pick an Avatar to compare ➜</div>
      </div>
      <div class="vs">VS</div>
      <div class="slot" :class="{ filled: !!right }">
        <AgentAvatarCard v-if="right" :agent="right" />
        <div v-else class="empty-slot">⬅ Pick a second Avatar</div>
      </div>
    </div>

    <div v-if="left && right" class="diff-table">
      <div v-for="row in rows" :key="row.label" class="diff-row">
        <div class="diff-label">{{ row.label }}</div>
        <div class="diff-cell" :class="row.leftWin ? 'win' : ''">{{ row.leftDisplay }}</div>
        <div class="diff-spark">
          <div class="bar-l" :style="{ width: leftPct(row) + '%' }" />
          <div class="bar-r" :style="{ width: rightPct(row) + '%' }" />
        </div>
        <div class="diff-cell right" :class="row.rightWin ? 'win' : ''">{{ row.rightDisplay }}</div>
      </div>

      <div class="vectors">
        <AgentOpinionVector :vector="left.opinion_vector" :label="`${left.name} — Opinion`" />
        <AgentOpinionVector :vector="right.opinion_vector" :label="`${right.name} — Opinion`" />
      </div>

      <div class="overlap">
        <span class="overlap-label">Allocation overlap</span>
        <div class="overlap-bar">
          <div class="overlap-fill" :style="{ width: overlap * 100 + '%' }" />
        </div>
        <span class="overlap-pct">{{ Math.round(overlap * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import AgentAvatarCard from '~/components/Agent/AvatarCard.vue'
import AgentOpinionVector from '~/components/Agent/OpinionVector.vue'

const agents = useAgentsStore()
const [left, right] = [computed(() => agents.comparisonPair[0]), computed(() => agents.comparisonPair[1])]

interface DiffRow {
  label: string
  leftValue: number
  rightValue: number
  leftDisplay: string
  rightDisplay: string
  higherIsBetter: boolean
  leftWin: boolean
  rightWin: boolean
}

const rows = computed<DiffRow[]>(() => {
  if (!left.value || !right.value) return []
  const l = left.value
  const r = right.value
  const make = (label: string, lv: number, rv: number, fmt: (n: number) => string, higher: boolean): DiffRow => {
    const leftWin = higher ? lv > rv : lv < rv
    return {
      label,
      leftValue: lv,
      rightValue: rv,
      leftDisplay: fmt(lv),
      rightDisplay: fmt(rv),
      higherIsBetter: higher,
      leftWin,
      rightWin: !leftWin && lv !== rv
    }
  }
  const pct = (n: number) => `${n.toFixed(1)}%`
  const fxd = (n: number) => n.toFixed(2)
  return [
    make('Live PnL', l.performance.live_pnl_pct, r.performance.live_pnl_pct, pct, true),
    make('Sharpe', l.performance.sharpe, r.performance.sharpe, fxd, true),
    make('Win rate', l.performance.win_rate * 100, r.performance.win_rate * 100, pct, true),
    make('Max DD', l.performance.max_drawdown_pct, r.performance.max_drawdown_pct, pct, true), // less negative wins
    make('Confidence', l.confidence * 100, r.confidence * 100, pct, true),
    make('Risk', l.personality_matrix.risk * 100, r.personality_matrix.risk * 100, pct, false),
    make('Patience', l.personality_matrix.patience * 100, r.personality_matrix.patience * 100, pct, true),
    make('Reaction', l.personality_matrix.reaction_speed * 100, r.personality_matrix.reaction_speed * 100, pct, true)
  ]
})

const leftPct = (row: DiffRow) => {
  const sum = Math.abs(row.leftValue) + Math.abs(row.rightValue)
  if (sum === 0) return 50
  return (Math.abs(row.leftValue) / sum) * 100
}
const rightPct = (row: DiffRow) => 100 - leftPct(row)

const overlap = computed(() => {
  if (!left.value || !right.value) return 0
  const lo = left.value.opinion_vector
  const ro = right.value.opinion_vector
  const diff = Math.abs(lo.fiat - ro.fiat) + Math.abs(lo.crypto - ro.crypto) + Math.abs(lo.stocks - ro.stocks) + Math.abs(lo.commodities - ro.commodities)
  return Math.max(0, 1 - diff / 200) // 200 is the max possible absolute diff
})

const clear = () => {
  agents.setComparison(0, null)
  agents.setComparison(1, null)
}
</script>

<style scoped>
.compare-pane {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 8px);
}
.head { display: flex; justify-content: space-between; align-items: baseline; }
.head h2 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
}
.clear {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}
.clear:hover { color: var(--primary-green, #00ff88); border-color: var(--primary-green, #00ff88); }

.slots {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: stretch;
}
.slot {
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 6px;
  min-height: 200px;
  padding: 0.5rem;
}
.slot.filled { border-style: solid; border-color: rgba(255,255,255,0.12); padding: 0; }
.empty-slot {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 1rem;
}
.vs {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.35);
  align-self: center;
}

.diff-table { display: flex; flex-direction: column; gap: 0.4rem; }
.diff-row {
  display: grid;
  grid-template-columns: 1fr 60px 2fr 60px;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.75rem;
}
.diff-label { font-size: 0.65rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.55); text-transform: uppercase; }
.diff-cell { font-variant-numeric: tabular-nums; font-weight: 600; text-align: left; }
.diff-cell.right { text-align: right; }
.diff-cell.win { color: var(--success-green, #00ff88); }
.diff-spark { display: flex; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
.bar-l { background: #4A90E2; height: 100%; }
.bar-r { background: #F5A623; height: 100%; }

.vectors {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.overlap { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.overlap-label {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}
.overlap-bar {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  overflow: hidden;
}
.overlap-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-blue, #00aaff), var(--primary-green, #00ff88));
  transition: width 0.4s ease;
}
.overlap-pct { font-size: 0.85rem; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
