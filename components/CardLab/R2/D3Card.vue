<script setup lang="ts">
/**
 * Card lab ROUND 2 — lane d3 card: the FOLDED CORNER. Same information and honesty as CardLab/Final.vue (round 1,
 * blind 100 % / 0 misleads); round 2 changes form, size and polish (Strades-comms/cards-2026-11-02/R2-BRIEF.md):
 *   - the card's top-right corner is CUT at 45° and folded back (dog-ear flap); the corner pocket under the fold holds
 *     the style glyph, bigger (58–66 px tile, glyph ≈ 60 %), class-coloured, with its tooltip;
 *   - the title is centred (2 lines max, full name in `title`), identity and state rows centred under it;
 *   - honesty flags keep a ⚠ marker on the number they qualify + one labelled chip each in a checks strip (no more
 *     word-by-word wrapping inside 65 px cells on phones);
 *   - the bottom actions are carbon-weave plates with a coloured accent edge (not chips), one row, same height on every card;
 *   - Details is a LAYER inside the card (slide-up sheet, Esc / ✕ closes, focus managed): the card never resizes.
 * Height/width come from the list (D3List.vue size table → CSS vars --d3-h, --d3-minw, --d3-maxw, --d3-tile); without
 * them (outside the lab) the card is auto height. Maths: utils/cardLabFinal.ts + utils/cardLabR2D3.ts.
 */
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { assetClassTheme } from '~/utils/assetClass'
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney, fmtSignedNumber } from '~/utils/format'
import { cardLabFinalModel, cardLabFinalObject } from '~/utils/cardLabFinal'
import { cardLabR2D3FlagChips, cardLabR2D3Plates, type CardLabR2D3Metric } from '~/utils/cardLabR2D3'
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
const panelId = `d3-more-${uid}`

// ── identity ────────────────────────────────────────────────────────────
const { userId } = useCurrentUser()
// A catalog sample is never "yours" (signed out, userId falls back to the demo author's id — steal from @d1).
const creatorLabel = computed(() => (!m.value.sample && (m.value.creator === userId.value || m.value.creator === 'current_user') ? 'you' : m.value.creator))
const classTheme = computed(() => assetClassTheme(m.value.category || m.value.assets[0] || ''))
const GLYPH_MEANS: Record<string, string> = {
  reversion: 'a price swinging around its mean, traded back toward it',
  pair: 'two related prices; the gap between them is traded when it widens',
  vol: 'a short-straddle payoff tent under a volatility wiggle: sells option premium, earns while prices stay calm',
  momentum: 'a rising staircase: follows a move already under way',
  event: 'a dated event line, then the drift that follows it',
  systematic: 'rules-based, no clearer style word in the record',
}
const glyphTitle = computed(() => `Style glyph: ${m.value.style.label} — ${GLYPH_MEANS[m.value.style.key]}. Read from ${m.value.style.evidence.length ? m.value.style.evidence.join(', ') : 'nothing specific'}. Corner colour = asset class (${m.value.classLabel}).`)
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
const chips = computed(() => cardLabR2D3FlagChips(m.value.flags))
const marked = (k: CardLabR2D3Metric) => chips.value.filter(c => c.target === k)
const markTitle = (k: CardLabR2D3Metric) => marked(k).map(c => c.long).join(' · ')
const sharpeDoubt = computed(() => marked('sharpe').length > 0)

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

// ── actions + details layer ────────────────────────────────────────────
const plates = computed(() => cardLabR2D3Plates(m.value.sample, m.value.status.key))
const open = ref(false)
const closeBtn = ref<HTMLButtonElement | null>(null)
const detailsBtn = ref<HTMLButtonElement | null>(null)
function setDetailsBtn(el: unknown) { if (el) detailsBtn.value = el as HTMLButtonElement }
function openDetails() {
  open.value = true
  nextTick(() => closeBtn.value?.focus({ preventScroll: true })) // no page jump: the list never moves
}
function closeDetails() {
  if (!open.value) return
  open.value = false
  nextTick(() => detailsBtn.value?.focus({ preventScroll: true }))
}
function act(key: string) {
  if (key === 'details') return open.value ? closeDetails() : openDetails()
  if (key === 'copy' || key === 'edit') return emit('copy')
  if (key === 'view') return emit('view')
  if (key === 'toggle') return emit('toggle')
}
</script>

<template>
  <article
    class="d3"
    data-r2="card"
    :class="[`risk-${m.risk.key}`, `st-${m.status.key}`, { selected, open }]"
    :style="{ '--d3-class': classTheme.color, '--d3-class-tint': classTheme.tint }"
    :aria-label="`${m.name} — strategy card`"
    @click="emit('select')"
    @keydown.esc.stop="closeDetails"
  >
    <!-- ⓪ Folded corner: the cut corner's flap folds back over a pocket that holds the style glyph -->
    <div class="corner" data-r2="corner-icon" role="img" :title="glyphTitle" :aria-label="glyphTitle">
      <svg viewBox="0 0 40 40" aria-hidden="true">
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
      <span class="fold" aria-hidden="true" />
    </div>

    <!-- ① Identity: centred title, then class line and state line, centred -->
    <!-- three equal columns (badges · title · under the corner): the title's centre IS the card's centre -->
    <header class="head">
      <span class="badges">
        <UISourceChip v-if="m.sample" class="chip" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
        <span class="price" :class="{ prem: m.premium }" :title="m.premium ? 'Premium: paid access' : 'Free: not premium, price $0'">{{ priceLabel }}</span>
      </span>
      <h3 class="name" data-r2="title" :title="m.name">{{ m.name }}</h3>
      <span aria-hidden="true" />
    </header>
    <p class="kind">
      <span class="style" title="Trading style, read from the strategy's own tags, indicators and name">{{ m.style.label }}</span>
      <span class="sep" aria-hidden="true">·</span>
      <span class="cls" :title="`Asset class: ${m.classLabel}`">{{ m.classLabel }}</span>
      <span v-if="m.experimental" class="exp" title="The record's own tags call this strategy experimental">⚗ Experimental</span>
    </p>
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
    </div>

    <!-- ② What it trades: filled = traded asset, outlined = indicator it reads -->
    <div v-if="m.assets.length || m.indicators.length" class="tokens">
      <span v-for="a in m.assets" :key="a" class="coin" :title="`Traded asset ${a} · ${assetClassTheme(a).label}`"><span class="coin-dot" :style="{ background: assetDot(a) }" aria-hidden="true" />{{ a }}</span>
      <span v-if="m.assets.length && m.indicators.length" class="vsep" aria-hidden="true" />
      <span v-for="i in m.indicators" :key="`i-${i}`" class="ind" :title="`Indicator read by the rules: ${i}`">{{ i }}</span>
    </div>

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

    <!-- ④ Proof: one period line for every figure below, return vs DD on one fixed axis, aligned 4×2 grid, checks strip -->
    <section class="proof">
      <p class="period" :class="{ unknown: !m.window.known }" :title="m.window.known ? 'backtest_period of the record: every figure below covers it' : 'The record has no backtest window: every figure below covers its whole history; dates not published.'">
        <template v-if="!m.hasRecord">○ no trades recorded yet</template>
        <template v-else-if="m.window.known">Backtest {{ fmtDate(m.window.start) }} → {{ fmtDate(m.window.end) }} · {{ m.window.months }} mo</template>
        <template v-else>Whole record · ○ window not published<template v-if="m.impliedMonths != null"> · <span class="nowrap" title="Record length implied by its own total vs annual return (12·ln(1+total)/ln(1+annual)), if both figures are right">about {{ Math.max(1, Math.round(m.impliedMonths)) }} mo implied</span></template></template>
      </p>
      <div class="bal-row">
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
            <span v-if="marked('win').length" class="mk" :title="markTitle('win')">⚠</span>
          </span>
          <span v-if="m.win?.wins != null" class="sub"><span class="up">{{ m.win.wins }} W</span> · <span class="down">{{ m.win.losses }} L</span></span>
        </div>
        <div class="cell" :title="`Sharpe ratio, band −1 … 3: below 0 losing · 0–1 weak · 1–2 good · 2+ strong. This one: ${fmtNumber(m.sharpeValue)}, ${m.sharpe.label}`">
          <span class="lbl">Sharpe</span>
          <span class="val-row"><b class="val">{{ fmtNumber(m.sharpeValue) }}</b><span v-if="marked('sharpe').length" class="mk" :title="markTitle('sharpe')">⚠</span></span>
          <span v-if="m.sharpe.key !== 'none'" class="verdict" :class="sharpeDoubt ? 'sq-doubt' : `sq-${m.sharpe.key}`" :title="sharpeDoubt ? `Verdict on the stated Sharpe only — the record's own figures disagree (${marked('sharpe')[0].text})` : undefined">{{ m.sharpe.label }}{{ sharpeDoubt ? '?' : '' }}</span>
          <span class="band" aria-hidden="true">
            <span class="seg losing" :class="{ on: m.sharpe.key === 'losing' }" /><span class="seg weak" :class="{ on: m.sharpe.key === 'weak' }" /><span class="seg good" :class="{ on: m.sharpe.key === 'good' }" /><span class="seg strong" :class="{ on: m.sharpe.key === 'strong' }" />
            <span v-if="m.sharpe.pos != null" class="pin" :style="{ left: `${m.sharpe.pos * 100}%` }" />
          </span>
        </div>
        <div class="cell" title="Number of trades in the record (fewer than 30 = thin sample)">
          <span class="lbl">Trades</span>
          <span class="val-row"><b class="val">{{ fmtCount(m.trades) }}</b><span v-if="marked('trades').length" class="mk" :title="markTitle('trades')">⚠</span></span>
        </div>
        <div class="cell" :title="`Average time a trade stays open (average_trade_duration): ${m.holdRaw ?? 'not recorded'} · ${m.holdBucket}`">
          <span class="lbl">Avg hold</span>
          <span class="val-row"><b class="val">{{ m.holdRaw ?? '—' }}</b></span>
          <span v-if="m.holdRaw" class="verdict">{{ m.holdBucket }}</span>
        </div>
        <div class="cell" title="Annual return: annualised return (performance_metrics.annual_return), % per year">
          <span class="lbl">Annual /yr</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.annual)">{{ fmtPctFromPercent(m.perf.annual, { signed: true }) }}</b><span v-if="marked('annual').length" class="mk" :title="markTitle('annual')">⚠</span></span>
        </div>
        <div class="cell" title="Volatility: annualised standard deviation of returns, % per year">
          <span class="lbl">Vol /yr</span>
          <span class="val-row"><b class="val sm">{{ fmtPctFromPercent(m.perf.vol) }}</b></span>
        </div>
        <div class="cell" title="Beta: sensitivity to its market (1 = moves with it)">
          <span class="lbl">Beta</span>
          <span class="val-row"><b class="val sm">{{ fmtNumber(m.perf.beta) }}</b><span v-if="marked('beta').length" class="mk" :title="markTitle('beta')">⚠</span></span>
        </div>
        <div class="cell" title="Alpha: return not explained by the market, as stored in the record (unit not specified)">
          <span class="lbl">Alpha</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.alpha)">{{ fmtSignedNumber(m.perf.alpha) }}</b></span>
        </div>
      </div>
      <ul v-if="chips.length" class="checks" aria-label="The record contradicts itself here">
        <li v-for="c in chips" :key="c.key" class="fl" :title="c.long">⚠ {{ c.text }}</li>
      </ul>
    </section>

    <!-- elastic zone: the fixed card height is taken up here (a never-run strategy says so in words, no fake figures) -->
    <div class="fill">
      <p v-if="!m.hasRecord" class="empty" title="No trade recorded: every figure above stays “—” until the strategy runs">
        <b>Never run</b> — no return, drawdown or trade figures yet.<template v-if="!m.sample"> Start it to build a record.</template>
      </p>
    </div>

    <!-- ⑤ Crowd + provenance: one line, real counts -->
    <p class="who">
      <span :title="m.followers == null ? 'Followers not recorded' : 'followers_count'"><b class="big">{{ fmtCount(m.followers) }}</b> {{ plural(m.followers, 'follower') }}</span>
      <span title="Creator of the strategy">by <b>{{ creatorLabel }}</b></span>
      <span v-if="m.agentId || full" :title="m.agentId ? `Agent running it: ${m.agentId}` : 'No agent attached in the record'">agent <b>{{ agentName ?? 'none' }}</b></span>
      <!-- The store fills a missing last_run with "now": with no trade recorded the strategy never ran, so say that. -->
      <span v-if="full && (m.trades ?? 0) > 0" title="last_run: last time the strategy ran">last run <b>{{ fmtDate(m.lastRun) }}</b></span>
      <span v-else-if="full" title="No trade recorded: the strategy has not run yet">never run</span>
    </p>

    <!-- ⑥ Details: a layer INSIDE the card (slide-up sheet). The card keeps its size; Esc or ✕ closes. -->
    <section v-if="open" :id="panelId" class="sheet" data-r2="details" role="dialog" :aria-label="`Details of ${m.name}`" @click.stop>
        <header class="sh-head">
          <span class="sh-k">Details</span>
          <span class="sh-name">{{ m.name }}</span>
          <button ref="closeBtn" type="button" class="sh-close" aria-label="Close details" title="Close details (Esc)" @click="closeDetails">✕</button>
        </header>
        <div class="sh-body">
          <p v-if="m.description" class="sh-desc">“{{ m.description }}”</p>
          <p class="sh-row">
            <span class="leg-k">Entry</span>
            <span v-if="m.rule.entry.length">{{ m.rule.entry.map(l => `${l.action}${l.condition ? ` ${l.keyword} ${l.condition}` : ''}`).join('; ') }}{{ trigger && m.rule.pair ? ` (${trigger.keyword} ${trigger.text})` : '' }}</span>
            <span v-else>not described</span>
          </p>
          <p class="sh-row">
            <span class="leg-k">Exit</span>
            <span v-if="m.rule.exit">{{ m.rule.exit.action }}{{ m.rule.exit.condition ? ` ${m.rule.exit.keyword} ${m.rule.exit.condition}` : '' }}</span>
            <span v-else>not stated — only the average hold ({{ m.holdRaw ?? 'not recorded' }}) is known</span>
          </p>
          <template v-if="chips.length">
            <p class="sh-k">Checks</p>
            <ul class="sh-checks">
              <li v-for="c in chips" :key="`l-${c.key}`">⚠ {{ c.long }}</li>
            </ul>
          </template>
          <p v-if="m.tags.length" class="tags" title="Tags"><span v-for="t in m.tags" :key="t">#{{ t }}</span></p>
          <p class="kv">
            <span title="created_at">created <b>{{ fmtDate(m.created) }}</b></span>
            <span title="likes_count"><b>{{ fmtCount(m.likes) }}</b> {{ plural(m.likes, 'like') }}</span>
            <span title="comments_count"><b>{{ fmtCount(m.comments) }}</b> {{ plural(m.comments, 'comment') }}</span>
            <span title="is_public">{{ m.isPublic == null ? 'visibility —' : m.isPublic ? 'Public' : 'Private' }}</span>
            <span title="price (premium strategies only)">price <b>{{ fmtMoney(m.price ?? (m.premium ? null : 0), { decimals: 0 }) }}</b></span>
            <span v-if="m.agentId" title="agent_id">agent id <b>{{ m.agentId }}</b></span>
          </p>
        </div>
    </section>

    <!-- ⑦ Actions: carbon-weave plates with an accent edge, one row, same height on every card -->
    <div class="actions" data-r2="actions" :class="`n${plates.length}`" @click.stop>
      <template v-for="p in plates" :key="p.key">
        <ChatShareTo
          v-if="p.key === 'share'" class="plate-wrap" :style="{ '--d3-acc': `var(${p.accent})` }" button-class="plate p-share"
          :item="{ kind: 'strategy', id: String(m.id || 'draft'), title: m.name, url: `/strategy/${m.id}` }"
        />
        <button
          v-else-if="p.key === 'details'" :ref="setDetailsBtn" type="button" class="plate p-details" :style="{ '--d3-acc': `var(${p.accent})` }"
          :aria-expanded="open" :aria-controls="panelId" :title="p.title" @click="act(p.key)"
        >{{ open ? 'Details ▴' : 'Details ▾' }}</button>
        <button
          v-else type="button" class="plate" :class="[`p-${p.key}`, p.key === 'toggle' ? `run-${m.status.key}` : '']" :style="{ '--d3-acc': `var(${p.accent})` }"
          :title="p.title" @click="act(p.key)"
        >{{ p.label }}</button>
      </template>
    </div>
  </article>
</template>

<style scoped>
/* ── shell: fixed box from the list, folded top-right corner ─────────────────────────────── */
.d3 {
  --d3-risk: var(--border-secondary);
  --d3-risk-w: 2px;
  --d3-pad: 14px;
  --d3-t: var(--d3-tile, 62px);
  --d3-fold: calc(var(--d3-t) * 0.36);
  --d3-act-h: 32px;
  position: relative; display: flex; flex-direction: column; gap: 6px; box-sizing: border-box;
  width: 100%; height: var(--d3-h, auto); min-height: var(--d3-h, 0); max-height: var(--d3-h, none);
  min-width: var(--d3-minw, 0); max-width: var(--d3-maxw, none); margin-inline: auto;
  padding: 10px var(--d3-pad) 12px;
  background-color: var(--bg-tertiary); color: var(--text-white);
  background-image: linear-gradient(180deg, var(--edge-soft) 0, transparent 120px);
  border: 1px solid var(--border-primary); border-radius: var(--radius-md);
  clip-path: polygon(0 0, calc(100% - var(--d3-fold)) 0, 100% var(--d3-fold), 100% 100%, 0 100%);
  font-size: 12px; line-height: 1.35; overflow: hidden; container-type: inline-size; cursor: default;
}
.d3.selected { border-color: var(--primary-green); box-shadow: inset 0 0 0 1px var(--primary-green); }
/* Risk = weight of the left edge: low thin blue · medium orange · high thick red (inside the padding: centring intact). */
.d3::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--d3-risk-w); background: var(--d3-risk); }
.risk-low { --d3-risk: var(--primary-blue); --d3-risk-w: 3px; }
.risk-medium { --d3-risk: var(--warning-orange); --d3-risk-w: 6px; }
.risk-high { --d3-risk: var(--error-red); --d3-risk-w: 9px; }
.st-stopped .corner svg, .st-stopped .track, .st-stopped .ring { filter: saturate(0.5); }
.up { color: var(--app-color-up); }
.down { color: var(--app-color-down); }
b { font-weight: 700; }

/* ⓪ corner pocket + folded flap */
.corner {
  position: absolute; top: 0; right: 0; z-index: 1; width: var(--d3-t); height: var(--d3-t); box-sizing: border-box;
  display: grid; place-items: center; color: var(--d3-class);
  background-color: var(--bg-tertiary);
  background-image: linear-gradient(225deg, var(--d3-class-tint) 0, var(--d3-class-tint) 100%);
  /* ONE sharp corner — the top-right, under the fold; the pocket's three inner corners are round */
  border-left: 1.5px solid var(--d3-class); border-bottom: 1.5px solid var(--d3-class); border-radius: 0 0 6px 18px;
  border-top-left-radius: 6px;
}
.corner svg { width: 60%; height: 60%; overflow: visible; transform: translate(-9%, 9%); }
.st-active .corner { box-shadow: inset 0 0 0 3px var(--d3-class-tint); }
.fold {
  position: absolute; top: 0; right: 0; width: var(--d3-fold); height: var(--d3-fold);
  /* the folded-back flap = the card's underside: brushed light metal tinted by the class, lit on the crease */
  background:
    linear-gradient(to bottom left, transparent calc(50% - 0.5px), rgba(255, 255, 255, 0.85) calc(50% - 0.5px), rgba(255, 255, 255, 0.85) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    linear-gradient(to bottom left, transparent 50%, color-mix(in srgb, var(--d3-class) 30%, var(--text-light-gray)) 50%, color-mix(in srgb, var(--d3-class) 45%, var(--border-secondary)) 100%);
  border-bottom-left-radius: 4px; filter: drop-shadow(-3px 3px 3px rgba(0, 0, 0, 0.65));
}
.g-line { fill: none; stroke: var(--text-white); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.g-line.alt { stroke: var(--d3-class); }
.g-mean { fill: none; stroke: var(--d3-class); stroke-width: 1.4; stroke-dasharray: 2.5 2.5; }
.g-acc { fill: none; stroke: var(--d3-class); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.g-acc-fill { fill: var(--d3-class); }

/* ① head: the title band is as tall as the corner pocket, with equal side margins → centred on the card */
.head {
  --d3-side: max(56px, calc(var(--d3-t) - var(--d3-pad) + 4px));
  flex: 0 0 auto; box-sizing: border-box; height: calc(var(--d3-t) - 10px);
  display: grid; grid-template-columns: var(--d3-side) minmax(0, 1fr) var(--d3-side); align-items: center; column-gap: 0;
  text-align: center;
}
.badges { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; align-self: start; padding-top: 2px; }
.badges .chip :deep(.chip) { letter-spacing: 0.03em; padding: 1px 5px; }
.name {
  /* line-height ≥ Poppins' ascent+descent (1.4 em): a lower one makes scrollHeight > clientHeight, i.e. a false "cut" */
  margin: 0; font-size: 16px; font-weight: 800; line-height: 1.4; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.chip :deep(.chip) { font-size: 10px; }
.kind { margin: -2px 0 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 5px; font-size: 12px; font-weight: 700; }
.kind .sep { color: var(--text-light-gray); }
.kind .cls { color: var(--d3-class); }
.price { font-size: 11px; line-height: 1.3; padding: 0 6px; border: 1px solid var(--text-light-gray); border-radius: 999px; color: var(--text-light-gray); }
.price.prem { color: var(--warning-orange); border-color: var(--warning-orange); }
.state { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; align-items: center; font-size: 11px; font-weight: 700; }
.state > span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.st-ico { width: 12px; height: 12px; fill: currentColor; }
.status {
  color: var(--secondary-darker); background-color: var(--text-light-gray); padding: 1px 8px 1px 6px;
  border-radius: 999px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
}
.st-active .status { background-color: var(--status-active); }
.st-paused .status { background-color: var(--status-paused); }
.st-stopped .status { background-color: var(--status-stopped); }
.st-backtesting .status { background-color: var(--primary-blue); }
.st-active .st-ico { animation: d3-live 2.4s ease-in-out infinite; }
@keyframes d3-live { 50% { opacity: 0.45; } }
.auto { color: var(--text-light-gray); }
.au-ico { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.auto-semi .au-ico { stroke-dasharray: 1.6 1.4; }
.risk { color: var(--d3-risk); }
.risk-none .risk { color: var(--text-light-gray); }
.rk-ico { width: 15px; height: 12px; }
.rk-ico rect { fill: var(--border-secondary); }
.rk-ico rect.on { fill: currentColor; }
.exp { padding: 0 6px; border: 1px dashed var(--warning-orange); border-radius: 999px; color: var(--warning-orange); }

/* ② tokens */
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

/* ③ rule */
.rule { display: flex; flex-direction: column; gap: 5px; padding: 6px 0 0; border-top: 1px solid var(--border-primary); }
.desc { margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-light-gray); }
.desc.cond { color: var(--text-white); font-family: var(--font-market-data); }
.k, .leg-k { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-light-gray); }
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

/* ④ proof */
.proof { display: flex; flex-direction: column; gap: 4px; padding-top: 6px; border-top: 1px solid var(--border-primary); }
.period { margin: 0; font-size: 10px; font-weight: 700; color: var(--text-light-gray); text-transform: uppercase; letter-spacing: 0.03em; }
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

.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 10px; margin-top: 2px; }
.cell { position: relative; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-light-gray); white-space: nowrap; }
.val-row { display: flex; align-items: center; gap: 4px; min-width: 0; white-space: nowrap; }
.val { font-family: var(--font-market-data); font-size: 15px; font-weight: 800; line-height: 1.25; font-variant-numeric: tabular-nums; }
.val.sm { font-size: 13px; }
.verdict { font-size: 11px; font-weight: 700; color: var(--text-light-gray); white-space: nowrap; }
.sq-doubt { color: var(--text-light-gray); }
.sub { font-size: 11px; font-family: var(--font-market-data); white-space: nowrap; }
.mk { font-size: 12px; font-weight: 800; color: var(--warning-orange); cursor: help; }
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
/* checks strip: one boxed chip per contradiction, led by the metric it qualifies (the cell carries the ⚠) */
.checks { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3px 5px; }
.fl { padding: 0 5px; border: 1px solid var(--warning-orange); border-radius: 4px; font-size: 11px; font-family: var(--font-market-data); font-weight: 700; line-height: 1.35; color: var(--warning-orange); cursor: help; }

.fill { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; }
.empty {
  margin: 0; max-width: 34ch; padding: 8px 12px; text-align: center; font-size: 12px; line-height: 1.45; color: var(--text-light-gray);
  border: 1px dashed var(--border-secondary); border-radius: var(--radius-md);
}
.empty b { color: var(--text-white); }

/* ⑤ who */
.who { margin: 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 2px 8px; padding-top: 6px; border-top: 1px solid var(--border-primary); font-size: 11px; color: var(--text-light-gray); }
.who > span { white-space: nowrap; }
.who > span + span::before { content: '· '; color: var(--text-gray); }
.who b { color: var(--text-white); }
.who b.big { font-size: 13px; font-family: var(--font-market-data); }
.nowrap { white-space: nowrap; }

/* ⑥ details layer: slides up over the card body, above the action row; never changes the card's box */
.sheet {
  position: absolute; z-index: 3; left: 0; right: 0; top: 0; bottom: calc(var(--d3-act-h) + 12px);
  display: flex; flex-direction: column; box-sizing: border-box;
  background: var(--surface-overlay); background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--edge-lit); box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
}
.sh-head { display: flex; align-items: center; gap: 8px; padding: 10px calc(var(--d3-fold) + 4px) 8px var(--d3-pad); border-bottom: 1px solid var(--border-secondary); }
.sh-k { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-light-gray); }
.sh-name { flex: 1; min-width: 0; font-weight: 800; font-size: 13px; overflow-wrap: anywhere; }
.sh-close {
  flex: 0 0 auto; width: 28px; height: 28px; border-radius: var(--radius-sm); cursor: pointer; font: inherit; font-size: 14px; font-weight: 800;
  color: var(--text-white); background: var(--bg-secondary); border: 1px solid var(--border-secondary);
}
.sh-close:hover { background: var(--border-primary); }
.sh-close:focus-visible { outline: 2px solid var(--primary-green); outline-offset: 2px; }
.sh-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px var(--d3-pad) 10px; display: flex; flex-direction: column; gap: 6px; }
.sh-desc { margin: 0; font-size: 12px; line-height: 1.45; color: var(--text-white); }
.sh-row { margin: 0; display: flex; gap: 6px; font-size: 12px; color: var(--text-light-gray); }
.sh-row .leg-k { flex: 0 0 40px; padding-top: 2px; }
.sh-checks { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--warning-orange); }
.tags { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 11px; color: var(--text-light-gray); }
.kv { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; color: var(--text-light-gray); }
.kv b { color: var(--text-white); }
/* No <Transition> and no transform/opacity animation: in a throttled (background) tab those stall half-way and leave the
   layer translucent or offset. Only the lift shadow animates; the layer itself is in place and opaque at once. */
.sheet { animation: d3-sheet-lift 0.25s ease-out; }
@keyframes d3-sheet-lift { from { box-shadow: 0 0 0 rgba(0, 0, 0, 0); } }

/* ⑦ actions: carbon-weave plates (twill of crossed gradients on gunmetal) + an accent edge on top */
.actions { position: relative; z-index: 4; flex: 0 0 var(--d3-act-h); height: var(--d3-act-h); display: flex; gap: 5px; align-items: stretch; }
.actions > * { flex: 1 1 0; min-width: 0; }
.actions > .p-copy, .actions > .p-edit { flex-grow: 1.6; }
.actions :deep(.plate-wrap) { display: flex; }
.actions :deep(.plate) {
  --d3-acc-base: var(--text-light-gray);
  position: relative; box-sizing: border-box; width: 100%; min-width: 0; height: 100%; margin: 0; padding: 2px 6px 0;
  display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; text-decoration: none;
  font: inherit; font-family: var(--font-chrome); font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
  color: var(--text-white); cursor: pointer; border-radius: 3px 3px var(--radius-sm) var(--radius-sm);
  border: 1px solid var(--secondary-darker); border-top: 2px solid var(--d3-acc, var(--d3-acc-base));
  background-color: var(--bg-tertiary);
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0, rgba(255, 255, 255, 0) 45%, rgba(0, 0, 0, 0.28) 100%),
    linear-gradient(27deg, rgba(0, 0, 0, 0.45) 3px, transparent 3px),
    linear-gradient(207deg, rgba(0, 0, 0, 0.45) 3px, transparent 3px),
    linear-gradient(27deg, rgba(255, 255, 255, 0.07) 3px, transparent 3px),
    linear-gradient(207deg, rgba(255, 255, 255, 0.07) 3px, transparent 3px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.12) 6px, transparent 6px),
    linear-gradient(rgba(255, 255, 255, 0.01) 25%, rgba(0, 0, 0, 0.18) 25%, rgba(0, 0, 0, 0.18) 50%, transparent 50%, transparent 75%, rgba(255, 255, 255, 0.08) 75%, rgba(255, 255, 255, 0.08)),
    linear-gradient(rgba(42, 46, 57, 0.45), rgba(42, 46, 57, 0.45));
  background-size: 100% 100%, 12px 12px, 12px 12px, 12px 12px, 12px 12px, 12px 12px, 12px 12px, 100% 100%;
  background-position: 0 0, 0 3px, 6px 0, 0 6px, 6px 3px, 0 0, 0 0, 0 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 1px 2px rgba(0, 0, 0, 0.6);
  transition: border-color 0.12s, box-shadow 0.12s, transform 0.08s;
}
.actions :deep(.plate:hover) { filter: brightness(1.25); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 3px 0 -1px var(--d3-acc), 0 2px 6px rgba(0, 0, 0, 0.6); }
.actions :deep(.plate:active) { transform: translateY(1px); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.7); }
.actions :deep(.plate:focus-visible) { outline: 2px solid var(--d3-acc); outline-offset: 2px; }
.actions .p-copy, .actions .p-edit { color: var(--primary-green); }
.actions .p-details[aria-expanded='true'] { color: var(--text-white); border-top-color: var(--text-white); }

/* narrow cards (phone, 280–400 px): tighter grid, smaller hero, 5 plates still in one row */
@container (max-width: 400px) {
  .grid { gap: 6px 6px; }
  .val { font-size: 14px; }
  .val.sm { font-size: 12px; }
  .ring { width: 16px; height: 16px; flex-basis: 16px; }
  .val-row { gap: 3px; }
  .lbl { letter-spacing: 0.02em; }
  .end .v.hero { font-size: 19px; }
  .actions { gap: 4px; }
  .actions :deep(.plate) { padding-inline: 3px; font-size: 11px; letter-spacing: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .st-active .st-ico { animation: none; }
  .sheet { animation: none; }
}
</style>
