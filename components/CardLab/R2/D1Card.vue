<script setup lang="ts">
/**
 * Card lab ROUND 2 — D1 card: ONE pointed corner · centred title · brushed-steel action row · in-card Details sheet.
 * Same props/emits as components/Card/Strategy.vue (`strategy`, `selected?` · select, copy, share, view, toggle, delete)
 * plus optional `full` (canonical record) and `code` (strategyToCodeView). Information = round-1 Final, unchanged and as
 * honest (no defaults as data, periods on numbers, warning chips); round 2 changes form only:
 *   • corner: the style glyph sits in a 52 px DROP (class colour, three round corners) flush in the card's top-right corner;
 *     that corner is the card's ONLY sharp corner and the drop's only point, with a status badge on its round edge.
 *   • narrow cards (≤ 400 px content) print the honesty checks as one strip under the metric grid (⚠ beside the number).
 *   • title centred on the card (symmetric gutters = tile width), 2 lines max + full name in `title`.
 *   • the card fills the height its list gives it (D1List: one height per device class); top block (identity, assets,
 *     rule) is anchored top, proof + crowd + steel actions are anchored bottom, so rows line up across cards.
 *   • Details = a sheet that slides up INSIDE the card over the body (✕, Esc, focus in/out): the card never resizes.
 * Judge marks: data-r2 = card · title · corner-icon · actions · details.
 * Maths: utils/cardLabFinal.ts (model) + utils/cardLabR2D1.ts (actions, corner tooltip, details rows, size table).
 */
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { assetClassTheme } from '~/utils/assetClass'
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney, fmtSignedNumber } from '~/utils/format'
import { cardLabFinalModel, cardLabFinalObject } from '~/utils/cardLabFinal'
import { cardLabR2D1Actions, cardLabR2D1CornerTitle, cardLabR2D1DetailRows } from '~/utils/cardLabR2D1'
import type { CardLabCClause } from '~/utils/cardLabC'

const props = defineProps<{
  strategy: Record<string, any>
  full?: Record<string, any> | null
  code?: Record<string, any> | null
  selected?: boolean
}>()
const emit = defineEmits<{ select: []; copy: []; share: []; view: []; toggle: []; delete: [] }>()

const m = computed(() => cardLabFinalModel(props.strategy, props.full, props.code))
const uid = useId()
const sheetId = `d1-sheet-${uid}`
const titleId = `d1-title-${uid}`

// ── Details sheet (in-card layer: never resizes the card) ──────────────
const open = ref(false)
const closeBtn = ref<HTMLButtonElement | null>(null)
const moreBtn = ref<HTMLButtonElement | null>(null)
const setMoreBtn = (el: unknown) => { moreBtn.value = (el as HTMLButtonElement | null) ?? null }
async function setOpen(v: boolean) {
  open.value = v
  await nextTick()
  ;(v ? closeBtn.value : moreBtn.value)?.focus({ preventScroll: true })
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) { e.stopPropagation(); setOpen(false) }
}

// ── identity ────────────────────────────────────────────────────────────
const { userId } = useCurrentUser()
// A catalog sample is never "yours": signed out, useCurrentUser falls back to the demo id, which is the catalog author's.
const creatorLabel = computed(() => (!m.value.sample && (m.value.creator === userId.value || m.value.creator === 'current_user') ? 'you' : m.value.creator))
const classTheme = computed(() => assetClassTheme(m.value.category || m.value.assets[0] || ''))
const cornerTitle = computed(() => cardLabR2D1CornerTitle(m.value))
const ASSET_VAR: Record<string, string> = { BTC: '--asset-btc', ETH: '--asset-eth', SOL: '--asset-sol', TSLA: '--asset-tsla' }
const assetDot = (a: string) => (ASSET_VAR[a] ? `var(${ASSET_VAR[a]})` : assetClassTheme(a).color)
const priceLabel = computed(() => (m.value.premium ? (m.value.price ? `Premium ${fmtMoney(m.value.price, { decimals: 0 })}` : 'Premium') : 'Free'))

// ── rule ────────────────────────────────────────────────────────────────
const VERB_WORD: Record<string, string> = {
  buy: 'BUY', buys: 'BUY', buying: 'BUY', bought: 'BUY', sell: 'SELL', sells: 'SELL', selling: 'SELL', sold: 'SELL',
  long: 'LONG', longs: 'LONG', short: 'SHORT', shorts: 'SHORT', add: 'ADD', adds: 'ADD', adding: 'ADD',
  accumulate: 'ADD', accumulates: 'ADD', trims: 'TRIM', cuts: 'CUT', exits: 'EXIT', closes: 'CLOSE',
}
const sideWord = (c: CardLabCClause) => VERB_WORD[c.verb.toLowerCase()] ?? (c.side === 'buy' ? 'BUY' : 'SELL')
const trigger = computed(() => {
  const r = m.value.rule
  if (r.pair) return r.pairCondition ? { keyword: 'when', text: r.pairCondition } : null
  const c = r.entry.find(e => e.condition)
  return c ? { keyword: c.keyword ?? 'when', text: c.condition! } : null
})

// ── proof ───────────────────────────────────────────────────────────────
const tone = (v: number | null) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down')
const balTitle = computed(() => {
  const b = m.value.balance
  return `Return vs drawdown on one axis, the same on every card (half-width ${b.scale}%): solid bar = total return ${fmtPctFromPercent(m.value.ret, { signed: true })} (right = gain, left = loss); faded bar = max drawdown ${fmtPctFromPercent(m.value.dd == null ? null : -Math.abs(m.value.dd))}, always left.`
})
const RING_C = 2 * Math.PI * 15
const winPct = computed(() => (m.value.win ? m.value.win.frac * 100 : null))

// ── who ─────────────────────────────────────────────────────────────────
const agents = useAgentsStore()
onMounted(() => { if (!agents.hydrated && !agents.loading) agents.fetchAgents() })
const agentName = computed(() => {
  const id = m.value.agentId
  if (!id) return null
  const a = (agents.byId as Record<string, { name?: string; kind?: string; owner_id?: string }>)[id]
  if (!a) return id
  // The catalog's personal avatar is named "Your avatar": on someone else's strategy it is the creator's, not the viewer's.
  if (m.value.sample && (a.kind === 'personal' || /^your\b/i.test(a.name ?? ''))) return id
  return a.name ?? id
})
const plural = (n: number | null, w: string) => `${w}${n === 1 ? '' : 's'}`
const flag = (k: string) => m.value.flags.find(f => f.key === k)
const sharpeFlag = computed(() => flag('sharpe-sign') ?? flag('sharpe-gap'))
/** The checks shown on the card, in grid order, led by the metric they qualify (narrow cards print them as one strip). */
const shownFlags = computed(() => [
  ['Win', flag('win')], ['Win', flag('win-loss')], ['Sharpe', sharpeFlag.value], ['Trades', flag('sample')],
  ['Annual', flag('annual')], ['Beta', flag('beta-pair')],
].filter((x): x is [string, NonNullable<ReturnType<typeof flag>>] => !!x[1]))

// ── actions + details rows ──────────────────────────────────────────────
const actions = computed(() => cardLabR2D1Actions(m.value.sample, m.value.status.key, !!m.value.id && !m.value.sample))
const detailRows = computed(() => cardLabR2D1DetailRows(m.value))
function act(key: string) {
  if (key === 'copy' || key === 'edit') emit('copy')
  else if (key === 'view') emit('view')
  else if (key === 'toggle') emit('toggle')
}
</script>

<template>
  <article
    class="d1"
    data-r2="card"
    :class="[`risk-${m.risk.key}`, `st-${m.status.key}`, { selected, open }]"
    :style="{ '--d1-class': classTheme.color, '--d1-class-tint': classTheme.tint }"
    :aria-labelledby="titleId"
    @click="emit('select')"
    @keydown="onKey"
  >
    <!-- Corner: ONE pointed corner. The tile's sharp top-right corner IS the card's sharp corner. -->
    <div class="corner" data-r2="corner-icon" :title="cornerTitle" role="img" :aria-label="`${m.style.label} · ${m.classLabel} · ${m.status.label}`">
      <svg class="glyph" viewBox="0 0 40 40" aria-hidden="true">
        <g v-if="m.style.key === 'reversion'">
          <path class="g-mean" d="M3 20H37" />
          <path class="g-line" d="M3 20C8 5 13 5 16 20S25 35 29 20 34 12 37 16" />
          <path class="g-acc" d="M10 6.5v6M7.6 10.2 10 12.7l2.4-2.5M22 33.5v-6M19.6 29.8 22 27.3l2.4 2.5" />
        </g>
        <g v-else-if="m.style.key === 'pair'">
          <path class="g-line" d="M3 17 13 8 25 17 37 18" />
          <path class="g-line alt" d="M3 23 13 32 25 23 37 22" />
          <path class="g-acc" d="M13 12v16M10.5 14.5 13 11.5l2.5 3M10.5 25.5 13 28.5l2.5-3" />
        </g>
        <g v-else-if="m.style.key === 'vol'">
          <path class="g-mean" d="M3 27H37" />
          <path class="g-line" d="M3 36 20 13 37 36" />
          <path class="g-acc" d="M9 8c2-3 4 3 6 0s4 3 6 0 4 3 6 0 4 3 6 0" />
        </g>
        <g v-else-if="m.style.key === 'momentum'">
          <path class="g-line" d="M3 33 11 27 16 29 24 19 28 21 36 9" />
          <path class="g-acc" d="M29 8.5 36.5 8.5 36.5 16" />
        </g>
        <g v-else-if="m.style.key === 'event'">
          <path class="g-mean" d="M14 4V36" />
          <rect class="g-acc-fill" x="10.5" y="3" width="7" height="7" rx="1.5" />
          <path class="g-line" d="M3 27H14C21 26 27 21 37 12" />
          <path class="g-acc" d="M31 11.5 37.3 11.5 37 18" />
        </g>
        <path v-else class="g-line" d="M20 4 34 12V28L20 36 6 28V12Z" />
      </svg>
      <span class="badge" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <circle v-if="m.status.key === 'active'" cx="6" cy="6" r="4" />
          <g v-else-if="m.status.key === 'paused'"><rect x="2.4" y="2" width="2.6" height="8" rx="0.6" /><rect x="7" y="2" width="2.6" height="8" rx="0.6" /></g>
          <rect v-else-if="m.status.key === 'stopped'" x="2.3" y="2.3" width="7.4" height="7.4" rx="1" />
          <path v-else-if="m.status.key === 'backtesting'" d="M6 1.5a4.5 4.5 0 1 0 0 9V1.5Z" />
          <circle v-else cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </span>
    </div>

    <!-- ① Identity, centred: name · style/class/price/sample · status/automation/risk -->
    <header class="head">
      <div class="title-band">
        <h3 :id="titleId" class="name" data-r2="title" :title="m.name">{{ m.name }}</h3>
        <p class="kind">
        <span class="style" title="Trading style, read from the strategy's own tags, indicators and name">{{ m.style.label }}</span>
        <span class="sep" aria-hidden="true">·</span>
        <span class="cls" :title="`Asset class: ${m.classLabel}`">{{ m.classLabel }}</span>
        <span class="price" :class="{ prem: m.premium }" :title="m.premium ? 'Premium: paid access' : 'Free: not premium, price $0'">{{ priceLabel }}</span>
        <UISourceChip v-if="m.sample" class="chip" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
        </p>
      </div>
      <div class="state">
        <span class="status" :title="m.status.title">
          <svg class="st-ico" viewBox="0 0 12 12" aria-hidden="true">
            <circle v-if="m.status.key === 'active'" cx="6" cy="6" r="4.5" />
            <g v-else-if="m.status.key === 'paused'"><rect x="2" y="1.5" width="3" height="9" rx="0.6" /><rect x="7" y="1.5" width="3" height="9" rx="0.6" /></g>
            <rect v-else-if="m.status.key === 'stopped'" x="1.8" y="1.8" width="8.4" height="8.4" rx="1" />
            <path v-else-if="m.status.key === 'backtesting'" d="M6 1a5 5 0 1 0 0 10V1Z" />
            <circle v-else cx="6" cy="6" r="4" fill="none" stroke="currentColor" />
          </svg>{{ ' ' }}{{ m.status.label }}
        </span>
        <span class="auto" :class="`auto-${m.automation.key}`" :title="`Execution: ${m.automation.label} (gear solid = automated, dashed = semi-automated)`">
          <svg class="au-ico" viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="6" cy="6" r="2.2" />
            <path d="M6 .8v1.8M6 9.4v1.8M.8 6h1.8M9.4 6h1.8M2.3 2.3l1.3 1.3M8.4 8.4l1.3 1.3M2.3 9.7l1.3-1.3M8.4 3.6l1.3-1.3" />
          </svg>{{ ' ' }}{{ m.automation.label }}
        </span>
        <span class="risk" :title="`Risk level from the record: ${m.risk.label} (1–3 bars = low · medium · high; also the left-edge thickness)`">
          <svg class="rk-ico" viewBox="0 0 15 12" aria-hidden="true">
            <rect v-for="i in 3" :key="i" :x="(i - 1) * 5" :y="12 - i * 4" width="3.6" :height="i * 4" rx="0.6" :class="{ on: i <= m.risk.level }" />
          </svg>{{ ' ' }}{{ m.risk.level ? `${m.risk.label} risk` : 'Risk not rated' }}
        </span>
        <span v-if="m.experimental" class="exp" title="The record's own tags call this strategy experimental">⚗ Experimental</span>
      </div>
    </header>

    <!-- ② What it trades: filled = traded asset, outlined = indicator it reads -->
    <div v-if="m.assets.length || m.indicators.length" class="tokens">
      <span v-for="a in m.assets" :key="a" class="coin" :title="`Traded asset ${a} · ${assetClassTheme(a).label}`"><span class="coin-dot" :style="{ background: assetDot(a) }" aria-hidden="true" />{{ a }}</span>
      <span v-if="m.assets.length && m.indicators.length" class="vsep" aria-hidden="true" />
      <span v-for="i in m.indicators" :key="`i-${i}`" class="ind" :title="`Indicator read by the rules: ${i}`">{{ i }}</span>
    </div>

    <span class="spring" aria-hidden="true" />

    <!-- ③ Rule: the creator's sentence verbatim, then its legs as side badges -->
    <section class="rule" aria-label="Trading rule, from the creator's description">
      <p v-if="m.description" class="desc" :title="`The creator's description, verbatim: “${m.description}”`">{{ m.description }}</p>
      <p v-for="(c, i) in m.conditions" :key="`c${i}`" class="desc cond" title="Coded condition of the strategy"><span class="k">{{ i === 0 ? 'When' : 'and' }}</span> {{ c }}</p>
      <p v-if="!m.description && !m.conditions.length" class="desc"><span class="gap">○ rule not described</span></p>
      <div class="legs">
        <span class="grp">
          <span class="leg-k">Entry</span>
          <template v-if="m.rule.entry.length">
            <span
              v-for="(leg, i) in m.rule.entry" :key="`e${i}`" class="side" :class="leg.side"
              :title="`Entry ${leg.side === 'buy' ? 'buy / long' : 'sell / short'} side, from the verb “${leg.verb}”: ${leg.action}${leg.condition ? ` ${leg.keyword} ${leg.condition}` : ''}${trigger && m.rule.pair ? ` (${trigger.keyword} ${trigger.text})` : ''}`"
            ><span aria-hidden="true">{{ leg.side === 'buy' ? '▲' : '▼' }}</span> {{ sideWord(leg) }}</span>
            <span v-for="(leg, i) in m.rule.entry.length === 1 ? m.rule.entry : []" :key="`o${i}`" class="obj">{{ cardLabFinalObject(leg.action, leg.verb) }}</span>
          </template>
          <span v-else class="gap">○ not described</span>
        </span>
        <span class="grp">
          <span class="leg-k">Exit</span>
          <span v-if="m.rule.exit" class="side" :class="m.rule.exit.side" :title="`Exit: ${m.rule.exit.action}${m.rule.exit.condition ? ` ${m.rule.exit.keyword} ${m.rule.exit.condition}` : ''}`"><span aria-hidden="true">{{ m.rule.exit.side === 'buy' ? '▲' : '▼' }}</span> {{ sideWord(m.rule.exit) }}</span>
          <span v-if="m.rule.exit" class="obj">{{ cardLabFinalObject(m.rule.exit.action, m.rule.exit.verb) }}</span>
          <span v-else class="gap" title="The description gives no exit rule; only the average holding time is known.">○ not stated</span>
        </span>
      </div>
    </section>

    <!-- elastic gaps (weights 1 · 2 · 1): identity stays top, actions stay bottom, the fixed height's slack is spread -->
    <span class="spring s2" aria-hidden="true" />

    <!-- ④ Proof: one period line for every figure, return vs DD on one fixed axis, aligned 4-col grid -->
    <section class="proof" :class="{ norec: !m.hasRecord }">
      <!-- No track record: one honest empty panel takes the slack of the list height (no hole between sections) -->
      <div v-if="!m.hasRecord" class="empty" title="No trade in the record: every figure below is empty, not zero">
        <svg class="empty-ico" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" /><path d="M16 9v7l5 3" /></svg>
        <span class="empty-k">No trades recorded yet</span>
        <span class="empty-t">Return, drawdown and the metrics below appear after the first run.</span>
      </div>
      <p v-else class="period" :class="{ unknown: !m.window.known }" :title="m.window.known ? 'backtest_period of the record: every figure below covers it' : 'The record has no backtest window: every figure below covers its whole history; dates not published.'">
        <template v-if="m.window.known">Backtest {{ fmtDate(m.window.start) }} → {{ fmtDate(m.window.end) }} · {{ m.window.months }} mo</template>
        <template v-else>Whole record · ○ window not published<template v-if="m.impliedMonths != null"> · <span class="nowrap" title="Record length implied by its own total vs annual return (12·ln(1+total)/ln(1+annual)), if both figures are right">about {{ Math.max(1, Math.round(m.impliedMonths)) }} mo implied</span></template></template>
      </p>
      <div v-if="m.hasRecord" class="bal-row">
        <span class="end r" title="total_return_percentage: return over the whole backtest / record (see the period line) — not a monthly figure">
          <span class="lbl">Total return</span>
          <b class="v hero" :class="tone(m.ret)">{{ fmtPctFromPercent(m.ret, { signed: true }) }}</b>
          <span v-if="m.capStart != null || m.retUsd != null" class="money" title="Initial capital → current capital; total return in dollars">
            <span v-if="m.capStart != null">{{ fmtMoney(m.capStart, { decimals: 0 }) }} → {{ fmtMoney(m.capNow, { decimals: 0 }) }}</span>
            <b :class="tone(m.retUsd)">{{ fmtSignedMoney(m.retUsd, { decimals: 0 }) }}</b>
          </span>
        </span>
        <span class="end l" title="max_drawdown: largest peak-to-trough fall over the same period">
          <span class="lbl">Max drawdown</span>
          <b class="v down">{{ fmtPctFromPercent(m.dd == null ? null : -Math.abs(m.dd)) }}</b>
        </span>
        <div class="track" :title="balTitle" aria-hidden="true">
          <span class="base" />
          <div class="half l">
            <span v-if="m.balance.retSign < 0 && m.balance.ret != null" class="bar ret neg" :style="{ width: `${m.balance.ret * 100}%` }" />
            <span v-if="m.balance.dd != null" class="bar dd" :style="{ width: `${m.balance.dd * 100}%` }" />
          </div>
          <span class="axis" />
          <div class="half r">
            <span v-if="m.balance.retSign > 0 && m.balance.ret != null" class="bar ret pos" :style="{ width: `${m.balance.ret * 100}%` }" />
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="cell" :title="m.win?.wins != null ? `Win ring from the trade counts: ${m.win.wins} winning (green arc) and ${m.win.losses} losing (red) of ${m.win.total}` : 'Win rate as recorded (no trade counts)'">
          <span class="lbl">Win rate</span>
          <span class="val-row">
            <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle class="r-bg" :class="{ loss: winPct != null }" cx="18" cy="18" r="15" />
              <circle v-if="winPct != null" class="r-win" cx="18" cy="18" r="15" :stroke-dasharray="`${RING_C * (winPct / 100)} ${RING_C}`" />
            </svg>
            <b class="val" title="win_rate as stated by the record">{{ fmtPctFromPercent(m.winShown, { decimals: m.winShown != null && Number.isInteger(m.winShown) ? 0 : 1 }) }}</b>
            <span v-if="flag('win') || flag('win-loss')" class="mk" aria-hidden="true">⚠</span>
          </span>
          <span v-if="m.win?.wins != null" class="sub"><span class="up">{{ m.win.wins }} W</span> · <span class="down">{{ m.win.losses }} L</span></span>
          <span v-if="flag('win')" class="fl in" :title="flag('win')!.long">⚠ {{ flag('win')!.short }}</span>
          <span v-if="flag('win-loss')" class="fl in" :title="flag('win-loss')!.long">⚠ {{ flag('win-loss')!.short }}</span>
        </div>
        <div class="cell" :title="`Sharpe ratio, band −1 … 3: below 0 losing · 0–1 weak · 1–2 good · 2+ strong. This one: ${fmtNumber(m.sharpeValue)}, ${m.sharpe.label}`">
          <span class="lbl">Sharpe</span>
          <span class="val-row wrap"><b class="val">{{ fmtNumber(m.sharpeValue) }}</b><span v-if="sharpeFlag" class="mk" aria-hidden="true">⚠</span> <span v-if="m.sharpe.key !== 'none'" class="verdict" :class="sharpeFlag ? 'sq-doubt' : `sq-${m.sharpe.key}`" :title="sharpeFlag ? `Verdict on the stated Sharpe only — the record's own figures disagree (${sharpeFlag.short})` : undefined">{{ m.sharpe.label }}{{ sharpeFlag ? '?' : '' }}</span></span>
          <span class="band" aria-hidden="true">
            <span class="seg losing" :class="{ on: m.sharpe.key === 'losing' }" /><span class="seg weak" :class="{ on: m.sharpe.key === 'weak' }" /><span class="seg good" :class="{ on: m.sharpe.key === 'good' }" /><span class="seg strong" :class="{ on: m.sharpe.key === 'strong' }" />
            <span v-if="m.sharpe.pos != null" class="pin" :style="{ left: `${m.sharpe.pos * 100}%` }" />
          </span>
          <span v-if="sharpeFlag" class="fl in" :title="sharpeFlag.long">⚠ {{ sharpeFlag.short }}</span>
        </div>
        <div class="cell" title="Number of trades in the record (fewer than 30 = thin sample)">
          <span class="lbl">Trades</span>
          <span class="val-row"><b class="val">{{ fmtCount(m.trades) }}</b><span v-if="flag('sample')" class="mk" aria-hidden="true">⚠</span></span>
          <span v-if="flag('sample')" class="fl in" :title="flag('sample')!.long">⚠ {{ flag('sample')!.short }}</span>
        </div>
        <div class="cell" :title="`Average time a trade stays open (average_trade_duration): ${m.holdRaw ?? 'not recorded'} · ${m.holdBucket}`">
          <span class="lbl">Avg hold</span>
          <span class="val-row wrap"><b class="val">{{ m.holdRaw ?? '—' }}</b> <span v-if="m.holdRaw" class="verdict">{{ m.holdBucket }}</span></span>
        </div>
        <div class="cell" title="Annual return: annualised return (performance_metrics.annual_return), % per year">
          <span class="lbl">Annual /yr</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.annual)">{{ fmtPctFromPercent(m.perf.annual, { signed: true }) }}</b><span v-if="flag('annual')" class="mk" aria-hidden="true">⚠</span></span>
          <span v-if="flag('annual')" class="fl in" :title="flag('annual')!.long">⚠ {{ flag('annual')!.short }}</span>
        </div>
        <div class="cell" title="Volatility: annualised standard deviation of returns, % per year">
          <span class="lbl">Vol /yr</span>
          <span class="val-row"><b class="val sm">{{ fmtPctFromPercent(m.perf.vol) }}</b></span>
        </div>
        <div class="cell" title="Beta: sensitivity to its market (1 = moves with it)">
          <span class="lbl">Beta</span>
          <span class="val-row"><b class="val sm">{{ fmtNumber(m.perf.beta) }}</b><span v-if="flag('beta-pair')" class="mk" aria-hidden="true">⚠</span></span>
          <span v-if="flag('beta-pair')" class="fl in" :title="flag('beta-pair')!.long">⚠ {{ flag('beta-pair')!.short }}</span>
        </div>
        <div class="cell" title="Alpha: return not explained by the market, as stored in the record (unit not specified)">
          <span class="lbl">Alpha</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.alpha)">{{ fmtSignedNumber(m.perf.alpha) }}</b></span>
        </div>
      </div>
      <!-- narrow cards (≤ 400 px): the same checks as ONE strip under the grid, led by their metric (cells stay one word wide) -->
      <p v-if="shownFlags.length" class="checks">
        <span v-for="([k, f], i) in shownFlags" :key="`${f.key}-${i}`" class="fl" :title="f.long">⚠ <b v-if="!f.short.toLowerCase().startsWith(k.toLowerCase())">{{ k }}:</b> {{ f.short }}</span>
      </p>
    </section>

    <span class="spring" aria-hidden="true" />

    <!-- ⑤ Crowd + provenance: one line, real counts -->
    <p class="who">
      <span :title="m.followers == null ? 'Followers not recorded' : 'followers_count'"><b class="big">{{ fmtCount(m.followers) }}</b> {{ plural(m.followers, 'follower') }}</span>
      <span title="Creator of the strategy">by <b>{{ creatorLabel }}</b></span>
      <span v-if="m.agentId || full" :title="m.agentId ? `Agent running it: ${m.agentId}` : 'No agent attached in the record'">agent <b>{{ agentName ?? 'none' }}</b></span>
      <!-- The store fills a missing last_run with "now": with no trade recorded the strategy never ran, so say that. -->
      <span v-if="full && (m.trades ?? 0) > 0" title="last_run: last time the strategy ran">last run <b>{{ fmtDate(m.lastRun) }}</b></span>
      <span v-else-if="full" title="No trade recorded: the strategy has not run yet">never run</span>
    </p>

    <!-- ⑥ Brushed-steel action row: same height on every card, always the last row -->
    <div class="actions" :class="`n${actions.length}`" data-r2="actions" @click.stop>
      <template v-for="a in actions" :key="a.key">
        <ChatShareTo
          v-if="a.key === 'share'"
          :item="{ kind: 'strategy', id: String(m.id), title: m.name, url: `/strategy/${m.id}` }"
          button-class="btn steel"
        />
        <button
          v-else-if="a.key === 'details'" :ref="setMoreBtn"
          type="button" class="btn steel more-btn" :aria-expanded="open" :aria-controls="sheetId" :title="a.title"
          @click="setOpen(!open)"
        ><span class="ico" aria-hidden="true">{{ open ? '✕' : a.icon }}</span><span class="lab">{{ open ? 'Close' : a.label }}</span><span class="lab-s">{{ open ? 'Close' : a.short }}</span></button>
        <button
          v-else type="button" class="btn steel" :class="[`a-${a.key}`, { primary: a.key === 'copy' || a.key === 'edit' }]" :title="a.title"
          @click="act(a.key)"
        ><span class="ico" aria-hidden="true">{{ a.icon }}</span><span class="lab">{{ a.label }}</span><span class="lab-s">{{ a.short }}</span></button>
      </template>
    </div>

    <!-- ⑦ Details: a sheet INSIDE the card, over the body; the card keeps its size -->
    <div
      v-if="open" :id="sheetId" class="sheet" data-r2="details" role="dialog" aria-modal="false"
      :aria-label="`Details of ${m.name}`" @click.stop
    >
      <div class="sheet-head">
        <span class="sheet-k">Details</span>
        <button ref="closeBtn" type="button" class="x" :aria-label="`Close details of ${m.name}`" title="Close (Esc)" @click="setOpen(false)">✕</button>
      </div>
      <p class="sheet-name">{{ m.name }}</p>
      <dl class="kv">
        <template v-for="r in detailRows" :key="r.key">
          <dt :title="r.title">{{ r.label }}</dt>
          <dd :title="r.title">{{ r.value }}</dd>
        </template>
      </dl>
      <p v-if="m.tags.length" class="tags" title="Tags"><span v-for="t in m.tags" :key="t">#{{ t }}</span></p>
      <p v-else class="tags none">no tags</p>
    </div>
  </article>
</template>

<style scoped>
.d1 {
  --d1-risk: var(--border-secondary);
  --d1-risk-w: 2px;
  --d1-pad: 12px;
  --d1-tile: 52px;
  --d1-r: var(--radius-lg);
  /* brushed steel (metal palette; local tokens) */
  --d1-steel-0: #eef0f2;
  --d1-steel-1: #c9ced3;
  --d1-steel-2: #aab1b8;
  --d1-steel-edge: #5d646b;
  --d1-steel-ink: #15181b;
  position: relative; display: flex; flex-direction: column; gap: 7px;
  box-sizing: border-box; width: 100%; height: 100%;
  min-width: var(--d1-min-w, 0); max-width: var(--d1-max-w, none);
  /* ONE height for every card of the list, from the card width only (utils/cardLabR2D1.ts cardLabR2D1Height) */
  min-height: max(534px, calc(708px - 1.537 * (100cqw - 258px)), min(calc(622px - 0.558 * (100cqw - 313px)), calc(598px - 1.1 * (100cqw - 356px))));
  /* the left padding reserves the THICKEST risk edge (10 px) on every card: same content width for every card of a list,
     so metric columns line up across neighbours and narrow-card rules switch at the same card width */
  --d1-edge: 10px;
  padding: 0 var(--d1-pad) 10px calc(var(--d1-pad) + var(--d1-edge));
  background-color: var(--bg-tertiary); color: var(--text-white);
  border: 1px solid var(--border-primary);
  /* ONE pointed corner: top-right is sharp, the three others round */
  border-radius: var(--d1-r) 0 var(--d1-r) var(--d1-r);
  font-size: 12px; line-height: 1.35; overflow: hidden; container-type: inline-size; cursor: default;
}
.d1.selected { border-color: var(--primary-green); box-shadow: 0 0 0 1px var(--primary-green); }
/* Risk = weight of the left edge: low thin blue · medium orange · high thick red. */
.d1::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--d1-risk-w); background: var(--d1-risk); }
.risk-low { --d1-risk: var(--primary-blue); --d1-risk-w: 3px; }
.risk-medium { --d1-risk: var(--warning-orange); --d1-risk-w: 6px; }
.risk-high { --d1-risk: var(--error-red); --d1-risk-w: 10px; }
.st-stopped .corner .glyph, .st-stopped .track, .st-stopped .ring { filter: saturate(0.5); }
.up { color: var(--app-color-up); }
.down { color: var(--app-color-down); }
b { font-weight: 700; }

/* ── corner tile: flush in the card's sharp corner, sharp on the same corner only ── */
.corner {
  position: absolute; top: 0; right: 0; z-index: 1;
  width: var(--d1-tile); height: var(--d1-tile); display: grid; place-items: center;
  /* solid silhouette (the shape must read at half size): class colour, brightest at the point, fading to the round corners */
  background-color: var(--bg-tertiary);
  background-image:
    linear-gradient(225deg, color-mix(in srgb, var(--d1-class) 52%, transparent) 0%, color-mix(in srgb, var(--d1-class) 20%, transparent) 36%, color-mix(in srgb, var(--d1-class) 12%, transparent) 100%);
  border: 1.5px solid var(--d1-class);
  /* a drop: three fully round corners, ONE sharp point — the card's own sharp corner */
  border-radius: 50% 0 50% 50%;
  color: var(--d1-class);
}
.glyph { width: 30px; height: 30px; overflow: visible; transform: translate(2px, -2px); }
.g-line { fill: none; stroke: var(--text-white); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.g-line.alt { stroke: var(--d1-class); }
.g-mean { fill: none; stroke: var(--d1-class); stroke-width: 1.5; stroke-dasharray: 2.5 2.5; }
.g-acc { fill: none; stroke: var(--d1-class); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.g-acc-fill { fill: var(--d1-class); }
.badge {
  position: absolute; left: 0; bottom: 0; width: 15px; height: 15px; border-radius: 50%;
  display: grid; place-items: center; background-color: var(--text-light-gray); color: var(--secondary-darker);
  box-shadow: 0 0 0 2px var(--bg-tertiary);
}
.badge svg { width: 9px; height: 9px; fill: currentColor; }
.st-active .badge { background-color: var(--status-active); }
.st-paused .badge { background-color: var(--status-paused); }
.st-stopped .badge { background-color: var(--status-stopped); }
.st-backtesting .badge { background-color: var(--primary-blue); }

/* ── ① head: centred on the CARD (cancels the asymmetric risk edge) ── */
.head {
  display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
  margin: 0 calc(-1 * var(--d1-pad)) 0 calc(-1 * (var(--d1-pad) + var(--d1-edge)));
  padding: 0 var(--d1-pad);
}
.title-band {
  align-self: stretch; min-height: calc(var(--d1-tile) + 4px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  /* symmetric gutters = the tile's reach past the head padding (+4 px air): the title text centre IS the card centre */
  padding: 6px calc(var(--d1-tile) - var(--d1-pad) + 4px) 0;
}
.name {
  margin: 0; max-width: 100%; font-size: 16px; font-weight: 800; line-height: 1.32; /* ≥ the font's ascent+descent: no false clip */ letter-spacing: 0.005em; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.chip :deep(.chip) { font-size: 10px; }
.kind { margin: 0; max-width: 100%; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 5px; font-size: 12px; font-weight: 700; }
.kind .sep { color: var(--text-light-gray); }
.kind .cls { color: var(--d1-class); }
.state { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 9px; align-items: center; font-size: 11px; font-weight: 700; }
.state > span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.st-ico { width: 12px; height: 12px; fill: currentColor; }
.status {
  color: var(--secondary-darker); background-color: var(--text-light-gray); padding: 1px 8px 1px 6px;
  border-radius: 999px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
}
.st-active .status { background-color: var(--status-active); }
.st-paused .status { background-color: var(--status-paused); }
.st-stopped .status { background-color: var(--status-stopped); }
.st-backtesting .status { background-color: var(--primary-blue); }
.st-active .st-ico, .st-active .badge svg { animation: d1-live 2.4s ease-in-out infinite; }
@keyframes d1-live { 50% { opacity: 0.45; } }
.auto { color: var(--text-light-gray); }
.au-ico { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.auto-semi .au-ico { stroke-dasharray: 1.6 1.4; }
.risk { color: var(--d1-risk); }
.risk-none .risk { color: var(--text-light-gray); }
.rk-ico { width: 15px; height: 12px; }
.rk-ico rect { fill: var(--border-secondary); }
.rk-ico rect.on { fill: currentColor; }
.exp { padding: 0 6px; border: 1px dashed var(--warning-orange); border-radius: 999px; color: var(--warning-orange); }
.price { font-size: 11px; padding: 0 7px; border: 1px solid var(--text-light-gray); border-radius: 999px; color: var(--text-light-gray); }
.price.prem { color: var(--warning-orange); border-color: var(--warning-orange); }

/* ── ② tokens (centred under the identity) ── */
.tokens { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; align-items: center; }
.coin {
  display: inline-flex; align-items: center; gap: 5px; padding: 1px 8px 1px 3px; border-radius: 999px;
  background: var(--text-white); color: var(--bg-tertiary);
  font-family: var(--font-market-data); font-size: 12px; font-weight: 800;
}
.coin-dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.35); }
.vsep { width: 1px; height: 14px; background: var(--border-secondary); margin: 0 2px; }
.ind {
  font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: var(--radius-sm);
  color: var(--primary-blue); border: 1px solid var(--primary-blue); font-family: var(--font-market-data);
}

/* ── ③ rule ── */
.rule { display: flex; flex-direction: column; gap: 5px; padding: 6px 0 0; border-top: 1px solid var(--border-primary); }
.desc { margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-light-gray); text-wrap: pretty; }
.desc.cond { color: var(--text-white); font-family: var(--font-market-data); }
.k, .leg-k { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-gray); }
.legs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; }
.grp { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.side {
  display: inline-flex; align-items: center; gap: 3px; padding: 0 6px; white-space: nowrap;
  font-size: 11px; font-weight: 800; letter-spacing: 0.05em; border: 1px solid; border-radius: var(--radius-sm);
}
.side.buy { color: var(--app-color-up); }
.side.sell { color: var(--app-color-down); }
.obj { font-size: 11px; color: var(--text-white); margin-left: -1px; }
.gap { display: inline-block; font-size: 11px; color: var(--text-light-gray); border: 1px dashed var(--text-gray); border-radius: var(--radius-sm); padding: 0 6px; white-space: nowrap; }

.spring { flex: 1 1 0; min-height: 0; margin: -3.5px 0; }
.spring.s2 { flex-grow: 1.5; }

/* ── ④ proof ── */
.proof { display: flex; flex-direction: column; gap: 4px; padding-top: 6px; border-top: 1px solid var(--border-primary); }
.proof.norec { flex: 8 1 auto; }
.empty {
  flex: 1 1 auto; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  padding: 8px 12px; text-align: center; border: 1px dashed var(--border-secondary); border-radius: var(--radius-md);
  background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.025) 0 6px, transparent 6px 12px);
}
.empty-ico { width: 30px; height: 30px; fill: none; stroke: var(--text-gray); stroke-width: 1.6; stroke-linecap: round; }
.empty-ico circle { stroke-dasharray: 3 3; }
.empty-k { font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-light-gray); }
.empty-t { font-size: 11px; color: var(--text-light-gray); }
.period { margin: 0; font-size: 10px; font-weight: 700; color: var(--text-light-gray); text-transform: uppercase; letter-spacing: 0.05em; }
.period.unknown { color: var(--text-gray); }
.bal-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; }
.end { display: flex; flex-direction: column; min-width: 0; }
.end.r { order: 1; }
.end.l { align-items: flex-end; order: 3; }
.bal-row .track { order: 2; align-self: start; margin-top: 18px; }
.end .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-light-gray); white-space: nowrap; }
.end .v { font-family: var(--font-market-data); font-size: 16px; font-weight: 800; line-height: 1.2; }
.end .v.hero { font-size: 22px; }
.track { position: relative; display: grid; grid-template-columns: 1fr 2px 1fr; height: 16px; align-items: center; }
.half { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
.half.l { align-items: flex-end; }
.half.r { align-items: flex-start; }
.track .base { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--border-secondary); }
.axis { height: 100%; background: var(--text-light-gray); }
.bar { display: block; height: 6px; min-width: 2px; }
.bar.ret.pos { background: var(--app-color-up); border-radius: 0 3px 3px 0; }
.bar.ret.neg { background: var(--app-color-down); border-radius: 3px 0 0 3px; }
.bar.dd { background: var(--app-color-down); opacity: 0.5; border-radius: 3px 0 0 3px; }
.money { display: flex; flex-wrap: wrap; gap: 0 6px; font-size: 11px; color: var(--text-light-gray); font-family: var(--font-market-data); }

.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 10px; margin-top: 4px; }
.cell { position: relative; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-light-gray); white-space: nowrap; }
.val-row { display: flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; }
.val { font-family: var(--font-market-data); font-size: 15px; font-weight: 800; line-height: 1.25; font-variant-numeric: tabular-nums; }
.val.sm { font-size: 13px; }
.val-row.wrap { flex-wrap: wrap; white-space: normal; column-gap: 5px; row-gap: 0; }
.verdict { font-size: 11px; font-weight: 700; color: var(--text-light-gray); white-space: nowrap; }
.sq-doubt { color: var(--text-light-gray); }
.sub { font-size: 11px; font-family: var(--font-market-data); white-space: nowrap; }
.fl { align-self: flex-start; max-width: 100%; margin-top: 1px; padding: 0 4px; border: 1px solid var(--warning-orange); border-radius: 4px; font-size: 11px; font-family: var(--font-market-data); font-weight: 700; line-height: 1.3; color: var(--warning-orange); cursor: help; text-wrap: balance; }
.mk { display: none; font-size: 11px; font-weight: 700; color: var(--warning-orange); margin-left: 2px; cursor: help; }
.checks { display: none; margin: 2px 0 0; flex-wrap: wrap; gap: 4px; }
.checks .fl { margin: 0; max-width: 100%; }
.checks .fl b { font-weight: 800; }
.ring { width: 22px; height: 22px; flex: 0 0 22px; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 6; }
.r-bg { stroke: var(--border-secondary); }
.r-bg.loss { stroke: var(--app-color-down); opacity: 0.45; }
.r-win { stroke: var(--app-color-up); opacity: 0.6; }
.band { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; height: 5px; margin: 2px 0 1px; }
.seg { border-radius: 2px; opacity: 0.3; }
.seg.on { opacity: 1; }
.seg.losing { background: var(--app-color-down); }
.seg.weak { background: var(--warning-orange); }
.seg.good { background: var(--primary-blue); }
.seg.strong { background: var(--app-color-up); }
.sq-losing { color: var(--app-color-down); }
.sq-weak { color: var(--warning-orange); }
.sq-good { color: var(--primary-blue); }
.sq-strong { color: var(--app-color-up); }
.band .pin {
  position: absolute; top: 50%; width: 3px; height: 11px; transform: translate(-50%, -50%);
  background: var(--text-white); border-radius: 2px; box-shadow: 0 0 0 2px var(--bg-tertiary);
}

/* ── ⑤ who ── */
.who > span { white-space: nowrap; }
.who > span + span::before { content: '· '; color: var(--text-gray); }
.nowrap { white-space: nowrap; }
.who { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 8px; padding-top: 6px; border-top: 1px solid var(--border-primary); font-size: 11px; color: var(--text-light-gray); }
.who b { color: var(--text-white); }
.who b.big { font-size: 13px; font-family: var(--font-market-data); }

/* ── ⑥ brushed-steel action row ── */
.actions { display: flex; gap: 6px; align-items: stretch; height: 34px; flex: 0 0 34px; }
.actions :deep(.chat-share-to) { display: flex; flex: 1 1 0; min-width: 0; }
.actions :deep(.chat-share-to > .btn) { flex: 1 1 0; }
.btn, .actions :deep(.btn) {
  flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 0 8px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap;
  color: var(--d1-steel-ink);
  /* brushed steel: fine horizontal hairlines over a silver body with a soft horizontal sheen */
  background-color: var(--d1-steel-1);
  background-image:
    /* brushing: two hairline combs with co-prime periods (3 px · 5 px) = irregular horizontal grain */
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.11) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.45) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 7px, rgba(0, 0, 0, 0.05) 7px 9px, transparent 9px 23px),
    /* anisotropic sheen: a wide soft highlight band, as on turned/brushed metal */
    radial-gradient(120% 70% at 35% 0%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, var(--d1-steel-0) 0%, var(--d1-steel-1) 52%, var(--d1-steel-2) 100%);
  border: 1px solid var(--d1-steel-edge); border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 1px 0 rgba(0, 0, 0, 0.7);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: filter 0.12s ease, box-shadow 0.12s ease;
}
.btn .ico { font-size: 13px; line-height: 1; }
.btn .lab-s { display: none; }
.btn.primary { flex-grow: 1.6; color: #0b3d24; box-shadow: inset 3px 0 0 var(--primary-green), inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 1px 0 rgba(0, 0, 0, 0.7); }
.btn.more-btn { flex: 0 0 auto; }
.btn:hover, .actions :deep(.btn:hover) { filter: brightness(1.07); }
.btn:active, .actions :deep(.btn:active) {
  filter: brightness(0.93);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.35), inset 0 -1px 0 rgba(255, 255, 255, 0.4);
}
.btn:focus-visible, .actions :deep(.btn:focus-visible) { outline: 2px solid var(--primary-green); outline-offset: 2px; }
.btn[aria-expanded='true'] { filter: brightness(0.95); box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.3); }

/* ── ⑦ details sheet (absolute, inside the card) ── */
.sheet {
  position: absolute; z-index: 2; left: 0; right: 0; top: calc(var(--d1-tile) + 8px); bottom: 50px;
  display: flex; flex-direction: column; gap: 8px; padding: 10px 14px 12px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-secondary);
  box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.55);
  border-radius: var(--d1-r) var(--d1-r) 0 0;
}
.sheet-head { display: flex; align-items: center; justify-content: space-between; }
.sheet-k { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-light-gray); }
.x {
  width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; font: inherit; font-size: 13px; font-weight: 800;
  color: var(--d1-steel-ink); background-color: var(--d1-steel-1);
  background-image: linear-gradient(180deg, var(--d1-steel-0), var(--d1-steel-2));
  border: 1px solid var(--d1-steel-edge); border-radius: 50%;
}
.x:focus-visible { outline: 2px solid var(--primary-green); outline-offset: 2px; }
.sheet-name { margin: 0; font-size: 14px; font-weight: 800; }
.kv { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 12px; }
.kv dt { color: var(--text-light-gray); }
.kv dd { margin: 0; color: var(--text-white); font-weight: 700; font-family: var(--font-market-data); overflow-wrap: anywhere; }
.tags { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 11px; color: var(--text-light-gray); }
/* slide-up on open (CSS animation, not a JS transition: closing is instant and never waits on a frame) */
.sheet { animation: d1-sheet-in 0.18s ease-out; }
@keyframes d1-sheet-in { from { transform: translateY(18px); opacity: 0.4; } }

/* Narrow card (phone / 2-col tablet): grid keeps 4 columns, cells tighten; action labels go short. */
@container (max-width: 400px) {
  .fl.in { display: none; }
  .mk { display: inline; }
  .checks { display: flex; }
  .name { font-size: 15px; }
  .grid { gap: 8px 6px; }
  .val { font-size: 14px; }
  .val.sm { font-size: 12px; }
  .ring { width: 16px; height: 16px; flex-basis: 16px; }
  .val-row { gap: 3px; }
  .lbl { letter-spacing: 0.02em; }
  .end .v.hero { font-size: 19px; }
}
/* Short labels only when the row would not fit: 3 buttons (samples) below 300 px, 4–5 buttons (own) below 430 px. */
@container (max-width: 300px) {
  .actions.n3 .btn { padding: 0 6px; gap: 3px; }
  .actions.n3 .lab { display: none; }
  .actions.n3 .lab-s { display: inline; }
}
@container (max-width: 430px) {
  .actions:is(.n4, .n5) .btn { padding: 0 5px; gap: 3px; font-size: 11px; }
  .actions:is(.n4, .n5) .lab { display: none; }
  .actions:is(.n4, .n5) .lab-s { display: inline; }
}
@media (prefers-reduced-motion: reduce) {
  .st-active .st-ico, .st-active .badge svg { animation: none; }
  .sheet { animation: none; }
}
</style>
