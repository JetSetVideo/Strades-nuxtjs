import { defineStore } from 'pinia'
import { publicAssetUrl } from '~/composables/useLocalJson'
import type {
  Agent,
  PersonalityMatrix,
} from '~/types/agent'
import { withDeskAgents } from '~/utils/labRoster'

export type {
  Agent,
  AgentKind,
  AgentStatus,
  PersonalityMatrix,
  OpinionVector,
  TrainingState,
  AgentPerformance,
  AgentLineage,
  AgentShareState,
} from '~/types/agent'

export interface AgentsState {
  byId: Record<string, Agent>
  ids: string[]
  personalId: string | null
  hydrated: boolean
  loading: boolean
  error: string | null
  comparisonSlots: [string | null, string | null]
  /** Marketplace compare tray (⇄ on each card): up to COMPARE_MAX agent ids, oldest first. */
  compareIds: string[]
}

// ─── Compare tray (Wave 2 review, REVIEW-15) — pure helpers, tested in tests/review-agentCompare.test.ts ──
export const COMPARE_MAX = 3
export const AGENT_SAMPLE_NOTE = 'Catalog avatars from a bundled sample file (avatars.json): simulated figures, not live trading, not your account.'

/** ⇄ toggles: add (dropping the oldest past `max`) or remove. Returns a new array. */
export function toggleCompareIds(ids: readonly string[], id: string, max = COMPARE_MAX): string[] {
  if (!id) return [...ids]
  if (ids.includes(id)) return ids.filter(x => x !== id)
  const next = [...ids, id]
  return next.length > max ? next.slice(next.length - max) : next
}

/** "LIVE" is never shown in the paper-only MVP: a catalog avatar that runs is "Simulated". */
export function agentStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? '').toLowerCase()
  if (s === 'live') return 'Simulated'
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface CompareColumn {
  id: string
  name: string
  status: string
  pnl: string
  sharpe: string
  win: string
  dd: string
  trades: string
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** One column per agent: PnL / Win / DD / Sharpe when present, "—" otherwise (never a made-up 0). */
export function agentCompareColumns(list: (Pick<Agent, 'id' | 'name'> & {
  performance?: Partial<Agent['performance']> | null
  training_state?: Partial<Agent['training_state']> | null
} | null | undefined)[]): CompareColumn[] {
  return list.filter((a): a is NonNullable<typeof a> => !!a).map(a => {
    const p = a.performance ?? {}
    const winRaw = p.win_rate
    const win = finite(winRaw) ? (winRaw > 1 ? winRaw : winRaw * 100) : null
    return {
      id: a.id,
      name: a.name,
      status: agentStatusLabel(a.training_state?.status),
      pnl: finite(p.live_pnl_pct) ? `${p.live_pnl_pct >= 0 ? '+' : ''}${p.live_pnl_pct.toFixed(1)}%` : '—',
      sharpe: finite(p.sharpe) ? p.sharpe.toFixed(2) : '—',
      win: win == null ? '—' : `${Math.round(win)}%`,
      dd: finite(p.max_drawdown_pct) ? `${p.max_drawdown_pct.toFixed(1)}%` : '—',
      trades: finite(p.trades_total) ? String(p.trades_total) : '—',
    }
  })
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

export const useAgentsStore = defineStore('agents', {
  state: (): AgentsState => ({
    byId: {},
    ids: [],
    personalId: null,
    hydrated: false,
    loading: false,
    error: null,
    comparisonSlots: [null, null],
    compareIds: []
  }),

  actions: {
    async fetchAgents() {
      this.loading = true
      try {
        const url = publicAssetUrl('/data/agents/avatars.json')
        const list = withDeskAgents(await $fetch<Agent[]>(url))
        const byId: Record<string, Agent> = {}
        list.forEach(a => { byId[a.id] = a })
        this.byId = byId
        this.ids = list.map(a => a.id)
        const personal = list.find(a => a.kind === 'personal')
        this.personalId = personal?.id ?? null
        this.hydrated = true
        this.error = null
      } catch (e: any) {
        const list = withDeskAgents([])
        const byId: Record<string, Agent> = {}
        list.forEach(a => { byId[a.id] = a })
        this.byId = byId
        this.ids = list.map(a => a.id)
        this.error = e.message ?? 'failed'
        console.error('agents.fetchAgents', e)
      } finally {
        this.loading = false
      }
    },

    /** Apply an in-place patch to an agent (called by training pipeline). */
    patchAgent(id: string, patch: Partial<Agent>) {
      const agent = this.byId[id]
      if (!agent) return
      this.byId[id] = { ...agent, ...patch }
    },

    /** Apply a personality delta and bump training counters. */
    applyTrainingDelta(id: string, delta: Partial<PersonalityMatrix>, reward?: number) {
      const agent = this.byId[id]
      if (!agent) return
      const next: PersonalityMatrix = { ...agent.personality_matrix }
      ;(Object.keys(delta) as (keyof PersonalityMatrix)[]).forEach(k => {
        next[k] = clamp((next[k] ?? 0.5) + (delta[k] ?? 0))
      })
      const ts: TrainingState = {
        ...agent.training_state,
        version: agent.training_state.version + 1,
        epochs: agent.training_state.epochs + 1,
        last_trained_at: new Date().toISOString(),
        samples_since_last_train: 0,
        samples_observed: agent.training_state.samples_observed + agent.training_state.samples_since_last_train,
        reward_ema_pnl: reward !== undefined
          ? agent.training_state.reward_ema_pnl * 0.9 + reward * 0.1
          : agent.training_state.reward_ema_pnl,
        loss_ema: agent.training_state.loss_ema * 0.92 + 0.08 * Math.abs(reward ?? 0.05),
        status: 'live'
      }
      this.byId[id] = { ...agent, personality_matrix: next, training_state: ts }
    },

    /** Increment sample counter for the personal agent. */
    recordSamples(id: string, count = 1) {
      const agent = this.byId[id]
      if (!agent) return
      agent.training_state.samples_since_last_train += count
      agent.training_state.status = 'training'
    },

    /** Fork a public agent into the user's roster. */
    forkAgent(sourceId: string, ownerId: string): Agent | null {
      const source = this.byId[sourceId]
      if (!source) return null
      const newId = `${sourceId}_fork_${Date.now()}`
      const fork: Agent = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        name: `${source.name} (fork)`,
        owner_id: ownerId,
        kind: 'forked',
        lineage: { parent_id: sourceId, forked_at: new Date().toISOString() },
        share_state: { is_public: false, price_credits: 0, license: 'private' },
        training_state: {
          ...source.training_state,
          version: 0,
          epochs: 0,
          samples_observed: 0,
          samples_since_last_train: 0,
          last_trained_at: new Date().toISOString(),
          status: 'idle'
        },
        performance: { ...source.performance, live_pnl_pct: 0, trades_total: 0, last_30d_curve: [100] },
        created_at: new Date().toISOString()
      }
      this.byId[newId] = fork
      this.ids = [...this.ids, newId]
      return fork
    },

    toggleCompare(id: string) {
      this.compareIds = toggleCompareIds(this.compareIds, id)
    },

    clearCompare() {
      this.compareIds = []
    },

    setComparison(slot: 0 | 1, id: string | null) {
      const next: [string | null, string | null] = [...this.comparisonSlots]
      next[slot] = id
      this.comparisonSlots = next
    },

    publish(id: string, priceCredits: number) {
      const a = this.byId[id]
      if (!a) return
      this.byId[id] = {
        ...a,
        kind: 'public',
        share_state: { is_public: true, price_credits: priceCredits, license: 'swarm-readonly' }
      }
    }
  },

  getters: {
    all: (state): Agent[] => state.ids.map(id => state.byId[id]).filter((a): a is Agent => !!a),
    personal: (state): Agent | null => (state.personalId ? state.byId[state.personalId] ?? null : null),
    publicAgents(): Agent[] { return this.all.filter(a => a.kind === 'public') },
    myRoster(): Agent[] {
      // Prefer authenticated user; fall back to demo owner for JSON data
      let ownerId = 'user_001'
      try {
        ownerId = useCurrentUser().getUserId()
      } catch { /* SSR / early pinia */ }
      return this.all.filter(a => a.owner_id === ownerId || a.owner_id === 'user_001')
    },
    byPnL(): Agent[] {
      return [...this.publicAgents].sort((a, b) => b.performance.live_pnl_pct - a.performance.live_pnl_pct)
    },
    bySharpe(): Agent[] {
      return [...this.publicAgents].sort((a, b) => b.performance.sharpe - a.performance.sharpe)
    },
    byLowestDrawdown(): Agent[] {
      // Less negative drawdown ranks first
      return [...this.publicAgents].sort((a, b) => b.performance.max_drawdown_pct - a.performance.max_drawdown_pct)
    },
    getAvatarById: (state) => (id: string): Agent | undefined => state.byId[id],
    comparisonPair(): [Agent | null, Agent | null] {
      return [
        this.comparisonSlots[0] ? this.byId[this.comparisonSlots[0]] ?? null : null,
        this.comparisonSlots[1] ? this.byId[this.comparisonSlots[1]] ?? null : null
      ]
    },
    trainingProgress(): number {
      // 0..1 for personal agent based on samples_since_last_train vs threshold
      const a = this.personal
      if (!a) return 0
      return clamp(a.training_state.samples_since_last_train / 100, 0, 1)
    }
  }
})
