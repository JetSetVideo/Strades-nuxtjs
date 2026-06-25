<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface DataSource {
  id: string; name: string; icon: string; category: string; cost: number
}

const props = defineProps<{ code: Record<string, any> }>()

// ── Local datasource catalogue for enriching IDs ──────────────────────────
const dsCatalogue = ref<DataSource[]>([])
onMounted(async () => {
  try { dsCatalogue.value = await $fetch<DataSource[]>('/data/Datasources.json') } catch { /* ok */ }
})

const getDsInfo = (id: string) => dsCatalogue.value.find(d => d.id === id)

// ── Derived helpers ────────────────────────────────────────────────────────
const hasName       = computed(() => !!props.code?.name)
const hasAssets     = computed(() => props.code?.assetFrom && props.code?.assetTo)
const hasSources    = computed(() => props.code?.dataSources?.length > 0)
const hasConditions = computed(() => props.code?.conditions?.length > 0)
const hasActions    = computed(() => props.code?.actions?.length > 0)
const hasProfiles   = computed(() => props.code?.profiles?.length > 0)
const hasVariables  = computed(() => props.code?.variables && Object.keys(props.code.variables).length > 0)

const categoryColor = (cat: string): string => {
  const m: Record<string,string> = {
    crypto:'#f7931a', stocks:'#2196f3', forex:'#4caf50', commodities:'#ffd700',
    'multi-asset':'#9c27b0', technical:'#00bcd4', fundamental:'#ff9800',
  }
  return m[cat] ?? '#607d8b'
}

const ASSET_COLORS: Record<string,string> = {
  BTC:'#f7931a', ETH:'#627eea', SOL:'#9945ff', BNB:'#f3ba2f', DOGE:'#c2a633',
  AAPL:'#555', TSLA:'#cc0000', NVDA:'#76b900', MSFT:'#00a4ef', AMZN:'#ff9900',
  'EUR/USD':'#0052b4', 'GBP/USD':'#00247d', XAU:'#ffd700', WTI:'#704214',
  USD:'#4caf50', EUR:'#0052b4', USDT:'#26a17b',
}

function assetColor(id: string): string {
  return ASSET_COLORS[id] ?? '#607d8b'
}

const OPERATOR_LABELS: Record<string, string> = {
  gt:'>', lt:'<', gte:'≥', lte:'≤', eq:'=', crosses_up:'↑', crosses_dn:'↓',
}

const ACTION_ICONS: Record<string, string> = {
  shift:'↔', increase:'↑', decrease:'↓', rebalance:'⚖', exit:'⏹', hold:'⏸',
}

const freqColor = (f: string): string => {
  const m: Record<string,string> = {
    '1m':'#f44336','5m':'#ff5722','15m':'#ff9800','1h':'#ffc107',
    '4h':'#8bc34a','1D':'#4caf50','1W':'#2196f3','1M':'#673ab7',
  }
  return m[f] ?? '#607d8b'
}

// ── Raw JSON toggle ────────────────────────────────────────────────────────
const showRaw = ref(false)

function formatRaw(obj: any, indent = 0): string {
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  if (Array.isArray(obj)) {
    if (!obj.length) return '<span class="raw-punct">[]</span>'
    const items = obj.map(v => `${' '.repeat(indent+2)}${formatRaw(v, indent+2)}`).join(',\n')
    return `<span class="raw-punct">[\n${items}\n${' '.repeat(indent)}]</span>`
  }
  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj).map(([k, v]) => {
      const key   = `<span class="raw-key">"${esc(k)}"</span>`
      const value = (v && typeof v === 'object') ? formatRaw(v, indent+2) : colorizeRaw(v)
      return `${' '.repeat(indent+2)}${key}: ${value}`
    }).join(',\n')
    return `<span class="raw-punct">{\n${entries}\n${' '.repeat(indent)}}</span>`
  }
  return colorizeRaw(obj)
}

function colorizeRaw(v: unknown): string {
  if (typeof v === 'number')  return `<span class="raw-num">${v}</span>`
  if (typeof v === 'boolean') return `<span class="raw-bool">${v}</span>`
  if (v === null)             return `<span class="raw-null">null</span>`
  const esc = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<span class="raw-str">"${esc}"</span>`
}

const rawHtml = computed(() => formatRaw(props.code))

// ── Completeness score (visual feedback) ──────────────────────────────────
const completeness = computed(() => {
  let score = 0
  if (hasName.value)       score += 20
  if (hasAssets.value)     score += 25
  if (hasSources.value)    score += 20
  if (hasConditions.value) score += 20
  if (hasActions.value)    score += 15
  return score
})

const completenessColor = computed(() => {
  if (completeness.value >= 80) return 'var(--success-green)'
  if (completeness.value >= 50) return 'var(--warning-orange)'
  return 'var(--error-red)'
})
</script>

<template>
  <div class="scv-root">

    <!-- ── Completeness bar ── -->
    <div class="completeness-row">
      <span class="comp-label">Strategy completeness</span>
      <div class="comp-track">
        <div class="comp-fill" :style="{ width: completeness + '%', background: completenessColor }" />
      </div>
      <span class="comp-pct" :style="{ color: completenessColor }">{{ completeness }}%</span>
    </div>

    <!-- ── Header card ── -->
    <div class="preview-card header-card">
      <div class="card-row">
        <div class="strat-name-row">
          <span class="strat-icon">📐</span>
          <span class="strat-name" :class="{ empty: !hasName }">
            {{ code.name || 'Unnamed Strategy' }}
          </span>
        </div>
        <span
          v-if="code.category"
          class="category-tag"
          :style="{ color: categoryColor(code.category), borderColor: categoryColor(code.category) + '55', background: categoryColor(code.category) + '18' }"
        >
          {{ code.category }}
        </span>
      </div>
      <p v-if="code.description" class="strat-desc">{{ code.description }}</p>
      <p v-else class="strat-desc empty">No description yet…</p>
    </div>

    <!-- ── Asset flow card ── -->
    <div class="preview-card flow-card">
      <div class="card-label">Capital Flow</div>
      <div class="flow-visual">
        <!-- FROM asset -->
        <div v-if="code.assetFrom" class="asset-pill from-pill" :style="{ borderColor: assetColor(code.assetFrom), background: assetColor(code.assetFrom) + '18' }">
          <span class="a-dot" :style="{ background: assetColor(code.assetFrom) }" />
          <span class="a-sym" :style="{ color: assetColor(code.assetFrom) }">{{ code.assetFrom }}</span>
          <span class="a-role">FROM</span>
        </div>
        <div v-else class="asset-pill empty-pill">? FROM</div>

        <!-- Arrow + allocation -->
        <div class="flow-mid">
          <div class="flow-line" />
          <div class="alloc-bubble">
            <span class="alloc-pct">{{ code.allocation ?? 50 }}%</span>
            <span class="alloc-sub">of portfolio</span>
          </div>
          <div class="flow-arrow">→</div>
        </div>

        <!-- TO asset -->
        <div v-if="code.assetTo" class="asset-pill to-pill" :style="{ borderColor: assetColor(code.assetTo), background: assetColor(code.assetTo) + '18' }">
          <span class="a-dot" :style="{ background: assetColor(code.assetTo) }" />
          <span class="a-sym" :style="{ color: assetColor(code.assetTo) }">{{ code.assetTo }}</span>
          <span class="a-role">TO</span>
        </div>
        <div v-else class="asset-pill empty-pill">? TO</div>
      </div>

      <!-- Frequency + period row -->
      <div class="timing-row">
        <span class="freq-chip" :style="{ color: freqColor(code.frequency), borderColor: freqColor(code.frequency) + '55', background: freqColor(code.frequency) + '18' }">
          ⏱ {{ code.frequency || '1D' }}
        </span>
        <span v-if="code.period?.start && code.period?.end" class="period-chip">
          📅 {{ code.period.start }} → {{ code.period.end }}
        </span>
        <span v-else class="period-chip empty">📅 No period set</span>
      </div>
    </div>

    <!-- ── Data sources card ── -->
    <div class="preview-card">
      <div class="card-label">
        Data Sources
        <span class="badge-count" :class="{ zero: !hasSources }">{{ code.dataSources?.length ?? 0 }}</span>
      </div>
      <div v-if="hasSources" class="ds-chips">
        <span v-for="dsId in code.dataSources" :key="dsId" class="ds-chip">
          <template v-if="getDsInfo(dsId)">
            <span class="ds-chip-icon">{{ getDsInfo(dsId)!.icon }}</span>
            <span>{{ getDsInfo(dsId)!.name }}</span>
          </template>
          <template v-else>
            <span>{{ dsId }}</span>
          </template>
        </span>
      </div>
      <p v-else class="empty-hint">No data sources selected. At least one is required.</p>
    </div>

    <!-- ── Logic card ── -->
    <div class="preview-card">
      <div class="card-label">Logic Rules</div>

      <!-- Conditions -->
      <div class="logic-group">
        <span class="logic-kw kw-if">IF</span>
        <div v-if="hasConditions" class="logic-items">
          <div v-for="(cond, i) in code.conditions" :key="i" class="logic-item cond-item">
            <span class="li-ind">{{ cond.indicator }}</span>
            <span v-if="cond.indicatorParam" class="li-param">({{ cond.indicatorParam }})</span>
            <span class="li-tf">[{{ cond.timeframe }}]</span>
            <span class="li-op">{{ OPERATOR_LABELS[cond.operator] ?? cond.operator }}</span>
            <span class="li-val">{{ cond.valueType === 'indicator' ? cond.valueIndicator : cond.value }}</span>
            <span v-if="i < code.conditions.length - 1" class="li-and">AND</span>
          </div>
        </div>
        <span v-else class="empty-hint-inline">No conditions set</span>
      </div>

      <!-- Actions -->
      <div class="logic-group">
        <span class="logic-kw kw-then">THEN</span>
        <div v-if="hasActions" class="logic-items">
          <div v-for="(action, i) in code.actions" :key="i" class="logic-item action-item">
            <span class="li-act-icon">{{ ACTION_ICONS[action.type] ?? '?' }}</span>
            <span class="li-act-type">{{ action.type }}</span>
            <span v-if="action.type !== 'hold'" class="li-val">{{ action.allocation }}%</span>
            <span class="li-timing">→ {{ action.timing }}</span>
          </div>
        </div>
        <span v-else class="empty-hint-inline">No actions set</span>
      </div>
    </div>

    <!-- ── AI Avatars card ── -->
    <div v-if="hasProfiles" class="preview-card">
      <div class="card-label">
        AI Avatars
        <span class="badge-count">{{ code.profiles.length }}</span>
      </div>
      <div class="profiles-chips">
        <span v-for="pid in code.profiles" :key="pid" class="profile-chip">
          🤖 {{ pid }}
        </span>
      </div>
    </div>

    <!-- ── Variables card ── -->
    <div v-if="hasVariables" class="preview-card">
      <div class="card-label">Variables</div>
      <div class="vars-grid">
        <div v-for="[k, v] in Object.entries(code.variables)" :key="k" class="var-row">
          <span class="var-key">{{ k }}</span>
          <span class="var-eq">=</span>
          <span class="var-val">{{ v }}</span>
        </div>
      </div>
    </div>

    <!-- ── Raw JSON toggle ── -->
    <button class="raw-toggle" @click="showRaw = !showRaw">
      {{ showRaw ? '▲ Hide' : '▼ Show' }} raw JSON
    </button>

    <div v-if="showRaw" class="raw-view" v-html="rawHtml" />

  </div>
</template>

<style scoped>
.scv-root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* ── Completeness ── */
.completeness-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.comp-label { font-size: 0.62rem; color: var(--text-gray); flex-shrink: 0; }

.comp-track {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
}

.comp-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease, background 0.4s ease;
}

.comp-pct { font-size: 0.7rem; font-weight: 700; flex-shrink: 0; min-width: 32px; text-align: right; }

/* ── Cards ── */
.preview-card {
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(0,255,136,0.15);
  color: var(--primary-green);
  font-size: 0.58rem;
  font-weight: 700;
}

.badge-count.zero { background: rgba(255,255,255,0.06); color: var(--text-gray); }

/* Header card */
.header-card { gap: 6px; }
.strat-name-row { display: flex; align-items: center; gap: 6px; }
.strat-icon { font-size: 0.9rem; }
.strat-name { font-size: 0.88rem; font-weight: 700; color: var(--text-white); }
.strat-name.empty { color: var(--text-gray); font-style: italic; }
.card-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.category-tag { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
.strat-desc { font-size: 0.7rem; color: var(--text-gray); margin: 0; line-height: 1.4; }
.strat-desc.empty { font-style: italic; }

/* Flow card */
.flow-visual {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asset-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid;
  flex: 1;
  text-align: center;
}

.empty-pill {
  border-color: var(--border-secondary);
  background: rgba(255,255,255,0.03);
  color: var(--text-gray);
  font-size: 0.72rem;
  font-style: italic;
}

.a-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.a-sym {
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1;
}

.a-role {
  font-size: 0.5rem;
  color: var(--text-gray);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.flow-mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.flow-line {
  height: 1px;
  width: 20px;
  background: var(--border-secondary);
}

.alloc-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 999px;
  padding: 3px 8px;
}

.alloc-pct { font-size: 0.8rem; font-weight: 800; color: var(--primary-green); line-height: 1; }
.alloc-sub { font-size: 0.45rem; color: var(--primary-green); opacity: 0.7; }

.flow-arrow { font-size: 0.9rem; color: var(--primary-green); }

.timing-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 2px;
}

.freq-chip, .period-chip {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
}

.period-chip {
  color: var(--text-gray);
  border-color: var(--border-secondary);
  background: rgba(255,255,255,0.04);
  font-size: 0.62rem;
}

.period-chip.empty { font-style: italic; opacity: 0.6; }

/* Data sources */
.ds-chips { display: flex; flex-wrap: wrap; gap: 5px; }

.ds-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: rgba(255,255,255,0.04);
  color: var(--text-light-gray);
}

.ds-chip-icon { font-size: 0.8rem; }

/* Logic */
.logic-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.logic-kw {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  margin-top: 2px;
}

.kw-if   { background: rgba(33,150,243,0.15); color: var(--primary-blue); }
.kw-then { background: rgba(255,160,0,0.15); color: var(--warning-orange); }

.logic-items { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.logic-item {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}

.cond-item   { background: rgba(33,150,243,0.06); border: 1px solid rgba(33,150,243,0.15); }
.action-item { background: rgba(255,160,0,0.06); border: 1px solid rgba(255,160,0,0.15); }

.li-ind  { font-weight: 700; color: var(--primary-blue); }
.li-param { font-size: 0.62rem; color: var(--text-gray); }
.li-tf   { font-size: 0.58rem; color: var(--text-gray); background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 999px; }
.li-op   { font-weight: 700; color: var(--text-white); min-width: 16px; text-align: center; }
.li-val  { font-weight: 700; color: var(--warning-orange); }
.li-and  { font-size: 0.55rem; color: var(--text-gray); letter-spacing: 0.06em; margin-left: 4px; }
.li-act-icon { font-size: 0.85rem; }
.li-act-type { font-weight: 700; color: var(--warning-orange); text-transform: capitalize; }
.li-timing { font-size: 0.6rem; color: var(--text-gray); }

.empty-hint        { font-size: 0.68rem; color: var(--text-gray); font-style: italic; margin: 0; }
.empty-hint-inline { font-size: 0.68rem; color: var(--text-gray); font-style: italic; }

/* Profiles */
.profiles-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.profile-chip {
  font-size: 0.65rem;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(156,39,176,0.3);
  background: rgba(156,39,176,0.1);
  color: #ce93d8;
}

/* Variables */
.vars-grid { display: flex; flex-direction: column; gap: 4px; }
.var-row { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; }
.var-key { color: var(--primary-blue); font-weight: 700; font-family: monospace; }
.var-eq  { color: var(--text-gray); }
.var-val { color: var(--primary-green); font-family: monospace; }

/* Raw toggle */
.raw-toggle {
  align-self: center;
  font-size: 0.6rem;
  color: var(--text-gray);
  background: transparent;
  border: 1px dashed var(--border-secondary);
  border-radius: 999px;
  padding: 3px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.raw-toggle:hover { border-color: var(--border-primary); color: var(--text-white); }

.raw-view {
  background: rgba(0,0,0,0.35);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  color: var(--text-white);
}

.raw-view :deep(.raw-key)   { color: var(--primary-blue); }
.raw-view :deep(.raw-str)   { color: var(--primary-green); }
.raw-view :deep(.raw-num)   { color: #ffa500; }
.raw-view :deep(.raw-bool)  { color: #ff6666; }
.raw-view :deep(.raw-null)  { color: var(--text-gray); }
.raw-view :deep(.raw-punct) { color: var(--text-gray); }
</style>
