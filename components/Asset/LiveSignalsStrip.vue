<script setup lang="ts">
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

interface CountryStat {
  country: string
  flag: string
  share: number
}

defineProps<{
  armedCount: number
  firedCount: number
  tags: { id: string; label: string }[]
  annotationsCount: number
  shipmentsCount?: number
  topSupplierCountry?: CountryStat | null
}>()
</script>

<template>
  <UICard title="Live signals" padding="tight">
    <template #action>
      <UIPill tone="success" show-dot>HOT</UIPill>
    </template>
    <div class="signals-grid">
      <div class="signal">
        <span class="s-label">Alerts</span>
        <span class="s-value">
          <span :class="{ pos: armedCount > 0 }">{{ armedCount }}</span>
          <em>armed</em>
          <span v-if="firedCount" class="fired">+ {{ firedCount }} fired</span>
        </span>
      </div>

      <div class="signal">
        <span class="s-label">Tags</span>
        <span class="s-value">
          <span>{{ tags.length }}</span>
          <em>{{ tags.length === 1 ? 'thesis' : 'theses' }}</em>
        </span>
        <span v-if="tags.length" class="signal-chips">
          <span v-for="t in tags.slice(0, 3)" :key="t.id" class="chip">{{ t.label }}</span>
          <span v-if="tags.length > 3" class="chip more">+{{ tags.length - 3 }}</span>
        </span>
      </div>

      <div class="signal">
        <span class="s-label">Annotations</span>
        <span class="s-value">
          <span>{{ annotationsCount }}</span>
          <em>drawn</em>
        </span>
      </div>

      <div class="signal" v-if="shipmentsCount !== undefined">
        <span class="s-label">Supply lanes</span>
        <span class="s-value">
          <span>{{ shipmentsCount }}</span>
          <em>recent</em>
        </span>
        <span v-if="topSupplierCountry" class="signal-chips">
          <span class="chip flag-chip">{{ topSupplierCountry.flag }} {{ topSupplierCountry.country }}</span>
          <span class="chip">{{ topSupplierCountry.share.toFixed(0) }}%</span>
        </span>
      </div>
    </div>
  </UICard>
</template>

<style scoped>
.signals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 0.45rem;
  min-width: 0;
}
.signal {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.03);
  border-radius: 5px;
  min-width: 0;
}
.signal .s-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.signal .s-value {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
}
.signal .s-value span.pos { color: var(--success-green, #00ff88); }
.signal .s-value em {
  font-style: normal;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 600;
}
.signal .s-value .fired {
  font-size: 0.62rem;
  color: var(--primary-green, #00ff88);
  font-weight: 700;
}
.signal-chips {
  display: inline-flex;
  gap: 0.2rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}
.signal .chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.55rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.signal .chip.more { color: rgba(255,255,255,0.4); }
.signal .chip.flag-chip { letter-spacing: 0.02em; text-transform: none; }
</style>
