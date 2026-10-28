/**
 * Notification contract v1 — shared by the backend (`apps/notifications`), the store
 * (`stores/notifications.ts`), the pure model (`utils/notifications.ts`) and the UI
 * (`pages/notifications.vue`, `components/Notification/*`).
 *
 * Every notification answers the same questions, always in the same fields:
 *   WHEN   when.occurred_at (+ when.due_at for deadlines)
 *   WHAT   domain + event + what.* (the subject: a prediction, a bot, a trade…)
 *   WHERE  where.route (+ where.anchor): the page / component a click opens
 *   WHO    who.*  — who acted: you, one of your bots or agents, a friend, the system
 *   TO     to.*   — who receives it (always the signed-in user in v1)
 *   FROM   from.* — which subsystem produced it, and whether the server or this browser did
 *   HOW WELL outcome.* — the measured result (score, P&L, hit rate…), when there is one
 *
 * IDENTITY — the `key` is the clear id code:
 *     <domain>.<event>:<subject_id>[:<qualifier>]
 *   e.g. prediction.due_soon:pred_1792_ab12:24h · prediction.resolved:pred_1792_ab12
 *        bot.trades:bot_001:2026-10-25 · bot.guardrail:bot_001:3 · alert.fired:trg_9
 *        paper.closed:pt_12 · agent.trained:avatar_user_001:e12 · social.friend_call:u_<uuid>:BTC:1W
 *   It is deterministic, so the same fact produced by the server AND by this browser
 *   collapses into one row (the server copy wins). `id` is the server UUID, or
 *   `loc:<key>` for a notification derived in the browser only.
 *   Allowed key characters: [A-Za-z0-9_.:\-] (max 160).
 */

export type NotificationDomain =
  | 'prediction'   // your calls: deadline coming, deadline reached, scored
  | 'bot'          // your bots: started/stopped, trades summary, guardrail fired, P&L
  | 'agent'        // your avatars/agents: trained, opinion moved, plugged into a strategy
  | 'paper'        // paper trades opened/closed with P&L
  | 'alert'        // price triggers you armed fired
  | 'strategy'     // strategy deployed/paused/backtest finished
  | 'social'       // friends' calls on assets you called, follows, messages
  | 'wallet'       // funding, reserve/release to bots
  | 'system'       // account, security, maintenance

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'danger'
export type NotificationActorType = 'user' | 'bot' | 'agent' | 'friend' | 'system'
export type NotificationOrigin = 'server' | 'client'
export type OutcomeUnit = '%' | 'USD' | 'score' | 'count' | 'pp' | 'prob'

export interface NotificationOutcome {
  /** what was measured: 'score' | 'pnl' | 'pnl_pct' | 'hit_rate' | 'error_pct' | 'trades' | … */
  metric: string
  value: number
  unit: OutcomeUnit
  /** direction of the result, never colour alone: the UI also prints the sign */
  tone: 'up' | 'down' | 'neutral'
  /** one human line, e.g. "Score 82/100 · direction right" */
  label: string
  /** optional comparison so a number is never shown without context */
  benchmark?: { label: string; value: number; unit: OutcomeUnit }
}

export interface AppNotification {
  v: 1
  id: string
  key: string
  domain: NotificationDomain
  /** short verb in snake_case: due_soon, due_now, resolved, trades, guardrail, fired, closed, trained… */
  event: string
  severity: NotificationSeverity
  /** 0 low · 1 normal · 2 high · 3 urgent (deadline < 1 h, money at risk) */
  priority: 0 | 1 | 2 | 3
  title: string
  body: string
  when: {
    occurred_at: string        // ISO-8601 UTC
    due_at?: string | null     // deadline the notification is about (prediction target, bot next action)
  }
  what: {
    action: string             // human verb: "Prediction due", "Bot traded", "Alert fired"
    subject_type: 'prediction' | 'bot' | 'agent' | 'paper_trade' | 'trigger' | 'strategy' | 'user' | 'wallet' | 'asset' | 'system'
    subject_id: string
    subject_label: string
    asset?: { id?: string; symbol: string; name?: string; type?: string } | null
  }
  where: {
    route: string              // in-app path, always starts with '/'
    anchor?: string | null     // element id on that page (e.g. 'sec-chart'), no '#'
    query?: Record<string, string> | null
    label: string              // "Bitcoin · prediction chart"
  }
  who: { actor_type: NotificationActorType; actor_id: string; actor_label: string; avatar_url?: string | null }
  to: { recipient_id: string }
  from: { source: NotificationDomain; origin: NotificationOrigin }
  outcome?: NotificationOutcome | null
  state: {
    /** Set when the row has been shown on the notifications page. Drives the nav badge. */
    read_at: string | null
    /** Set only when the user clicks the row open. Distinct from read. */
    opened_at?: string | null
    archived_at?: string | null
  }
  /** rows sharing a group_key can be folded ("3 bots traded today") */
  group_key?: string | null
  expires_at?: string | null
}

/** GET /api/v1/notifications/ */
export interface NotificationPage {
  results: AppNotification[]
  next_before: string | null
  unread: number
}

export const NOTIFICATION_DOMAINS: NotificationDomain[] = [
  'prediction', 'bot', 'agent', 'paper', 'alert', 'strategy', 'social', 'wallet', 'system',
]

export const NOTIFICATION_KEY_RE = /^[A-Za-z0-9_.:\-]{3,160}$/
