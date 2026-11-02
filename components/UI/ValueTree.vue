<script setup lang="ts">
/**
 * UIValueTree — a number you can open, top-down: value -> formula + inputs -> the settings that drive it.
 * Each input is itself a node (recursive). Inline disclosure (no pop-over), one open child per level,
 * every option visible even at 0 / unknown. Spec: DESIGN-AUDIT.md §3. Nodes come from utils/valueTree.ts.
 */
import { computed, ref } from 'vue'
import { drillable, headline, signTone, type ValueNode } from '~/utils/valueTree'
import { fmtDateTime, toDate } from '~/utils/format'

const props = withDefaults(defineProps<{ node: ValueNode; size?: 'lg' | 'md' | 'sm'; layout?: 'stat' | 'row'; depth?: number; maxDepth?: number; openTo?: number }>(), {
  size: 'md', layout: 'stat', depth: 0, maxDepth: 4, openTo: 0,
})
const emit = defineEmits<{ drill: [id: string, level: number] }>()

const open = ref(props.openTo > 0)
const head = computed(() => headline(props.node))
// Numbers come from formatValue (utils/valueTree.ts → utils/format.ts); a date-like "as of" goes through fmtDateTime.
const asOfText = computed(() => {
  const a = props.node.source?.asOf
  return a && toDate(a) ? fmtDateTime(a) : a
})
const canOpen = computed(() => drillable(props.node) && props.depth < props.maxDepth && props.node.status !== 'loading')
const panelId = computed(() => `vt-${props.node.id.replace(/[^a-z0-9_-]/gi, '-')}-${props.depth}`)
const tone = computed(() => {
  const v = props.node.value
  if (!props.node.signed || typeof v !== 'number') return ''
  // A value that prints as zero ("$0.00") is neutral, like the KPI tiles.
  const t = signTone(v)
  return t === 'positive' ? 'up' : t === 'negative' ? 'down' : ''
})
const SOURCE: Record<string, string> = {
  api: 'from the server', computed: 'computed here', setting: 'your setting', sample: 'sample data (not yours)',
  simulated: 'simulated by a model', browser: 'saved in this browser only',
}

function toggle() {
  if (!canOpen.value) return
  open.value = !open.value
  if (open.value) emit('drill', props.node.id, props.depth)
}
</script>

<template>
  <div class="vt" :class="[size, layout, `d${depth}`, { open }]">
    <button
      type="button" class="vt-head" :aria-expanded="canOpen ? open : undefined" :aria-controls="canOpen ? panelId : undefined"
      :disabled="!canOpen" :aria-busy="node.status === 'loading'" @click="toggle"
    >
      <span class="vt-label">{{ node.label }}
        <UISourceChip v-if="node.source?.kind === 'sample'" source="sample" />
        <UISourceChip v-else-if="node.source?.kind === 'simulated'" source="simulated" />
      </span>
      <span class="vt-value" :class="tone">
        <span v-if="node.status === 'loading'" class="vt-skel" />
        <template v-else>{{ head.text }}</template>
        <span v-if="canOpen" class="vt-caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      </span>
      <span v-if="head.muted" class="vt-reason">{{ head.muted }}</span>
    </button>

    <div v-if="open" :id="panelId" class="vt-body" role="group" :aria-label="`How ${node.label} is computed`">
      <p v-if="node.formula" class="vt-formula">{{ node.formula }}</p>
      <ul v-if="node.inputs?.length" class="vt-inputs">
        <li v-for="c in node.inputs" :key="c.id">
          <ValueTree
            :node="c" size="sm" layout="row" :depth="depth + 1" :max-depth="maxDepth"
            @drill="(id, l) => emit('drill', id, l)"
          />
        </li>
      </ul>
      <p v-if="node.explain" class="vt-explain">{{ node.explain }}</p>
      <p v-if="node.source" class="vt-source">
        Source: {{ SOURCE[node.source.kind] || node.source.kind }} · {{ node.source.name }}<template v-if="node.source.asOf"> · as of {{ asOfText }}</template>
      </p>
      <div v-if="node.settings?.length" class="vt-settings">
        <span class="vt-settings-t">Driven by your settings</span>
        <NuxtLink v-for="s in node.settings" :key="s.key" :to="s.href || `/settings#set-${s.key}`" class="vt-set">
          {{ s.label }} <b>{{ s.value ?? 'not set' }}</b> <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vt { min-width: 0; }
.vt-head { all: unset; box-sizing: border-box; width: 100%; display: grid; gap: 0.15rem; cursor: pointer; border-radius: var(--radius-sm); }
.vt-head:disabled { cursor: default; }
.vt-head:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.stat .vt-head { padding: 0.6rem 0.7rem; border: 1px solid var(--edge-soft); background: var(--surface-raised); }
.stat .vt-head:not(:disabled):hover { border-color: var(--edge-lit); }
.row .vt-head { grid-template-columns: 1fr auto; align-items: baseline; padding: 0.3rem 0.2rem; }
.row .vt-reason { grid-column: 1 / -1; }
.vt-label { font-size: 0.72rem; color: var(--text-gray); display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.vt-value { font-variant-numeric: tabular-nums; color: var(--text-white); display: inline-flex; align-items: baseline; gap: 0.3rem; }
.lg .vt-value { font-size: 1.5rem; font-weight: 700; }
.md .vt-value { font-size: 1.05rem; font-weight: 600; }
.sm .vt-value { font-size: 0.85rem; }
.vt-value.up { color: var(--app-color-up, #00ff88); }
.vt-value.down { color: var(--app-color-down, #ff4444); }
.vt-caret { font-size: 0.7rem; color: var(--text-gray); }
.vt-reason { font-size: 0.68rem; color: var(--text-gray); }
.vt-skel { display: inline-block; width: 5rem; height: 1em; border-radius: 4px; background: rgba(255, 255, 255, 0.06); }
.vt-body { margin: 0.3rem 0 0.2rem 0.6rem; padding-left: 0.6rem; border-left: 1px solid var(--edge-raised); display: grid; gap: 0.35rem; }
.vt-formula { margin: 0; font-family: var(--font-market-data, ui-monospace, monospace); font-size: 0.74rem; color: var(--text-light-gray); }
.vt-inputs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.1rem; }
.vt-explain, .vt-source { margin: 0; font-size: 0.7rem; color: var(--text-gray); }
.vt-settings { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.vt-settings-t { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.vt-set { font-size: 0.72rem; color: var(--primary-blue); text-decoration: none; padding: 0.15rem 0.45rem; border: 1px solid var(--edge-raised); border-radius: 999px; }
.vt-set:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) { .vt-body { animation: vt-in 150ms ease-out; } }
@keyframes vt-in { from { opacity: 0; transform: translateY(-2px); } }
</style>
