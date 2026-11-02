<script setup lang="ts">
/**
 * Compare tray for the Avatar Marketplace (Wave 2 review, REVIEW-15): the ⇄ button on each
 * <AgentAvatarCard> adds the agent here (max 3, stores/agents.ts compareIds). Two ⇄ clicks = two
 * columns side by side. Figures come from the bundled catalog (avatars.json): chipped Sample;
 * a missing figure prints "—".
 */
import { computed } from 'vue'
import { AGENT_SAMPLE_NOTE, COMPARE_MAX, agentCompareColumns, useAgentsStore } from '~/stores/agents'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISourceChip from '@/components/UI/SourceChip.vue'

const agents = useAgentsStore()
const columns = computed(() => agentCompareColumns(agents.compareIds.map(id => agents.byId[id])))
const cols = computed(() => Math.min(COMPARE_MAX, Math.max(2, columns.value.length)) as 2 | 3)
const ROWS = [
  { key: 'pnl', label: 'PnL' },
  { key: 'win', label: 'Win' },
  { key: 'dd', label: 'Max DD' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'trades', label: 'Trades' },
  { key: 'status', label: 'Status' },
] as const
</script>

<template>
  <section v-if="columns.length" class="compare-tray" aria-label="Compare agents" aria-live="polite">
    <header class="tray-head">
      <h2>Compare <small>{{ columns.length }} / {{ COMPARE_MAX }}</small></h2>
      <UISourceChip source="sample" :note="AGENT_SAMPLE_NOTE" />
      <span v-if="columns.length < 2" class="hint">Press ⇄ on another card to put it side by side.</span>
      <button type="button" class="clear" @click="agents.clearCompare()">Clear</button>
    </header>
    <UIMetricRow :cols="cols">
      <div v-for="c in columns" :key="c.id" class="col">
        <div class="col-head">
          <NuxtLink :to="`/agents/${c.id}`" class="col-name">{{ c.name }}</NuxtLink>
          <button type="button" class="drop" :aria-label="`Remove ${c.name} from the comparison`" @click="agents.toggleCompare(c.id)">×</button>
        </div>
        <dl>
          <template v-for="r in ROWS" :key="r.key">
            <dt>{{ r.label }}</dt>
            <dd>{{ c[r.key] }}</dd>
          </template>
        </dl>
      </div>
    </UIMetricRow>
  </section>
</template>

<style scoped>
.compare-tray {
  position: sticky;
  bottom: 0.5rem;
  z-index: 5;
  margin: 0.6rem 0;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg, 12px);
  background: color-mix(in srgb, var(--surface-sunken, #0a0b10) 92%, transparent);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
}
.tray-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; margin-bottom: 0.4rem; }
.tray-head h2 { margin: 0; font-size: 0.85rem; }
.tray-head small { font-weight: 400; color: var(--text-secondary); }
.hint { font-size: 0.7rem; color: var(--text-secondary); }
.clear, .drop {
  border: 1px solid var(--border-primary);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
}
.clear { margin-left: auto; }
.col { border: 1px solid var(--border-primary); border-radius: 8px; padding: 0.35rem 0.5rem; }
.col-head { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; }
.col-name { font-weight: 600; font-size: 0.78rem; color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-name:hover { text-decoration: underline; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 0.1rem 0.5rem; margin: 0.3rem 0 0; font-size: 0.72rem; }
dt { color: var(--text-secondary); }
dd { margin: 0; text-align: right; font-family: var(--font-market-data, monospace); }
</style>
