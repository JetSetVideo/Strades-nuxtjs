import { assetClassTheme } from '~/utils/assetClass'
import { BET_COLOR } from '~/utils/betAssets'

/**
 * History timeline — one past / present / future model of the user (pages/historic.vue).
 *
 * Sources, merged here and nowhere else:
 *   server   GET /api/v1/history/ (Strades-backend apps/history): calls, wallet ledger (agents launch /
 *            close / running), strategies + backtests, simulated-cash portfolio, news opinions, daily
 *            activity digests from the tracking rollup, trader profile (EMA features).
 *   local    this browser's paper ledger (stores/paper) and calls not yet synced (stores/predictions).
 *   catalog  the founder's sample wallets (public/data/core/wallets.json) — always chipped Sample.
 *
 * Time model: `at` is the anchor; `start_at` makes a span. Tense: future = at > now (and the span has
 * not started); present = start_at <= now < at, or an open position / running agent; past = the rest.
 * Pure functions only — tested in tests/historyTimeline.test.ts.
 */
import type { PaperTrade } from '~/stores/paper'
import type { Prediction } from '~/stores/predictions'

export type Lane = 'profile' | 'opinion' | 'prediction' | 'trade' | 'agent' | 'activity'
export type Tense = 'past' | 'present' | 'future'
/** real = an external wallet's own record; paper = simulated cash; backtest = replayed history. */
export type Mode = 'real' | 'paper' | 'backtest'
export type Origin = 'server' | 'local' | 'catalog'

export interface HistoryEvent {
  id: string
  at: string
  start_at: string | null
  tense: Tense
  lane: Lane
  kind: string
  mode: Mode | null
  title: string
  subtitle: string
  asset: string | null
  amount_usd: number | null
  pnl_usd: number | null
  pct: number | null
  score: number | null
  status: string | null
  href: string | null
  ref: { type: string; id: string } | null
  /** Pre-filled demo history or catalog sample data: never the user's own doing. */
  sample: boolean
  source: Origin
  data: Record<string, any>
}

export interface CallsProfile {
  n: number; resolved: number; withdrawn: number; revisions: number
  hit_rate: number | null; score: number | null; calibration_pct: number | null; error_pct: number | null
  bullish_share: number; boldness: number; avg_move_pct: number; horizon_hours: number
  friends_first: number; herding: number
}

export interface HistoryProfile {
  id: string
  /** rows that began before this instant are pre-filled sample history */
  sample_before: string | null
  display_name: string
  joined_at: string
  is_demo: boolean
  demo_expires_at: string | null
  days_on_strades: number
  calls: CallsProfile | null
  engagement: { level: number; xp: number; streak: number; active_days: number; last_active: string | null } | null
}

export interface HistoryPayload {
  now: string
  window: { from: string; to: string; clipped?: boolean }
  profile: HistoryProfile | null
  lanes: { id: Lane; label: string; count: number; past: number; present: number; future: number }[]
  events: HistoryEvent[]
  heatmap: { hour: number; dow: number; count: number }[]
  sources: Record<string, { ok: boolean; n?: number; note?: string; truncated?: boolean; [k: string]: unknown }>
}

export const HISTORY_LANES: { id: Lane; label: string; hint: string }[] = [
  { id: 'prediction', label: 'Predictions', hint: 'Calls you made, how they resolved, what is still open' },
  { id: 'trade', label: 'Trades', hint: 'Real wallet records, paper trades and backtests' },
  { id: 'agent', label: 'Agents', hint: 'Strategies you drafted and the bots they run' },
  { id: 'opinion', label: 'Opinions', hint: 'Articles you judged, saved, shared; agents you follow' },
  { id: 'activity', label: 'Activity', hint: 'One digest per active day, from your logs' },
  { id: 'profile', label: 'Profile', hint: 'Account milestones' },
]

/** Same glyph + colour language as the notification domains (utils/notifications.ts DOMAIN_META). */
export const LANE_META: Record<Lane, { glyph: string; color: string }> = {
  prediction: { glyph: '◎', color: 'var(--primary-blue, #00aaff)' },
  trade: { glyph: '◈', color: 'var(--primary-green, #00ff88)' },
  agent: { glyph: '⬡', color: 'var(--domain-agent, #b388ff)' },
  opinion: { glyph: '❝', color: 'var(--domain-social, #ff7eb6)' },
  activity: { glyph: '∿', color: 'var(--text-gray, #888888)' },
  profile: { glyph: '◉', color: 'var(--text-light-gray, #cccccc)' },
}

export const HISTORY_MODES: { id: Mode; label: string }[] = [
  { id: 'real', label: 'Real' },
  { id: 'paper', label: 'Paper' },
  { id: 'backtest', label: 'Backtest' },
]

export const HISTORY_RANGES = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
] as const
export type RangeId = typeof HISTORY_RANGES[number]['id']

const DAY = 86_400_000

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)

export function historyTense(at: number, start: number | null, now: number): Tense {
  if (start !== null && Number.isFinite(start) && start <= now && now < at) return 'present'
  return at > now ? 'future' : 'past'
}

function base(p: Partial<HistoryEvent> & Pick<HistoryEvent, 'id' | 'at' | 'lane' | 'kind' | 'title'>, now: number): HistoryEvent {
  const ev: HistoryEvent = {
    start_at: null, mode: null, subtitle: '', asset: null, amount_usd: null, pnl_usd: null, pct: null,
    score: null, status: null, href: null, ref: null, sample: false, source: 'local', data: {},
    tense: 'past', ...p,
  }
  if (!p.tense) ev.tense = historyTense(ms(ev.at), ev.start_at ? ms(ev.start_at) : null, now)
  return ev
}

// --------------------------------------------------------------------------- local adapters
/** Paper ledger (this browser): open bets are present spans, closed ones a past event with P&L. */
export function fromPaperTrades(trades: PaperTrade[], now: number): HistoryEvent[] {
  const out: HistoryEvent[] = []
  for (const t of trades) {
    const sym = t.asset_symbol
    const common = {
      lane: 'trade' as Lane, mode: 'paper' as Mode, asset: sym, amount_usd: t.notional_value,
      href: `/assets/${encodeURIComponent((t.asset_id || sym).toLowerCase())}`,
      ref: { type: 'paper', id: t.id },
      data: { side: t.side, wallet_pct: t.wallet_pct, price: t.simulated_price, strategy_id: t.strategy_id, agent_id: t.agent_id },
    }
    const verb = t.side === 'buy' ? 'Paper long' : 'Paper short'
    if (t.status === 'open') {
      out.push(base({
        ...common, id: `paper:${t.id}`, at: new Date(now).toISOString(), start_at: t.timestamp, tense: 'present',
        kind: 'paper_open', title: `${verb} ${sym} · ${t.wallet_pct.toFixed(1)}% of wallet`,
        subtitle: `Entered at ${histPrice(t.simulated_price)}`, pnl_usd: t.hypothetical_pnl_value,
        pct: t.hypothetical_pnl_pct, status: 'open',
      }, now))
    } else {
      out.push(base({
        ...common, id: `paper:${t.id}`, at: t.closed_at ?? t.timestamp, start_at: t.timestamp, tense: 'past',
        kind: 'paper_closed', title: `${verb} ${sym} closed`,
        subtitle: t.closed_price ? `${histPrice(t.simulated_price)} → ${histPrice(t.closed_price)}` : '',
        pnl_usd: t.realized_pnl_value ?? null, pct: t.realized_pnl_pct ?? null, status: 'closed',
      }, now))
    }
  }
  return out
}

/** Calls this browser holds that the server timeline does not (not synced yet, or offline). Demo seed
 *  calls from public/data/predictions.json are sample data, never the user's. */
export function fromLocalPredictions(preds: Prediction[], historyServerClientIds: Set<string>, now: number): HistoryEvent[] {
  const out: HistoryEvent[] = []
  for (const p of preds) {
    if (historyServerClientIds.has(p.id)) continue
    const sym = (p.assetId || p.assetName || '?').toUpperCase()
    const up = p.predictedChangePct >= 0
    const target = p.targetTs ? new Date(p.targetTs).toISOString() : p.targetDate
    const common = {
      lane: 'prediction' as Lane, asset: sym, sample: !!p.demo, pct: p.predictedChangePct,
      href: `/assets/${encodeURIComponent(sym.toLowerCase())}?call=${encodeURIComponent(p.id)}#sec-chart`,
      ref: { type: 'prediction', id: p.id },
      data: { timeframe: p.timeframe, confidence: p.confidence, predicted_price: p.predictedPrice, reference_price: p.currentPrice, unsynced: true },
    }
    out.push(base({
      ...common, id: `local-call:${p.id}:made`, at: p.timestamp, kind: 'call_made', status: p.status,
      title: `Called ${sym} ${up ? '▲' : '▼'} ${histPct(p.predictedChangePct)} · ${p.timeframe}`, subtitle: p.note ?? '',
    }, now))
    if (p.status === 'pending' && target) {
      const t = ms(target)
      out.push(base({
        ...common, id: `local-call:${p.id}:due`, at: target, start_at: p.timestamp,
        tense: t <= now ? 'present' : undefined, kind: t <= now ? 'call_awaiting' : 'call_due', status: 'pending',
        title: t <= now ? `${sym} call awaiting a price` : `${sym} call resolves`,
        subtitle: `Target ${histPrice(p.predictedPrice)} (${histPct(p.predictedChangePct)})`,
      }, now))
    } else if (p.status !== 'pending' && target) {
      out.push(base({
        ...common, id: `local-call:${p.id}:resolved`, at: target, start_at: p.timestamp, tense: 'past',
        kind: 'call_resolved', status: p.status, score: p.accuracyScore ?? null,
        title: `${sym} call ${p.status}${p.accuracyScore != null ? ` · scored ${Math.round(p.accuracyScore)}` : ''}`,
      }, now))
    }
  }
  return out
}

interface CatalogWallet { id: string; name: string; transactions?: { id: string; type?: string; asset_id?: string; asset_symbol?: string; amount?: number; price?: number; total_value?: number; fee?: number; timestamp?: string; status?: string; pnl_usd?: number }[] }

/** The founder's sample wallets: "real" external-wallet records, always flagged Sample. */
export function fromCatalogWallets(wallets: CatalogWallet[], now: number): HistoryEvent[] {
  const out: HistoryEvent[] = []
  for (const w of wallets) {
    for (const t of w.transactions ?? []) {
      if (!t.timestamp) continue
      const sym = (t.asset_symbol || t.asset_id || '?').toUpperCase()
      const sell = t.type === 'sell'
      out.push(base({
        id: `catalog:${w.id}:${t.id}`, at: t.timestamp, lane: 'trade', kind: sell ? 'trade_sell' : 'trade_buy',
        mode: 'real', sample: true, source: 'catalog', asset: sym, amount_usd: t.total_value ?? null,
        pnl_usd: typeof t.pnl_usd === 'number' ? t.pnl_usd : null, status: t.status ?? null,
        title: `${sell ? 'Sold' : 'Bought'} ${t.amount ?? ''} ${sym}`.replace(/\s+/g, ' '),
        subtitle: `${w.name}${t.price ? ` · @ ${histPrice(t.price)}` : ''}`,
        href: '/wallet', ref: { type: 'wallet', id: w.id }, data: { wallet: w.name, fee: t.fee },
      }, now))
    }
  }
  return out
}

/** Agents whose opinion the user follows (stores/opinions plugs). No timestamp: present only. */
export function fromPluggedAgents(plugs: { agent_id: string; weight: number; enabled: boolean }[],
  nameOf: (id: string) => string | undefined, now: number): HistoryEvent[] {
  return plugs.filter(p => p.enabled).map(p => base({
    id: `plug:${p.agent_id}`, at: new Date(now).toISOString(), tense: 'present', lane: 'opinion', kind: 'agent_followed',
    title: `Following ${nameOf(p.agent_id) ?? p.agent_id}'s opinion`, subtitle: `${Math.round(p.weight * 100)}% of your swarm weight`,
    href: `/agents/${encodeURIComponent(p.agent_id)}`, ref: { type: 'agent', id: p.agent_id }, data: { weight: p.weight },
  }, now))
}

/** Live engine numbers (GET /api/v1/bots/) for agents the ledger says are still running. */
export function enrichRunningAgents(events: HistoryEvent[], bots: { bot_id: string; pnl?: number; pnl_pct?: number; alive?: boolean; paused?: boolean; stats?: { closed?: number; win_rate?: number }; strategy?: { name?: string } | null }[]): HistoryEvent[] {
  const byId = new Map(bots.map(b => [b.bot_id, b]))
  return events.map((e) => {
    if (e.kind !== 'agent_running' || !e.ref) return e
    const b = byId.get(e.ref.id)
    if (!b) return e
    return {
      ...e,
      pnl_usd: b.pnl ?? e.pnl_usd, pct: b.pnl_pct ?? e.pct,
      status: b.paused ? 'paused' : b.alive === false ? 'stopped' : 'live',
      title: b.alive === false
        ? `${b.strategy?.name ? `Agent “${b.strategy.name}”` : e.title.split(' running')[0]} stopped, capital not yet returned`
        : (b.strategy?.name ? `Agent “${b.strategy.name}” running` : e.title),
      data: { ...e.data, closed: b.stats?.closed, win_rate: b.stats?.win_rate, live: true },
    }
  })
}

// --------------------------------------------------------------------------- merge + views
export function historyServerClientIds(events: HistoryEvent[]): Set<string> {
  const s = new Set<string>()
  for (const e of events) if (e.lane === 'prediction' && e.data?.client_id) s.add(String(e.data.client_id))
  return s
}

/** One list, unique ids, server rows win over local copies of the same id. */
export function mergeHistoryEvents(...groups: HistoryEvent[][]): HistoryEvent[] {
  const seen = new Map<string, HistoryEvent>()
  for (const g of groups) for (const e of g) if (!seen.has(e.id)) seen.set(e.id, e)
  return [...seen.values()]
}

/** Recompute tense against a moving clock (the page ticks every 30 s; the server's `now` ages). */
export function retenseHistory(events: HistoryEvent[], now: number): HistoryEvent[] {
  return events.map((e) => {
    // a pending call whose target passed is waiting for a price — still in play, never "past"
    if (e.kind === 'call_due' && ms(e.at) <= now) {
      return { ...e, kind: 'call_awaiting', tense: 'present', title: `${e.asset ?? 'Call'} call awaiting a price` }
    }
    if (e.kind === 'position_open' || e.kind === 'paper_open' || e.kind === 'agent_running' ||
        e.kind === 'agent_followed' || e.kind === 'call_awaiting') return e
    const t = historyTense(ms(e.at), e.start_at ? ms(e.start_at) : null, now)
    // a resolved call stays past even though it is a span
    const tense = e.kind === 'call_resolved' || e.kind === 'agent_closed' || e.kind === 'paper_closed' ? 'past' : t
    return tense === e.tense ? e : { ...e, tense }
  })
}

export interface HistoryFilter {
  lanes: Set<Lane>
  modes: Set<Mode>
  /** include events with no mode (calls, opinions...) */
  q: string
  range: RangeId
  showSample: boolean
}

export function historyRangeStart(range: RangeId, now: number): number {
  const r = HISTORY_RANGES.find(x => x.id === range)
  return r?.days ? now - r.days * DAY : -Infinity
}

export function matchesHistoryFilter(e: HistoryEvent, f: HistoryFilter, now: number): boolean {
  if (!f.lanes.has(e.lane)) return false
  if (e.mode && !f.modes.has(e.mode)) return false
  if (!f.showSample && e.sample) return false
  // The range limits the PAST only: what is running now and what is coming always shows.
  if (e.tense === 'past' && ms(e.at) < historyRangeStart(f.range, now)) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hay = `${e.title} ${e.subtitle} ${e.asset ?? ''} ${e.kind}`.toLowerCase()
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false
  }
  return true
}

export interface HistorySections {
  future: HistoryEvent[]
  present: HistoryEvent[]
  past: { day: string; events: HistoryEvent[] }[]
}

/** Future soonest-first, present by when it started, past newest-first grouped by local day. */
export function historySections(events: HistoryEvent[], dayKey: (iso: string) => string = historyDay): HistorySections {
  const future = events.filter(e => e.tense === 'future').sort((a, b) => ms(a.at) - ms(b.at))
  const present = events.filter(e => e.tense === 'present')
    .sort((a, b) => presentRank(a) - presentRank(b) || ms(a.at) - ms(b.at))
  const past = events.filter(e => e.tense === 'past').sort((a, b) => ms(b.at) - ms(a.at))
  const days: { day: string; events: HistoryEvent[] }[] = []
  for (const e of past) {
    const d = dayKey(e.at)
    const last = days[days.length - 1]
    if (last && last.day === d) last.events.push(e)
    else days.push({ day: d, events: [e] })
  }
  return { future, present, past: days }
}

/** Present spans with no scheduled end: they run until the user (or the market) stops them. */
export const OPEN_ENDED = new Set(['agent_running', 'position_open', 'paper_open', 'agent_followed'])

const PRESENT_ORDER = ['call_awaiting', 'call_due', 'agent_running', 'paper_open', 'position_open', 'agent_followed', 'demo_ends']
function presentRank(e: HistoryEvent) {
  const i = PRESENT_ORDER.indexOf(e.kind)
  return i < 0 ? PRESENT_ORDER.length : i
}

export function historyDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Progress of a span through time, 0..1 (null when it is not a span). */
export function historySpanProgress(e: HistoryEvent, now: number): number | null {
  if (!e.start_at) return null
  const a = ms(e.start_at), b = ms(e.at)
  if (!(b > a)) return null
  return Math.max(0, Math.min(1, (now - a) / (b - a)))
}

/** How the row should read: the result is up, down, waiting, or undecided. */
export type HistoryState = 'up' | 'down' | 'warn' | 'flat'

export interface HistoryAssetTone {
  id: string
  label: string
  color: string
  tint: string
}

export interface HistoryVisual {
  state: HistoryState
  /** 0.18…1. A quiet print stays pale; a large move, a high score, or a confident call saturates. */
  intensity: number
  asset: HistoryAssetTone | null
  /** Fill of the row bar, 0…1. Null when the row has no clock and no mark. */
  bar: number | null
}

const BET_TONE: HistoryAssetTone = { id: 'bet', label: 'Bet', color: BET_COLOR, tint: 'rgba(255, 77, 157, 0.16)' }

/** Kalshi contracts are tickers like KXELONMARS-99. They are bets, not equities. */
export function historyAssetTone(asset: string | null | undefined): HistoryAssetTone | null {
  const sym = asset?.trim()
  if (!sym) return null
  if (/^KX[A-Z0-9]/i.test(sym)) return BET_TONE
  const theme = assetClassTheme(sym)
  return { id: theme.id, label: theme.label, color: theme.color, tint: theme.tint }
}

/** Direction of the print. A clock that has run out without a price is a warning, not a flat line. */
export function historyState(e: HistoryEvent): HistoryState {
  if (e.kind === 'call_awaiting' || e.kind === 'call_withdrawn') return e.kind === 'call_awaiting' ? 'warn' : 'down'
  if (e.status === 'paused') return 'flat'
  if (e.status === 'accurate' || e.status === 'live') return 'up'
  if (e.status === 'missed' || e.status === 'stopped') return 'down'
  const n = typeof e.pnl_usd === 'number' ? e.pnl_usd : e.pct
  if (typeof n === 'number' && n !== 0) return n > 0 ? 'up' : 'down'
  return 'flat'
}

/** How loud the colour should be, from the move, the P&L, the score, or the call's confidence. */
export function historyIntensity(e: HistoryEvent): number {
  const parts: number[] = []
  if (typeof e.pct === 'number') parts.push(Math.min(1, Math.abs(e.pct) / 20))
  if (typeof e.pnl_usd === 'number') parts.push(Math.min(1, Math.abs(e.pnl_usd) / 250))
  if (typeof e.score === 'number') parts.push(Math.min(1, e.score / 100))
  const conf = Number(e.data?.confidence)
  if (Number.isFinite(conf) && conf > 0) parts.push(Math.min(1, conf / 5))
  const win = Number(e.data?.win_rate)
  if (Number.isFinite(win) && win >= 0) parts.push(Math.min(1, win))
  if (e.kind === 'call_awaiting') parts.push(0.72)
  const top = parts.length ? Math.max(...parts) : 0.2
  return Math.max(0.18, Math.min(1, top))
}

/**
 * The bar on a row. A scheduled span fills with the clock. An open position
 * has no finish, so the bar is how far the mark has moved instead.
 */
/** How far a settled print moved, 0–1. Confidence stays in the shade, not the length. */
function historyMark(e: HistoryEvent): number | null {
  const parts: number[] = []
  if (typeof e.pct === 'number') parts.push(Math.abs(e.pct) / 20)
  if (typeof e.pnl_usd === 'number') parts.push(Math.abs(e.pnl_usd) / (Math.abs(e.amount_usd ?? 0) || 250))
  if (typeof e.score === 'number') parts.push(e.score / 100)
  if (!parts.length) return null
  return Math.max(0.06, Math.min(1, Math.max(...parts)))
}

export function historyBar(e: HistoryEvent, now: number): number | null {
  if (e.tense === 'past') return historyMark(e)
  if (e.tense !== 'present') return null
  if (!OPEN_ENDED.has(e.kind)) {
    const clock = historySpanProgress(e, now)
    if (clock !== null) return clock
  }
  if (typeof e.pct === 'number' && e.pct !== 0) return Math.max(0.08, Math.min(1, Math.abs(e.pct) / 20))
  if (typeof e.pnl_usd === 'number' && e.pnl_usd !== 0) {
    const base = Math.abs(e.amount_usd ?? 0) || 250
    return Math.max(0.08, Math.min(1, Math.abs(e.pnl_usd) / base))
  }
  return null
}

const DETAIL: Record<string, string> = {
  call_made: 'call', call_due: 'open', call_awaiting: 'awaiting price', call_resolved: 'resolved',
  call_withdrawn: 'withdrawn', agent_launched: 'launched', agent_closed: 'closed', agent_running: 'running',
  agent_released: 'capital back', strategy_created: 'draft', backtest: 'backtest',
  trade_buy: 'buy', trade_sell: 'sell', position_open: 'open', paper_open: 'open', paper_closed: 'closed',
  wallet_created: 'wallet', wallet_funded: 'funding', news_reaction: 'reaction', news_comment: 'comment',
  news_bookmark: 'saved', news_share: 'share', agent_followed: 'following',
  day_digest: 'activity', joined: 'joined', demo_ends: 'demo ends',
}

/** The word next to the asset. The percent stays in the value column, so it is not repeated here. */
export function historyDetail(e: HistoryEvent): string {
  if (e.kind === 'day_digest') return e.subtitle || e.title
  const tf = typeof e.data?.timeframe === 'string' ? e.data.timeframe.trim() : ''
  const kind = DETAIL[e.kind] ?? historyKindLabel(e.kind)
  if (e.asset && tf) return `${tf} ${kind}`
  if (e.asset) return kind
  if (e.subtitle && e.subtitle !== e.title) return e.subtitle
  return ''
}

export function historyVisual(e: HistoryEvent, now: number): HistoryVisual {
  return {
    state: historyState(e),
    intensity: historyIntensity(e),
    asset: historyAssetTone(e.asset),
    bar: historyBar(e, now),
  }
}

// --------------------------------------------------------------------------- summary
export interface HistorySummary {
  /** Exact counts over the events in view (not EMAs). */
  calls: { made: number; resolved: number; right: number; open: number; avgScore: number | null }
  realized: { paper: number; real: number; n: number }
  open: { calls: number; agents: number; positions: number; paper: number }
  next: HistoryEvent | null
  backtests: { n: number; best: HistoryEvent | null }
  activeDays: number
  span: { first: string | null; last: string | null }
}

export function summarizeHistory(events: HistoryEvent[]): HistorySummary {
  const resolved = events.filter(e => e.kind === 'call_resolved' && (e.status === 'accurate' || e.status === 'missed'))
  const scores = resolved.map(e => e.score).filter((s): s is number => typeof s === 'number')
  const realizedRows = events.filter(e => e.tense === 'past' && typeof e.pnl_usd === 'number' &&
    (e.kind === 'agent_closed' || e.kind === 'paper_closed' || e.kind === 'trade_sell'))
  const sum = (m: Mode) => realizedRows.filter(e => e.mode === m).reduce((s, e) => s + (e.pnl_usd as number), 0)
  // what happens next: the soonest scheduled moment — a future event or the end of an open span
  const ahead = events.filter(e => e.tense === 'future' || (e.tense === 'present' && e.start_at && !OPEN_ENDED.has(e.kind) && e.kind !== 'call_awaiting'))
    .sort((a, b) => ms(a.at) - ms(b.at))
  const backtests = events.filter(e => e.kind === 'backtest')
  // the user's own history span: sample / catalog rows are not "since when you've been here"
  const past = events.filter(e => e.tense === 'past' && !e.sample).map(e => e.at).sort()
  return {
    calls: {
      made: events.filter(e => e.kind === 'call_made').length,
      resolved: resolved.length,
      right: resolved.filter(e => (e.data?.direction_correct ?? e.status === 'accurate') === true).length,
      open: events.filter(e => e.tense === 'present' && (e.kind === 'call_due' || e.kind === 'call_awaiting')).length,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    },
    realized: { paper: sum('paper'), real: sum('real'), n: realizedRows.length },
    open: {
      calls: events.filter(e => e.tense === 'present' && e.lane === 'prediction').length,
      agents: events.filter(e => e.kind === 'agent_running').length,
      positions: events.filter(e => e.kind === 'position_open').length,
      paper: events.filter(e => e.kind === 'paper_open').length,
    },
    next: ahead[0] ?? null,
    backtests: {
      n: backtests.length,
      best: backtests.reduce<HistoryEvent | null>((b, e) => (b === null || (e.pct ?? -Infinity) > (b.pct ?? -Infinity) ? e : b), null),
    },
    activeDays: events.filter(e => e.kind === 'day_digest').length,
    span: { first: past[0] ?? null, last: past[past.length - 1] ?? null },
  }
}

// --------------------------------------------------------------------------- river layout
export interface RiverDomain { from: number; to: number; now: number }

/** Time axis for the river: the chosen past range on the left, NOW at a fixed share, the future that
 *  actually holds events on the right (capped so a 6-month call does not squash the past). */
export function riverDomain(events: HistoryEvent[], range: RangeId, now: number, nowShare = 0.7): RiverDomain {
  let from = historyRangeStart(range, now)
  if (!Number.isFinite(from)) {
    const first = Math.min(...events.map(e => ms(e.start_at ?? e.at)).filter(Number.isFinite), now - 30 * DAY)
    from = first - DAY
  }
  const past = now - from
  const lastFuture = Math.max(now + DAY, ...events.filter(e => e.tense !== 'past').map(e => ms(e.at)).filter(Number.isFinite))
  // the future side gets (1 - nowShare) of the width at the SAME scale as the past when possible
  const sameScale = past * (1 - nowShare) / nowShare
  const to = now + Math.max(DAY, Math.min(lastFuture - now, Math.max(sameScale, 7 * DAY)))
  return { from, to, now }
}

/** x in [0, width]: piecewise linear so NOW sits at `nowShare` of the width whatever the spans are. */
export function riverX(t: number, d: RiverDomain, width: number, nowShare = 0.7): number {
  const nx = width * nowShare
  if (t <= d.now) return Math.max(0, nx * (t - d.from) / Math.max(1, d.now - d.from))
  return Math.min(width, nx + (width - nx) * (t - d.now) / Math.max(1, d.to - d.now))
}

/** Axis ticks: about `n` labelled instants on each side of NOW. */
export function riverTicks(d: RiverDomain, n = 4): { t: number; label: string }[] {
  const ticks: { t: number; label: string }[] = []
  const pastStep = (d.now - d.from) / n
  for (let i = 0; i < n; i++) ticks.push({ t: d.from + i * pastStep, label: riverDate(d.from + i * pastStep, d) })
  const futStep = (d.to - d.now) / 2
  for (let i = 1; i <= 2; i++) ticks.push({ t: d.now + i * futStep, label: riverDate(d.now + i * futStep, d) })
  return ticks
}

function riverDate(t: number, d: RiverDomain) {
  const span = d.to - d.from
  const o: Intl.DateTimeFormatOptions = span > 400 * DAY ? { month: 'short', year: '2-digit' } : span > 3 * DAY ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' }
  return new Date(t).toLocaleDateString('en-US', o)
}

// --------------------------------------------------------------------------- formatting
const KIND_LABEL: Record<string, string> = {
  call_made: 'Call made', call_due: 'Call open', call_awaiting: 'Awaiting price', call_resolved: 'Call resolved',
  call_withdrawn: 'Call withdrawn', agent_launched: 'Agent launched', agent_closed: 'Agent closed',
  agent_running: 'Agent running', agent_released: 'Capital returned', strategy_created: 'Strategy drafted',
  backtest: 'Backtest', trade_buy: 'Buy', trade_sell: 'Sell', position_open: 'Open position', paper_open: 'Open paper bet',
  paper_closed: 'Paper bet closed', wallet_created: 'Wallet', wallet_funded: 'Funding', news_reaction: 'Reaction',
  news_comment: 'Comment', news_bookmark: 'Saved article', news_share: 'Share', agent_followed: 'Following',
  day_digest: 'Activity', joined: 'Joined', demo_ends: 'Demo ends',
}
export const historyKindLabel = (kind: string) => KIND_LABEL[kind] ?? kind.replace(/_/g, ' ')

/** The facts shown when a row is opened: only what the event actually carries, never placeholders. */
export function historyFacts(e: HistoryEvent, timeZone = 'UTC'): { label: string; value: string }[] {
  const f: { label: string; value: string }[] = []
  const add = (label: string, v: unknown, fmt: (x: any) => string = x => String(x)) => {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return
    f.push({ label, value: fmt(v) })
  }
  const d = e.data ?? {}
  const when = (iso: string) => {
    const clock = histClockTime(iso, timeZone)
    const date = (() => {
      try {
        return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
      } catch {
        return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
      }
    })()
    return clock ? `${date}, ${clock}` : date
  }
  if (!OPEN_ENDED.has(e.kind)) add(e.start_at ? 'Ends' : 'When', e.at, when)
  add('Started', e.start_at, when)
  add('Asset', e.asset)
  add('Mode', e.mode, m => (m === 'paper' ? 'Paper (simulated cash)' : m === 'backtest' ? 'Backtest (replayed history)' : 'Real wallet record'))
  if (e.lane === 'prediction') {
    add('Timeframe', d.timeframe)
    add('Confidence', d.confidence, c => `${c}/5`)
    add('From', d.reference_price, histPrice)
    add('Target', d.predicted_price, histPrice)
    add('Resolved at', d.resolved_price, histPrice)
    add(e.kind === 'call_resolved' ? 'Realised move' : 'Called move', e.pct, histPct)
    add('Score', e.score, s => `${Math.round(s)}/100`)
    add('Error', d.error_pct, x => `${Number(x).toFixed(2)}%`)
    if (d.revisions) add('Moved', d.revisions, n => `${n}×`)
    if (d.saw_friends_first) add('Looked at friends first', 'yes')
    if (d.unsynced) add('Sync', 'Only on this device so far')
  } else {
    add('Amount', e.amount_usd, histUsd)
    add('P&L', e.pnl_usd, histSignedUsd)
    add('Return', e.pct, histPct)
  }
  if (e.kind === 'backtest') {
    const m = d.metrics ?? {}
    add('Trades', m.trades)
    add('Win rate', m.win_rate, w => `${Math.round(w * 100)}%`)
    add('Max drawdown', m.max_dd_pct, x => `${Number(x).toFixed(1)}%`)
    add('Buy & hold', d.benchmark?.buy_hold_pct, histPct)
    add('Bars', d.window ? `${d.window.bars} × ${d.window.interval} ${d.window.symbol}` : null)
    add('Engine', d.engine)
  }
  if (e.lane === 'agent') {
    add('Closed trades', d.closed)
    add('Win rate', d.win_rate, w => `${Math.round(w * 100)}%`)
    add('Open positions', d.open_positions)
    add('Conditions', d.conditions)
    add('Frequency', d.frequency)
  }
  if (e.kind.startsWith('trade_') || e.kind === 'position_open') {
    add('Quantity', d.qty)
    add(e.kind === 'position_open' ? 'Average price' : 'Price', d.price ?? d.avg, histPrice)
    add('Mark', d.mark, histPrice)
    add('Fee', d.fee, x => `$${Number(x).toFixed(2)}`)
    add('Wallet', d.wallet)
  }
  if (e.kind === 'day_digest') {
    for (const [k, n] of Object.entries(d.counts ?? {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6)) add(k.replace(/_/g, ' '), n)
  }
  if (e.sample) add('Origin', e.source === 'catalog' ? 'Sample catalog data' : 'Pre-filled demo history (real prices)')
  return f
}

export function histPrice(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : 4
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function histPct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return '—'
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}%`
}

export function histSignedUsd(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—'
  return `${x >= 0 ? '+' : '−'}$${Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function histUsd(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—'
  return `$${x.toLocaleString('en-US', { maximumFractionDigits: x >= 100 ? 0 : 2 })}`
}

/** Same clock as the header: 24-hour, in the appearance timezone. */
export function histClockTime(iso: string, timeZone: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const fmt = (zone: string) => new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  try { return fmt(timeZone) } catch { return fmt('UTC') }
}

/** "in 3 d", "2 h ago" — coarse on purpose (the exact time is one tap away). */
export function histRelTime(iso: string, now: number): string {
  const dt = ms(iso) - now
  const a = Math.abs(dt)
  const unit = a < 3_600_000 ? [60_000, 'min'] : a < DAY ? [3_600_000, 'h'] : a < 60 * DAY ? [DAY, 'd'] : a < 730 * DAY ? [30 * DAY, 'mo'] : [365 * DAY, 'y']
  const n = Math.max(1, Math.round(a / (unit[0] as number)))
  return dt >= 0 ? `in ${n} ${unit[1]}` : `${n} ${unit[1]} ago`
}
