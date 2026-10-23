<script setup lang="ts">
import { computed } from 'vue'
import { BASIS_META, CLASS_META, assetClass, type DraftBlock, type PoolMember, type SourceBasis } from '~/utils/strategyDraft'

const props = defineProps<{
  pool: PoolMember[]
  assetFrom: string
  assetTo: string
  allocation: number
  blocks: DraftBlock[]
  sources: { id: string; basis: SourceBasis; name?: string }[]
  frequency: string
}>()

const emit = defineEmits<{ focus: [section: string] }>()

const universe = computed(() => props.pool.length
  ? props.pool
  : [
      ...(props.assetFrom ? [{ id: props.assetFrom, op: 'include' as const }] : []),
      ...(props.assetTo ? [{ id: props.assetTo, op: 'include' as const }] : []),
    ])

function blockText(block: DraftBlock): string {
  const d = block.data
  if (block.type === 'condition') return `${d.indicator ?? 'IF'} ${d.operator ?? ''} ${d.value ?? ''}`.trim()
  if (block.type === 'formula') return `${d.op ?? 'op'} ${d.left ?? ''} ${d.right ?? ''} → ${d.into ?? ''}`.replace(/\s+/g, ' ').trim()
  return `${d.type ?? 'action'} ${d.allocation ?? ''}%`.trim()
}

const tone = (block: DraftBlock) => block.type === 'condition' ? '#5b9cff' : block.type === 'formula' ? '#c084fc' : '#ffb020'
</script>

<template>
  <div class="blueprint">
    <p class="bp-note">Same parameters as the card and the JSON. A node opens that part of the card.</p>
    <div class="bp-row">
      <button type="button" class="node" style="--tone:#3dd68c" @click="emit('focus', 'assets')">
        <span class="kicker">Universe</span>
        <strong>{{ assetFrom || '—' }} → {{ assetTo || '—' }}</strong>
        <span class="meta">{{ allocation }}% · {{ frequency }}</span>
        <span class="chips">
          <em v-for="member in universe" :key="member.id + member.op" :class="member.op" :style="{ color: CLASS_META[assetClass(member.id)].color }">
            {{ member.op === 'exclude' ? '−' : '+' }}{{ member.id }}
          </em>
          <em v-if="!universe.length" class="empty">Add an asset</em>
        </span>
      </button>

      <button type="button" class="node" style="--tone:#3ec6e0" @click="emit('focus', 'sources')">
        <span class="kicker">Sources</span>
        <strong>{{ sources.length }} linked</strong>
        <span class="chips">
          <em v-for="src in sources" :key="src.id" :style="{ color: BASIS_META[src.basis].color }">{{ BASIS_META[src.basis].label }}</em>
          <em v-if="!sources.length" class="empty">None yet</em>
        </span>
      </button>

      <button
        v-for="(block, i) in blocks"
        :key="block.id"
        type="button"
        class="node"
        :style="{ '--tone': tone(block) }"
        @click="emit('focus', 'logic')"
      >
        <span class="kicker">{{ String(i + 1).padStart(2, '0') }} {{ block.type }}</span>
        <strong>{{ blockText(block) }}</strong>
      </button>

      <button v-if="!blocks.length" type="button" class="node dashed" style="--tone:#ffb020" @click="emit('focus', 'logic')">
        <span class="kicker">Logic</span>
        <strong>Add if, math, or an exchange</strong>
      </button>
    </div>
  </div>
</template>

<style scoped>
.blueprint { display: flex; flex-direction: column; gap: 10px; }
.bp-note { margin: 0; font-size: 0.72rem; color: var(--text-gray); }
.bp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
}
.node {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  background: color-mix(in srgb, var(--tone) 10%, transparent);
  color: var(--text-white);
  cursor: pointer;
  min-width: 0;
}
.node.dashed { border-style: dashed; }
.kicker {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tone);
}
.node strong { font-size: 0.82rem; font-weight: 700; }
.meta { font-size: 0.65rem; color: var(--text-gray); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chips em { font-style: normal; font-size: 0.62rem; font-weight: 700; }
.chips em.exclude { text-decoration: line-through; opacity: 0.8; }
.chips em.empty { color: var(--text-gray); font-weight: 500; }
</style>
