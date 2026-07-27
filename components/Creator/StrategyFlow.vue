<script setup lang="ts">
import { computed } from 'vue'

interface Block {
  id: number
  type: 'condition' | 'action'
  data: Record<string, unknown>
}

const props = defineProps<{
  blocks: Block[]
  assetFrom?: string
  assetTo?: string
  frequency?: string
}>()

function conditionLabel(data: Record<string, unknown>): string {
  if (!data?.indicator) return 'Condition'
  const ind = String(data.indicator)
  const op  = String(data.operator ?? '?')
  const val = data.valueType === 'indicator' ? String(data.valueIndicator ?? '?') : String(data.value ?? '?')
  const opMap: Record<string,string> = {
    gt:'>', lt:'<', gte:'≥', lte:'≤', eq:'=', crosses_up:'↑×', crosses_dn:'↓×',
  }
  return `${ind} ${opMap[op] ?? op} ${val}`
}

function actionLabel(data: Record<string, unknown>): string {
  if (!data?.type) return 'Action'
  const typeMap: Record<string, string> = {
    shift: '↔ Shift', increase: '↑ Inc', decrease: '↓ Dec',
    rebalance: '⚖ Rebalance', exit: '⏹ Exit', hold: '⏸ Hold',
  }
  const t = typeMap[String(data.type)] ?? String(data.type)
  const alloc = data.type !== 'hold' ? ` ${data.allocation ?? '?'}%` : ''
  return `${t}${alloc}`
}

const conditions = computed(() => props.blocks.filter(b => b.type === 'condition'))
const actions    = computed(() => props.blocks.filter(b => b.type === 'action'))
const hasBlocks  = computed(() => props.blocks.length > 0)
</script>

<template>
  <div class="sv-root">
    <div class="sv-header">
      <span class="sv-title">Strategy Flow</span>
      <span v-if="frequency" class="sv-freq">{{ frequency }}</span>
    </div>

    <div v-if="!hasBlocks && !assetFrom && !assetTo" class="sv-empty">
      <span class="empty-icon">🗺</span>
      <p>Add assets, conditions & actions to see your strategy flow.</p>
    </div>

    <div v-else class="sv-flow">
      <div v-if="assetFrom" class="flow-node asset-node from-node">
        <span class="node-icon">📤</span>
        <span class="node-label">{{ assetFrom }}</span>
        <span class="node-meta">FROM</span>
      </div>

      <template v-if="hasBlocks || assetFrom || assetTo">
        <div class="flow-col">
          <template v-if="conditions.length">
            <div class="col-label">IF</div>
            <div
              v-for="(block, i) in conditions"
              :key="block.id"
              class="flow-node cond-node"
            >
              <span class="node-dot cond-dot" />
              <span class="node-label">{{ conditionLabel(block.data) }}</span>
              <span v-if="i < conditions.length - 1" class="and-or">AND</span>
            </div>
          </template>
          <template v-else>
            <div class="flow-placeholder">+ Add conditions</div>
          </template>

          <div class="arrow-connector">▼</div>

          <template v-if="actions.length">
            <div class="col-label">THEN</div>
            <div
              v-for="block in actions"
              :key="block.id"
              class="flow-node action-node"
            >
              <span class="node-dot action-dot" />
              <span class="node-label">{{ actionLabel(block.data) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="flow-placeholder">+ Add actions</div>
          </template>
        </div>
      </template>

      <div v-if="assetTo" class="flow-node asset-node to-node">
        <span class="node-icon">📥</span>
        <span class="node-label">{{ assetTo }}</span>
        <span class="node-meta">TO</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sv-root {
  background: rgba(0,0,0,0.2);
  border: 1px dashed var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 80px;
}

.sv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sv-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

.sv-freq {
  font-size: 0.62rem;
  color: var(--primary-green);
  font-weight: 700;
  background: rgba(0,255,136,0.1);
  padding: 2px 7px;
  border-radius: 999px;
}

.sv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-sm);
  color: var(--text-gray);
}

.empty-icon { font-size: 1.6rem; opacity: 0.4; }
.sv-empty p { font-size: 0.72rem; text-align: center; margin: 0; }

.sv-flow {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  overflow-x: auto;
  scrollbar-width: none;
}

.sv-flow::-webkit-scrollbar { display: none; }

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  min-width: 64px;
  flex-shrink: 0;
  position: relative;
}

.asset-node {
  border-color: var(--border-primary);
  background: rgba(255,255,255,0.04);
  align-self: center;
}

.from-node { border-color: var(--primary-blue); background: rgba(33,150,243,0.08); }
.to-node   { border-color: var(--success-green); background: rgba(76,175,80,0.08); }

.cond-node   { border-color: var(--primary-blue); background: rgba(33,150,243,0.08); }
.action-node { border-color: var(--warning-orange); background: rgba(255,160,0,0.08); }

.node-icon  { font-size: 1rem; }
.node-label { font-size: 0.65rem; font-weight: 600; color: var(--text-white); text-align: center; }
.node-meta  { font-size: 0.5rem; color: var(--text-gray); letter-spacing: 0.05em; text-transform: uppercase; }

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: flex-start;
  position: absolute;
  top: 6px;
  left: 6px;
}

.cond-dot   { background: var(--primary-blue); }
.action-dot { background: var(--warning-orange); }

.flow-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 120px;
}

.col-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-gray);
}

.and-or {
  font-size: 0.5rem;
  color: var(--text-gray);
  letter-spacing: 0.08em;
}

.arrow-connector {
  font-size: 0.6rem;
  color: var(--text-gray);
  padding: 2px;
}

.flow-placeholder {
  font-size: 0.65rem;
  color: var(--text-gray);
  font-style: italic;
  padding: 4px 8px;
  border: 1px dashed var(--border-secondary);
  border-radius: var(--radius-sm);
  text-align: center;
}
</style>
