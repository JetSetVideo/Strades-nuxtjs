<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AssetClass } from '~/stores/macro'
import DisplayAsset from '~/components/Widget/DisplayAsset.vue'

export interface ClassFeedAsset {
  id: string
  symbol: string
  name: string
  icon_url?: string
  current_price: number
}

const props = defineProps<{
  groups: Array<{ key: AssetClass; items: ClassFeedAsset[] }>
  priceChanges: Record<string, number>
  liquidityOf?: (asset: ClassFeedAsset) => number
}>()

const emit = defineEmits<{ (e: 'select', assetId: string): void }>()

const CLASS_LABEL: Record<AssetClass, string> = {
  crypto: 'Crypto',
  stocks: 'Stocks',
  fiat: 'Fiat',
  commodities: 'Commodities'
}

const CLASS_COLOR: Record<AssetClass, string> = {
  crypto: '#F5A623',
  stocks: '#7ED321',
  fiat: '#4A90E2',
  commodities: '#F8E71C'
}

const activeClass = ref<AssetClass>('crypto')

watch(
  () => props.groups,
  (groups) => {
    if (!groups.length) return
    if (!groups.some(g => g.key === activeClass.value)) {
      activeClass.value = groups[0].key
    }
  },
  { immediate: true }
)

const activeGroup = computed(() =>
  props.groups.find(g => g.key === activeClass.value) ?? props.groups[0]
)

const activeItems = computed(() => activeGroup.value?.items ?? [])

function formatPrice(price: number) {
  return `$${price.toFixed(price < 1 ? 4 : 2)}`
}

function liquidity(asset: ClassFeedAsset) {
  return props.liquidityOf?.(asset) ?? 0.5
}
</script>

<template>
  <section class="class-feed">
    <header class="class-tabs" role="tablist" aria-label="Asset classes">
      <button
        v-for="group in groups"
        :key="group.key"
        type="button"
        role="tab"
        class="class-tab"
        :class="{ active: group.key === activeClass }"
        :aria-selected="group.key === activeClass"
        :style="{ '--class-color': CLASS_COLOR[group.key] }"
        @click="activeClass = group.key"
      >
        <span class="tab-label">{{ CLASS_LABEL[group.key] }}</span>
        <span class="tab-count">{{ group.items.length }}</span>
      </button>
    </header>

    <div class="asset-list" role="tabpanel">
      <DisplayAsset
        v-for="asset in activeItems"
        :key="asset.id"
        :assetName="asset.name"
        :tagName="asset.symbol"
        :nominalPrice="formatPrice(asset.current_price)"
        :percentagePrice="`${(priceChanges[asset.id] ?? 0).toFixed(2)}%`"
        :profileIcon="asset.icon_url"
        :assetId="asset.id"
        :assetClass="activeClass"
        :liquidityDepth="liquidity(asset)"
        @click="emit('select', asset.id)"
      />
    </div>
  </section>
</template>

<style scoped>
.class-feed {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.class-tabs {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding: 0.15rem 0;
}

.class-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.65);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.class-tab:hover {
  border-color: color-mix(in srgb, var(--class-color) 50%, transparent);
  color: rgba(255,255,255,0.9);
}

.class-tab.active {
  border-color: var(--class-color);
  background: color-mix(in srgb, var(--class-color) 12%, transparent);
  color: #fff;
}

.tab-label {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
}

.tab-count {
  font-size: 0.58rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.55);
}

.class-tab.active .tab-count {
  background: color-mix(in srgb, var(--class-color) 25%, transparent);
  color: var(--class-color);
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}
</style>
