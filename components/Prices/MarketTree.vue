<script setup lang="ts">
/**
 * Market tree — Market → asset class → sector → asset, with the equations
 * that link each stage to the ones above and below it (utils/marketTree.ts).
 *
 *   UP    r_P = Σ wᵢ·rᵢ      cᵢ = wᵢ·rᵢ  (Σ cᵢ = r_P)
 *   DOWN  Eᵢ = βᵢ·r_P        εᵢ = rᵢ − Eᵢ    shock: sᵢ = βᵢ·s_P
 */
import type { Asset } from '~/types/asset'
import { buildMarketTree, flattenTree, propagateShock, type MarketNode } from '~/utils/marketTree'

const props = defineProps<{
  assets: Asset[]
  /** % change per asset id (same numbers the cards show) */
  priceChanges: Record<string, number>
}>()

const open = ref(new Set<string>(['market']))
const selected = defineModel<string | null>('selected', { default: null })
const shockPct = ref(-10)

const tree = computed(() => buildMarketTree(props.assets.map(a => ({
  id: a.id,
  label: `${a.symbol} · ${a.name}`,
  classKey: a.type,
  sectorKey: a.category || 'other',
  cap: a.market_cap ?? null,
  ret: (props.priceChanges[a.id] ?? a.change_24h_pct ?? 0) / 100,
  price: a.current_price,
  history: a.return_history,
}))))

const rows = computed(() => flattenTree(tree.value, id => open.value.has(id)))

// Honesty: which leaves carry a SIMULATED move (no live quote), and how many sit under each parent.
const simIds = computed(() => new Set(props.assets.filter(a => !a.live).map(a => a.id)))
const simCount = (n: MarketNode): [number, number] => {
  if (!n.children.length) return [simIds.value.has(n.id) ? 1 : 0, 1]
  return n.children.reduce<[number, number]>((acc, c) => {
    const [s, t] = simCount(c)
    return [acc[0] + s, acc[1] + t]
  }, [0, 0])
}
const simLabel = (n: MarketNode) => {
  const [s, t] = simCount(n)
  if (!s) return ''
  return n.children.length ? `${s}/${t} sim` : 'sim'
}
const byId = computed(() => new Map(flattenTree(tree.value).map(n => [n.id, n])))
const selectedNode = computed(() => (selected.value ? byId.value.get(selected.value) ?? null : null))
const parentOf = (n: MarketNode) => (n.parentId ? byId.value.get(n.parentId) ?? null : null)

const shock = computed(() =>
  selectedNode.value ? propagateShock(tree.value, selectedNode.value.id, shockPct.value / 100) : new Map<string, number>())

function toggle(n: MarketNode) {
  if (!n.children.length) return
  const s = new Set(open.value)
  if (s.has(n.id)) s.delete(n.id)
  else s.add(n.id)
  open.value = s
}
function expandAll() {
  open.value = new Set(flattenTree(tree.value).filter(n => n.children.length).map(n => n.id))
}

const pct = (x: number, d = 2) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`
const tone = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '')
const fmtCap = (c: number) => !c ? '—' : c >= 1e12 ? `$${(c / 1e12).toFixed(2)}T` : c >= 1e9 ? `$${(c / 1e9).toFixed(1)}B` : `$${(c / 1e6).toFixed(0)}M`
</script>

<template>
  <section class="mtree">
    <header class="mt-head">
      <div class="formula">
        <span><b>↑ up</b> r<sub>P</sub> = Σ w<sub>i</sub>·r<sub>i</sub>, c<sub>i</sub> = w<sub>i</sub>·r<sub>i</sub></span>
        <span><b>↓ down</b> E<sub>i</sub> = β<sub>i</sub>·r<sub>P</sub>, ε<sub>i</sub> = r<sub>i</sub> − E<sub>i</sub></span>
      </div>
      <button class="mt-btn" @click="expandAll">Expand all</button>
    </header>

    <div class="mt-table" role="treegrid" aria-label="Market hierarchy">
      <div class="mt-row mt-cols" role="row">
        <span>Stage</span><span>Move r</span><span>Weight w</span><span>Contrib. c</span>
        <span class="nocase">β</span><span>Expected E</span><span>Residual ε</span><span>Cap</span>
      </div>
      <div
        v-for="n in rows" :key="n.id" role="row"
        class="mt-row" :class="[`lvl-${n.level}`, { sel: n.id === selected }]"
        :aria-level="n.depth + 1" :aria-expanded="n.children.length ? open.has(n.id) : undefined"
        @click="selected = n.id"
      >
        <span class="mt-name" :style="{ paddingLeft: `${n.depth * 16}px` }">
          <button v-if="n.children.length" class="caret" :aria-label="open.has(n.id) ? 'Collapse' : 'Expand'"
            @click.stop="toggle(n)">{{ open.has(n.id) ? '▾' : '▸' }}</button>
          <i v-else class="caret-gap" />
          {{ n.label }}
          <small v-if="n.children.length" class="cnt">{{ n.children.length }}</small>
          <small v-if="simLabel(n)" class="sim" :title="'Includes moves with no live quote (simulated)'">{{ simLabel(n) }}</small>
        </span>
        <span :class="tone(n.ret)">{{ pct(n.ret) }}</span>
        <span>{{ n.parentId ? `${(n.weight * 100).toFixed(1)}%` : '—' }}</span>
        <span :class="tone(n.contribution)">{{ pct(n.contribution, 3) }}</span>
        <span :title="n.betaAssumed ? 'Assumed 1: no shared return history' : 'Cov(rᵢ, r_P) / Var(r_P), 48 hourly returns'">
          {{ n.parentId ? n.beta.toFixed(2) : '—' }}<sup v-if="n.parentId && n.betaAssumed">*</sup>
        </span>
        <span :class="n.parentId ? tone(n.expected) : ''">{{ n.parentId ? pct(n.expected) : '—' }}</span>
        <span :class="tone(n.residual)">{{ n.parentId ? pct(n.residual) : '—' }}</span>
        <span class="cap">{{ fmtCap(n.cap) }}</span>
      </div>
    </div>
    <p class="note">"sim" = no live quote, so the move is simulated; parents show how many of their assets are simulated. * β assumed 1 where no live hourly history exists. Weights are cap-weighted when every sibling has a market cap, equal otherwise.</p>

    <aside v-if="selectedNode" class="mt-detail">
      <h4>{{ selectedNode.label }} <small>{{ selectedNode.level }}</small></h4>

      <div v-if="parentOf(selectedNode)" class="eq">
        <div class="eq-title">↓ From its parent: {{ parentOf(selectedNode)!.label }}</div>
        <code>E = β · r<sub>P</sub> = {{ selectedNode.beta.toFixed(2) }} × {{ pct(parentOf(selectedNode)!.ret) }} = {{ pct(selectedNode.expected) }}</code>
        <code>ε = r − E = {{ pct(selectedNode.ret) }} − {{ pct(selectedNode.expected) }} = {{ pct(selectedNode.residual) }}</code>
        <code>its share of the parent move: c = w · r = {{ (selectedNode.weight * 100).toFixed(1) }}% × {{ pct(selectedNode.ret) }} = {{ pct(selectedNode.contribution, 3) }}</code>
      </div>

      <div v-if="selectedNode.children.length" class="eq">
        <div class="eq-title">↑ From its children</div>
        <code>r = Σ wᵢ·rᵢ =
          <template v-for="(c, i) in selectedNode.children" :key="c.id">{{ i ? ' + ' : '' }}{{ (c.weight * 100).toFixed(0) }}%·{{ pct(c.ret, 1) }}</template>
          = {{ pct(selectedNode.ret) }}</code>
      </div>

      <div v-if="selectedNode.children.length" class="eq">
        <div class="eq-title">↓ Shock simulator: if {{ selectedNode.label }} moves by
          <input v-model.number="shockPct" type="number" step="1" min="-90" max="200" aria-label="Shock in percent" />%
        </div>
        <ul class="shock">
          <li v-for="[id, s] in [...shock.entries()].filter(([id]) => id !== selectedNode!.id)" :key="id">
            <span :style="{ paddingLeft: `${((byId.get(id)?.depth ?? 0) - selectedNode.depth - 1) * 14}px` }">{{ byId.get(id)?.label }}</span>
            <b :class="tone(s)">{{ pct(s, 1) }}</b>
            <small v-if="byId.get(id)?.price">→ {{ (byId.get(id)!.price! * (1 + s)).toPrecision(6) }}</small>
          </li>
        </ul>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.mtree { display: flex; flex-direction: column; gap: .6rem; }
.mt-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.formula { display: flex; gap: 1.2rem; flex-wrap: wrap; font-family: var(--font-market-data, monospace); font-size: .74rem; color: var(--text-secondary); }
.formula b { color: var(--text-primary); margin-right: .3rem; }
.mt-btn { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border-primary); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: .72rem; }
.mt-table { border: 1px solid var(--border-primary); border-radius: var(--radius-md, 8px); overflow-x: auto; }
.mt-row { display: grid; grid-template-columns: minmax(220px, 2.4fr) repeat(6, minmax(78px, 1fr)) minmax(70px, .8fr);
  gap: .4rem; align-items: center; padding: .42rem .7rem; font-size: .78rem; font-family: var(--font-market-data, monospace);
  border-top: 1px solid var(--border-primary); cursor: pointer; min-width: 820px; }
.mt-row:hover { background: rgba(255,255,255,.03); }
.mt-row.sel { background: rgba(0,180,255,.08); }
.mt-cols { border-top: 0; cursor: default; color: var(--text-secondary); font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
.mt-cols:hover { background: none; }
.lvl-market { font-weight: 700; }
.lvl-class { font-weight: 600; }
.lvl-asset { color: var(--text-secondary); }
.mt-name { display: flex; align-items: center; gap: .35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.caret { width: 18px; border: 0; background: none; color: var(--text-secondary); cursor: pointer; padding: 0; }
.caret-gap { width: 18px; display: inline-block; }
.cnt { color: var(--text-secondary); font-size: .65rem; border: 1px solid var(--border-primary); border-radius: 999px; padding: 0 5px; }
.cap { color: var(--text-secondary); }
.nocase { text-transform: none; }
.sim { font-size: .6rem; color: var(--text-secondary); border: 1px dashed var(--text-secondary); border-radius: 999px; padding: 0 5px; }
/* Phone: keep Stage · Move · Contribution; the rest lives in the tap-to-open detail panel. */
@media (max-width: 640px) {
  .mt-row { grid-template-columns: minmax(0, 1fr) 70px 78px; min-width: 0; }
  .mt-row > span:nth-child(3), .mt-row > span:nth-child(5), .mt-row > span:nth-child(6),
  .mt-row > span:nth-child(7), .mt-row > span:nth-child(8) { display: none; }
  .mt-name { white-space: normal; }
}
.up { color: var(--app-color-up, #00ff88); }
.down { color: var(--app-color-down, #ff4444); }
sup { color: var(--text-secondary); }
.note { margin: 0; font-size: .68rem; color: var(--text-secondary); }
.mt-detail { border: 1px solid var(--border-primary); border-radius: var(--radius-md, 8px); padding: .8rem 1rem; display: flex; flex-direction: column; gap: .7rem; }
.mt-detail h4 { margin: 0; }
.mt-detail h4 small { color: var(--text-secondary); font-weight: 400; margin-left: .4rem; }
.eq { display: flex; flex-direction: column; gap: .25rem; }
.eq-title { font-size: .74rem; color: var(--text-secondary); }
.eq code { font-size: .78rem; white-space: normal; }
.eq input { width: 64px; padding: 2px 6px; background: transparent; color: var(--text-primary); border: 1px solid var(--border-primary); border-radius: 4px; }
.shock { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .2rem; font-family: var(--font-market-data, monospace); font-size: .76rem; }
.shock li { display: grid; grid-template-columns: 1fr 70px 110px; gap: .5rem; }
.shock small { color: var(--text-secondary); }
</style>
