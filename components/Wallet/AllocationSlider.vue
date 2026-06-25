<template>
  <div class="allocation-slider-container" :style="dynamicStyles">
    <header class="slider-header">
      <div class="title-block">
        <h3 class="title">100% Allocation</h3>
        <span class="subtitle" :class="{ ok: allocationStore.is100Percent }">
          {{ allocationStore.is100Percent ? 'Balanced' : 'Rebalancing…' }}
        </span>
      </div>
      <div class="health-indicator" :title="`Flow velocity ${(macro.flow_velocity*100).toFixed(0)}%`">
        <span class="dot" :style="{ animationDuration: `${Math.max(0.3, 1.6 - macro.flow_velocity * 1.4)}s` }"></span>
        <span class="flow-label">{{ Math.round(macro.flow_velocity * 100) }}%</span>
      </div>
    </header>

    <div class="total-bar" :style="{ borderRadius: macro.appBorderRadius }">
      <div
        v-for="(val, key) in allocationStore.allocationPie"
        :key="key"
        class="total-segment"
        :class="[`bg-${key}`, { dominant: macro.dominant_asset_class === key }]"
        :style="{ width: `${val}%` }"
        :title="`${key}: ${val.toFixed(1)}%`"
      >
        <span v-if="val > 8" class="segment-label">{{ Math.round(val) }}</span>
      </div>
    </div>

    <!-- Swarm advisory overlay: ghost markers showing where agents want the user to be -->
    <div v-if="opinions.activeCount > 0" class="swarm-advisory">
      <div class="swarm-row">
        <span class="swarm-label">SWARM ({{ opinions.activeCount }}) · diverges {{ Math.round(opinions.divergence) }}%</span>
        <button class="apply-swarm" @click="opinions.commitToWallet()">Match swarm</button>
      </div>
      <div class="ghost-bar">
        <div v-for="(v, k) in opinions.swarmVector" :key="k" :class="['ghost-seg', `bg-${k}`]" :style="{ width: `${v}%` }" />
      </div>
    </div>

    <div class="sliders" :class="{ compact: isCompact }">
      <div
        v-for="(val, key) in allocationStore.allocationPie"
        :key="key"
        class="slider-row"
        :class="[`row-${key}`, { dominant: macro.dominant_asset_class === key }]"
        :style="{ '--row-weight': classWeightFor(key as keyof AllocationPie) }"
      >
        <button
          class="key-name"
          @click="setDominant(key as keyof AllocationPie)"
          :title="`Set ${key} as the dominant class`"
        >
          <span class="swatch" :class="`bg-${key}`"></span>
          {{ key }}
        </button>
        <input
          type="range"
          :min="0"
          :max="100"
          :step="0.5"
          :value="val"
          @input="onInput(key as keyof AllocationPie, Number(($event.target as HTMLInputElement).value))"
          class="range-slider"
          :class="`range-${key}`"
        />
        <span class="percent" :style="{ color: val > 50 ? 'var(--primary-green, #00ff88)' : 'inherit' }">
          {{ val.toFixed(1) }}%
        </span>
      </div>
    </div>

    <footer class="slider-footer">
      <button class="reset-btn" @click="resetEqual" :disabled="isEqual">Reset 25/25/25/25</button>
      <button class="cycle-btn" @click="cycleDominant" :title="`Currently: ${macro.dominant_asset_class}`">
        Dominant: {{ macro.dominant_asset_class }} →
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAllocationStore, type AllocationPie } from '~/stores/allocation'
import { useMacroStore, type AssetClass } from '~/stores/macro'
import { useOpinionsStore } from '~/stores/opinions'
import { useLivingUI } from '~/composables/useLivingUI'
import { useAgentTracker } from '~/composables/useAgentTracker'

const allocationStore = useAllocationStore()
const macro = useMacroStore()
const opinions = useOpinionsStore()
const tracker = useAgentTracker()

const { dynamicStyles, isCompact } = useLivingUI({ assetClass: macro.dominant_asset_class })

const classWeightFor = (k: keyof AllocationPie) => {
  return (macro.classWeights[k as AssetClass] ?? 0.5).toString()
}

const isEqual = computed(() =>
  Object.values(allocationStore.allocationPie).every(v => Math.abs(v - 25) < 0.1)
)

const onInput = (category: keyof AllocationPie, value: number) => {
  const previous = allocationStore.allocationPie[category]
  allocationStore.updateAllocation(category, value)
  tracker.track('allocation_change', { category, magnitude: value - previous, new_value: value })
}

const setDominant = (k: keyof AllocationPie) => {
  macro.applyTick({ dominant_asset_class: k as AssetClass })
}

const ORDER: AssetClass[] = ['fiat', 'crypto', 'stocks', 'commodities']
const cycleDominant = () => {
  const idx = ORDER.indexOf(macro.dominant_asset_class)
  setDominant(ORDER[(idx + 1) % ORDER.length] as keyof AllocationPie)
}

const resetEqual = () => {
  allocationStore.$patch({ allocationPie: { fiat: 25, crypto: 25, stocks: 25, commodities: 25 } })
}
</script>

<style scoped>
.allocation-slider-container {
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  backdrop-filter: blur(var(--app-glass-blur, 10px));
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  /* useLivingUI provides padding/border-radius/transition */
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.title-block { display: flex; align-items: baseline; gap: 0.75rem; }

.title {
  margin: 0;
  font-family: 'Poppins', sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.subtitle {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--warning-orange, #ffa500);
}
.subtitle.ok { color: var(--primary-green, #00ff88); }

.health-indicator {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.7);
}
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary-green, #00ff88);
  animation: pulse-dot infinite ease-in-out;
}
@keyframes pulse-dot {
  0%,100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.6); transform: scale(1); }
  50% { box-shadow: 0 0 0 5px rgba(0,255,136,0); transform: scale(1.15); }
}

.total-bar {
  display: flex;
  width: 100%;
  height: 14px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  margin-bottom: 0.75rem;
  border: 1px solid rgba(255,255,255,0.06);
}
.total-segment {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  font-weight: 700;
  color: rgba(0,0,0,0.7);
  transition: width 0.25s ease, filter 0.3s ease;
}
.total-segment.dominant { filter: brightness(1.2) saturate(1.2); }
.segment-label { padding: 0 4px; }

.swarm-advisory {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  background: rgba(0,255,136,0.04);
  border: 1px dashed rgba(0,255,136,0.2);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  margin-top: -0.25rem;
}
.swarm-row { display: flex; justify-content: space-between; align-items: center; }
.swarm-label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--primary-green, #00ff88);
}
.apply-swarm {
  background: transparent;
  border: 1px solid var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
}
.apply-swarm:hover { background: rgba(0,255,136,0.15); }
.ghost-bar {
  display: flex;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  opacity: 0.5;
}
.ghost-seg { height: 100%; transition: width 0.4s ease; }

.sliders { display: flex; flex-direction: column; gap: 0.65rem; }
.sliders.compact { gap: 0.4rem; }

.slider-row {
  display: grid;
  grid-template-columns: 7rem 1fr 3rem;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--app-border-radius, 8px);
  background: rgba(255,255,255,calc(0.02 + var(--row-weight, 0.5) * 0.05));
  transition: background 0.3s ease, transform 0.2s ease;
}
.slider-row.dominant {
  background: rgba(0,255,136,0.07);
  transform: scale(1.01);
}

.key-name {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0;
}
.key-name:hover { color: var(--primary-green, #00ff88); }

.swatch {
  width: 8px; height: 8px; border-radius: 50%;
}

.range-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  outline: none;
}
.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}
.range-fiat::-webkit-slider-thumb { background: #4A90E2; }
.range-crypto::-webkit-slider-thumb { background: #F5A623; }
.range-stocks::-webkit-slider-thumb { background: #7ED321; }
.range-commodities::-webkit-slider-thumb { background: #F8E71C; }

.percent { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 0.85rem; }

.bg-fiat { background: #4A90E2; }
.bg-crypto { background: #F5A623; }
.bg-stocks { background: #7ED321; }
.bg-commodities { background: #F8E71C; }

.slider-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.85rem;
  gap: 0.5rem;
}
.reset-btn, .cycle-btn {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.4rem 0.75rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: all 0.2s ease;
}
.reset-btn:hover:not(:disabled), .cycle-btn:hover { background: rgba(0,255,136,0.1); border-color: var(--primary-green, #00ff88); color: var(--primary-green, #00ff88); }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
