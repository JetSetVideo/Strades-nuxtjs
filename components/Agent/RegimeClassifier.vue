<template>
  <div class="regime-classifier">
    <section class="block">
      <h4 class="block-title">Regime probability simplex</h4>
      <div class="prob-rows">
        <div v-for="r in probRows" :key="r.key" class="prob-row">
          <span class="prob-key" :class="{ predicted: r.key === classifier.predicted_regime }">{{ r.key }}</span>
          <div class="prob-track">
            <div class="prob-fill" :class="`fill-${r.key}`" :style="{ width: `${r.pct}%` }" />
          </div>
          <span class="prob-pct">{{ r.pct.toFixed(1) }}%</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h4 class="block-title">Feature weights <span class="hint">(what it's actually looking at)</span></h4>
      <div class="feature-rows">
        <div v-for="f in featureRows" :key="f.key" class="feature-row">
          <span class="feature-key">{{ f.key.replace(/_/g, ' ') }}</span>
          <div class="feature-track">
            <div class="feature-fill" :style="{ width: `${f.pct}%` }" />
          </div>
          <span class="feature-pct">{{ f.pct.toFixed(0) }}%</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h4 class="block-title">Confusion matrix <span class="hint">(rolling, realized × predicted)</span></h4>
      <div class="confusion-wrap">
        <table class="confusion">
          <thead>
            <tr>
              <th class="corner">realized ↓ / predicted →</th>
              <th v-for="c in regimes" :key="c">{{ c }}</th>
              <th>accuracy</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in confusionRows" :key="row.key">
              <th>{{ row.key }}</th>
              <td
                v-for="c in regimes"
                :key="c"
                :class="{ diag: c === row.key }"
              >{{ classifier.confusion[row.key][c] }}</td>
              <td class="acc">{{ row.accuracy.toFixed(0) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClassifierState, MarketRegime } from '~/types/agent'

const props = defineProps<{ classifier: ClassifierState }>()

const regimes: MarketRegime[] = ['bull', 'bear', 'chop', 'crisis']

const probRows = computed(() =>
  regimes.map(key => ({ key, pct: props.classifier.regime_probs[key] * 100 }))
)

const featureRows = computed(() =>
  Object.entries(props.classifier.feature_weights)
    .map(([key, w]) => ({ key, pct: w * 100 }))
    .sort((a, b) => b.pct - a.pct)
)

const confusionRows = computed(() =>
  regimes.map(key => {
    const row = props.classifier.confusion[key]
    const total = regimes.reduce((s, c) => s + row[c], 0)
    return { key, accuracy: total > 0 ? (row[key] / total) * 100 : 0 }
  })
)
</script>

<style scoped>
.regime-classifier { display: flex; flex-direction: column; gap: 1.1rem; }
.block-title {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
}
.hint { font-weight: 400; text-transform: none; letter-spacing: normal; color: rgba(255,255,255,0.4); }

.prob-rows, .feature-rows { display: flex; flex-direction: column; gap: 0.4rem; }
.prob-row, .feature-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) 3rem;
  align-items: center;
  gap: 0.5rem;
}
.prob-key {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
}
.prob-key.predicted { color: #fff; }
.prob-track, .feature-track {
  height: 8px;
  border-radius: 4px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.prob-fill, .feature-fill { height: 100%; transition: width 0.4s ease; }
.fill-bull   { background: var(--success-green, #00ff88); }
.fill-bear   { background: var(--error-red, #ff4444); }
.fill-chop   { background: rgba(255,255,255,0.4); }
.fill-crisis { background: #7a1fd6; }
.feature-fill { background: var(--primary-blue, #00aaff); }
.prob-pct, .feature-pct { font-size: 0.7rem; font-variant-numeric: tabular-nums; text-align: right; color: rgba(255,255,255,0.7); }
.feature-key { font-size: 0.72rem; color: rgba(255,255,255,0.65); text-transform: capitalize; }

.confusion-wrap { overflow-x: auto; }
.confusion { border-collapse: collapse; width: 100%; font-size: 0.68rem; }
.confusion th, .confusion td {
  padding: 0.3rem 0.5rem;
  text-align: center;
  color: rgba(255,255,255,0.7);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}
.confusion th.corner { text-align: left; color: rgba(255,255,255,0.4); font-weight: 400; }
.confusion tbody th { text-align: left; text-transform: capitalize; font-weight: 700; }
.confusion td.diag { background: rgba(0,255,136,0.1); font-weight: 700; color: var(--success-green, #00ff88); }
.confusion td.acc { font-weight: 700; color: rgba(255,255,255,0.85); }
</style>
