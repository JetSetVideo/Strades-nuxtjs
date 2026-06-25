<script setup lang="ts">
interface Block {
  id: number | string
  type: 'asset' | 'condition' | 'action' | string
  data: any
}

defineProps<{ blocks: Block[] }>()

function describe(block: Block): string {
  switch (block.type) {
    case 'asset':
      return `Asset · ${block.data}`
    case 'condition':
      return `When ${block.data?.condition ?? '—'} ${block.data?.value ?? ''}`
    case 'action':
      return `${block.data?.action ?? '—'} ${block.data?.amount ?? ''}`
    default:
      return ''
  }
}

function blockTone(type: string) {
  if (type === 'condition') return 'cond'
  if (type === 'action')    return 'action'
  if (type === 'asset')     return 'asset'
  return 'neutral'
}
</script>

<template>
  <div class="strategy-flow">
    <template v-if="blocks.length === 0">
      <span class="empty">Add a condition + action to see the flow.</span>
    </template>
    <template v-else>
      <template v-for="(block, index) in blocks" :key="block.id">
        <span :class="['block-item', blockTone(block.type)]">
          <span class="b-tag">{{ block.type }}</span>
          <span class="b-text">{{ describe(block) }}</span>
        </span>
        <span v-if="index < blocks.length - 1" class="arrow">→</span>
      </template>
    </template>
  </div>
</template>

<style scoped>
.strategy-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.empty {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.04em;
}

.block-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  max-width: 100%;
}
.block-item.cond   { background: rgba(0,170,255,0.08);  border-color: rgba(0,170,255,0.3);  color: var(--primary-blue, #00aaff); }
.block-item.action { background: rgba(0,255,136,0.08);  border-color: rgba(0,255,136,0.3);  color: var(--primary-green, #00ff88); }
.block-item.asset  { background: rgba(245,166,35,0.1);  border-color: rgba(245,166,35,0.3); color: #F5A623; }

.b-tag {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 800;
  opacity: 0.7;
}

.b-text {
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.arrow {
  font-size: 1rem;
  color: var(--primary-green, #00ff88);
  font-weight: 700;
}
</style>
