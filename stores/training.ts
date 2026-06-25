import { defineStore } from 'pinia'
import { useAgentsStore, type PersonalityMatrix } from '~/stores/agents'

export type TrainingEventType =
  | 'article_dwell'
  | 'article_political_view'
  | 'allocation_change'
  | 'asset_click'
  | 'asset_hover'
  | 'strategy_deploy'
  | 'strategy_pause'
  | 'agent_compare'
  | 'agent_fork'
  | 'agent_plug'
  | 'page_route'
  | 'chart_annotation'
  | 'prediction_set'
  | 'prediction_triggered'
  | 'asset_tag'
  | 'chat_message_sent'
  | 'friend_added'
  | 'search_used'
  | 'share_asset'
  | 'share_opinion'
  | 'share_strategy'
  | 'share_article'

export interface TrainingEvent {
  id: string
  ts: number
  type: TrainingEventType
  agent_id: string
  payload: Record<string, any>
}

export interface TrainingDelta {
  delta: Partial<PersonalityMatrix>
  reward?: number
  note?: string
  source_event_ids: string[]
}

export interface TrainingStoreState {
  buffer: TrainingEvent[]
  recentDeltas: Array<TrainingDelta & { applied_at: number; agent_id: string }>
  maxBuffer: number
  totalEventsRecorded: number
  hydrated: boolean
}

// Each event type contributes a small delta to specific personality axes.
// Tunable in one place — the heart of the "Avatar trains from your behavior" promise.
const EVENT_DELTA_MAP: Record<TrainingEventType, (payload: any) => Partial<PersonalityMatrix>> = {
  article_dwell: (p) => {
    // Long dwell on an article => more patient
    const secs = Math.min(p.dwell_ms / 1000, 60)
    return { patience: secs > 20 ? 0.005 : -0.003 }
  },
  article_political_view: (p) => {
    // Reading polarized content nudges contrarian
    return { contrarian: Math.abs(p.leaning ?? 0) * 0.004 }
  },
  allocation_change: (p) => {
    // Big swings => aggressive; many small tweaks => high reaction speed
    const mag = Math.min(Math.abs(p.magnitude ?? 0) / 25, 1)
    return {
      aggression: mag * 0.008,
      reaction_speed: 0.003,
      risk: mag > 0.6 ? 0.005 : -0.001
    }
  },
  asset_click: () => ({ reaction_speed: 0.002 }),
  asset_hover: () => ({ patience: -0.001 }),
  strategy_deploy: () => ({ aggression: 0.01, risk: 0.01 }),
  strategy_pause: () => ({ patience: 0.005, risk: -0.005 }),
  agent_compare: () => ({ contrarian: 0.002 }),
  agent_fork: () => ({ aggression: 0.005 }),
  agent_plug: (p) => ({
    // Plugging in an aggressive agent rubs off on us
    aggression: (p.source_aggression ?? 0.5) * 0.01
  }),
  page_route: () => ({ reaction_speed: 0.0005 }),
  chart_annotation: (p) => {
    // Drawing trendlines/levels = analytical patience
    const trendline = p.kind === 'trendline'
    return { patience: trendline ? 0.004 : 0.002, contrarian: 0.001 }
  },
  prediction_set: (p) => {
    // Forecasting an outcome = aggression + risk tolerance
    const horizonHrs = (p.horizon_hours ?? 24) / 24
    return {
      aggression: 0.005,
      risk: Math.min(0.01, Math.abs(p.target_pct ?? 0) / 100),
      patience: horizonHrs > 1 ? 0.003 : -0.002
    }
  },
  prediction_triggered: (p) => ({
    // A triggered prediction either rewards or punishes the user — bias by hit/miss
    reaction_speed: 0.002,
    aggression: (p.hit ? 0.003 : -0.001)
  }),
  asset_tag: (p) => {
    // Tagging assets = curation behavior (patience + contrarian if "watch breakout")
    const isContrarian = (p.tag ?? '').includes('reversal') || (p.tag ?? '').includes('fade')
    return { patience: 0.002, contrarian: isContrarian ? 0.004 : 0 }
  },
  chat_message_sent: (p) => ({
    // Social activity nudges reaction speed
    reaction_speed: 0.001,
    patience: (p.length ?? 50) > 200 ? 0.003 : 0
  }),
  friend_added: (p) => {
    // Adding a friend specializing in your weak class rounds you out
    const specs: string[] = p.specialization ?? []
    return {
      contrarian: specs.length > 1 ? 0.002 : 0.0,
      patience: 0.001
    }
  },
  search_used: () => ({ reaction_speed: 0.001, patience: -0.001 }),
  share_asset: (p) => ({
    reaction_speed: 0.003,
    contrarian: 0.002,
    patience: (p.recipient_ids?.length ?? 1) > 1 ? 0.002 : 0.001
  }),
  share_opinion: (p) => {
    const ov = p.opinion_vector ?? {}
    const cryptoBias = (ov.crypto ?? 25) / 100
    return {
      aggression: cryptoBias * 0.006,
      risk: cryptoBias * 0.004,
      patience: 0.003
    }
  },
  share_strategy: () => ({ aggression: 0.006, patience: 0.004, reaction_speed: 0.002 }),
  share_article: (p) => ({
    patience: 0.004,
    contrarian: (p.controversy ?? 0) * 0.003
  })
}

const sumDeltas = (deltas: Partial<PersonalityMatrix>[]): Partial<PersonalityMatrix> => {
  const out: Partial<PersonalityMatrix> = {}
  for (const d of deltas) {
    ;(Object.keys(d) as (keyof PersonalityMatrix)[]).forEach(k => {
      out[k] = (out[k] ?? 0) + (d[k] ?? 0)
    })
  }
  return out
}

let _eventCounter = 0
const nextEventId = () => `ev_${Date.now()}_${++_eventCounter}`

export const useTrainingStore = defineStore('training', {
  state: (): TrainingStoreState => ({
    buffer: [],
    recentDeltas: [],
    maxBuffer: 200,
    totalEventsRecorded: 0,
    hydrated: false
  }),

  actions: {
    /** Record a single behavioral event. Called by useAgentTracker. */
    record(type: TrainingEventType, payload: Record<string, any> = {}) {
      const agents = useAgentsStore()
      const targetId = payload.agent_id ?? agents.personalId
      if (!targetId) return
      const ev: TrainingEvent = {
        id: nextEventId(),
        ts: Date.now(),
        type,
        agent_id: targetId,
        payload
      }
      this.buffer.push(ev)
      this.totalEventsRecorded++
      if (this.buffer.length > this.maxBuffer) {
        this.buffer.splice(0, this.buffer.length - this.maxBuffer)
      }
      agents.recordSamples(targetId, 1)
    },

    /** Drain the buffer, compute aggregate delta, and apply it to the target agent. */
    applyTrainingTick(): TrainingDelta | null {
      const agents = useAgentsStore()
      if (this.buffer.length === 0) return null

      // Group buffered events by agent_id
      const byAgent: Record<string, TrainingEvent[]> = {}
      for (const ev of this.buffer) {
        byAgent[ev.agent_id] = byAgent[ev.agent_id] ?? []
        byAgent[ev.agent_id].push(ev)
      }

      let lastDelta: TrainingDelta | null = null
      Object.entries(byAgent).forEach(([agentId, events]) => {
        const deltas = events.map(e => EVENT_DELTA_MAP[e.type]?.(e.payload) ?? {})
        const aggregate = sumDeltas(deltas)
        // Reward is a synthetic signal — agent's recent reward EMA + a noise term
        const agent = agents.getAvatarById(agentId)
        const reward = (agent?.training_state.reward_ema_pnl ?? 0.04) + (Math.random() - 0.5) * 0.02
        agents.applyTrainingDelta(agentId, aggregate, reward)
        const td: TrainingDelta = {
          delta: aggregate,
          reward,
          note: `Aggregated ${events.length} event(s)`,
          source_event_ids: events.map(e => e.id)
        }
        lastDelta = td
        this.recentDeltas = [
          { ...td, applied_at: Date.now(), agent_id: agentId },
          ...this.recentDeltas
        ].slice(0, 30)
      })

      this.buffer = []
      return lastDelta
    }
  },

  getters: {
    bufferSize: (state) => state.buffer.length,
    recentEvents: (state) => [...state.buffer].reverse().slice(0, 20),
    summaryByType: (state): Record<string, number> => {
      const out: Record<string, number> = {}
      for (const ev of state.buffer) out[ev.type] = (out[ev.type] ?? 0) + 1
      return out
    },
    /** "Learned today" summary — last 30 applied deltas reduced to a single vector. */
    learnedToday(): Partial<PersonalityMatrix> {
      const agg: Partial<PersonalityMatrix> = {}
      const recent = (this.recentDeltas as any[]) ?? []
      for (const d of recent) {
        ;(Object.keys(d.delta) as (keyof PersonalityMatrix)[]).forEach(k => {
          agg[k] = (agg[k] ?? 0) + (d.delta[k] ?? 0)
        })
      }
      return agg
    }
  }
})
