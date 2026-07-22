import { defineStore } from 'pinia'
import { useTrainingStore, type TrainingEventType } from '~/stores/training'
import { useAgentsStore } from '~/stores/agents'

/**
 * Activity Log — durable interaction journal for Avatar training & trading profile.
 *
 * Captures the 5 axes of every interaction:
 *   where  — page / component
 *   when   — ISO timestamp
 *   what   — action + target + category
 *   why    — intent + contextual signals (dwell, referrer, market state)
 *   with   — friend profiles when sharing / chatting
 *
 * Reduction phase: when raw entries exceed `reduceThreshold`, similar events are
 * compacted into summary rows so the log stays bounded while still training the
 * Avatar and powering trading-profile records.
 */

export type ActivityCategory =
  | 'navigation'
  | 'content'
  | 'trading'
  | 'social'
  | 'share'
  | 'settings'

export interface FriendProfileSnapshot {
  id: string
  username?: string
  trading_style?: string
  specialization?: string[]
  avatar_url?: string
}

export interface ActivityWhere {
  page: string
  route_name?: string
  component?: string
}

export interface ActivityWhat {
  action: string
  target: string
  category: ActivityCategory
}

export interface ActivityWhy {
  intent?: string
  context?: Record<string, unknown>
}

export interface ActivityWith {
  friend_ids: string[]
  friend_profiles?: FriendProfileSnapshot[]
  conversation_id?: string
}

export interface ActivityLogEntry {
  id: string
  when: string
  where: ActivityWhere
  what: ActivityWhat
  why: ActivityWhy
  with?: ActivityWith
  session_id?: string
  duration_ms?: number
  /** True when this row is a compacted summary of multiple raw events */
  reduced?: boolean
  /** How many raw events were folded into this summary */
  count?: number
  from_ts?: string
  to_ts?: string
}

export interface TradingProfileRecord {
  top_pages: Array<{ page: string; visits: number }>
  top_actions: Array<{ action: string; count: number }>
  share_network: Array<{
    friend_id: string
    username?: string
    trading_style?: string
    share_count: number
  }>
  content_affinity: Record<string, number>
  trading_signals: {
    deployments: number
    pauses: number
    allocation_changes: number
    asset_views: number
  }
  last_reduced_at: string | null
  total_interactions: number
  reduced_epochs: number
  raw_retained: number
  summaries_retained: number
}

export interface ActivityLogState {
  raw: ActivityLogEntry[]
  summaries: ActivityLogEntry[]
  profile: TradingProfileRecord
  reduceThreshold: number
  retainRawAfterReduce: number
  maxSummaries: number
  sessionId: string | null
  hydrated: boolean
  lastReduceAt: number | null
  totalLogged: number
}

const STORAGE_KEY = 'strades_activity_log_v1'

const DEFAULT_PROFILE = (): TradingProfileRecord => ({
  top_pages: [],
  top_actions: [],
  share_network: [],
  content_affinity: {},
  trading_signals: {
    deployments: 0,
    pauses: 0,
    allocation_changes: 0,
    asset_views: 0,
  },
  last_reduced_at: null,
  total_interactions: 0,
  reduced_epochs: 0,
  raw_retained: 0,
  summaries_retained: 0,
})

/** Map activity actions → training event types when a bridge exists */
const ACTION_TO_TRAINING: Partial<Record<string, TrainingEventType>> = {
  page_view: 'page_route',
  asset_view: 'asset_click',
  asset_click: 'asset_click',
  allocation_change: 'allocation_change',
  strategy_deploy: 'strategy_deploy',
  strategy_pause: 'strategy_pause',
  chat_message: 'chat_message_sent',
  friend_added: 'friend_added',
  search: 'search_used',
  share_asset: 'share_asset',
  share_opinion: 'share_opinion',
  share_strategy: 'share_strategy',
  share_article: 'share_article',
  article_dwell: 'article_dwell',
}

let _counter = 0
const nextId = (prefix = 'al') => `${prefix}_${Date.now()}_${++_counter}`

const reduceKey = (e: ActivityLogEntry): string =>
  `${e.where.page}|${e.what.action}|${e.what.target}|${e.what.category}`

function bumpCount(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] ?? 0) + n
}

export const useActivityLogStore = defineStore('activityLog', {
  state: (): ActivityLogState => ({
    raw: [],
    summaries: [],
    profile: DEFAULT_PROFILE(),
    reduceThreshold: 120,
    retainRawAfterReduce: 40,
    maxSummaries: 80,
    sessionId: null,
    hydrated: false,
    lastReduceAt: null,
    totalLogged: 0,
  }),

  getters: {
    /** Chronological feed: recent raw + summaries for UI */
    recentFeed: (state): ActivityLogEntry[] => {
      const merged = [...state.raw, ...state.summaries]
      return merged
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 40)
    },

    needsReduce: (state): boolean => state.raw.length >= state.reduceThreshold,

    shareInteractions: (state): ActivityLogEntry[] =>
      [...state.raw, ...state.summaries].filter(
        e => e.what.category === 'share' || (e.with?.friend_ids?.length ?? 0) > 0
      ),

    tradingRecords: (state): TradingProfileRecord => state.profile,
  },

  actions: {
    ensureSession() {
      if (this.sessionId) return this.sessionId
      this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      return this.sessionId
    },

    async hydrate() {
      if (this.hydrated) return
      if (import.meta.client) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<ActivityLogState>
            this.raw = parsed.raw ?? []
            this.summaries = parsed.summaries ?? []
            this.profile = { ...DEFAULT_PROFILE(), ...(parsed.profile ?? {}) }
            this.totalLogged = parsed.totalLogged ?? this.raw.length
            this.lastReduceAt = parsed.lastReduceAt ?? null
            this.sessionId = parsed.sessionId ?? null
          }
        } catch {
          /* corrupt storage — start fresh */
        }
      }

      // Seed from static file if empty (first visit)
      if (this.raw.length === 0 && this.summaries.length === 0) {
        try {
          const seed = await $fetch<ActivityLogEntry[]>('/data/tracking/activity_log.json')
          if (Array.isArray(seed) && seed.length) {
            this.raw = seed.filter(e => !e.reduced)
            this.summaries = seed.filter(e => e.reduced)
            this.totalLogged = seed.reduce((s, e) => s + (e.count ?? 1), 0)
            this.rebuildProfile()
          }
        } catch {
          /* optional seed */
        }
      }

      this.ensureSession()
      this.hydrated = true
      this.persist()
    },

    persist() {
      if (!import.meta.client) return
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            raw: this.raw,
            summaries: this.summaries,
            profile: this.profile,
            totalLogged: this.totalLogged,
            lastReduceAt: this.lastReduceAt,
            sessionId: this.sessionId,
          })
        )
      } catch {
        /* quota — force a reduce then retry once */
        if (this.raw.length > this.retainRawAfterReduce) {
          this.reduce()
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                raw: this.raw,
                summaries: this.summaries,
                profile: this.profile,
                totalLogged: this.totalLogged,
                lastReduceAt: this.lastReduceAt,
                sessionId: this.sessionId,
              })
            )
          } catch { /* give up */ }
        }
      }
    },

    /**
     * Append one interaction. Optionally bridges into the Avatar training buffer.
     */
    log(input: {
      where: ActivityWhere
      what: ActivityWhat
      why?: ActivityWhy
      with?: ActivityWith
      duration_ms?: number
      feedTraining?: boolean
      trainingPayload?: Record<string, unknown>
    }): ActivityLogEntry {
      this.ensureSession()

      const entry: ActivityLogEntry = {
        id: nextId(),
        when: new Date().toISOString(),
        where: input.where,
        what: input.what,
        why: input.why ?? {},
        with: input.with,
        session_id: this.sessionId ?? undefined,
        duration_ms: input.duration_ms,
      }

      this.raw.push(entry)
      this.totalLogged++

      if (input.feedTraining !== false) {
        this.bridgeToTraining(entry, input.trainingPayload)
      }

      if (this.raw.length >= this.reduceThreshold) {
        this.reduce()
      } else {
        this.rebuildProfile()
        this.persist()
      }

      return entry
    },

    bridgeToTraining(entry: ActivityLogEntry, extra?: Record<string, unknown>) {
      const trainingType = ACTION_TO_TRAINING[entry.what.action]
      if (!trainingType) return

      try {
        const training = useTrainingStore()
        const agents = useAgentsStore()
        training.record(trainingType, {
          agent_id: agents.personalId,
          target: entry.what.target,
          page: entry.where.page,
          intent: entry.why.intent,
          friend_ids: entry.with?.friend_ids,
          conversation_id: entry.with?.conversation_id,
          duration_ms: entry.duration_ms,
          ...(entry.why.context ?? {}),
          ...(extra ?? {}),
        })
      } catch {
        /* training store may not be ready during early boot */
      }
    },

    /**
     * Reducing phase — fold older raw events into compact summaries keyed by
     * where × what, preserving friend-share aggregates. Keeps the newest
     * `retainRawAfterReduce` raw rows intact for live training ticks.
     */
    reduce(): { folded: number; summariesCreated: number } {
      if (this.raw.length <= this.retainRawAfterReduce) {
        this.rebuildProfile()
        this.persist()
        return { folded: 0, summariesCreated: 0 }
      }

      const cutoff = this.raw.length - this.retainRawAfterReduce
      const toFold = this.raw.slice(0, cutoff)
      const keep = this.raw.slice(cutoff)

      const groups = new Map<string, ActivityLogEntry[]>()
      for (const e of toFold) {
        const key = reduceKey(e)
        const list = groups.get(key) ?? []
        list.push(e)
        groups.set(key, list)
      }

      const newSummaries: ActivityLogEntry[] = []
      for (const [, events] of groups) {
        if (events.length === 0) continue
        const first = events[0]!
        const last = events[events.length - 1]!
        const friendMap = new Map<string, FriendProfileSnapshot>()
        let totalDuration = 0
        const intents = new Set<string>()

        for (const e of events) {
          if (e.duration_ms) totalDuration += e.duration_ms
          if (e.why.intent) intents.add(e.why.intent)
          for (const fp of e.with?.friend_profiles ?? []) {
            friendMap.set(fp.id, fp)
          }
          for (const id of e.with?.friend_ids ?? []) {
            if (!friendMap.has(id)) friendMap.set(id, { id })
          }
        }

        const friendProfiles = [...friendMap.values()]
        newSummaries.push({
          id: nextId('sum'),
          when: last.when,
          where: first.where,
          what: first.what,
          why: {
            intent: intents.size === 1
              ? [...intents][0]
              : intents.size > 1
                ? `aggregated:${[...intents].slice(0, 3).join(',')}`
                : 'pattern_repeat',
            context: {
              folded: events.length,
              avg_duration_ms: events.length
                ? Math.round(totalDuration / events.length)
                : 0,
              sample_targets: [...new Set(events.map(e => e.what.target))].slice(0, 5),
            },
          },
          with: friendProfiles.length
            ? {
                friend_ids: friendProfiles.map(f => f.id),
                friend_profiles: friendProfiles,
                conversation_id: events.find(e => e.with?.conversation_id)?.with?.conversation_id,
              }
            : undefined,
          session_id: last.session_id,
          duration_ms: totalDuration || undefined,
          reduced: true,
          count: events.length,
          from_ts: first.when,
          to_ts: last.when,
        })
      }

      this.raw = keep
      this.summaries = [...newSummaries, ...this.summaries].slice(0, this.maxSummaries)
      this.lastReduceAt = Date.now()
      this.profile.reduced_epochs++
      this.profile.last_reduced_at = new Date().toISOString()

      this.rebuildProfile()
      this.persist()

      return { folded: toFold.length, summariesCreated: newSummaries.length }
    },

    /** Recompute trading-profile records from raw + summaries (Avatar training signal). */
    rebuildProfile() {
      const pageCounts: Record<string, number> = {}
      const actionCounts: Record<string, number> = {}
      const affinity: Record<string, number> = {}
      const shareNet = new Map<string, {
        friend_id: string
        username?: string
        trading_style?: string
        share_count: number
      }>()

      const signals = {
        deployments: 0,
        pauses: 0,
        allocation_changes: 0,
        asset_views: 0,
      }

      const visit = (e: ActivityLogEntry) => {
        const n = e.count ?? 1
        bumpCount(pageCounts, e.where.page, n)
        bumpCount(actionCounts, e.what.action, n)
        bumpCount(affinity, e.what.category, n)

        if (e.what.action === 'strategy_deploy') signals.deployments += n
        if (e.what.action === 'strategy_pause') signals.pauses += n
        if (e.what.action === 'allocation_change') signals.allocation_changes += n
        if (e.what.action === 'asset_view' || e.what.action === 'asset_click') {
          signals.asset_views += n
        }

        if (e.with?.friend_ids?.length) {
          for (const id of e.with.friend_ids) {
            const snap = e.with.friend_profiles?.find(f => f.id === id)
            const prev = shareNet.get(id)
            if (prev) {
              prev.share_count += n
              if (snap?.username) prev.username = snap.username
              if (snap?.trading_style) prev.trading_style = snap.trading_style
            } else {
              shareNet.set(id, {
                friend_id: id,
                username: snap?.username,
                trading_style: snap?.trading_style,
                share_count: n,
              })
            }
          }
        }
      }

      for (const e of this.summaries) visit(e)
      for (const e of this.raw) visit(e)

      const sortTop = (map: Record<string, number>, keyName: 'page' | 'action') =>
        Object.entries(map)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([k, v]) =>
            keyName === 'page'
              ? { page: k, visits: v }
              : { action: k, count: v }
          )

      this.profile = {
        top_pages: sortTop(pageCounts, 'page') as TradingProfileRecord['top_pages'],
        top_actions: sortTop(actionCounts, 'action') as TradingProfileRecord['top_actions'],
        share_network: [...shareNet.values()].sort((a, b) => b.share_count - a.share_count).slice(0, 12),
        content_affinity: affinity,
        trading_signals: signals,
        last_reduced_at: this.profile.last_reduced_at,
        total_interactions: this.totalLogged,
        reduced_epochs: this.profile.reduced_epochs,
        raw_retained: this.raw.length,
        summaries_retained: this.summaries.length,
      }
    },

    clear() {
      this.raw = []
      this.summaries = []
      this.profile = DEFAULT_PROFILE()
      this.totalLogged = 0
      this.lastReduceAt = null
      this.persist()
    },
  },
})
