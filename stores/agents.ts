import { defineStore } from 'pinia'
import type {
  Agent,
  PersonalityMatrix,
} from '~/types/agent'

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
    comparisonSlots: [null, null]
  }),

  actions: {
    async fetchAgents() {
      this.loading = true
      try {
        const res = await fetch('/data/agents/avatars.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const list: Agent[] = await res.json()
        const byId: Record<string, Agent> = {}
        list.forEach(a => { byId[a.id] = a })
        this.byId = byId
        this.ids = list.map(a => a.id)
        const personal = list.find(a => a.kind === 'personal')
        this.personalId = personal?.id ?? null
        this.hydrated = true
        this.error = null
      } catch (e: any) {
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
    all: (state): Agent[] => state.ids.map(id => state.byId[id]).filter(Boolean),
    personal: (state): Agent | null => state.personalId ? state.byId[state.personalId] : null,
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
