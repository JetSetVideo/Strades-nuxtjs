<template>
  <component
    :is="tag"
    class="ui-card"
    :class="[`pad-${padding}`, { hoverable, dominant, danger }]"
    :style="dynamicStyles"
  >
    <header v-if="title || $slots.header" class="card-head">
      <slot name="header">
        <h3 class="card-title">
          <slot name="icon" />
          {{ title }}
        </h3>
      </slot>
      <div v-if="$slots.action" class="card-action"><slot name="action" /></div>
    </header>
    <div class="card-body"><slot /></div>
    <footer v-if="$slots.footer" class="card-foot"><slot name="footer" /></footer>
  </component>
</template>

<script setup lang="ts">
import { useLivingUI } from '~/composables/useLivingUI'
import type { AssetClass } from '~/stores/macro'

const props = withDefaults(defineProps<{
  title?: string
  tag?: string
  padding?: 'tight' | 'normal' | 'loose'
  hoverable?: boolean
  dominant?: boolean
  danger?: boolean
  assetClass?: AssetClass
  confidence?: number
  liquidity?: number
}>(), {
  tag: 'section',
  padding: 'normal'
})

const { dynamicStyles } = useLivingUI({
  assetClass: props.assetClass,
  confidence: props.confidence,
  liquidity: props.liquidity
})
</script>

<style scoped>
.ui-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.07);
  color: #fff;
  min-width: 0;          /* allow card to shrink inside grid/flex parents */
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;       /* keep child content within card bounds */
  /* dynamicStyles supplies padding, radius, transition, opacity, scale, boxShadow */
}
.ui-card.pad-tight { padding: 0.5rem 0.65rem !important; }
.ui-card.pad-loose { padding: 1.2rem 1.4rem !important; }

.ui-card.hoverable { cursor: pointer; }
.ui-card.hoverable:hover {
  border-color: rgba(0,255,136,0.4);
  transform: scale(calc(var(--lui-scale, 1) + 0.005)) translateY(-1px);
}

.ui-card.dominant {
  border-color: var(--primary-green, #00ff88);
  background: linear-gradient(135deg, rgba(0,255,136,0.05), rgba(14,14,18,0.92));
}
.ui-card.danger { border-color: rgba(255,68,68,0.35); }

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.card-title {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(255,255,255,0.65);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-action { display: flex; gap: 0.25rem; flex-shrink: 0; }
.card-body { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}
</style>
