<script setup lang="ts">
/**
 * Card lab variant B — "glyph / visual encoding" (swarm 2026-11-02 "cards").
 * The card is understood before it is read: style archetype = glyph, risk = left border weight + signal bars,
 * status = shape AND word (● Active · ❚❚ Paused · ■ Stopped), holding period = marker on a 1h→1mo log scale,
 * return vs max drawdown = balance bars on one shared scale, win rate = W/L ring from the real trade counts,
 * Sharpe = quality band, asset class = tile colour, assets = coloured coins, popularity = log bar.
 * Numbers stay, small and exact. Every shape is computed from a field of the catalog record (utils/cardLabB.ts) and
 * its tooltip says which field and scale; no curve, no default values. Contract: components/CardLab/Bench.vue.
 */
import { computed, onMounted } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { assetClassTheme } from '~/utils/assetClass'
import { fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney, fmtSignedNumber } from '~/utils/format'
import {
  CARD_LAB_B_HOLD_TICKS, cardLabBAutomation, cardLabBBalance, cardLabBDurationHours, cardLabBHoldBucket,
  cardLabBHoldPos, cardLabBPopularity, cardLabBRisk, cardLabBSharpe, cardLabBSmallSample, cardLabBStyle,
  cardLabBWinLoss, cardLabBWinRateMismatch, cardLabBWindowKnown, cardLabBPerf, CARD_LAB_B_SHARPE_MIN, CARD_LAB_B_SHARPE_MAX,
} from '~/utils/cardLabB'

const props = defineProps<{ strategy: Record<string, any>; full: Record<string, any>; code: Record<string, any> | null }>()
const emit = defineEmits<{ view: []; copy: [] }>()

const agents = useAgentsStore()
onMounted(() => { if (!agents.hydrated && !agents.loading) agents.fetchAgents() })

const f = computed(() => props.full ?? {})
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

const style = computed(() => cardLabBStyle({ name: f.value.name, tags: f.value.tags, indicators: f.value.indicators }))
const GLYPH_MEANS: Record<string, string> = {
  reversion: 'price swings around a mean and is traded back toward it',
  pair: 'two related prices; the gap between them is traded when it widens',
  vol: 'a short-straddle payoff tent under a volatility wiggle: sells option premium, earns when prices stay calm',
  momentum: 'a rising staircase: follows a move that is already under way',
  event: 'a dated event line, then the drift that follows it',
  systematic: 'rules-based, no clearer style word in the record',
}
const glyphTitle = computed(() => `Style glyph: ${style.value.label} — ${GLYPH_MEANS[style.value.key]}. Read from ${style.value.evidence.length ? style.value.evidence.join(', ') : 'nothing specific'}. Tile colour = asset class.`)

const classTheme = computed(() => assetClassTheme(String(f.value.category ?? '')))
const classLabel = computed(() => {
  const c = String(f.value.category ?? '')
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Class not given'
})

const STATUS: Record<string, { label: string; title: string }> = {
  active: { label: 'Active', title: 'Status: active — the strategy is running' },
  paused: { label: 'Paused', title: 'Status: paused — kept, not trading now' },
  stopped: { label: 'Stopped', title: 'Status: stopped — not running' },
}
const statusKey = computed(() => (STATUS[String(f.value.status)] ? String(f.value.status) : 'none'))
const status = computed(() => STATUS[statusKey.value] ?? { label: 'Status not given', title: 'Status not given' })

const auto = computed(() => cardLabBAutomation(f.value.type))
const risk = computed(() => cardLabBRisk(f.value.risk_level))

// Assets: brand colour where the design system has a token, else the asset's class colour.
const ASSET_VAR: Record<string, string> = { BTC: '--asset-btc', ETH: '--asset-eth', SOL: '--asset-sol', TSLA: '--asset-tsla' }
const assets = computed(() => ((f.value.target_assets ?? []) as string[]).map(a => {
  const th = assetClassTheme(a)
  return { id: a, color: ASSET_VAR[a] ? `var(${ASSET_VAR[a]})` : th.color, cls: th.label }
}))

// Return vs drawdown (whole backtest, one shared scale so the five cards compare).
const ret = computed(() => num(f.value.total_return_percentage))
const dd = computed(() => num(f.value.max_drawdown))
const bal = computed(() => cardLabBBalance(ret.value, dd.value))
const balTitle = computed(() => `Balance bars: total return ${fmtPctFromPercent(ret.value, { signed: true })} over the whole backtest (solid; right = gain, left = loss) against max drawdown ${fmtPctFromPercent(dd.value == null ? null : -Math.abs(dd.value))} (hatched, always left). Half-width = ${bal.value.scale}% on every card.`)
// All-zero metrics = the store's filler for a record without them, not four real zeros.
const pm = computed(() => cardLabBPerf(f.value.performance_metrics))

// Win / loss ring from the real trade counts.
const wl = computed(() => cardLabBWinLoss(f.value.total_trades, f.value.successful_trades, f.value.win_rate))
const RING_C = 2 * Math.PI * 15
const ringWin = computed(() => (wl.value ? RING_C * wl.value.frac : 0))
const winStated = computed(() => cardLabBWinRateMismatch(f.value.win_rate, wl.value))
const small = computed(() => cardLabBSmallSample(f.value.total_trades))

const sharpeV = computed(() => num(f.value.sharpe_ratio))
const sharpe = computed(() => cardLabBSharpe(sharpeV.value))
const sharpeSignOff = computed(() => {
  const a = num(pm.value.annual_return)
  return sharpeV.value != null && a != null && sharpeV.value !== 0 && a !== 0 && Math.sign(sharpeV.value) !== Math.sign(a)
})

const holdRaw = computed(() => String(f.value.average_trade_duration ?? ''))
const holdH = computed(() => cardLabBDurationHours(holdRaw.value))
const holdPos = computed(() => cardLabBHoldPos(holdH.value))
const sharpeTicks = [0, 1, 2]
const holdTicks = CARD_LAB_B_HOLD_TICKS.map(t => ({ ...t, pos: cardLabBHoldPos(t.hours) ?? 0 }))

const followers = computed(() => num(f.value.followers_count))
const pop = computed(() => cardLabBPopularity(followers.value))

const agentName = computed(() => {
  const id = f.value.agent_id
  if (!id) return null
  return agents.byId[id]?.name ?? String(id)
})
// The store fills a missing window with {start: today, end: today} (stores/strategies.ts): a window counts only when
// both ends exist and start < end (same guard as @design-a's cardLabAWindowKnown).
const backtest = computed(() => {
  const b = f.value.backtest_period
  return cardLabBWindowKnown(b) ? `${fmtDate(b.start)} → ${fmtDate(b.end)}` : null
})
const priceLabel = computed(() => (f.value.is_premium ? `Premium ${fmtMoney(num(f.value.price), { decimals: 0 })}` : 'Free'))
const visLabel = computed(() => (f.value.is_public ? 'Public' : 'Private'))
</script>

<template>
  <article
    class="clb"
    :class="[`risk-${risk.key}`, `st-${statusKey}`]"
    :style="{ '--clb-class': classTheme.color, '--clb-class-tint': classTheme.tint }"
  >
    <!-- ① Identity: style glyph on the asset-class tile, name, status shape + word, automation, risk bars -->
    <header class="head">
      <div class="glyph" :title="glyphTitle">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <g v-if="style.key === 'reversion'">
            <path class="g-mean" d="M3 20H37" />
            <path class="g-line" d="M3 20C8 5 13 5 16 20S25 35 29 20 34 12 37 16" />
            <path class="g-acc" d="M10 6.5v6M7.6 10.2 10 12.7l2.4-2.5M22 33.5v-6M19.6 29.8 22 27.3l2.4 2.5" />
          </g>
          <g v-else-if="style.key === 'pair'">
            <path class="g-line" d="M3 17 13 8 25 17 37 18" />
            <path class="g-line alt" d="M3 23 13 32 25 23 37 22" />
            <path class="g-acc" d="M13 12v16M10.5 14.5 13 11.5l2.5 3M10.5 25.5 13 28.5l2.5-3" />
          </g>
          <g v-else-if="style.key === 'vol'">
            <path class="g-mean" d="M3 27H37" />
            <path class="g-line" d="M3 36 20 13 37 36" />
            <path class="g-acc" d="M9 8c2-3 4 3 6 0s4 3 6 0 4 3 6 0 4 3 6 0" />
          </g>
          <g v-else-if="style.key === 'momentum'">
            <path class="g-line" d="M3 33 11 27 16 29 24 19 28 21 36 9" />
            <path class="g-acc" d="M29 8.5 36.5 8.5 36.5 16" />
          </g>
          <g v-else-if="style.key === 'event'">
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
          <h3 class="name">{{ f.name }}</h3>
          <UISourceChip v-if="strategy.sample" class="chip" source="sample" note="Catalog sample shown to every user: its figures are sample data, not one of your strategies." />
        </div>
        <p class="kind">
          <span class="style">{{ style.label }}</span>
          <span class="sep" aria-hidden="true">·</span>
          <span class="cls"><StrategyMark class="mark" :category="String(f.category || '')" />{{ classLabel }}</span>
        </p>
        <div class="state">
          <span class="status" :title="status.title">
            <svg class="st-ico" viewBox="0 0 12 12" aria-hidden="true">
              <circle v-if="statusKey === 'active'" cx="6" cy="6" r="4.5" />
              <g v-else-if="statusKey === 'paused'"><rect x="2" y="1.5" width="3" height="9" rx="0.6" /><rect x="7" y="1.5" width="3" height="9" rx="0.6" /></g>
              <rect v-else-if="statusKey === 'stopped'" x="1.8" y="1.8" width="8.4" height="8.4" rx="1" />
              <circle v-else cx="6" cy="6" r="4" fill="none" stroke="currentColor" />
            </svg>
            {{ status.label }}
          </span>
          <span class="auto" :class="`auto-${auto.key}`" :title="`Execution: ${auto.label} (gear solid = automated, dashed = semi-automated)`">
            <svg class="au-ico" viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="2.2" />
              <path d="M6 .8v1.8M6 9.4v1.8M.8 6h1.8M9.4 6h1.8M2.3 2.3l1.3 1.3M8.4 8.4l1.3 1.3M2.3 9.7l1.3-1.3M8.4 3.6l1.3-1.3" />
            </svg>
            {{ auto.label }}
          </span>
          <span class="risk" :title="`Risk level from the catalog: ${risk.label} (1–3 bars = low · medium · high; also the left-edge thickness)`">
            <svg class="rk-ico" viewBox="0 0 15 12" aria-hidden="true">
              <rect v-for="i in 3" :key="i" :x="(i - 1) * 5" :y="12 - i * 4" width="3.6" :height="i * 4" rx="0.6" :class="{ on: i <= risk.level }" />
            </svg>
            {{ risk.label }} risk
          </span>
        </div>
      </div>
    </header>

    <!-- ② What it does (the record's own sentence) + what it trades and reads -->
    <p class="desc">{{ f.description }}</p>
    <div class="tokens">
      <span v-for="a in assets" :key="a.id" class="coin" :title="`Traded asset ${a.id} · ${a.cls}`">
        <span class="coin-dot" :style="{ background: a.color }" aria-hidden="true" />{{ a.id }}
      </span>
      <span v-for="i in (f.indicators ?? [])" :key="`i-${i}`" class="ind" :title="`Indicator read by the rules: ${i}`">{{ i }}</span>
      <span v-for="t in (f.tags ?? [])" :key="`t-${t}`" class="tag">#{{ t }}</span>
    </div>

    <!-- ③ Balance: gain side vs pain side, one scale for every card -->
    <section class="bal">
      <div class="bal-row">
        <!-- DOM order = reading order for text readers: return (hero) first, then drawdown; CSS order puts DD left. -->
        <span class="end r">
          <span class="lbl">total return</span>
          <b class="v hero" :class="(ret ?? 0) < 0 ? 'down' : 'up'">{{ fmtPctFromPercent(ret, { signed: true }) }}</b>
        </span>
        <span class="end l">
          <span class="lbl">max drawdown</span>
          <b class="v down">{{ fmtPctFromPercent(dd == null ? null : -Math.abs(dd)) }}</b>
        </span>
        <div class="track" :title="balTitle">
          <span class="base" />
          <div class="half l">
            <span v-if="bal.retSign < 0 && bal.ret != null" class="bar ret neg" :style="{ width: `${bal.ret * 100}%` }" />
            <span v-if="bal.dd != null" class="bar dd" :style="{ width: `${bal.dd * 100}%` }" />
          </div>
          <span class="axis" />
          <div class="half r">
            <span v-if="bal.retSign > 0 && bal.ret != null" class="bar ret pos" :style="{ width: `${bal.ret * 100}%` }" />
          </div>
        </div>
      </div>
      <div class="bal-scale" aria-hidden="true"><span>−{{ bal.scale }}%</span><span>0</span><span>+{{ bal.scale }}%</span></div>
      <p class="bal-mid">
        <span>whole backtest</span>
        <span title="Total return divided by max drawdown (whole backtest): above 1 = earned more than its worst fall">{{ bal.ratio == null ? 'return / max DD —' : `return / max DD ${fmtNumber(bal.ratio, { decimals: 1 })}×` }}</span>
      </p>
      <p class="bal-sub">
        <span title="Initial capital → current capital (total return in dollars)">{{ fmtMoney(num(f.initial_capital), { decimals: 0 }) }} → {{ fmtMoney(num(f.current_capital), { decimals: 0 }) }}
          (<span :class="(num(f.total_return) ?? 0) < 0 ? 'down' : 'up'">{{ fmtSignedMoney(num(f.total_return), { decimals: 0 }) }}</span>)</span>
        <span>Annual return {{ fmtPctFromPercent(num(pm.annual_return), { signed: true }) }}</span>
        <span>Volatility {{ fmtPctFromPercent(num(pm.volatility)) }}/yr</span>
        <span>Beta {{ fmtNumber(num(pm.beta)) }}</span>
        <span>Alpha {{ fmtSignedNumber(num(pm.alpha)) }}</span>
      </p>
    </section>

    <!-- ④ Dials: win ring · Sharpe band · holding time scale -->
    <section class="dials">
      <div class="dial win">
        <div class="ring" :title="wl ? `Win ring: ${fmtCount(wl.wins)} winning trades (green arc) and ${fmtCount(wl.losses)} losing (red) out of ${fmtCount(wl.total)}` : 'Win rate not given'">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle class="r-loss" cx="18" cy="18" r="15" />
            <circle class="r-win" cx="18" cy="18" r="15" :stroke-dasharray="`${ringWin} ${RING_C}`" />
          </svg>
          <b class="ring-v">{{ wl ? fmtPctFromPercent(wl.frac * 100, { decimals: 0 }) : '—' }}</b>
        </div>
        <div class="dial-txt">
          <span class="dl">Wins / losses</span>
          <span class="dv"><span class="up">{{ fmtCount(wl?.wins) }} W</span> · <span class="down">{{ fmtCount(wl?.losses) }} L</span></span>
          <span class="dn">of {{ fmtCount(num(f.total_trades)) }} trades</span>
          <span v-if="small" class="warn" :title="`Fewer than 30 trades: win rate and Sharpe rest on a small sample`">thin sample · n = {{ fmtCount(num(f.total_trades)) }}</span>
          <span v-if="winStated != null" class="warn" :title="`The record states a ${fmtPctFromPercent(winStated, { decimals: 0 })} win rate, which does not match its own wins ÷ trades`">record says {{ fmtPctFromPercent(winStated, { decimals: 0 }) }}</span>
        </div>
      </div>

      <div class="dial sharpe">
        <span class="dl">Sharpe ratio</span>
        <div class="band" :title="`Sharpe band, −1 to 3: below 0 losing · 0–1 weak · 1–2 good · 2+ strong. This one: ${fmtNumber(sharpeV)}, ${sharpe.label}`">
          <span class="seg losing" :class="{ on: sharpe.key === 'losing' }" />
          <span class="seg weak" :class="{ on: sharpe.key === 'weak' }" />
          <span class="seg good" :class="{ on: sharpe.key === 'good' }" />
          <span class="seg strong" :class="{ on: sharpe.key === 'strong' }" />
          <span v-if="sharpe.pos != null" class="pin" :style="{ left: `${sharpe.pos * 100}%` }" />
        </div>
        <div class="tick-lbls sh" aria-hidden="true">
          <span v-for="t in sharpeTicks" :key="t" :style="{ left: `${((t - CARD_LAB_B_SHARPE_MIN) / (CARD_LAB_B_SHARPE_MAX - CARD_LAB_B_SHARPE_MIN)) * 100}%` }">{{ t }}</span>
        </div>
        <span class="dv"><b>{{ fmtNumber(sharpeV) }}</b> <span :class="`sq-${sharpe.key}`">{{ sharpe.label }}</span></span>
        <span v-if="sharpeSignOff" class="warn" title="The record's Sharpe ratio and its annual return have opposite signs: one of them is inconsistent">sign ≠ annual return</span>
      </div>

      <div class="dial hold">
        <span class="dl">Avg trade hold</span>
        <div class="scale" :title="`Holding scale: average trade duration ${holdRaw || 'not given'} on a log axis from 1 hour to 1 month`">
          <span class="line" />
          <span v-for="t in holdTicks" :key="t.label" class="tick" :style="{ left: `${t.pos * 100}%` }" />
          <span v-if="holdPos != null" class="pin" :style="{ left: `${holdPos * 100}%` }" />
        </div>
        <div class="tick-lbls" aria-hidden="true">
          <span v-for="t in holdTicks" :key="t.label" :style="{ left: `${t.pos * 100}%` }">{{ t.label }}</span>
        </div>
        <span class="dv"><b>{{ holdRaw || '—' }}</b> {{ cardLabBHoldBucket(holdH) }}</span>
      </div>
    </section>

    <!-- ⑤ Crowd + access -->
    <section class="crowd">
      <span class="pop" :title="`Popularity bar: ${fmtCount(followers)} followers on a log scale to 1,000`">
        <span class="pop-track"><span class="pop-fill" :style="{ width: `${pop * 100}%` }" /></span>
        <span><b>{{ fmtCount(followers) }}</b> {{ followers === 1 ? 'follower' : 'followers' }}</span>
      </span>
      <span>{{ fmtCount(num(f.likes_count)) }} {{ num(f.likes_count) === 1 ? 'like' : 'likes' }}</span>
      <span>{{ fmtCount(num(f.comments_count)) }} {{ num(f.comments_count) === 1 ? 'comment' : 'comments' }}</span>
      <span class="pill" :class="{ prem: f.is_premium }">{{ priceLabel }}</span>
      <span class="pill">{{ visLabel }}</span>
    </section>

    <!-- ⑥ Provenance -->
    <dl class="meta">
      <div><dt>Creator</dt><dd>{{ strategy.creator || f.creator_id || '—' }}</dd></div>
      <div><dt>Agent</dt><dd>{{ agentName ?? 'none' }}</dd></div>
      <div><dt>Last run</dt><dd>{{ fmtDate(f.last_run) }}</dd></div>
      <div><dt>Backtest</dt><dd>{{ backtest ?? 'dates not given' }}</dd></div>
    </dl>

    <div class="actions">
      <button type="button" class="btn primary" @click.stop="emit('copy')">Use as template</button>
      <button type="button" class="btn" @click.stop="emit('view')">View</button>
    </div>
  </article>
</template>

<style scoped>
.clb {
  --clb-risk: var(--border-secondary);
  --clb-risk-w: 2px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 12px calc(14px + var(--clb-risk-w));
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  font-size: 12px;
  line-height: 1.35;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
}
/* Risk = weight of the left edge (low thin blue · medium orange · high thick red). */
.clb::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--clb-risk-w); background: var(--clb-risk); }
.risk-low { --clb-risk: var(--primary-blue); --clb-risk-w: 3px; }
.risk-medium { --clb-risk: var(--warning-orange); --clb-risk-w: 6px; }
.risk-high { --clb-risk: var(--error-red); --clb-risk-w: 10px; }
.st-stopped .glyph, .st-stopped .bal .track, .st-stopped .ring svg { filter: saturate(0.5); }

.up { color: var(--app-color-up); }
.down { color: var(--app-color-down); }

/* ① head */
.head { display: flex; gap: 12px; align-items: flex-start; }
.glyph {
  flex: 0 0 52px; height: 52px; border-radius: 12px;
  background-color: var(--clb-class-tint);
  border: 1.5px solid var(--clb-class);
  display: grid; place-items: center;
  color: var(--clb-class);
}
.glyph svg { width: 40px; height: 40px; overflow: visible; }
.g-line { fill: none; stroke: var(--text-white); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.g-line.alt { stroke: var(--clb-class); }
.g-mean { fill: none; stroke: var(--clb-class); stroke-width: 1.4; stroke-dasharray: 2.5 2.5; }
.g-acc { fill: none; stroke: var(--clb-class); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.g-acc-fill { fill: var(--clb-class); }
.st-active .glyph { box-shadow: 0 0 0 3px var(--clb-class-tint); }

.id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mark { color: var(--clb-class); width: 13px; height: 13px; flex-basis: 13px; }
.kind .cls { display: inline-flex; align-items: center; gap: 4px; }
.name { margin: 0; font-size: 15px; font-weight: 800; line-height: 1.2; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.chip :deep(.chip) { font-size: 10px; }
.kind { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; font-weight: 700; }
.kind .style { color: var(--text-white); }
.kind .sep { color: var(--text-light-gray); }
.kind .cls { color: var(--clb-class); }

.state { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; font-size: 11px; font-weight: 700; }
.state > span { display: inline-flex; align-items: center; gap: 4px; }
.st-ico { width: 11px; height: 11px; fill: currentColor; }
.status { color: var(--secondary-darker); background-color: var(--text-light-gray); padding: 1px 8px 1px 6px; border: 1px solid transparent; border-radius: 999px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.st-active .status { background-color: var(--status-active); }
.st-paused .status { background-color: var(--status-paused); }
.st-stopped .status { background-color: var(--status-stopped); }
.st-active .st-ico { animation: clb-live 2.4s ease-in-out infinite; }
@keyframes clb-live { 50% { opacity: 0.45; } }
.auto { color: var(--text-light-gray); }
.au-ico { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.auto-semi .au-ico { stroke-dasharray: 1.6 1.4; }
.risk { color: var(--clb-risk); }
.risk-none .risk { color: var(--text-light-gray); }
.rk-ico { width: 15px; height: 12px; }
.rk-ico rect { fill: var(--border-secondary); }
.rk-ico rect.on { fill: currentColor; }

/* ② description + tokens */
.desc { margin: 0; font-size: 12px; color: var(--text-light-gray); line-height: 1.45; }
.tokens { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.coin {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 3px;
  border: 1px solid var(--border-secondary); border-radius: 999px;
  font-family: var(--font-market-data); font-size: 11px; font-weight: 700; color: var(--text-white);
}
.coin-dot { width: 13px; height: 13px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.35); }
.ind {
  font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 4px;
  color: var(--text-white); background-color: #2e2e2e; border: 1px solid var(--border-secondary);
}
.tag { font-size: 11px; color: var(--text-light-gray); }

/* ③ balance */
.bal { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; border-top: 1px solid var(--border-primary); }
.bal-row { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; }
.end { display: flex; flex-direction: column; min-width: 0; }
.end.r { align-items: flex-end; order: 3; }
.end.l { order: 1; }
.bal-row .track { order: 2; }
.bal-row .v.hero { font-size: 19px; }
.end .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-light-gray); white-space: nowrap; }
.bal-row .v { font-family: var(--font-market-data); font-size: 15px; font-weight: 800; line-height: 1.4; }
.bal-mid { margin: 0; display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-light-gray); }
.track { position: relative; display: grid; grid-template-columns: 1fr 2px 1fr; height: 22px; align-items: center; }
.half { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.half.l { align-items: flex-end; }
.half.r { align-items: flex-start; }
.track .base { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--border-secondary); }
.bal-scale { display: grid; grid-template-columns: 1fr auto 1fr; margin: -2px 0 0; font-size: 10px; color: var(--text-light-gray); font-family: var(--font-market-data); }
.bal-scale span:last-child { text-align: right; }
.axis { height: 100%; background: var(--text-light-gray); }
.bar { display: block; height: 8px; min-width: 2px; }
.bar.ret.pos { background: var(--app-color-up); border-radius: 0 3px 3px 0; }
.bar.ret.neg { background: var(--app-color-down); border-radius: 3px 0 0 3px; }
.bar.dd { background: repeating-linear-gradient(135deg, var(--app-color-down) 0 3px, rgba(255,68,68,0.4) 3px 6px); border-radius: 3px 0 0 3px; }
.bal-sub > span + span::before, .crowd > span + span::before { content: '· '; color: var(--text-gray); }
.bal-sub { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 6px; font-size: 11px; color: var(--text-light-gray); font-family: var(--font-market-data); }

/* ④ dials */
.dials { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; padding-top: 8px; border-top: 1px solid var(--border-primary); }
.dial { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dial.win { grid-row: span 2; flex-direction: row; align-items: center; gap: 8px; padding-right: 14px; border-right: 1px solid var(--border-primary); }
.dl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-light-gray); }
.dv { font-size: 11px; color: var(--text-light-gray); font-family: var(--font-market-data); }
.dv b { color: var(--text-white); font-size: 13px; }
.dn { font-size: 11px; color: var(--text-light-gray); }
.warn { align-self: flex-start; font-size: 10px; font-weight: 700; color: var(--warning-orange); border: 1px solid var(--warning-orange); border-radius: 4px; padding: 0 5px; }
.dial-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ring { position: relative; flex: 0 0 54px; height: 54px; }
.ring svg { width: 54px; height: 54px; transform: rotate(-90deg); }
.ring circle { fill: none; stroke-width: 4.5; }
.r-loss { stroke: var(--app-color-down); opacity: 0.75; }
.r-win { stroke: var(--app-color-up); }
.ring-v { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-market-data); font-size: 13px; }

.band { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; height: 10px; margin: 5px 0 1px; }
.seg { border-radius: 2px; opacity: 0.35; }
.seg.on { opacity: 1; }
.seg.losing { background: var(--app-color-down); }
.seg.weak { background: var(--warning-orange); }
.seg.good { background: var(--primary-blue); }
.seg.strong { background: var(--app-color-up); }
.band .pin, .scale .pin {
  position: absolute; top: 50%; width: 4px; height: 18px; transform: translate(-50%, -50%);
  background: var(--text-white); border-radius: 2px; box-shadow: 0 0 0 2px var(--bg-tertiary);
}
.sq-losing { color: var(--app-color-down); }
.sq-weak { color: var(--warning-orange); }
.sq-good { color: var(--primary-blue); }
.sq-strong { color: var(--app-color-up); }

.scale { position: relative; height: 10px; margin: 4px 6px 0; }
.scale .line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px; background: var(--border-secondary); }
.scale .tick { position: absolute; top: 1px; width: 1px; height: 8px; background: var(--text-light-gray); }
.scale .pin { background: var(--clb-class); width: 11px; height: 11px; border-radius: 50%; }
.tick-lbls.sh { margin: 0 0 2px; }
.hold .tick-lbls { margin-bottom: 2px; }
.tick-lbls { position: relative; height: 13px; margin: 0 6px; font-size: 10px; color: var(--text-light-gray); }
.tick-lbls span { position: absolute; transform: translateX(-50%); line-height: 13px; }

/* ⑤ crowd */
.crowd { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 11px; color: var(--text-light-gray); padding-top: 8px; border-top: 1px solid var(--border-primary); }
.crowd b { color: var(--text-white); }
.pop { display: inline-flex; align-items: center; gap: 6px; }
.pop-track { width: 48px; height: 7px; border-radius: 3px; background-color: var(--border-secondary); overflow: hidden; display: inline-block; }
.pop-fill { display: block; height: 100%; background: var(--domain-social); }
.crowd > .pill::before { content: none; }
.pill { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border-secondary); color: var(--text-light-gray); }
.pill.prem { color: var(--warning-orange); border-color: var(--warning-orange); }

/* ⑥ meta */
.meta { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px; }
.meta div { display: flex; gap: 5px; min-width: 0; flex-wrap: wrap; }
.meta dt { color: var(--text-light-gray); font-weight: 400; }
.meta dd { margin: 0; color: var(--text-white); font-weight: 600; overflow-wrap: anywhere; }

.actions { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 7px 8px; border-radius: var(--radius-sm); cursor: pointer; font: inherit; font-size: 12px; font-weight: 700;
  border: 1px solid var(--border-secondary); background-color: #262626; color: var(--text-white);
}
.btn.primary { border-color: var(--primary-green); color: var(--primary-green); }
.btn:hover { background-color: #303030; }
.btn:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }

/* Narrow card (phone, 340 px): every dial gets a full-width row. */
@container (max-width: 400px) {
  .dials { grid-template-columns: 1fr; }
  .dial.win { grid-row: auto; padding: 0 0 8px; border-right: 0; border-bottom: 1px solid var(--border-primary); }
  .dial.win .dial-txt { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
  .dial.win .dial-txt .dl { flex-basis: 100%; }
  .dial.sharpe, .dial.hold { display: grid; grid-template-columns: 92px 1fr; column-gap: 12px; align-items: center; }
  .dial.sharpe > .dl, .dial.hold > .dl { grid-row: span 2; }
  .dial.sharpe > .dv, .dial.hold > .dv, .dial.sharpe > .warn { grid-column: 2; }
}
@media (prefers-reduced-motion: reduce) { .st-active .st-ico { animation: none; } }
</style>
