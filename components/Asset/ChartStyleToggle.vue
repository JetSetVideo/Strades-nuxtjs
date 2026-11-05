<script setup lang="ts">
/** Line / Candles for every price chart in the app at once (persisted in appearance). */
import { computed, onMounted, ref } from 'vue'
import { useAppearanceStore } from '~/stores/appearance'

const appearance = useAppearanceStore()
// The saved style is only known in the browser: render the server default until mounted
// so hydration matches, then show the real state.
const ready = ref(false)
onMounted(() => { appearance.hydrate(); ready.value = true })
const style = computed(() => (ready.value ? appearance.chartStyle : 'line'))
</script>

<template>
  <div class="cst" role="group" aria-label="Chart style for every chart">
    <button
      type="button" :class="{ active: style === 'line' }" :aria-pressed="style === 'line'"
      aria-label="Line charts" title="Line charts" @click="appearance.setChartStyle('line')"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M1.5 12 5.5 7l3 3 6-7" /></svg>
    </button>
    <button
      type="button" :class="{ active: style === 'candle' }" :aria-pressed="style === 'candle'"
      aria-label="Candlestick charts" title="Candlestick charts" @click="appearance.setChartStyle('candle')"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.2"><path d="M4 1.5v13M12 1.5v13" fill="none" /><rect x="2.5" y="4" width="3" height="6" rx=".4" /><rect x="10.5" y="6" width="3" height="5" rx=".4" fill="none" /></svg>
    </button>
  </div>
</template>

<style scoped>
.cst {
  display: inline-flex;
  gap: 1px;
  padding: 1px;
  border-radius: 5px;
  border: 1px solid rgba(48, 48, 54, 0.55);
  background: rgba(8, 8, 10, 0.72);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.72);
}
.cst button {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 22px; min-width: 22px; padding: 0 5px; border-radius: 4px; border: 0;
  background: transparent; color: rgba(255, 255, 255, 0.42);
  cursor: pointer;
}
.cst button:hover { color: #fff; }
.cst button.active {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.65);
}
</style>
