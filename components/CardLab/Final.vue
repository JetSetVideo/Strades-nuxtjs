<script setup lang="ts">
/**
 * Card lab — FINAL strategy card (swarm 2026-11-02 "cards", lane combine). Production-ready: same props/emits as
 * components/Card/Strategy.vue (`strategy`, `selected?` · select, copy, share, view, toggle, delete) plus optional
 * `full` (canonical record) and `code` (strategyToCodeView) that the lab bench — and later the store — pass in.
 * Works with `strategy` alone (Carousel rows): a missing field prints "—" / "not recorded", never a default.
 *
 * Glance layer (always visible), best element of each design:
 *   B  style glyph on the asset-class tile · status pill (shape + word) · gear automation · risk bars + left-edge weight ·
 *      return vs max DD on ONE ±25 % axis (thin) · W/L ring from the counts (muted) · Sharpe verdict word + thin band ·
 *      boxed warning chips
 *   A  filled asset pills / outlined indicator pills · aligned caption-less 4×2 grid (also at 340 px) incl. annual/vol/β/α ·
 *      hold as a text token · compactness
 *   C  description verbatim + ENTRY ▲▼ / EXIT ("○ not stated") side badges · one period line over every figure (backtest
 *      window, or "window not published" + months implied by total vs annual) · honesty flags in words next to their number
 * Details toggle (progressive disclosure): tags, created, likes, comments, visibility, price, agent id.
 * Maths: utils/cardLabFinal.ts. Swarm decisions: Strades-comms/cards-2026-11-02/boards/board-combine.md.
 */
import { computed, onMounted, ref, useId } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { assetClassTheme } from '~/utils/assetClass'
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney, fmtSignedNumber } from '~/utils/format'
import { cardLabFinalModel, cardLabFinalObject } from '~/utils/cardLabFinal'
import type { CardLabCClause } from '~/utils/cardLabC'

const props = defineProps<{
  strategy: Record<string, any>
  full?: Record<string, any> | null
  code?: Record<string, any> | null
  selected?: boolean
}>()
const emit = defineEmits<{ select: []; copy: []; share: []; view: []; toggle: []; delete: [] }>()

const m = computed(() => cardLabFinalModel(props.strategy, props.full, props.code))
const open = ref(false)
const panelId = `clf-more-${useId()}`

// ── identity ────────────────────────────────────────────────────────────
const { userId } = useCurrentUser()
const creatorLabel = computed(() => (m.value.creator === userId.value || m.value.creator === 'current_user' ? 'you' : m.value.creator))
const classTheme = computed(() => assetClassTheme(m.value.category || m.value.assets[0] || ''))
const GLYPH_MEANS: Record<string, string> = {
  reversion: 'a price swinging around its mean, traded back toward it',
  pair: 'two related prices; the gap between them is traded when it widens',
  vol: 'a short-straddle payoff tent under a volatility wiggle: sells option premium, earns while prices stay calm',
  momentum: 'a rising staircase: follows a move already under way',
  event: 'a dated event line, then the drift that follows it',
  systematic: 'rules-based, no clearer style word in the record',
}
const glyphTitle = computed(() => `Style glyph: ${m.value.style.label} — ${GLYPH_MEANS[m.value.style.key]}. Read from ${m.value.style.evidence.length ? m.value.style.evidence.join(', ') : 'nothing specific'}. Tile colour = asset class (${m.value.classLabel}).`)
const ASSET_VAR: Record<string, string> = { BTC: '--asset-btc', ETH: '--asset-eth', SOL: '--asset-sol', TSLA: '--asset-tsla' }
const assetDot = (a: string) => (ASSET_VAR[a] ? `var(${ASSET_VAR[a]})` : assetClassTheme(a).color)
const priceLabel = computed(() => (m.value.premium ? (m.value.price ? `Premium ${fmtMoney(m.value.price, { decimals: 0 })}` : 'Premium') : 'Free'))

// ── rule (C) ────────────────────────────────────────────────────────────
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
  return `Return vs drawdown on one axis, the same on every card (half-width ${b.scale}%): solid bar = total return ${fmtPctFromPercent(m.value.ret, { signed: true })} (right = gain, left = loss); hatched bar = max drawdown ${fmtPctFromPercent(m.value.dd == null ? null : -Math.abs(m.value.dd))}, always left.`
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
  if (m.value.sample && (a.kind === 'personal' || /^your\b/i.test(a.name ?? ''))) return id // the creator's own avatar: its id is the honest name
  return a.name ?? id
})
const runLabel = computed(() => (m.value.status.key === 'active' ? 'Pause' : m.value.status.key === 'paused' ? 'Resume' : 'Start'))
const plural = (n: number | null, w: string) => `${w}${n === 1 ? '' : 's'}`
const flag = (k: string) => m.value.flags.find(f => f.key === k)
const sharpeFlag = computed(() => flag('sharpe-sign') ?? flag('sharpe-gap'))
</script>

<template>
  <article
    class="clf"
    :class="[`risk-${m.risk.key}`, `st-${m.status.key}`, { selected, open }]"
    :style="{ '--clf-class': classTheme.color, '--clf-class-tint': classTheme.tint }"
    :aria-label="`${m.name} — strategy card`"
    @click="emit('select')"
  >
    <!-- ① Identity (B): glyph tile · name · style · class · status · automation · risk · price -->
    <header class="head">
      <div class="glyph" :title="glyphTitle">
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
      </div>
      <div class="id">
        <div class="name-row">
          <h3 class="name">{{ m.name }}</h3>
          <UISourceChip v-if="m.sample" class="chip" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
        </div>
        <p class="kind">
          <span class="style" title="Trading style, read from the strategy's own tags, indicators and name">{{ m.style.label }}</span>
          <span class="sep" aria-hidden="true">·</span>
          <span class="cls" :title="`Asset class: ${m.classLabel}`">{{ m.classLabel }}</span>
          <span class="price" :class="{ prem: m.premium }" :title="m.premium ? 'Premium: paid access' : 'Free: not premium, price $0'">{{ priceLabel }}</span>
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
          <span v-if="m.experimental" class="exp" title="The record's own tags call this strategy experimental">⚗ Experimental</span>
        </div>
      </div>
    </header>

    <!-- ② What it trades (A): filled = traded asset, outlined = indicator it reads -->
    <div v-if="m.assets.length || m.indicators.length" class="tokens">
      <span v-for="a in m.assets" :key="a" class="coin" :title="`Traded asset ${a} · ${assetClassTheme(a).label}`"><span class="coin-dot" :style="{ background: assetDot(a) }" aria-hidden="true" />{{ a }}</span>
      <span v-if="m.assets.length && m.indicators.length" class="vsep" aria-hidden="true" />
      <span v-for="i in m.indicators" :key="`i-${i}`" class="ind" :title="`Indicator read by the rules: ${i}`">{{ i }}</span>
    </div>

    <!-- ③ Rule (C + A): the creator's sentence verbatim, then its legs as side badges -->
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

    <!-- ④ Proof: one period line for every figure below (C), return vs DD on one fixed axis (B + A), aligned grid (A) -->
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
          </span>
          <span v-if="m.win?.wins != null" class="sub"><span class="up">{{ m.win.wins }} W</span> · <span class="down">{{ m.win.losses }} L</span></span>
          <span v-if="flag('win')" class="fl" :title="flag('win')!.long">⚠ {{ flag('win')!.short }}</span>
          <span v-if="flag('win-loss')" class="fl" :title="flag('win-loss')!.long">⚠ {{ flag('win-loss')!.short }}</span>
        </div>
        <div class="cell" :title="`Sharpe ratio, band −1 … 3: below 0 losing · 0–1 weak · 1–2 good · 2+ strong. This one: ${fmtNumber(m.sharpeValue)}, ${m.sharpe.label}`">
          <span class="lbl">Sharpe</span>
          <span class="val-row wrap"><b class="val">{{ fmtNumber(m.sharpeValue) }}</b> <span v-if="m.sharpe.key !== 'none'" class="verdict" :class="sharpeFlag ? 'sq-doubt' : `sq-${m.sharpe.key}`" :title="sharpeFlag ? `Verdict on the stated Sharpe only — the record's own figures disagree (${sharpeFlag.short})` : undefined">{{ m.sharpe.label }}{{ sharpeFlag ? '?' : '' }}</span></span>
          <span class="band" aria-hidden="true">
            <span class="seg losing" :class="{ on: m.sharpe.key === 'losing' }" /><span class="seg weak" :class="{ on: m.sharpe.key === 'weak' }" /><span class="seg good" :class="{ on: m.sharpe.key === 'good' }" /><span class="seg strong" :class="{ on: m.sharpe.key === 'strong' }" />
            <span v-if="m.sharpe.pos != null" class="pin" :style="{ left: `${m.sharpe.pos * 100}%` }" />
          </span>
          <span v-if="sharpeFlag" class="fl" :title="sharpeFlag.long">⚠ {{ sharpeFlag.short }}</span>
        </div>
        <div class="cell" title="Number of trades in the record (fewer than 30 = thin sample)">
          <span class="lbl">Trades</span>
          <span class="val-row"><b class="val">{{ fmtCount(m.trades) }}</b></span>
          <span v-if="flag('sample')" class="fl" :title="flag('sample')!.long">⚠ {{ flag('sample')!.short }}</span>
        </div>
        <div class="cell" :title="`Average time a trade stays open (average_trade_duration): ${m.holdRaw ?? 'not recorded'} · ${m.holdBucket}`">
          <span class="lbl">Avg hold</span>
          <span class="val-row wrap"><b class="val">{{ m.holdRaw ?? '—' }}</b> <span v-if="m.holdRaw" class="verdict">{{ m.holdBucket }}</span></span>
        </div>
        <div class="cell" title="Annual return: annualised return (performance_metrics.annual_return), % per year">
          <span class="lbl">Annual /yr</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.annual)">{{ fmtPctFromPercent(m.perf.annual, { signed: true }) }}</b></span>
          <span v-if="flag('annual')" class="fl" :title="flag('annual')!.long">⚠ {{ flag('annual')!.short }}</span>
        </div>
        <div class="cell" title="Volatility: annualised standard deviation of returns, % per year">
          <span class="lbl">Vol /yr</span>
          <span class="val-row"><b class="val sm">{{ fmtPctFromPercent(m.perf.vol) }}</b></span>
        </div>
        <div class="cell" title="Beta: sensitivity to its market (1 = moves with it)">
          <span class="lbl">Beta</span>
          <span class="val-row"><b class="val sm">{{ fmtNumber(m.perf.beta) }}</b></span>
          <span v-if="flag('beta-pair')" class="fl" :title="flag('beta-pair')!.long">⚠ {{ flag('beta-pair')!.short }}</span>
        </div>
        <div class="cell" title="Alpha: return not explained by the market, as stored in the record (unit not specified)">
          <span class="lbl">Alpha</span>
          <span class="val-row"><b class="val sm" :class="tone(m.perf.alpha)">{{ fmtSignedNumber(m.perf.alpha) }}</b></span>
        </div>
      </div>
    </section>

    <!-- ⑤ Crowd + provenance: one line, real counts -->
    <p class="who">
      <span :title="m.followers == null ? 'Followers not recorded' : 'followers_count'"><b class="big">{{ fmtCount(m.followers) }}</b> {{ plural(m.followers, 'follower') }}</span>
      <span title="Creator of the strategy">by <b>{{ creatorLabel }}</b></span>
      <span v-if="m.agentId || full" :title="m.agentId ? `Agent running it: ${m.agentId}` : 'No agent attached in the record'">agent <b>{{ agentName ?? 'none' }}</b></span>
      <!-- The store fills a missing last_run with "now": with no trade recorded the strategy never ran, so say that. -->
      <span v-if="full && (m.trades ?? 0) > 0" title="last_run: last time the strategy ran">last run <b>{{ fmtDate(m.lastRun) }}</b></span>
      <span v-else-if="full" title="No trade recorded: the strategy has not run yet">never run</span>
    </p>

    <!-- ⑥ Details: the long tail, one click away -->
    <div v-if="open" :id="panelId" class="more" role="region" :aria-label="`More about ${m.name}`">
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

    <div class="actions" @click.stop>
      <button type="button" class="btn primary" @click="emit('copy')">{{ m.sample ? '⧉ Use as template' : '✎ Edit' }}</button>
      <button type="button" class="btn" @click="emit('view')">→ View</button>
      <button v-if="!m.sample" type="button" class="btn" :class="`run-${m.status.key}`" @click="emit('toggle')">{{ runLabel }}</button>
      <ChatShareTo v-if="m.id && !m.sample" :item="{ kind: 'strategy', id: String(m.id), title: m.name, url: `/strategy/${m.id}` }" />
      <button
        type="button" class="btn more-btn" :aria-expanded="open" :aria-controls="panelId"
        title="Tags, creation date, likes, comments, visibility, price, agent id"
        @click="open = !open"
      >{{ open ? 'Less ▴' : 'Details ▾' }}</button>
    </div>
  </article>
</template>

<style scoped>
.clf {
  --clf-risk: var(--border-secondary);
  --clf-risk-w: 2px;
  position: relative; display: flex; flex-direction: column; gap: 8px;
  padding: 11px 12px 11px calc(12px + var(--clf-risk-w));
  background-color: var(--bg-tertiary); color: var(--text-white);
  border: 1px solid var(--border-primary); border-radius: var(--radius-md);
  font-size: 12px; line-height: 1.35; min-width: 0; overflow: hidden; container-type: inline-size; cursor: default;
}
.clf.selected { border-color: var(--primary-green); box-shadow: 0 0 0 1px var(--primary-green); }
/* Risk = weight of the left edge (B): low thin blue · medium orange · high thick red. */
.clf::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--clf-risk-w); background: var(--clf-risk); }
.risk-low { --clf-risk: var(--primary-blue); --clf-risk-w: 3px; }
.risk-medium { --clf-risk: var(--warning-orange); --clf-risk-w: 6px; }
.risk-high { --clf-risk: var(--error-red); --clf-risk-w: 10px; }
.st-stopped .glyph, .st-stopped .track, .st-stopped .ring { filter: saturate(0.5); }
.up { color: var(--app-color-up); }
.down { color: var(--app-color-down); }
b { font-weight: 700; }

/* ① head */
.head { display: flex; gap: 10px; align-items: flex-start; }
.glyph {
  flex: 0 0 50px; height: 50px; border-radius: 12px; display: grid; place-items: center;
  background-color: var(--clf-class-tint); border: 1.5px solid var(--clf-class); color: var(--clf-class);
}
.glyph svg { width: 38px; height: 38px; overflow: visible; }
.g-line { fill: none; stroke: var(--text-white); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.g-line.alt { stroke: var(--clf-class); }
.g-mean { fill: none; stroke: var(--clf-class); stroke-width: 1.4; stroke-dasharray: 2.5 2.5; }
.g-acc { fill: none; stroke: var(--clf-class); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.g-acc-fill { fill: var(--clf-class); }
.st-active .glyph { box-shadow: 0 0 0 3px var(--clf-class-tint); }
.id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.name { margin: 0; flex: 1; min-width: 0; font-size: 15px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }
.chip :deep(.chip) { font-size: 10px; }
.kind { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; font-weight: 700; }
.kind .sep { color: var(--text-light-gray); }
.kind .cls { display: inline-flex; align-items: center; gap: 4px; color: var(--clf-class); }
.state { display: flex; flex-wrap: wrap; gap: 4px 9px; align-items: center; font-size: 11px; font-weight: 700; }
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
.st-active .st-ico { animation: clf-live 2.4s ease-in-out infinite; }
@keyframes clf-live { 50% { opacity: 0.45; } }
.auto { color: var(--text-light-gray); }
.au-ico { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.auto-semi .au-ico { stroke-dasharray: 1.6 1.4; }
.risk { color: var(--clf-risk); }
.risk-none .risk { color: var(--text-light-gray); }
.rk-ico { width: 15px; height: 12px; }
.rk-ico rect { fill: var(--border-secondary); }
.rk-ico rect.on { fill: currentColor; }
.exp { padding: 0 6px; border: 1px dashed var(--warning-orange); border-radius: 999px; color: var(--warning-orange); }
.price { margin-left: 4px; font-size: 11px; padding: 0 7px; align-self: center; border: 1px solid var(--text-light-gray); border-radius: 999px; color: var(--text-light-gray); }
.price.prem { color: var(--warning-orange); border-color: var(--warning-orange); }

/* ② tokens */
.tokens { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
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
.desc {
  margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-light-gray);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.desc.cond { color: var(--text-white); font-family: var(--font-market-data); }
.k, .leg-k { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-gray); }
.legs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.legs { gap: 4px 16px; }
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
/* Solid, half-opacity: a hatched bar read as a sparkline (critic-a R2-4). */
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
/* Boxed warning chip (B's .warn): words, never ≠ / ÷ glyphs, which collapse to = / + at half size (critics R1). */
.fl { align-self: flex-start; max-width: 100%; margin-top: 1px; padding: 0 4px; border: 1px solid var(--warning-orange); border-radius: 4px; font-size: 11px; font-family: var(--font-market-data); font-weight: 700; line-height: 1.3; color: var(--warning-orange); cursor: help; }
.ring { width: 22px; height: 22px; flex: 0 0 22px; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 6; }
.r-bg { stroke: var(--border-secondary); }
.r-bg.loss { stroke: var(--app-color-down); opacity: 0.45; }
/* Muted on purpose (judge W3-4): the return hero, not the win ring, is the brightest thing on the card. */
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

/* ⑤ who */
.who > span { white-space: nowrap; }
.who > span + span::before { content: '· '; color: var(--text-gray); }
.nowrap { white-space: nowrap; }
.who { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 8px; padding-top: 6px; border-top: 1px solid var(--border-primary); font-size: 11px; color: var(--text-light-gray); }
.who b { color: var(--text-white); }
.who b.big { font-size: 13px; font-family: var(--font-market-data); }

/* ⑥ details */
.more { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; border: 1px dashed var(--border-secondary); border-radius: var(--radius-sm); }
.tags { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 11px; color: var(--text-light-gray); }
.kv { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; color: var(--text-light-gray); }
.kv b { color: var(--text-white); }

/* actions */
.actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.btn {
  flex: 1 1 auto; padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700;
  border: 1px solid var(--border-secondary); background-color: #262626; color: var(--text-white); white-space: nowrap;
}
.btn.primary { border-color: var(--primary-green); color: var(--primary-green); }
.btn.more-btn { flex: 0 0 auto; color: var(--text-light-gray); }
.btn:hover { background-color: #303030; }
.btn:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }

/* Narrow card (phone, 340 px): grids go 2 × 2. */
/* Narrow card (phone, 340 px): the grid KEEPS 4 columns (critic-a R1: compact on the phone), cells tighten. */
@container (max-width: 400px) {
  .grid { gap: 8px 6px; }
  .val { font-size: 14px; }
  .val.sm { font-size: 12px; }
  .ring { width: 16px; height: 16px; flex-basis: 16px; }
  .val-row { gap: 3px; }
  .lbl { letter-spacing: 0.02em; }
  .end .v.hero { font-size: 19px; }
}
@media (prefers-reduced-motion: reduce) { .st-active .st-ico { animation: none; } }
</style>
