<script setup lang="ts">
/**
 * Card lab variant A — "trading terminal" (swarm 2026-11-02 "cards", lane design-a).
 * Maximum density, every number labelled with its real meaning and period. Data: the canonical catalog record
 * (`full`) through utils/cardLabA.ts; nothing is defaulted (missing → "—" / "not recorded").
 * Encodings: filled ticker = traded asset, outlined = indicator; left rail + glyph shape = status
 * (● active, ‖ paused, ■ stopped); 3-step meter = risk level; bar LENGTH on fixed scales shared by every card
 * (return ±25 %, DD 0–25 %, Sharpe −1…3, vol 0–50 %, win 0–100 %); colour only for good / caution / bad.
 * Dropped from today's card: "MONTHLY" (was the whole-record return), "RISK 5/10" (a default), "1D" and "— → —"
 * (defaults), the regime widget and sparkline (fed by those defaults), "👥 0" (wrong field).
 * Contract: components/CardLab/Bench.vue.
 */
import { computed, onMounted } from 'vue'
import { cardLabAModel } from '~/utils/cardLabA'
import { useAgentsStore } from '~/stores/agents'

const props = defineProps<{ strategy: Record<string, any>; full: Record<string, any>; code: Record<string, any> | null }>()
const emit = defineEmits<{ view: []; copy: [] }>()

const m = computed(() => cardLabAModel(props.full ?? {}))
// Agent display name from the agents catalog (avatars.json); the id stays visible next to it.
const agents = useAgentsStore()
onMounted(() => { if (!Object.keys(agents.byId).length) agents.fetchAgents?.() })
const agentName = computed(() => {
  const n = (props.full?.agent_id ? (agents.byId as Record<string, { name?: string }>)[props.full.agent_id]?.name : '') || ''
  // "Your avatar" on a catalog sample would claim the viewer's own agent runs it: keep the id only
  return sample.value && /^your\b/i.test(n) ? '' : n
})
const sample = computed(() => !!(props.strategy?.sample ?? props.full?.sample))
const statusTitle = computed(() => `Status: ${m.value.status.label.toLowerCase()}`)
const riskTitle = computed(() => `Risk level from the record: ${m.value.risk.label.toLowerCase()} (low / medium / high)`)
const retTitle = computed(() => m.value.ret.periodKnown
  ? `Total return of the backtest ${m.value.ret.period}: profit over initial capital. Bar: ±25 %.`
  : 'Total return of the whole record: profit over initial capital. The record does not say over which period. Bar: ±25 %.')
const barStyle = (b?: { fill: number; zero?: number }) => {
  if (!b) return {}
  if (b.zero === undefined) return { left: '0', width: `${b.fill * 100}%` }
  return { left: `${(b.zero) * 100}%`, width: `${b.fill * 100}%` }
}
const divStyle = (b: { fill: number; zero?: number; tone: string }) => b.tone === 'down'
  ? { left: `${((b.zero ?? 0.5) - b.fill) * 100}%`, width: `${b.fill * 100}%` }
  : barStyle(b)
</script>

<template>
  <article class="cla" :class="`st-${m.status.key}`" :aria-label="`Strategy ${m.name}`">
    <!-- Identity -->
    <header class="hd">
      <div class="name-row">
        <StrategyMark :category="m.category" />
        <h3 class="name">{{ m.name }}</h3>
        <UISourceChip v-if="sample" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
      </div>
      <div class="style-row">
        <template v-if="m.style"><span class="lbl">STYLE</span><span class="style" title="Trading style, named from the strategy's own tags and description">{{ m.style }}</span></template>
        <span class="hold" title="Average holding time per trade (average_trade_duration)"><span class="lbl">AVG HOLD</span> {{ m.hold }}</span>
      </div>
      <div class="tick-row">
        <span class="cat" :title="`Asset class: ${m.category}`">{{ m.category.toUpperCase() }}</span>
        <span v-for="a in m.assets" :key="a" class="tk asset" :title="`Traded asset: ${a}`">{{ a }}</span>
        <span class="sep" aria-hidden="true">│</span>
        <span v-for="i in m.indicators" :key="i" class="tk ind" :title="`Indicator: ${i}`">{{ i }}</span>
      </div>
      <div class="badge-row">
        <span class="bdg" :class="`t-${m.status.tone}`" :title="statusTitle">
          <svg class="glyph" viewBox="0 0 10 10" aria-hidden="true">
            <circle v-if="m.status.key === 'active'" cx="5" cy="5" r="4" fill="currentColor" />
            <g v-else-if="m.status.key === 'paused'" fill="currentColor"><rect x="1.5" y="1" width="2.5" height="8" /><rect x="6" y="1" width="2.5" height="8" /></g>
            <rect v-else x="1.5" y="1.5" width="7" height="7" fill="currentColor" />
          </svg>{{ m.status.label }}
        </span>
        <span class="bdg" :title="`Execution: ${m.automation.label.toLowerCase()}`">
          <svg class="glyph" viewBox="0 0 10 10" aria-hidden="true">
            <path v-if="m.automation.key === 'automated'" d="M5 .8 6 2.4l1.8-.3.3 1.8L9.7 5 8.1 6.1l-.3 1.8L6 7.6 5 9.2 4 7.6l-1.8.3-.3-1.8L.3 5l1.6-1.1.3-1.8L4 2.4Z" fill="none" stroke="currentColor" stroke-width="1" />
            <path v-else-if="m.automation.key === 'semi_automated'" d="M5 1a4 4 0 1 0 0 8V1Z" fill="currentColor" />
            <circle v-else cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>{{ m.automation.label }}
        </span>
        <span class="bdg" :class="`t-${m.risk.tone}`" :title="riskTitle">
          <span class="meter" aria-hidden="true"><i v-for="n in 3" :key="n" :class="{ on: n <= m.risk.level }" :style="{ height: `${3 + n * 2}px` }" /></span>RISK {{ m.risk.label }}
        </span>
        <span class="bdg dim" :title="`Visibility: ${m.visibility.toLowerCase()}`">{{ m.visibility }}</span>
        <span class="bdg" :class="m.price.premium ? 't-warn' : 'dim'" :title="m.price.premium ? 'Premium strategy' : 'Free: price $0, not premium'">{{ m.price.label }}</span>
      </div>
    </header>

    <!-- Headline: total return, with its period -->
    <section class="ret" :title="retTitle">
      <div class="lbl-row">
        <span class="lbl">TOTAL RETURN</span>
        <span class="period" :class="{ unknown: !m.ret.periodKnown }">{{ m.ret.periodKnown ? `backtest ${m.ret.period}` : `whole record · ${m.ret.period}` }}</span>
      </div>
      <div class="ret-row">
        <span class="big" :class="`t-${m.ret.tone}`">{{ m.ret.pct }}</span>
        <span class="usd" :class="`t-${m.ret.tone}`">{{ m.ret.usd }}</span>
        <span class="cap"><span class="lbl">CAPITAL</span> {{ m.ret.capital }}</span>
      </div>
      <div class="track div" aria-hidden="true">
        <span class="zero" />
        <span class="fill" :class="`f-${m.ret.bar.tone}`" :style="divStyle(m.ret.bar)" />
      </div>
      <div class="scale" aria-hidden="true"><span>−25%</span><span>0</span><span>+25%</span></div>
    </section>

    <!-- Metric grid: 4 × 2 -->
    <section class="grid">
      <div v-for="c in m.cells" :key="c.key" class="cell" :title="c.hint">
        <span class="lbl">{{ c.label }}</span>
        <span class="val" :class="`t-${c.tone}`">{{ c.value }}<span v-if="c.key === 'win' && m.winCheck" class="flag" :title="m.winCheck">≠</span></span>
        <span class="sub" :class="{ 't-warn': c.key === 'trades' && m.smallSample }" :title="c.key === 'trades' && m.smallSample ? `Only ${c.value} trades (< 30): win rate and Sharpe rest on a small sample` : undefined">{{ c.sub }}</span>
        <span v-if="c.bar" class="track" :class="{ div: c.bar.zero !== undefined }" aria-hidden="true">
          <span v-if="c.bar.zero !== undefined" class="zero" />
          <span class="fill" :class="`f-${c.bar.tone}`" :style="divStyle(c.bar)" />
        </span>
      </div>
    </section>

    <!-- Rule + tags -->
    <section class="rule" title="Entry / exit rule as written in the strategy description (no coded conditions in the record)">
      <span class="lbl">RULE</span>
      <p class="rule-txt">{{ m.rule }}</p>
    </section>
    <div v-if="m.tags.length" class="tags" title="Tags">
      <span v-for="t in m.tags" :key="t" class="tag">#{{ t }}</span>
    </div>

    <!-- Provenance + social -->
    <footer class="ft">
      <div class="kv-row">
        <span class="kv" title="Creator (user id)"><span class="lbl">BY</span> {{ m.creator }}</span>
        <span class="kv" :title="m.agent === 'none' ? 'No agent attached in the record' : `Agent that runs it (avatar id ${m.agent})`"><span class="lbl">AGENT</span> {{ agentName ? `${agentName} · ${m.agent}` : m.agent }}</span>
      </div>
      <div class="kv-row">
        <span class="kv" title="Followers"><span class="lbl">FOLLOWERS</span> {{ m.social.followers }}</span>
        <span class="kv" title="Likes"><span class="lbl">LIKES</span> {{ m.social.likes }}</span>
        <span class="kv" title="Comments"><span class="lbl">COMMENTS</span> {{ m.social.comments }}</span>
      </div>
      <div class="kv-row">
        <span class="kv" title="Date the strategy was created"><span class="lbl">CREATED</span> {{ m.dates.created }}</span>
        <span class="kv" title="Date of its last run"><span class="lbl">LAST RUN</span> {{ m.dates.lastRun }}</span>
      </div>
      <div class="acts" @click.stop>
        <button type="button" class="btn primary" @click="emit('copy')">{{ sample ? 'Use as template' : 'Edit' }}</button>
        <button type="button" class="btn" @click="emit('view')">View →</button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
/* Solid backgrounds only: text contrast is measured against them (≥ 4.5 with --text-gray on --bg-tertiary). */
.cla {
  --cla-up: var(--success-green); --cla-down: var(--error-red); --cla-warn: var(--warning-orange);
  --cla-rail: var(--text-gray);
  position: relative; display: flex; flex-direction: column; gap: 8px;
  padding: 12px 12px 12px 15px; background: var(--bg-tertiary); color: var(--text-white);
  border: 1px solid var(--border-primary); border-radius: var(--radius-md);
  font-family: var(--font-market-data); font-variant-numeric: tabular-nums; font-size: 12px; line-height: 1.35;
  min-width: 0; overflow-wrap: anywhere;
}
.cla::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: var(--radius-md) 0 0 var(--radius-md); background: var(--cla-rail); }
.st-active { --cla-rail: var(--cla-up); }
.st-paused { --cla-rail: var(--cla-warn); }
.st-stopped { --cla-rail: var(--cla-down); }

.cla .t-up { color: var(--cla-up); } .cla .t-down { color: var(--cla-down); } .cla .t-warn { color: var(--cla-warn); } .cla .t-flat { color: var(--text-white); }
.lbl { font-size: 10px; letter-spacing: 0.06em; color: var(--text-gray); font-weight: 600; }

/* Identity */
.hd { display: flex; flex-direction: column; gap: 6px; }
.name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.name { margin: 0; flex: 1; min-width: 0; font-family: var(--font-family-primary); font-size: 15px; font-weight: 800; line-height: 1.2; }
.name-row :deep(.chip) { font-size: 10px; }
.tick-row, .badge-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.cat { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-light-gray); margin-right: 2px; }
.tk { font-size: 12px; font-weight: 700; padding: 1px 6px; border-radius: var(--radius-sm); border: 1px solid; }
.tk.asset { background: var(--text-white); color: var(--bg-tertiary); border-color: var(--text-white); }
.tk.ind { color: var(--primary-blue); border-color: var(--primary-blue); font-weight: 600; }
.sep { color: var(--text-gray); font-size: 11px; }
.bdg { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
  padding: 2px 5px; border: 1px solid currentColor; border-radius: var(--radius-sm); color: var(--text-light-gray); }
.bdg.dim { color: var(--text-light-gray); border-color: var(--border-secondary); }
.glyph { width: 9px; height: 9px; flex: 0 0 9px; }
.meter { display: inline-flex; align-items: flex-end; gap: 1px; height: 9px; }
.meter i { display: block; width: 3px; background: var(--border-secondary); }
.meter i.on { background: currentColor; }

/* Headline return */
.ret { display: flex; flex-direction: column; gap: 3px; padding: 6px 0 5px; border-top: 1px solid var(--border-primary); border-bottom: 1px solid var(--border-primary); }
.lbl-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 8px; }
.period { font-size: 10px; color: var(--text-light-gray); }
.period.unknown { color: var(--text-gray); font-style: italic; }
.ret-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.big { font-size: 22px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }
.usd { font-size: 13px; font-weight: 700; }
.cap { font-size: 11px; color: var(--text-light-gray); margin-left: auto; }
.scale { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-gray); line-height: 1; }

/* Bars */
.track { position: relative; display: block; height: 4px; background: var(--border-primary); border-radius: 2px; }
.track .fill { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: var(--text-light-gray); }
.track .zero { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--text-gray); }
.f-up { background: var(--cla-up) !important; } .f-down { background: var(--cla-down) !important; } .f-warn { background: var(--cla-warn) !important; }

/* Grid */
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 8px; }
.cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.val { font-size: 14px; font-weight: 700; line-height: 1.15; white-space: nowrap; }
.sub { font-size: 10px; color: var(--text-light-gray); white-space: nowrap; }
.cell .track { margin-top: 2px; height: 3px; }
.flag { margin-left: 3px; color: var(--cla-warn); font-size: 12px; cursor: help; }
.flag.small { font-size: 10px; font-weight: 700; }
.style-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; }
.style { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: var(--text-white); }
.hold { margin-left: auto; font-size: 11px; color: var(--text-light-gray); white-space: nowrap; }
.hold .lbl { margin-right: 2px; }

/* Rule + tags */
.rule { display: flex; gap: 8px; align-items: baseline; }
.rule .lbl { flex: 0 0 auto; white-space: nowrap; overflow-wrap: normal; }
.rule-txt { margin: 0; font-family: var(--font-family-primary); font-size: 12px; line-height: 1.4; color: var(--text-light-gray); }
.tags { display: flex; flex-wrap: wrap; gap: 2px 8px; }
.tag { font-size: 10px; color: var(--text-light-gray); }

/* Footer */
.ft { display: flex; flex-direction: column; gap: 3px; padding-top: 6px; border-top: 1px solid var(--border-primary); }
.kv-row { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; color: var(--text-light-gray); }
.kv .lbl { margin-right: 2px; }
.acts { display: flex; gap: 6px; padding-top: 4px; }
.btn { flex: 1; padding: 7px 6px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
  background: var(--bg-tertiary); color: var(--text-light-gray); border: 1px solid var(--border-secondary); border-radius: var(--radius-sm); }
.btn.primary { color: var(--primary-green); border-color: var(--primary-green); }
.btn:hover { color: var(--text-white); border-color: var(--text-light-gray); }
.btn:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }
</style>
