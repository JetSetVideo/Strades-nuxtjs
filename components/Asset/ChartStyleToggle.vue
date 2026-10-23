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
      title="Line charts" @click="appearance.setChartStyle('line')"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M1.5 12 5.5 7l3 3 6-7" /></svg>
      Line
    </button>
    <button
      type="button" :class="{ active: style === 'candle' }" :aria-pressed="style === 'candle'"
      title="Candlestick charts" @click="appearance.setChartStyle('candle')"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.2"><path d="M4 1.5v13M12 1.5v13" fill="none" /><rect x="2.5" y="4" width="3" height="6" rx=".4" /><rect x="10.5" y="6" width="3" height="5" rx=".4" fill="none" /></svg>
      Candles
    </button>
  </div>
</template>

<style scoped>
.cst { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; border: 1px solid var(--border-primary, rgba(255,255,255,.12)); background: rgba(255,255,255,.02); }
.cst button {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 26px; padding: 0 8px; border-radius: 6px; border: 0;
  background: transparent; color: var(--text-gray, #9aa0a6);
  font: 600 0.7rem/1 var(--font-family-secondary, inherit); cursor: pointer;
}
.cst button:hover { color: var(--text-white, #fff); }
.cst button.active { background: rgba(0,255,136,0.1); color: var(--primary-green, #00ff88); }
</style>
