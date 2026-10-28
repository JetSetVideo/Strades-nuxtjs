/**
 * Notifications — pure model (no store, no fetch, no Vue). Contract: types/notification.ts.
 *
 * The browser DERIVES the notifications it can prove from data it already holds (your calls,
 * paper trades, price triggers, bots, avatar training) with the SAME keys the server uses, so a
 * fact known on both sides is one row. Server rows win on merge; read state is kept per key.
 * Tested in tests/notifications.test.ts.
 */
import type {
  AppNotification, NotificationDomain, NotificationOutcome, NotificationSeverity,
} from '~/types/notification'
import { NOTIFICATION_KEY_RE } from '~/types/notification'
import { lookupPrice, priceApproach } from '~/utils/priceApproach'

const HOUR = 3_600_000
const DAY = 24 * HOUR

// ── Identity ────────────────────────────────────────────────────────────────

/** `<domain>.<event>:<subject_id>[:<qualifier>]`, sanitised to the allowed alphabet. */
export function notificationKey(domain: NotificationDomain, event: string, subjectId: string, qualifier?: string | number): string {
  const clean = (s: string) => String(s).replace(/[^A-Za-z0-9_.\-]/g, '-').slice(0, 64)
  const k = `${domain}.${clean(event)}:${clean(subjectId)}${qualifier !== undefined && qualifier !== '' ? `:${clean(String(qualifier))}` : ''}`
  return k.slice(0, 160)
}

export function isValidNotificationKey(k: string): boolean {
  return NOTIFICATION_KEY_RE.test(k)
}

export function parseNotificationKey(k: string): { domain: string; event: string; subjectId: string; qualifier?: string } | null {
  const m = /^([a-z]+)\.([a-z_]+):([^:]+)(?::(.+))?$/.exec(k)
  return m ? { domain: m[1]!, event: m[2]!, subjectId: m[3]!, qualifier: m[4] } : null
}

// ── Presentation metadata (labels, glyphs, token colours) ──────────────────

export const DOMAIN_META: Record<NotificationDomain, { label: string; glyph: string; color: string }> = {
  prediction: { label: 'Predictions', glyph: '◎', color: 'var(--primary-blue, #00aaff)' },
  bot:        { label: 'Bots',        glyph: '⚙', color: 'var(--status-active, #00ff88)' },
  agent:      { label: 'Agents',      glyph: '⬡', color: 'var(--domain-agent, #b388ff)' },
  paper:      { label: 'Paper trades', glyph: 'P', color: 'var(--text-light-gray, #cccccc)' },
  alert:      { label: 'Alerts',      glyph: '⚑', color: 'var(--warning-orange, #ffa500)' },
  strategy:   { label: 'Strategies',  glyph: '⟁', color: 'var(--status-saved, #00aaff)' },
  social:     { label: 'Friends',     glyph: '☺', color: 'var(--domain-social, #ff7eb6)' },
  wallet:     { label: 'Wallet',      glyph: '◈', color: 'var(--primary-green, #00ff88)' },
  system:     { label: 'System',      glyph: 'ⓘ', color: 'var(--text-gray, #888888)' },
}

export const SEVERITY_TONE: Record<NotificationSeverity, 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info', success: 'success', warning: 'warning', danger: 'danger',
}

// ── Formatting helpers ─────────────────────────────────────────────────────

export function fmtSigned(v: number, unit: NotificationOutcome['unit'], digits = 2): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  const a = Math.abs(v)
  switch (unit) {
    case 'USD': return `${sign}$${a.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 0 : 2, minimumFractionDigits: a >= 1000 ? 0 : 2 })}`
    case '%': return `${sign}${a.toFixed(digits)} %`
    case 'pp': return `${sign}${a.toFixed(1)} pp`
    case 'prob': return `${(v * 100).toFixed(1)} %`
    case 'score': return `${Math.round(v)}/100`
    default: return `${v}`
  }
}

/** "in 3 h", "in 2 days", "5 min ago", "yesterday". Tomorrow / yesterday are calendar days. */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = t - now
  const a = Math.abs(d)
  const fut = d > 0
  const say = (n: number, u: string) => (fut ? `in ${n} ${u}` : `${n} ${u} ago`)
  if (a < 60_000) return fut ? 'in < 1 min' : 'just now'
  if (a < HOUR) return say(Math.round(a / 60_000), 'min')
  if (a < 12 * HOUR) return say(Math.round(a / HOUR), 'h')
  const dayDiff = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY)
  if (dayDiff === 1) return 'tomorrow'
  if (dayDiff === -1) return 'yesterday'
  if (dayDiff === 0) return say(Math.round(a / HOUR), 'h')
  const days = Math.abs(dayDiff)
  if (days < 45) return say(days, 'days')
  return say(Math.round(days / 30.4), 'months')
}

function iso(t: number): string { return new Date(t).toISOString() }
function assetRoute(symbolOrId: string): string { return `/assets/${encodeURIComponent(String(symbolOrId).toLowerCase())}` }

function base(partial: Omit<AppNotification, 'v' | 'id' | 'state' | 'from' | 'to'> & { recipient: string; origin?: 'client' | 'server' }): AppNotification {
  const { recipient, origin = 'client', ...rest } = partial
  return {
    v: 1, id: `loc:${rest.key}`, ...rest,
    to: { recipient_id: recipient },
    from: { source: rest.domain, origin },
    state: { read_at: null, opened_at: null, archived_at: null },
  }
}

// ── Derivation: predictions (your calls) ───────────────────────────────────

/** Minimal shape of stores/predictions.ts Prediction (kept structural to avoid a store import). */
export interface PredictionLike {
  id: string; userId: string; assetId: string; assetName: string; timestamp: string
  currentPrice: number; predictedPrice: number; predictedChangePct: number; timeframe: string
  targetDate: string; targetTs?: number; horizonHours?: number; status: string
  actualPrice?: number; accuracyScore?: number; demo?: boolean; assetType?: string
}

const TF_HOURS: Record<string, number> = { '1D': 24, '1W': 168, '1M': 720, '3M': 2160, '6M': 4368, '1Y': 8760 }

export function targetOf(p: PredictionLike): number {
  if (p.targetTs) return p.targetTs
  // A date-only target ('2026-10-30', from addPrediction) means the END of that local day, not UTC
  // midnight (which is the previous evening west of Greenwich).
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.targetDate ?? '')
  if (dateOnly) return new Date(+dateOnly[1]!, +dateOnly[2]! - 1, +dateOnly[3]!, 23, 59).getTime()
  const t = Date.parse(p.targetDate)
  return Number.isFinite(t) ? t : Date.parse(p.timestamp) + (TF_HOURS[p.timeframe] ?? 24) * HOUR
}

/** Browser-derived rows older than this are not produced (the server keeps the long history). */
export const LOCAL_WINDOW_MS = 30 * DAY

/**
 * Deadlines and results of the user's own calls:
 *   due_soon:24h  — 24 h before the target, for calls of 3 days or more
 *   due_soon:1h   — 1 h before the target, for calls of 6 h or more   (priority 3)
 *   due_now       — target passed, score not known yet
 *   resolved      — scored (accurate / missed), with the score as outcome
 *   expired       — no price could be found at the target
 * Only notifications whose moment has come are returned (nothing "from the future").
 */
export function deriveFromPredictions(preds: PredictionLike[], now: number, recipient = 'current_user'): AppNotification[] {
  const out: AppNotification[] = []
  for (const p of preds) {
    if (p.userId !== recipient || p.demo) continue
    const target = targetOf(p)
    if (!Number.isFinite(target)) continue
    const made = Date.parse(p.timestamp)
    const horizon = p.horizonHours ?? (Number.isFinite(made) ? (target - made) / HOUR : TF_HOURS[p.timeframe] ?? 24)
    const sym = p.assetId
    const pct = p.predictedChangePct
    const dir = pct >= 0 ? 'up' : 'down'
    const callLabel = `${p.timeframe} call on ${p.assetName || sym}`
    const common = {
      what: { action: 'Prediction', subject_type: 'prediction' as const, subject_id: p.id, subject_label: callLabel,
              asset: { symbol: sym, name: p.assetName, type: p.assetType } },
      where: { route: assetRoute(sym), anchor: 'sec-chart', query: { call: p.id }, label: `${p.assetName || sym} · prediction chart` },
      who: { actor_type: 'user' as const, actor_id: recipient, actor_label: 'You' },
      group_key: `prediction:${sym}`,
      recipient,
    }
    const fmtTarget = new Date(target).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const callLine = `You called ${sym} ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)} % (${p.predictedPrice}) for ${fmtTarget}.`
    // The browser ages rows out after 30 days; the server keeps the history.
    if (target < now - LOCAL_WINDOW_MS) continue
    // Copy never carries a relative time ("in 24 h" rots): the row shows the deadline itself and the
    // UI renders the live "in 3 h" from when.due_at.
    // The browser's own `expired` (set at the first UTC midnight, without any price lookup) is NOT a
    // verdict: only the server says a call could not be scored, so a local expiry reads as due_now.
    const status = p.status === 'expired' && typeof p.accuracyScore !== 'number' ? 'pending' : p.status

    if (status === 'pending') {
      if (horizon >= 72 && now >= target - DAY && now < target) {
        out.push(base({ ...common, key: notificationKey('prediction', 'due_soon', p.id, '24h'), domain: 'prediction', event: 'due_soon',
          severity: 'info', priority: 1, title: `${sym} call closes ${fmtTarget}`, body: `${callLine} About a day left to move it.`,
          when: { occurred_at: iso(target - DAY), due_at: iso(target) }, outcome: null }))
      }
      if (horizon >= 6 && now >= target - HOUR && now < target) {
        out.push(base({ ...common, key: notificationKey('prediction', 'due_soon', p.id, '1h'), domain: 'prediction', event: 'due_soon',
          severity: 'warning', priority: 3, title: `${sym} call closes within the hour`, body: `${callLine} Last chance to move it.`,
          when: { occurred_at: iso(target - HOUR), due_at: iso(target) }, outcome: null }))
      }
      if (now >= target) {
        out.push(base({ ...common, key: notificationKey('prediction', 'due_now', p.id), domain: 'prediction', event: 'due_now',
          severity: 'info', priority: 2, title: `${sym} call reached its date`, body: `${callLine} Scoring as soon as the price at that date is known.`,
          when: { occurred_at: iso(target), due_at: iso(target) }, outcome: null }))
      }
      continue
    }
    if (status === 'accurate' || status === 'missed') {
      const score = typeof p.accuracyScore === 'number' ? p.accuracyScore : null
      const actual = typeof p.actualPrice === 'number' ? p.actualPrice : null
      const realised = actual !== null && p.currentPrice ? Math.round((actual / p.currentPrice - 1) * 1e6) / 1e4 : null
      // "hit" = the score threshold (>= 60/100), same rule as the server; the direction is said separately.
      const good = score !== null ? score >= 60 : status === 'accurate'
      const dirRight = realised !== null ? (realised >= 0) === (pct >= 0) : null
      out.push(base({ ...common, key: notificationKey('prediction', 'resolved', p.id), domain: 'prediction', event: 'resolved',
        severity: good ? 'success' : 'warning', priority: 2,
        title: `${sym} call ${good ? 'hit' : 'missed'}${score !== null ? ` · ${Math.round(score)}/100` : ''}`,
        body: `${callLine}${actual !== null ? ` The price was ${actual}${realised !== null ? ` (${realised >= 0 ? '+' : '−'}${Math.abs(realised).toFixed(2)} %)` : ''}.` : ''}${dirRight !== null ? ` Direction ${dirRight ? 'right' : 'wrong'}.` : ''}`,
        when: { occurred_at: iso(target), due_at: iso(target) },
        outcome: score !== null
          ? { metric: 'score', value: score, unit: 'score', tone: good ? 'up' : 'down',
              label: `Score ${Math.round(score)}/100 · you said ${dir}`,
              benchmark: realised !== null ? { label: 'actual move', value: realised, unit: '%' } : undefined }
          : null }))
    }
  }
  return out
}

// ── Derivation: paper trades ───────────────────────────────────────────────

export interface PaperTradeLike {
  id: string; timestamp: string; asset_id: string; asset_symbol: string; side: 'buy' | 'sell'
  wallet_pct: number; simulated_price: number; status: 'open' | 'closed'; closed_at?: string
  closed_price?: number; realized_pnl_pct?: number; realized_pnl_value?: number; strategy_id?: string; agent_id?: string
}

export function deriveFromPaper(trades: PaperTradeLike[], recipient = 'current_user', names: Record<string, string> = {}, now = Date.now()): AppNotification[] {
  return trades.flatMap((t) => {
    if (Date.parse(t.closed_at ?? t.timestamp) < now - LOCAL_WINDOW_MS) return []
    const actor = t.agent_id ? { actor_type: 'agent' as const, actor_id: t.agent_id, actor_label: names[t.agent_id] ?? 'Your agent' }
      : t.strategy_id ? { actor_type: 'bot' as const, actor_id: t.strategy_id, actor_label: names[t.strategy_id] ?? 'A strategy' }
        : { actor_type: 'user' as const, actor_id: recipient, actor_label: 'You' }
    const common = {
      domain: 'paper' as const, group_key: `paper:${t.asset_symbol}`, who: actor, recipient,
      what: { action: 'Paper trade', subject_type: 'paper_trade' as const, subject_id: t.id,
              subject_label: `${t.side.toUpperCase()} ${t.asset_symbol} · ${t.wallet_pct}% of wallet`, asset: { id: t.asset_id, symbol: t.asset_symbol } },
      where: { route: assetRoute(t.asset_id || t.asset_symbol), anchor: 'sec-trade', label: `${t.asset_symbol} · paper trade` },
    }
    if (t.status === 'closed' && t.closed_at) {
      const pnl = t.realized_pnl_pct ?? 0
      return [base({ ...common, key: notificationKey('paper', 'closed', t.id), event: 'closed',
        severity: pnl >= 0 ? 'success' : 'warning', priority: 1,
        title: `Paper ${t.side} ${t.asset_symbol} closed ${pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toFixed(2)} %`,
        body: `${actor.actor_label} ${t.side === 'buy' ? 'bought' : 'sold'} at ${t.simulated_price} and closed at ${t.closed_price ?? '—'}.`,
        when: { occurred_at: t.closed_at }, outcome: { metric: 'pnl_pct', value: pnl, unit: '%', tone: pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'neutral',
          label: t.realized_pnl_value !== undefined ? `${fmtSigned(t.realized_pnl_value, 'USD')} hypothetical` : 'hypothetical P&L' } })]
    }
    return [base({ ...common, key: notificationKey('paper', 'opened', t.id), event: 'opened', severity: 'info', priority: 0,
      title: `Paper ${t.side} ${t.asset_symbol} opened`, body: `${actor.actor_label} put ${t.wallet_pct}% of the wallet at ${t.simulated_price}.`,
      when: { occurred_at: t.timestamp }, outcome: null })]
  })
}

// ── Derivation: price triggers (alerts) ────────────────────────────────────

export interface TriggerLike {
  id: string; asset_id: string; kind: 'cross_above' | 'cross_below'; target_price: number
  current_price_at_creation: number; note?: string; status: string; created_at: number; triggered_at?: number
}

/** `symbols` maps asset id → ticker (triggers store the asset id, e.g. 'bitcoin'). */
export function deriveFromTriggers(triggers: TriggerLike[], recipient = 'current_user', symbols: Record<string, string> = {}, now = Date.now()): AppNotification[] {
  return triggers.filter(t => t.status === 'triggered' && t.triggered_at && t.triggered_at >= now - LOCAL_WINDOW_MS).map((t) => {
    const sym = symbols[t.asset_id] ?? t.asset_id.toUpperCase()
    const move = t.current_price_at_creation ? (t.target_price / t.current_price_at_creation - 1) * 100 : 0
    return base({
      key: notificationKey('alert', 'fired', t.id), domain: 'alert', event: 'fired', severity: 'warning', priority: 2, recipient,
      title: `${sym} crossed ${t.kind === 'cross_above' ? 'above' : 'below'} ${t.target_price}`,
      body: `Your alert set at ${t.current_price_at_creation} fired${t.note ? ` — “${t.note}”` : ''}.`,
      when: { occurred_at: iso(t.triggered_at!) },
      what: { action: 'Price alert', subject_type: 'trigger', subject_id: t.id, subject_label: `${sym} ${t.kind.replace('_', ' ')} ${t.target_price}`, asset: { id: t.asset_id, symbol: sym } },
      where: { route: assetRoute(t.asset_id), anchor: 'sec-chart', label: `${sym} · price chart` },
      who: { actor_type: 'system', actor_id: 'alerts', actor_label: 'Price alerts' },
      outcome: { metric: 'move_from_set', value: move, unit: '%', tone: move >= 0 ? 'up' : 'down', label: `${fmtSigned(move, '%')} since you set it` },
      group_key: `alert:${sym}`,
    })
  })
}

/**
 * A call or an armed alert whose live price has entered the last 20% of the gap
 * it was set against. The key stays put while the warning is true, so marking it
 * seen survives the next price tick. Copy states the gap closed, not a rotting "in 2 h".
 */
export function deriveClosing(
  preds: PredictionLike[],
  triggers: TriggerLike[],
  prices: Record<string, number>,
  now: number,
  recipient = 'current_user',
  symbols: Record<string, string> = {},
): AppNotification[] {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  const today = iso(day.getTime())
  const out: AppNotification[] = []
  for (const p of preds) {
    if (p.userId !== recipient || p.demo || p.status !== 'pending') continue
    const target = targetOf(p)
    if (!Number.isFinite(target) || target <= now) continue
    const live = lookupPrice(prices, p.assetId)
    if (live == null) continue
    const made = Date.parse(p.timestamp)
    const ap = priceApproach(p.currentPrice, p.predictedPrice, live, now - made)
    if (!ap.closing) continue
    const sym = p.assetId
    const closed = Math.round((1 - ap.remaining) * 100)
    out.push(base({
      key: notificationKey('prediction', 'closing', p.id), domain: 'prediction', event: 'closing',
      severity: 'warning', priority: 2, recipient,
      title: `${sym} is nearing your ${p.timeframe} call`,
      body: `${p.assetName || sym} has closed ${closed}% of the gap from ${compactPrice(p.currentPrice)} to ${compactPrice(p.predictedPrice)} (${compactPrice(live)} now).`,
      when: { occurred_at: today, due_at: iso(target) },
      what: { action: 'Prediction', subject_type: 'prediction', subject_id: p.id, subject_label: `${p.timeframe} call on ${p.assetName || sym}`,
        asset: { symbol: sym, name: p.assetName, type: p.assetType } },
      where: { route: assetRoute(sym), anchor: 'sec-chart', query: { call: p.id }, label: `${p.assetName || sym} · prediction chart` },
      who: { actor_type: 'system', actor_id: 'alerts', actor_label: 'Price alerts' },
      outcome: { metric: 'gap_closed', value: closed, unit: '%', tone: 'up', label: `${closed}% of the gap closed` },
      group_key: `prediction:${sym}`,
    }))
  }
  for (const t of triggers) {
    if (t.status !== 'armed') continue
    const sym = symbols[t.asset_id] ?? t.asset_id
    const live = lookupPrice(prices, t.asset_id, sym)
    if (live == null) continue
    const ap = priceApproach(t.current_price_at_creation, t.target_price, live, now - t.created_at)
    if (!ap.closing) continue
    const closed = Math.round((1 - ap.remaining) * 100)
    const role = ap.role === 'limit' ? 'limit' : 'support'
    out.push(base({
      key: notificationKey('alert', 'closing', t.id), domain: 'alert', event: 'closing',
      severity: 'warning', priority: 2, recipient,
      title: `${sym} is nearing your ${role} at ${compactPrice(t.target_price)}`,
      body: `Price is ${compactPrice(live)}, ${closed}% of the way from ${compactPrice(t.current_price_at_creation)} to the ${role} you set.`,
      when: { occurred_at: today, due_at: ap.etaMs && ap.etaMs > 0 ? iso(now + ap.etaMs) : undefined },
      what: { action: 'Price alert', subject_type: 'trigger', subject_id: t.id, subject_label: `${sym} ${role} ${compactPrice(t.target_price)}`, asset: { id: t.asset_id, symbol: sym } },
      where: { route: assetRoute(t.asset_id), anchor: 'sec-chart', label: `${sym} · price chart` },
      who: { actor_type: 'system', actor_id: 'alerts', actor_label: 'Price alerts' },
      outcome: { metric: 'gap_closed', value: closed, unit: '%', tone: 'up', label: `${closed}% of the gap closed` },
      group_key: `alert:${sym}`,
    }))
  }
  return out
}

function compactPrice(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : 4
  return v.toLocaleString('en-US', { maximumFractionDigits: digits })
}

// ── Derivation: bots ───────────────────────────────────────────────────────

export interface BotLike {
  id: string; owner_id: string; name: string; agent_id: string; status: string
  trades_today: number; pnl_today_usd: number; pnl_30d_pct: number; capital_allocated_usd: number
  next_action_at: string | null
}

/**
 * Bots the browser knows (stores/bots.ts). `demo` = the bundled sample bots (not the user's own):
 * their rows say "Demo" and stay low priority, so sample numbers are never shown as the user's money.
 * Keys use the UTC day, like the server; copy never says "today" (the row is grouped by its date).
 * The next scheduled order is a calendar item, not a notification (it reschedules every cycle).
 */
export function deriveFromBots(bots: BotLike[], now: number, recipient = 'current_user', opts: { demo?: boolean } = {}): AppNotification[] {
  const day = new Date(now).toISOString().slice(0, 10)
  const dayStart = `${day}T00:00:00.000Z`
  const tag = opts.demo ? 'Demo · ' : ''
  const out: AppNotification[] = []
  for (const b of bots) {
    if (!opts.demo && b.owner_id !== recipient) continue
    const who = { actor_type: 'bot' as const, actor_id: b.id, actor_label: `${tag}${b.name}` }
    const what = { action: 'Bot', subject_type: 'bot' as const, subject_id: b.id, subject_label: `${tag}${b.name}`, asset: null }
    const where = { route: `/bots/${encodeURIComponent(b.id)}`, label: `${b.name} · bot` }
    if (b.status === 'error') {
      out.push(base({ key: notificationKey('bot', 'error', b.id, day), domain: 'bot', event: 'error', severity: 'danger', priority: opts.demo ? 1 : 3, recipient,
        title: `${tag}${b.name} stopped on an error`, body: `It holds $${b.capital_allocated_usd.toLocaleString('en-US')} of capital. Open it to see why.`,
        when: { occurred_at: dayStart }, what, where, who, outcome: null, group_key: `bot:${b.id}` }))
    }
    if (b.trades_today > 0) {
      const pnlPct = b.capital_allocated_usd ? (b.pnl_today_usd / b.capital_allocated_usd) * 100 : 0
      out.push(base({ key: notificationKey('bot', 'daily', b.id, day), domain: 'bot', event: 'daily',
        severity: b.pnl_today_usd >= 0 ? 'success' : 'warning', priority: opts.demo ? 0 : 1, recipient,
        title: `${tag}${b.name}: ${b.trades_today} trade${b.trades_today === 1 ? '' : 's'}, ${fmtSigned(b.pnl_today_usd, 'USD')}`,
        body: `Day ${day} (UTC). 30-day result ${fmtSigned(b.pnl_30d_pct, '%')} on $${b.capital_allocated_usd.toLocaleString('en-US')} allocated.`,
        when: { occurred_at: dayStart }, what, where, who, group_key: opts.demo ? 'demo' : 'bot:daily',
        outcome: { metric: 'pnl', value: b.pnl_today_usd, unit: 'USD', tone: b.pnl_today_usd > 0 ? 'up' : b.pnl_today_usd < 0 ? 'down' : 'neutral',
          label: `${fmtSigned(pnlPct, '%')} of its capital that day`, benchmark: { label: '30 days', value: b.pnl_30d_pct, unit: '%' } } }))
    }
  }
  return out
}

/** Bots' next scheduled orders (live bots, within 7 days) for the calendar. */
export function botCalendarItems(bots: BotLike[], now: number): CalendarItem[] {
  return bots.flatMap((b) => {
    const t = b.next_action_at ? Date.parse(b.next_action_at) : NaN
    if (b.status !== 'live' || !Number.isFinite(t) || t < now || t - now > 7 * DAY) return []
    return [{ id: `cal:bot:${b.id}`, day: dayKey(t), at: iso(t), kind: 'notification' as const, domain: 'bot' as const,
      label: `${b.name} next order`, tone: 'neutral' as const, route: `/bots/${encodeURIComponent(b.id)}` }]
  })
}

// ── Derivation: avatar training ────────────────────────────────────────────

export interface TrainingDeltaLike { agent_id: string; applied_at: number; delta: Record<string, number | undefined>; source_event_ids: string[]; note?: string }

/** One row per agent per day: how many of your actions it learned from and the biggest trait move. */
export function deriveFromTraining(deltas: TrainingDeltaLike[], agentNames: Record<string, string>, recipient = 'current_user'): AppNotification[] {
  const groups = new Map<string, { agent: string; day: string; n: number; last: number; sum: Record<string, number> }>()
  for (const d of deltas) {
    // Overflow folds ("Reduced …", no trait delta) are bookkeeping, not learning.
    if (!d.delta || !Object.keys(d.delta).length || /^reduced/i.test(d.note ?? '')) continue
    const day = new Date(d.applied_at).toISOString().slice(0, 10)
    const k = `${d.agent_id}|${day}`
    const g = groups.get(k) ?? { agent: d.agent_id, day, n: 0, last: 0, sum: {} }
    g.n += d.source_event_ids?.length || 1
    g.last = Math.max(g.last, d.applied_at)
    for (const [axis, v] of Object.entries(d.delta)) if (typeof v === 'number') g.sum[axis] = (g.sum[axis] ?? 0) + v
    groups.set(k, g)
  }
  return [...groups.values()].map((g) => {
    const [axis, v] = Object.entries(g.sum).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['', 0]
    const name = agentNames[g.agent] ?? g.agent
    const pp = v * 100
    return base({
      key: notificationKey('agent', 'trained', g.agent, g.day), domain: 'agent', event: 'trained', severity: 'info', priority: 0, recipient,
      title: `${name} learned from ${g.n} of your actions`,
      body: axis ? `Biggest change: ${axis.replace(/_/g, ' ')} ${pp >= 0 ? '+' : '−'}${Math.abs(pp).toFixed(1)} pp.` : 'No trait moved noticeably.',
      when: { occurred_at: iso(g.last) },
      what: { action: 'Agent training', subject_type: 'agent', subject_id: g.agent, subject_label: name, asset: null },
      where: { route: `/agents/${encodeURIComponent(g.agent)}`, label: `${name} · training` },
      who: { actor_type: 'agent', actor_id: g.agent, actor_label: name },
      outcome: axis ? { metric: axis, value: pp, unit: 'pp', tone: 'neutral', label: `${axis.replace(/_/g, ' ')} ${fmtSigned(pp, 'pp')}` } : null,
      group_key: 'agent:trained',
    })
  })
}

// ── Merge, filter, group ───────────────────────────────────────────────────

/**
 * Server rows win over browser rows with the same key. Read state: a server row's own `read_at`
 * is the truth (so "mark unread" on another device wins); `readKeys` (key → ISO) only applies to
 * browser-only rows. A prediction's deadline rows (due_soon / due_now) give way to its result
 * (resolved / expired) whichever side produced it. Sorted newest first; archived and expired dropped.
 */
export function mergeNotifications(server: AppNotification[], local: AppNotification[], readKeys: Record<string, string> = {}, now = Date.now()): AppNotification[] {
  const byKey = new Map<string, AppNotification>()
  for (const n of local) byKey.set(n.key, n)
  for (const n of server) byKey.set(n.key, n)
  const settled = new Set<string>()
  // Per call keep only its latest deadline stage: due_now > due_soon:1h > due_soon:24h.
  const STAGE: Record<string, number> = { '24h': 1, '1h': 2 }
  const stageOf = (n: AppNotification) => (n.event === 'due_now' ? 3 : n.event === 'due_soon' ? (STAGE[n.key.split(':')[2] ?? ''] ?? 1) : 0)
  const latestStage = new Map<string, number>()
  for (const n of byKey.values()) {
    if (n.domain !== 'prediction') continue
    if (n.event === 'resolved' || n.event === 'expired') settled.add(n.what.subject_id)
    const s = stageOf(n)
    if (s) latestStage.set(n.what.subject_id, Math.max(latestStage.get(n.what.subject_id) ?? 0, s))
  }
  const out: { n: AppNotification; t: number }[] = []
  for (const n of byKey.values()) {
    if (n.state.archived_at || readKeys[`archived:${n.key}`]) continue
    if (n.expires_at && Date.parse(n.expires_at) < now) continue
    if (n.domain === 'prediction' && (n.event === 'due_soon' || n.event === 'due_now')
      && (settled.has(n.what.subject_id) || stageOf(n) < (latestStage.get(n.what.subject_id) ?? 0))) continue
    const r = n.from.origin === 'server' ? n.state.read_at : (n.state.read_at ?? readKeys[n.key] ?? null)
    const opened = readKeys[`opened:${n.key}`] ?? null
    const state = r === n.state.read_at && (n.state.opened_at ?? null) === opened
      ? n.state
      : { ...n.state, read_at: r, opened_at: opened }
    out.push({ n: state === n.state ? n : { ...n, state }, t: Date.parse(n.when.occurred_at) })
  }
  return out.sort((a, b) => b.t - a.t || b.n.priority - a.n.priority).map(x => x.n)
}

export interface NotificationFilter { domains?: NotificationDomain[]; unreadOnly?: boolean; unopenedOnly?: boolean; day?: string | null; q?: string }

export function filterNotifications(list: AppNotification[], f: NotificationFilter): AppNotification[] {
  const q = f.q?.trim().toLowerCase()
  return list.filter(n =>
    (!f.domains?.length || f.domains.includes(n.domain))
    && (!f.unreadOnly || !n.state.read_at)
    && (!f.unopenedOnly || !n.state.opened_at)
    && (!f.day || dayKey(Date.parse(n.when.due_at ?? n.when.occurred_at)) === f.day || dayKey(Date.parse(n.when.occurred_at)) === f.day)
    && (!q || `${n.title} ${n.body} ${n.what.subject_label} ${n.what.asset?.symbol ?? ''}`.toLowerCase().includes(q)))
}

export function countByDomain(list: AppNotification[]): Record<NotificationDomain, { total: number; unread: number; unopened: number }> {
  const out = Object.fromEntries(Object.keys(DOMAIN_META).map(d => [d, { total: 0, unread: 0, unopened: 0 }])) as Record<NotificationDomain, { total: number; unread: number; unopened: number }>
  for (const n of list) {
    const c = out[n.domain]
    if (!c) continue
    c.total++
    if (!n.state.read_at) c.unread++
    if (!n.state.opened_at) c.unopened++
  }
  return out
}

/** Remaining time as `8h 14m 02s` or `14m 02s`. Minutes and seconds are always present. */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const sign = ms < 0 ? '−' : ''
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60) % 60
  const h = Math.floor(totalSec / 3600) % 24
  const d = Math.floor(totalSec / 86400)
  const pad = (n: number) => String(n).padStart(2, '0')
  const body = d > 0
    ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`
    : h > 0
      ? `${h}h ${pad(m)}m ${pad(s)}s`
      : `${pad(m)}m ${pad(s)}s`
  return sign + body
}

/** Same clock, stopped at the minute. Seconds are dropped, not rounded up. */
export function formatCountdownMinutes(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const sign = ms < 0 ? '−' : ''
  const totalMin = Math.floor(Math.abs(ms) / 60_000)
  const m = totalMin % 60
  const h = Math.floor(totalMin / 60) % 24
  const d = Math.floor(totalMin / 1440)
  const pad = (n: number) => String(n).padStart(2, '0')
  const body = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}m`
  return sign + body
}

/** One scheduled moment: a call's target, a bot's next order, a nearing level, or another deadline. */
export interface UpcomingNotice {
  id: string
  /** Stable sort key (the deadline, or a 5-minute bucket for a level that has no date). */
  at: number
  title: string
  detail: string
  /** Extra line for the opened track: price, when it was made, how much of the gap is gone. */
  more: string
  domain: NotificationDomain
  href: string
  /** Price is inside the last 20% of the gap. Sorted ahead of ordinary deadlines. */
  urgent: boolean
  /**
   * False when `at` is not a real deadline (a level with no measured pace yet).
   * The big clock ignores these. `clock` is what the card shows instead.
   */
  paced?: boolean
  clock?: string
}

function madeLabel(isoStamp: string): string {
  const t = Date.parse(isoStamp)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** A level has no calendar deadline. Park it on a 5-minute grid so the board does not retrain every tick. */
function levelDue(now: number, etaMs: number | null, remaining: number): number {
  const ms = etaMs && etaMs > 0 ? etaMs : Math.max(HOUR, remaining * 24 * HOUR)
  const bucket = 5 * 60_000
  const base = now - (now % bucket)
  return base + Math.max(bucket, Math.round(ms / bucket) * bucket)
}

/**
 * What is still ahead.
 * Every pending call you made is listed, however far its date is.
 * Armed price limits are listed only while price is inside the last 20% of the gap.
 * Live bots and other deadlines stay inside 7 days so sample data does not flood the board.
 * Nearing items sort first; everything else is soonest first. The list is not capped.
 */
export function upcomingNotices(
  items: AppNotification[],
  calls: PredictionLike[],
  bots: BotLike[],
  now: number,
  opts: { recipient?: string; prices?: Record<string, number>; levels?: TriggerLike[]; symbols?: Record<string, string> } = {},
): UpcomingNotice[] {
  const who = opts.recipient ?? 'current_user'
  const byId = new Map<string, UpcomingNotice>()
  for (const p of calls) {
    if (p.userId !== who || p.demo || p.status !== 'pending') continue
    const at = targetOf(p)
    if (!Number.isFinite(at) || at <= now) continue
    const sym = p.assetId
    const live = lookupPrice(opts.prices, sym)
    const ap = live != null ? priceApproach(p.currentPrice, p.predictedPrice, live, now - Date.parse(p.timestamp)) : null
    const pct = `${p.predictedChangePct >= 0 ? '+' : '−'}${Math.abs(p.predictedChangePct).toFixed(1)}%`
    const made = madeLabel(p.timestamp)
    const gap = ap?.closing ? `${Math.round((1 - ap.remaining) * 100)}% of the gap closed` : ''
    byId.set(`call:${p.id}`, {
      id: `call:${p.id}`, at, title: p.assetName || sym,
      detail: ap?.closing ? `${p.timeframe} call · nearing` : `${p.timeframe} call`,
      more: [`${p.timeframe} · ${pct}`, `target ${compactPrice(p.predictedPrice)}`, made ? `made ${made}` : '', gap].filter(Boolean).join(' · '),
      domain: 'prediction', urgent: !!ap?.closing,
      href: `${assetRoute(sym)}?${new URLSearchParams({ call: p.id }).toString()}#sec-chart`,
    })
  }
  for (const b of bots) {
    if (b.status !== 'live') continue
    const at = b.next_action_at ? Date.parse(b.next_action_at) : NaN
    if (!Number.isFinite(at) || at <= now || at - now > 7 * DAY) continue
    byId.set(`bot:${b.id}`, {
      id: `bot:${b.id}`, at, title: b.name, detail: 'next order', more: 'Live bot · next order',
      domain: 'bot', href: `/bots/${encodeURIComponent(b.id)}`, urgent: false,
    })
  }
  for (const t of opts.levels ?? []) {
    if (t.status !== 'armed') continue
    const sym = opts.symbols?.[t.asset_id] ?? t.asset_id
    const live = lookupPrice(opts.prices, t.asset_id, sym)
    if (live == null) continue
    const ap = priceApproach(t.current_price_at_creation, t.target_price, live, now - t.created_at)
    if (!ap.closing) continue
    const role = ap.role === 'limit' ? 'limit' : 'support'
    const id = `alert:${t.id}`
    const closed = Math.round((1 - ap.remaining) * 100)
    const paced = ap.etaMs != null && ap.etaMs > 0
    byId.set(id, {
      id, at: paced ? levelDue(now, ap.etaMs, ap.remaining) : now + 60_000, title: sym,
      detail: `${role} · nearing`,
      more: [`${role} ${compactPrice(t.target_price)}`, `now ${compactPrice(live)}`, `${closed}% of the gap closed`].join(' · '),
      domain: 'alert', href: `${assetRoute(t.asset_id)}#sec-chart`, urgent: true,
      paced, clock: paced ? undefined : `${closed}%`,
    })
  }
  for (const n of items) {
    const at = n.when.due_at ? Date.parse(n.when.due_at) : NaN
    if (!Number.isFinite(at) || at <= now || at - now > 7 * DAY) continue
    if (n.domain === 'prediction' && byId.has(`call:${n.what.subject_id}`)) continue
    if (n.domain === 'bot' && byId.has(`bot:${n.what.subject_id}`)) continue
    if (n.domain === 'alert' && (byId.has(`alert:${n.what.subject_id}`) || n.event === 'closing')) continue
    const id = `n:${n.key}`
    if (byId.has(id)) continue
    const loc = notificationLocation(n)
    const q = loc.query && Object.keys(loc.query).length ? `?${new URLSearchParams(loc.query).toString()}` : ''
    byId.set(id, {
      id, at, title: n.what.asset?.symbol || n.what.subject_label || n.title,
      detail: n.title, more: n.body.replace(/\s+/g, ' ').slice(0, 180),
      domain: n.domain, href: `${loc.path}${q}${loc.hash ?? ''}`, urgent: n.event === 'closing',
    })
  }
  return [...byId.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.at - b.at || (a.id < b.id ? -1 : 1))
}

/** Local calendar day 'YYYY-MM-DD'. */
export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(key: string, now: number): string {
  const today = dayKey(now)
  const yest = dayKey(now - DAY)
  const tom = dayKey(now + DAY)
  if (key === today) return 'Today'
  if (key === yest) return 'Yesterday'
  if (key === tom) return 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
}

/** Groups by local day of occurred_at; groups ordered newest day first, rows keep their order. */
export function groupByDay(list: AppNotification[], now: number): { day: string; label: string; items: AppNotification[] }[] {
  const byDay = new Map<string, AppNotification[]>()
  for (const n of list) {
    const k = dayKey(Date.parse(n.when.occurred_at))
    const g = byDay.get(k)
    if (g) g.push(n)
    else byDay.set(k, [n])
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, items]) => ({ day, label: dayLabel(day, now), items }))
}

/** In-app sections a notification may open. Anything else falls back to /notifications. */
const ROUTE_PREFIXES = ['/assets/', '/bots/', '/agents/', '/calendar', '/notifications', '/wallet', '/strategies', '/strategy/', '/profile', '/predict', '/historic', '/chat', '/news', '/prices', '/community']
const ROUTE_RE = /^\/(?![/\\])[^\s\\\u0000-\u001f]{0,254}$/

/** Router location of a notification (validated: in-app paths only, never an external URL). */
export function notificationLocation(n: AppNotification): { path: string; query?: Record<string, string>; hash?: string } {
  const r = typeof n.where.route === 'string' ? n.where.route : ''
  const ok = ROUTE_RE.test(r) && ROUTE_PREFIXES.some(p => r === p.replace(/\/$/, '') || r.startsWith(p))
  const path = ok ? r : '/notifications'
  const anchor = n.where.anchor && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(n.where.anchor) ? `#${n.where.anchor}` : undefined
  let query: Record<string, string> | undefined
  if (ok && n.where.query && typeof n.where.query === 'object') {
    const pairs = Object.entries(n.where.query).filter(([k, v]) => /^[A-Za-z0-9_-]{1,32}$/.test(k) && typeof v === 'string' && v.length <= 128).slice(0, 5)
    if (pairs.length) query = Object.fromEntries(pairs)
  }
  return { path, query, hash: ok ? anchor : undefined }
}

// ── Calendar ───────────────────────────────────────────────────────────────

export interface CalendarItem {
  id: string
  day: string                 // dayKey
  at: string                  // ISO
  kind: 'call_due' | 'call_scored' | 'notification' | 'event'
  domain: NotificationDomain | 'market'
  label: string
  symbol?: string
  tone: 'up' | 'down' | 'neutral' | 'pending'
  route?: string
  anchor?: string
  query?: Record<string, string>
}

/** Your calls on the calendar: pending ones on their target day, scored ones too (tone = result). */
export function predictionCalendarItems(preds: PredictionLike[], recipient = 'current_user'): CalendarItem[] {
  return preds.filter(p => p.userId === recipient && !p.demo).map((p) => {
    const t = targetOf(p)
    const scored = p.status === 'accurate' || p.status === 'missed'
    return {
      id: `cal:${p.id}`, day: dayKey(t), at: iso(t), kind: scored ? 'call_scored' : 'call_due', domain: 'prediction',
      label: `${p.assetId} ${p.timeframe} ${p.predictedChangePct >= 0 ? '+' : '−'}${Math.abs(p.predictedChangePct).toFixed(1)} %${scored && typeof p.accuracyScore === 'number' ? ` · ${Math.round(p.accuracyScore)}/100` : ''}`,
      symbol: p.assetId,
      tone: scored ? ((typeof p.accuracyScore === 'number' ? p.accuracyScore >= 60 : p.status === 'accurate') ? 'up' : 'down') : 'pending',
      route: assetRoute(p.assetId), anchor: 'sec-chart', query: { call: p.id },
    }
  })
}

/**
 * Deadlines carried by notifications. Prediction rows are included only for calls this device does
 * not hold (made on another device), so a call is never on the calendar twice.
 */
export function notificationCalendarItems(list: AppNotification[], localCallIds: Set<string> = new Set()): CalendarItem[] {
  const seen = new Set<string>()
  return list.filter((n) => {
    if (!n.when.due_at) return false
    if (n.domain !== 'prediction') return true
    const id = n.what.subject_id
    if (localCallIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  }).map(n => ({
    id: `cal:${n.key}`, day: dayKey(Date.parse(n.when.due_at!)), at: n.when.due_at!,
    kind: n.domain === 'prediction' ? (n.event === 'resolved' ? 'call_scored' as const : 'call_due' as const) : 'notification' as const,
    domain: n.domain, label: n.domain === 'prediction' ? n.what.subject_label : n.title, symbol: n.what.asset?.symbol,
    tone: n.domain === 'prediction' ? (n.event === 'resolved' ? (n.outcome?.tone === 'down' ? 'down' as const : 'up' as const) : 'pending' as const) : 'neutral' as const,
    route: n.where.route, anchor: n.where.anchor ?? undefined, query: n.where.query ?? undefined,
  }))
}

export interface MarketEventLike { id: string; title: string; category: string; starts_at: string; impact: string }

export function eventCalendarItems(events: MarketEventLike[]): CalendarItem[] {
  return events.map((e) => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.starts_at)
    const t = d ? new Date(+d[1]!, +d[2]! - 1, +d[3]!).getTime() : Date.parse(e.starts_at)
    return { id: `cal:ev:${e.id}`, day: dayKey(t), at: iso(t), kind: 'event' as const,
      domain: 'market' as const, label: e.title, tone: 'neutral' as const, route: '/calendar' }
  }).filter(i => i.day !== 'NaN-NaN-NaN')
}

/** 6 x 7 grid (Monday first) for the month of `month` (any date in it). */
export function monthGrid(month: Date, items: CalendarItem[], now: number): { day: string; date: number; inMonth: boolean; isToday: boolean; items: CalendarItem[] }[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const byDay = new Map<string, CalendarItem[]>()
  for (const it of items) {
    const l = byDay.get(it.day)
    if (l) l.push(it)
    else byDay.set(it.day, [it])
  }
  const today = dayKey(now)
  const weeks: ReturnType<typeof monthGrid> = []
  for (let w = 0; w < 6; w++) {
    const row: ReturnType<typeof monthGrid>[number] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      const k = dayKey(date.getTime())
      row.push({ day: k, date: date.getDate(), inMonth: date.getMonth() === month.getMonth(), isToday: k === today,
        items: (byDay.get(k) ?? []).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)) })
    }
    weeks.push(row)
  }
  return weeks
}
