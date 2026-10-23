<script setup lang="ts">
/**
 * PriceChart — price alerts on the asset page.
 * Drag up or down anywhere on the chart to place an alert; release to arm it.
 * Draws with the shared PredictChart (same candles / line style as every other
 * chart, time scale at the bottom, prices on the right).
 */
import { computed, onMounted, ref } from 'vue'
import type { Asset } from '~/types/asset'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { useAppearanceStore } from '~/stores/appearance'
import { useAssetSeries, chartNow } from '~/composables/useAssetSeries'
import PredictChart from '~/components/Asset/PredictChart.vue'
import { HOUR, priceKindOf, fmtAxisPrice } from '~/utils/assetChart'

const props = withDefaults(defineProps<{
  assetId: string
  currentPrice: number
  volatility?: number
  /** the asset itself (preferred): gives real history where a market feed exists */
  asset?: Asset | null
  height?: number
}>(), { volatility: 0.3, asset: null, height: 200 })

const assetAnnotations = useAssetAnnotationsStore()
const appearance = useAppearanceStore()
onMounted(() => { if (!assetAnnotations.hydrated) assetAnnotations.hydrateFromStorage(); appearance.hydrate() })

const triggers = computed(() => assetAnnotations.triggersByAsset(props.assetId).filter(t => t.status === 'armed'))

const PERIODS = [
  { key: '1D', hours: 24 }, { key: '1W', hours: 168 }, { key: '1M', hours: 720 },
  { key: '3M', hours: 2160 }, { key: '1Y', hours: 8760 },
] as const
const period = ref<(typeof PERIODS)[number]['key']>('1M')
const hours = computed(() => PERIODS.find(p => p.key === period.value)!.hours)

const assetRef = computed<Asset | null>(() => props.asset ?? ({
  id: props.assetId, symbol: props.assetId.toUpperCase(), name: props.assetId, type: 'other',
  current_price: props.currentPrice, volatility_index: props.volatility, currency: 'USD',
} as unknown as Asset))
const kind = computed(() => priceKindOf(assetRef.value))
const win = computed(() => ({ start: chartNow.value - hours.value * HOUR, maxCandles: 60 }))
const { candles, realFrom } = useAssetSeries(assetRef, win)

const up = 'var(--app-color-up, #00ff88)'
const down = 'var(--app-color-down, #ff4444)'
const levels = computed(() => triggers.value.map(t => ({
  id: t.id, price: t.target_price,
  color: t.kind === 'cross_above' ? up : down,
  label: `${t.kind === 'cross_above' ? '↑' : '↓'}${fmtAxisPrice(t.target_price, kind.value)}`,
})))

function arm(price: number) {
  const cur = Number(assetRef.value?.current_price) || props.currentPrice
  const target = kind.value === 'probability' ? Math.round(price * 1000) / 1000 : Number(price.toPrecision(6))
  assetAnnotations.addTrigger({
    asset_id: props.assetId,
    kind: target >= cur ? 'cross_above' : 'cross_below',
    target_price: target,
    current_price_at_creation: cur,
  })
}
</script>

<template>
  <div class="price-chart">
    <div class="chart-toolbar">
      <div class="seg-group" role="group" aria-label="Period">
        <button v-for="p in PERIODS" :key="p.key" type="button" :class="{ active: period === p.key }" @click="period = p.key">{{ p.key }}</button>
      </div>
      <span class="chart-hint">Drag up or down on the chart to place an alert</span>
    </div>
    <ClientOnly>
      <PredictChart
        size="large"
        :height="height"
        :candles="candles"
        :t0="chartNow - hours * HOUR" :now="chartNow" :t1="chartNow"
        :current="Number(assetRef?.current_price) || currentPrice"
        :kind="kind"
        :chart-style="appearance.chartStyle"
        :levels="levels"
        :real-from="realFrom"
        level-mode
        :label="`${assetRef?.name ?? assetId} price alerts chart`"
        @level-commit="arm"
      />
      <template #fallback><div :style="{ height: `${height}px` }" /></template>
    </ClientOnly>
    <div v-if="triggers.length" class="alert-list">
      <span v-for="t in triggers" :key="t.id" class="alert-chip" :class="t.kind">
        {{ t.kind === 'cross_above' ? '↑ above' : '↓ below' }} {{ fmtAxisPrice(t.target_price, kind) }}
        <button type="button" aria-label="Remove alert" @click="assetAnnotations.removeTrigger(t.id)">✕</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.price-chart { display: flex; flex-direction: column; gap: 4px; }
.chart-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
.seg-group { display: flex; gap: 2px; }
.seg-group button {
  min-height: 26px; padding: 0 8px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.65); font: 600 0.7rem/1 var(--font-market-data, inherit); cursor: pointer;
}
.seg-group button.active { background: rgba(0,255,136,0.1); border-color: rgba(0,255,136,0.45); color: var(--primary-green, #00ff88); }
.chart-hint { font-size: 0.66rem; color: var(--text-gray, #9aa0a6); }
.alert-list { display: flex; flex-wrap: wrap; gap: 4px; }
.alert-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 1px 4px 1px 8px; border-radius: 999px;
  font-size: 0.68rem; border: 1px solid currentColor; font-family: var(--font-market-data, inherit);
}
.alert-chip.cross_above { color: var(--app-color-up, #00ff88); }
.alert-chip.cross_below { color: var(--app-color-down, #ff4444); }
.alert-chip button { min-width: 22px; min-height: 22px; border: 0; background: none; color: inherit; cursor: pointer; }
</style>
