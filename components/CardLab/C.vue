<script setup lang="ts">
/**
 * Card lab variant C — "rule-forward trade ticket" (swarm 2026-11-02 "cards"). Contract: components/CardLab/Bench.vue.
 *
 * Reads top-down like the strategy itself:
 *   1. WHAT  — name, status (shape + colour), traded tickers in their asset-class colour, risk bars, automation.
 *   2. RULE  — WHEN <condition> · SIGNALS <indicators> → ENTRY ▲/▼ <action> → EXIT <action | not stated> · HOLD <avg trade>,
 *              taken verbatim from the creator's description (utils/cardLabC.ts cardLabCRule) — nothing invented.
 *   3. PROOF — backtest window (or "not published": the store fakes start = end = today when the catalog has none),
 *              total return over that window (never "monthly"), $ P&L on the starting capital, win/loss bar with counts
 *              (flagged when the stored win rate disagrees with them), max DD, Sharpe, annual return / volatility, beta / alpha.
 *   4. WHO   — creator, agent (name from avatars.json), last run, followers / likes / comments, free or premium price.
 * No sparkline / regime widget: the catalog has no equity series, so none is drawn.
 */
import { computed, onMounted } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { assetClassTheme } from '~/utils/assetClass'
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney } from '~/utils/format'
import {
  CARD_LAB_C_SMALL_SAMPLE, cardLabCAutomation, cardLabCDuration, cardLabCRisk, cardLabCRule, cardLabCSegments, cardLabCStyle,
  cardLabCWindow, cardLabCWinLoss, type CardLabCClause,
} from '~/utils/cardLabC'

const props = defineProps<{ strategy: Record<string, any>; full: Record<string, any>; code: Record<string, any> | null }>()
const emit = defineEmits<{ view: []; copy: [] }>()

const f = computed(() => props.full ?? {})
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// ── 1. WHAT ──────────────────────────────────────────────────────────────
const tickers = computed<string[]>(() => ((f.value.target_assets ?? []) as string[]).filter(Boolean))
const category = computed(() => String(f.value.category ?? ''))
const classTheme = computed(() => assetClassTheme(tickers.value[0] ?? category.value))
const tickerColor = (t: string) => assetClassTheme(t || category.value).color
const categoryLabel = computed(() => category.value ? category.value[0]!.toUpperCase() + category.value.slice(1) : 'Class not set')

const STATUS: Record<string, { label: string; glyph: string; tone: string; note: string }> = {
  active: { label: 'Active', glyph: '●', tone: 'var(--status-active)', note: 'Status active: the strategy is switched on.' },
  paused: { label: 'Paused', glyph: '❚❚', tone: 'var(--status-paused)', note: 'Status paused: switched off for now, can be resumed.' },
  stopped: { label: 'Stopped', glyph: '■', tone: 'var(--error-red)', note: 'Status stopped: not running.' },
  backtesting: { label: 'Backtesting', glyph: '◐', tone: 'var(--primary-blue)', note: 'Status backtesting.' },
}
const status = computed(() => STATUS[String(f.value.status)] ?? { label: 'Status not set', glyph: '○', tone: 'var(--text-gray)', note: 'No status in the record.' })
const risk = computed(() => cardLabCRisk(f.value.risk_level))
const RISK_TONE: Record<string, string> = { low: 'var(--app-color-up)', medium: 'var(--warning-orange)', high: 'var(--app-color-down)', unset: 'var(--text-gray)' }
const automation = computed(() => cardLabCAutomation(f.value.type))
const tags = computed<string[]>(() => ((f.value.tags ?? []) as string[]).slice(0, 4))

// ── 2. RULE ──────────────────────────────────────────────────────────────
const rule = computed(() => cardLabCRule(String(f.value.description ?? '')))
const indicators = computed<string[]>(() => ((f.value.indicators ?? []) as string[]).filter(Boolean))
const trigger = computed(() => {
  if (rule.value.pair) return rule.value.pairCondition ? { keyword: 'when', text: rule.value.pairCondition } : null
  const c = rule.value.entry.find(e => e.condition)
  return c ? { keyword: c.keyword ?? 'when', text: c.condition! } : null
})
// The badge carries the verb as written (BUY / SELL / LONG / SHORT / ADD …); the text after it is the rest of the clause.
const VERB_WORD: Record<string, string> = {
  buy: 'BUY', buys: 'BUY', buying: 'BUY', bought: 'BUY', sell: 'SELL', sells: 'SELL', selling: 'SELL', sold: 'SELL',
  long: 'LONG', longs: 'LONG', short: 'SHORT', shorts: 'SHORT', add: 'ADD', adds: 'ADD', adding: 'ADD',
  accumulate: 'ACCUMULATE', accumulates: 'ACCUMULATE', trims: 'TRIM', cuts: 'CUT', exits: 'EXIT', closes: 'CLOSE',
}
const sideWord = (c: CardLabCClause) => VERB_WORD[c.verb.toLowerCase()] ?? (c.side === 'buy' ? 'BUY' : 'SELL')
const rest = (c: CardLabCClause) => c.action.slice(c.verb.length).trim()
const segs = (text: string) => cardLabCSegments(text, tickers.value)
const style = computed(() => cardLabCStyle(String(f.value.name ?? ''), (f.value.tags ?? []) as string[], rule.value.entry[0]?.side ?? null))
const hold = computed(() => cardLabCDuration(f.value.average_trade_duration))

// ── 3. PROOF ─────────────────────────────────────────────────────────────
const win = computed(() => cardLabCWindow(f.value.backtest_period))
const windowText = computed(() => win.value.known
  ? `${fmtDate(win.value.start)} → ${fmtDate(win.value.end)}`
  : 'window not published')
const ret = computed(() => num(f.value.total_return_percentage))
const retUsd = computed(() => num(f.value.total_return))
const capStart = computed(() => num(f.value.initial_capital))
const capNow = computed(() => num(f.value.current_capital))
const toneOf = (v: number | null) => v === null || v === 0 ? 'var(--text-white)' : v > 0 ? 'var(--app-color-up)' : 'var(--app-color-down)'
const retCaption = computed(() => win.value.known
  ? `total return over ${win.value.months} months`
  : 'total return, whole record')
const wl = computed(() => cardLabCWinLoss(num(f.value.win_rate), num(f.value.total_trades), num(f.value.successful_trades)))
const small = computed(() => wl.value.total !== null && wl.value.total < CARD_LAB_C_SMALL_SAMPLE)
const winPct = computed(() => wl.value.total && wl.value.wins !== null ? (wl.value.wins / wl.value.total) * 100 : (wl.value.pct ?? 0))
const pm = computed(() => (f.value.performance_metrics ?? {}) as Record<string, unknown>)
const pmKnown = computed(() => ['annual_return', 'volatility', 'beta', 'alpha'].some(k => num(pm.value[k]) !== null && num(pm.value[k]) !== 0))
const dd = computed(() => num(f.value.max_drawdown))
const sharpe = computed(() => num(f.value.sharpe_ratio))

// Contradictions inside the record are shown, never fixed (judge F2).
const sharpeFlag = computed(() => {
  const a = num(pm.value.annual_return), s = sharpe.value
  if (!pmKnown.value || a === null || s === null || a === 0 || s === 0 || Math.sign(a) === Math.sign(s)) return null
  return `Sharpe ${fmtNumber(s, { decimals: 2 })} has the opposite sign of the annual return ${fmtPctFromPercent(a, { signed: true })}: the record is inconsistent.`
})
const impliedAnnual = computed(() => {
  if (!win.value.known || !win.value.months || ret.value === null) return null
  return (Math.pow(1 + ret.value / 100, 12 / win.value.months) - 1) * 100
})
const annualFlag = computed(() => {
  const a = num(pm.value.annual_return), i = impliedAnnual.value
  if (!pmKnown.value || a === null || i === null || Math.abs(a - i) <= 2) return null
  return `The window's total return implies ${fmtPctFromPercent(i, { signed: true })}/yr, the record says ${fmtPctFromPercent(a, { signed: true })}/yr.`
})
// Sharpe band with a verdict word (from @design-b, judge F4): colour alone by sign painted 0.42 green.
const sharpeBand = computed(() => {
  const v = sharpe.value
  if (v === null) return { word: '', tone: 'var(--text-white)' }
  if (v < 0) return { word: 'losing', tone: 'var(--app-color-down)' }
  if (v < 1) return { word: 'weak', tone: 'var(--warning-orange)' }
  if (v < 2) return { word: 'good', tone: 'var(--app-color-up)' }
  return { word: 'strong', tone: 'var(--app-color-up)' }
})
// Fixed ±25 % scale so bar lengths compare across cards (idea from @design-a).
const RET_SCALE = 25
const retBar = computed(() => {
  const v = ret.value ?? 0
  return { side: v >= 0 ? 'pos' : 'neg', width: `${Math.min(50, (Math.abs(v) / RET_SCALE) * 50)}%` }
})

const metrics = computed(() => {
  const a = num(pm.value.annual_return), v = num(pm.value.volatility), b = num(pm.value.beta), al = num(pm.value.alpha)
  return [
    { k: 'Max drawdown', v: dd.value === null ? '—' : fmtPctFromPercent(-Math.abs(dd.value)), tone: dd.value ? 'var(--app-color-down)' : 'var(--text-white)', tip: 'Largest peak-to-trough fall during the backtest.', flag: null as string | null },
    { k: 'Sharpe', v: sharpe.value === null ? '—' : `${fmtNumber(sharpe.value, { decimals: 2 })} ${sharpeBand.value.word}`, tone: sharpeBand.value.tone,
      tip: 'Sharpe ratio of the backtest (return per unit of volatility). Bands: below 0 losing · 0–1 weak · 1–2 good · 2+ strong.',
      flag: sharpeFlag.value },
    { k: 'Annual return', v: pmKnown.value && a !== null ? `${fmtPctFromPercent(a, { signed: true })}/yr` : '—', tone: toneOf(pmKnown.value ? a : null), tip: 'Annualised return (performance_metrics.annual_return).',
      flag: annualFlag.value },
    { k: 'Volatility', v: pmKnown.value && v !== null ? `${fmtPctFromPercent(v)}/yr` : '—', tone: 'var(--text-white)', tip: 'Annualised volatility of returns.', flag: null as string | null },
    { k: 'Beta', v: pmKnown.value && b !== null ? fmtNumber(b, { decimals: 2 }) : '—', tone: 'var(--text-white)', tip: 'Beta: sensitivity to the market.', flag: null as string | null },
    { k: 'Alpha', v: pmKnown.value && al !== null ? fmtNumber(al, { decimals: 2, signed: true }) : '—', tone: toneOf(pmKnown.value ? al : null), tip: 'Alpha: return not explained by the market (catalog units).', flag: null as string | null },
  ]
})

// ── 4. WHO ───────────────────────────────────────────────────────────────
const agents = useAgentsStore()
onMounted(() => { if (!agents.hydrated && !agents.loading) agents.fetchAgents() })
const agentId = computed(() => (f.value.agent_id ? String(f.value.agent_id) : null))
const agentName = computed(() => {
  if (!agentId.value) return null
  const a = (agents.byId as Record<string, { name?: string; kind?: string; owner_id?: string }>)[agentId.value]
  if (!a) return agentId.value
  // The catalog's personal avatar is named "Your avatar" — on a sample card it belongs to the creator, not the viewer.
  if (a.kind === 'personal' || a.name === 'Your avatar') return `${a.owner_id ?? 'creator'}'s own avatar`
  return a.name ?? agentId.value
})
const creator = computed(() => String(f.value.creator ?? f.value.creator_id ?? '') || 'unknown')
const price = computed(() => f.value.is_premium ? `Premium · ${fmtMoney(num(f.value.price), { decimals: 2 })}` : 'Free to copy')
const plural = (n: unknown, word: string) => (n === 1 ? word : `${word}s`)
</script>

<template>
  <article
    class="tk"
    :style="{ '--tk-class': classTheme.color, '--tk-status': status.tone }"
    :aria-label="`${full.name} — strategy card`"
  >
    <!-- 1 · WHAT -->
    <header class="tk-head">
      <div class="tk-title">
        <span class="tk-mark" :style="{ color: classTheme.color }"><StrategyMark :category="category" /></span>
        <h3 class="tk-name">{{ full.name }}</h3>
        <span class="tk-status" :title="status.note"><span class="tk-glyph" aria-hidden="true">{{ status.glyph }}</span>{{ status.label }}</span>
      </div>
      <div class="tk-what">
        <UISourceChip v-if="strategy.sample" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
        <span
          v-for="t in tickers"
          :key="t"
          class="tk-ticker"
          :style="{ color: tickerColor(t), borderColor: tickerColor(t) }"
          :title="`Traded asset ${t} · class ${assetClassTheme(t || category).label}`"
        >{{ t }}</span>
        <span class="tk-class" :title="`Strategy category: ${category || 'not set'}`">{{ categoryLabel }}</span>
        <span class="tk-risk" :title="`Risk level: ${risk.label} (catalog risk_level, 3 steps low / medium / high)`">
          <span class="tk-bars" aria-hidden="true">
            <i v-for="n in 3" :key="n" :class="{ on: n <= risk.filled }" :style="n <= risk.filled ? { background: RISK_TONE[risk.id] } : undefined" />
          </span>
          Risk {{ risk.label.toLowerCase() }}
        </span>
        <span class="tk-auto" :class="automation.id" :title="`Execution: ${automation.label}`">{{ automation.id === 'automated' ? '⚙' : automation.id === 'semi_automated' ? '◐' : '✋' }} {{ automation.label }}</span>
      </div>
    </header>

    <!-- 2 · RULE -->
    <section class="tk-rule" aria-label="Trading rule, from the creator's description">
      <p v-if="style.length || rule.lead" class="tk-lead" title="Style read from the strategy name and tags (and the description's lead words)">
        <span class="tk-k">Style</span>
        <span v-for="st in style" :key="st" class="tk-style">{{ st }}</span>
        <span v-if="rule.lead && !style.length" class="tk-leadtxt">“{{ rule.lead }}”</span>
      </p>
      <div v-if="trigger" class="tk-row">
        <span class="tk-k">{{ trigger.keyword }}</span>
        <span class="tk-v tk-cond"><template v-for="(s, i) in segs(trigger.text)" :key="i"><b v-if="s.kind !== 'text'" :class="s.kind" :style="s.kind === 'ticker' ? { color: tickerColor(s.text) } : undefined">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
      </div>
      <div class="tk-row">
        <span class="tk-k">Signals</span>
        <span class="tk-v tk-inds">
          <span v-for="ind in indicators" :key="ind" class="tk-ind" :title="`Indicator used: ${ind}`">{{ ind }}</span>
          <span v-if="!indicators.length" class="tk-none">no indicator listed</span>
        </span>
      </div>
      <div v-for="(leg, i) in rule.entry" :key="`e${i}`" class="tk-row">
        <span class="tk-k">{{ i === 0 ? 'Entry' : (rule.pair ? 'and' : 'then') }}</span>
        <span class="tk-v tk-leg">
          <span class="tk-side" :class="leg.side" :title="`${leg.side === 'buy' ? 'Buy / long' : 'Sell / short'} side, from the verb “${leg.verb}”`">{{ leg.side === 'buy' ? '▲' : '▼' }} {{ sideWord(leg) }}</span>{{ ' ' }}<span class="tk-act"><template v-for="(s, j) in segs(rest(leg))" :key="j"><b v-if="s.kind !== 'text'" :class="s.kind" :style="s.kind === 'ticker' ? { color: tickerColor(s.text) } : undefined">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
        </span>
      </div>
      <div v-if="!rule.entry.length" class="tk-row">
        <span class="tk-k">Entry</span>
        <span class="tk-v"><span class="tk-gap">○ not described</span></span>
      </div>
      <div class="tk-row">
        <span class="tk-k">Exit</span>
        <span v-if="rule.exit" class="tk-v tk-leg">
          <span class="tk-side" :class="rule.exit.side">{{ rule.exit.side === 'buy' ? '▲' : '▼' }} {{ sideWord(rule.exit) }}</span>{{ ' ' }}<span class="tk-act"><template v-for="(s, j) in segs(rest(rule.exit) + (rule.exit.condition ? ` ${rule.exit.keyword} ${rule.exit.condition}` : ''))" :key="j"><b v-if="s.kind !== 'text'" :class="s.kind" :style="s.kind === 'ticker' ? { color: tickerColor(s.text) } : undefined">{{ s.text }}</b><template v-else>{{ s.text }}</template></template></span>
        </span>
        <span v-else class="tk-v" title="The description gives no exit rule; only the average trade length is known."><span class="tk-gap">○ not stated in the rule</span></span>
      </div>
      <div class="tk-row">
        <span class="tk-k">Hold</span>
        <span class="tk-v" title="average_trade_duration: average time a trade stays open">
          <template v-if="hold">≈ <b class="num">{{ hold }}</b> per trade (average)</template>
          <span v-else class="tk-none">average trade length not recorded</span>
        </span>
      </div>
      <p v-for="(c, i) in rule.context" :key="`c${i}`" class="tk-context">{{ c }}</p>
      <p v-if="tags.length" class="tk-tags"><span v-for="t in tags" :key="t" class="tk-tag">#{{ t }}</span></p>
    </section>

    <!-- 3 · PROOF -->
    <section class="tk-proof" aria-label="Backtest evidence">
      <p class="tk-window" :title="win.known ? 'backtest_period from the catalog record' : 'The catalog record has no backtest_period; no dates are shown rather than a placeholder.'">
        <span class="tk-k">Backtest</span>
        <span v-if="win.known" class="tk-dates">{{ windowText }} <span class="tk-months">· {{ win.months }} months</span></span>
        <span v-else class="tk-gap">○ dates not published</span>
      </p>
      <div class="tk-headline">
        <div class="tk-ret" :title="'total_return_percentage: return over the whole backtest — not a monthly figure'">
          <strong :style="{ color: toneOf(ret) }">{{ fmtPctFromPercent(ret, { signed: true }) }}</strong>
          <span>{{ retCaption }}</span>
        </div>
        <div class="tk-money" title="Starting capital → capital at the end (total_return in USD)">
          <strong :style="{ color: toneOf(retUsd) }">{{ fmtSignedMoney(retUsd, { decimals: 0 }) }}</strong>
          <span>{{ fmtMoney(capStart, { decimals: 0 }) }} → {{ fmtMoney(capNow, { decimals: 0 }) }}</span>
        </div>
      </div>
      <div class="tk-retbar" role="img" :aria-label="`Total return ${fmtPctFromPercent(ret, { signed: true })} on a fixed −25 % to +25 % scale`" :title="'Return bar: fixed −25 % … +25 % scale, the same on every card'">
        <span class="tk-scale">−{{ RET_SCALE }}%</span>
        <span class="tk-track"><i :class="retBar.side" :style="{ width: retBar.width }" /><b class="tk-zero" /></span>
        <span class="tk-scale">+{{ RET_SCALE }}%</span>
      </div>
      <div class="tk-wl" :title="`Win rate ${fmtPctFromPercent(wl.pct, { decimals: 0 })} (catalog) · ${wl.wins ?? '—'} winning of ${wl.total ?? '—'} trades`">
        <div class="tk-wl-top">
          <span class="tk-k">Win rate</span>
          <b class="num">{{ fmtPctFromPercent(wl.pct, { decimals: 0 }) }}</b>
          <span class="tk-wl-n"><b class="up">{{ wl.wins ?? '—' }} W</b> · <b class="down">{{ wl.losses ?? '—' }} L</b> of {{ fmtCount(wl.total) }} trades</span>
        </div>
        <div class="tk-wl-bar" role="img" :aria-label="`${wl.wins ?? 0} winning and ${wl.losses ?? 0} losing trades`">
          <i class="w" :style="{ width: `${winPct}%` }" /><i class="l" :style="{ width: `${100 - winPct}%` }" />
        </div>
        <p v-if="small" class="tk-warn" :title="`Fewer than ${CARD_LAB_C_SMALL_SAMPLE} trades: win rate and Sharpe are statistically weak.`">⚠ small sample: only {{ wl.total }} trades</p>
        <p v-if="!wl.consistent" class="tk-warn">⚠ counts give {{ fmtPctFromPercent(wl.countedPct, { decimals: 1 }) }}, the record says {{ fmtPctFromPercent(wl.pct, { decimals: 0 }) }}</p>
      </div>
      <dl class="tk-grid">
        <div v-for="m in metrics" :key="m.k" class="tk-cell" :title="m.tip">
          <dt>{{ m.k }}</dt>
          <dd :style="{ color: m.tone }">{{ m.v }}<span v-if="m.flag" class="tk-flag" :title="m.flag"> ⚠</span></dd>
        </div>
      </dl>
      <p v-for="m in metrics.filter(x => x.flag)" :key="`f${m.k}`" class="tk-warn">⚠ {{ m.flag }}</p>
    </section>

    <!-- 4 · WHO -->
    <footer class="tk-who">
      <p class="tk-line">
        <span title="Creator of the strategy">by <b>{{ creator }}</b></span>
        <span :title="agentId ? `Agent running it: ${agentId}` : 'No agent assigned in the record'">
          agent <b>{{ agentName ?? 'none' }}</b>
        </span>
        <span title="last_run: last time the strategy ran">last run <b>{{ fmtDate(full.last_run) }}</b></span>
      </p>
      <p class="tk-line">
        <span title="followers_count">👥 <b>{{ fmtCount(num(full.followers_count)) }}</b> {{ plural(full.followers_count, 'follower') }}</span>
        <span title="likes_count">♥ <b>{{ fmtCount(num(full.likes_count)) }}</b> {{ plural(full.likes_count, 'like') }}</span>
        <span title="comments_count">💬 <b>{{ fmtCount(num(full.comments_count)) }}</b> {{ plural(full.comments_count, 'comment') }}</span>
        <span class="tk-price" :class="{ premium: full.is_premium }" :title="full.is_premium ? 'Premium strategy: paid access' : 'Free to copy'">{{ price }}</span>
      </p>
      <div class="tk-actions">
        <button type="button" class="tk-btn primary" @click="emit('copy')">⧉ Use as template</button>
        <button type="button" class="tk-btn" @click="emit('view')">View details →</button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.tk {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-left: 4px solid var(--tk-class);
  border-radius: var(--radius-md);
  color: var(--text-white);
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
}
.tk > * { padding: 10px 12px; }
.tk > * + * { border-top: 1px dashed var(--border-secondary); }
b { font-weight: 700; }
.num, .tk-ticker, .tk-ind, .tk-grid dd, .tk-ret strong, .tk-money strong, b.num, b.ticker {
  font-family: var(--font-market-data);
  font-variant-numeric: tabular-nums;
}
.tk-k {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-gray);
}
.tk-none { color: var(--text-gray); font-style: italic; }
.tk-gap { display: inline-block; font-size: 11px; color: var(--text-light-gray); border: 1px dashed var(--text-gray); border-radius: var(--radius-sm); padding: 0 6px; }
.tk-dates { color: var(--text-white); font-weight: 700; }
.tk-months { color: var(--text-light-gray); font-weight: 400; }
.tk-flag { color: var(--warning-orange); font-size: 11px; cursor: help; }
.tk-retbar { display: flex; align-items: center; gap: 6px; }
.tk-scale { font-size: 10px; color: var(--text-gray); font-family: var(--font-market-data); }
.tk-track { position: relative; flex: 1; height: 6px; border-radius: 999px; background: var(--border-primary); }
.tk-track i { position: absolute; top: 0; bottom: 0; display: block; }
.tk-track i.pos { left: 50%; background: var(--app-color-up); border-radius: 0 999px 999px 0; }
.tk-track i.neg { right: 50%; background: var(--app-color-down); border-radius: 999px 0 0 999px; }
.tk-zero { position: absolute; left: calc(50% - 1px); top: -3px; bottom: -3px; width: 2px; background: var(--text-light-gray); }

/* 1 · WHAT */
.tk-head { display: flex; flex-direction: column; gap: 6px; }
.tk-title { display: flex; align-items: flex-start; gap: 7px; }
.tk-mark { display: inline-flex; padding-top: 2px; }
.tk-mark :deep(.mark) { color: inherit; }
.tk-name { flex: 1; min-width: 0; margin: 0; font-size: 15px; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
.tk-status {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--tk-status);
  border: 1px solid var(--tk-status);
  border-radius: 999px;
  padding: 1px 8px;
}
.tk-glyph { font-size: 10px; letter-spacing: -0.1em; }
.tk-what { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.tk-what :deep(.chip) { font-size: 10px; }
.tk-ticker { font-size: 12px; font-weight: 700; padding: 0 6px; border: 1px solid; border-radius: var(--radius-sm); }
.tk-class { font-size: 11px; color: var(--text-light-gray); }
.tk-risk, .tk-auto { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-light-gray); }
.tk-bars { display: inline-flex; align-items: flex-end; gap: 2px; }
.tk-bars i { display: block; width: 4px; border-radius: 1px; background: var(--border-secondary); }
.tk-bars i:nth-child(1) { height: 6px; }
.tk-bars i:nth-child(2) { height: 9px; }
.tk-bars i:nth-child(3) { height: 12px; }

/* 2 · RULE */
.tk-rule { display: flex; flex-direction: column; gap: 5px; }
.tk-lead { margin: 0 0 2px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; }
.tk-lead > .tk-k { width: 52px; text-align: right; margin-right: 2px; }
.tk-style { font-size: 11px; font-weight: 800; color: var(--text-white); padding: 0 6px; border: 1px solid var(--text-gray); border-radius: 999px; }
.tk-leadtxt { font-size: 11px; color: var(--text-light-gray); }
.tk-row { display: grid; grid-template-columns: 52px 1fr; gap: 8px; align-items: baseline; }
.tk-row > .tk-k { text-align: right; }
.tk-v { min-width: 0; color: var(--text-white); }
.tk-cond { color: var(--text-light-gray); }
.tk-inds { display: flex; flex-wrap: wrap; gap: 4px; }
.tk-ind { font-size: 11px; padding: 0 5px; border: 1px solid var(--border-secondary); border-radius: var(--radius-sm); color: var(--primary-blue); }
.tk-leg { display: flex; align-items: baseline; gap: 6px; }
.tk-leg .tk-act { min-width: 0; }
.tk-side {
  display: inline-block; flex-shrink: 0; min-width: 44px; text-align: center; padding: 0 5px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
  border: 1px solid; border-radius: var(--radius-sm);
}
.tk-side.buy { color: var(--app-color-up); }
.tk-side.sell { color: var(--app-color-down); }
b.num { color: var(--warning-orange); font-weight: 700; }
b.ticker { font-weight: 800; }
.tk-context { margin: 2px 0 0 60px; font-size: 11px; font-style: italic; color: var(--text-light-gray); }
.tk-tags { margin: 0 0 0 60px; display: flex; flex-wrap: wrap; gap: 2px 8px; }
.tk-tag { font-size: 10px; color: var(--text-gray); }

/* 3 · PROOF */
.tk-proof { display: flex; flex-direction: column; gap: 8px; }
.tk-window { margin: 0; display: flex; gap: 8px; align-items: baseline; font-size: 11px; color: var(--text-light-gray); }
.tk-headline { display: flex; justify-content: space-between; gap: 10px; align-items: flex-end; }
.tk-ret, .tk-money { display: flex; flex-direction: column; min-width: 0; }
.tk-money { align-items: flex-end; text-align: right; }
.tk-ret strong { font-size: 26px; font-weight: 800; line-height: 1.05; }
.tk-money strong { font-size: 15px; font-weight: 800; }
.tk-ret span, .tk-money span { font-size: 10px; color: var(--text-gray); }
.tk-wl { display: flex; flex-direction: column; gap: 4px; }
.tk-wl-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.tk-wl-top b.num { color: var(--text-white); font-size: 14px; }
.tk-wl-n { margin-left: auto; font-size: 11px; color: var(--text-light-gray); }
.tk-wl-n .up { color: var(--app-color-up); }
.tk-wl-n .down { color: var(--app-color-down); }
.tk-wl-bar { display: flex; height: 6px; border-radius: 999px; overflow: hidden; gap: 2px; }
.tk-wl-bar i { display: block; height: 100%; }
.tk-wl-bar .w { background: var(--app-color-up); }
.tk-wl-bar .l { background: var(--app-color-down); }
.tk-warn { margin: 0; font-size: 10px; color: var(--warning-orange); }
.tk-grid { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 10px; }
.tk-cell { display: flex; flex-direction: column; min-width: 0; }
.tk-cell dt { font-size: 10px; color: var(--text-gray); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.tk-cell dd { margin: 0; font-size: 13px; font-weight: 700; }

/* 4 · WHO */
.tk-who { display: flex; flex-direction: column; gap: 4px; }
.tk-line { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 11px; color: var(--text-light-gray); }
.tk-line b { color: var(--text-white); }
.tk-price { margin-left: auto; font-weight: 700; color: var(--text-light-gray); }
.tk-price.premium { color: var(--warning-orange); }
.tk-actions { display: flex; gap: 6px; margin-top: 4px; }
.tk-btn {
  flex: 1; padding: 6px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary); background: transparent;
  color: var(--text-light-gray); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
}
.tk-btn.primary { color: var(--primary-green); border-color: var(--primary-green); }
.tk-btn:hover { color: var(--text-white); }
.tk-btn:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
</style>
