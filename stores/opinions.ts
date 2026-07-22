import { defineStore } from 'pinia'
import { useAgentsStore, type OpinionVector } from '~/stores/agents'
import { useAllocationStore } from '~/stores/allocation'

export interface PluggedAgent {
  agent_id: string
  weight: number // 0..1 share of opinion influence
  enabled: boolean
}

export interface OpinionsState {
  /** Agents the user has "plugged in" — each contributes to the swarm opinion */
  plugs: PluggedAgent[]
  /** Mode controls how opinions reach the wallet: 'advisory' shows ghost overlay, 'auto' applies directly */
  mode: 'advisory' | 'auto'
  /** Last computed swarm vector (sum-of-weighted opinions, normalized to 100%) */
  swarmVector: OpinionVector
  /** Per-agent latest opinion snapshot (mirror of agents store for stable rendering) */
  lastSnapshot: Record<string, OpinionVector>
}

const normalize = (v: OpinionVector): OpinionVector => {
  const sum = v.fiat + v.crypto + v.stocks + v.commodities
  if (sum === 0) return { fiat: 25, crypto: 25, stocks: 25, commodities: 25 }
  return {
    fiat: (v.fiat / sum) * 100,
    crypto: (v.crypto / sum) * 100,
    stocks: (v.stocks / sum) * 100,
    commodities: (v.commodities / sum) * 100
  }
}

export const useOpinionsStore = defineStore('opinions', {
  state: (): OpinionsState => ({
    plugs: [],
    mode: 'advisory',
    swarmVector: { fiat: 25, crypto: 25, stocks: 25, commodities: 25 },
    lastSnapshot: {}
  }),

  actions: {
    plug(agentId: string, weight = 0.5) {
      const existing = this.plugs.find(p => p.agent_id === agentId)
      if (existing) { existing.weight = weight; existing.enabled = true; return }
      this.plugs.push({ agent_id: agentId, weight, enabled: true })
    },
    unplug(agentId: string) {
      this.plugs = this.plugs.filter(p => p.agent_id !== agentId)
    },
    setWeight(agentId: string, weight: number) {
      const p = this.plugs.find(pl => pl.agent_id === agentId)
      if (p) p.weight = Math.max(0, Math.min(1, weight))
    },
    setMode(mode: OpinionsState['mode']) {
      this.mode = mode
    },

    /** Recompute swarmVector from all plugged agents. Called by pipeline tick. */
    recompute() {
      const agents = useAgentsStore()
      if (this.plugs.length === 0) {
        this.swarmVector = { fiat: 25, crypto: 25, stocks: 25, commodities: 25 }
        return
      }
      const acc = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
      let totalWeight = 0
      for (const plug of this.plugs) {
        if (!plug.enabled) continue
        const agent = agents.getAvatarById(plug.agent_id)
        if (!agent) continue
        const v = agent.opinion_vector
        this.lastSnapshot[plug.agent_id] = { ...v }
        acc.fiat += v.fiat * plug.weight
        acc.crypto += v.crypto * plug.weight
        acc.stocks += v.stocks * plug.weight
        acc.commodities += v.commodities * plug.weight
        totalWeight += plug.weight
      }
      if (totalWeight === 0) {
        this.swarmVector = { fiat: 25, crypto: 25, stocks: 25, commodities: 25 }
        return
      }
      this.swarmVector = normalize(acc)

      // In auto mode, push the swarm vector directly to the wallet
      if (this.mode === 'auto') {
        const allocation = useAllocationStore()
        allocation.$patch({ allocationPie: {
          fiat: this.swarmVector.fiat,
          crypto: this.swarmVector.crypto,
          stocks: this.swarmVector.stocks,
          commodities: this.swarmVector.commodities
        }})
      }
    },

    /** Apply the current swarm vector to the user's wallet (advisory → user click). */
    commitToWallet() {
      const allocation = useAllocationStore()
      allocation.$patch({ allocationPie: { ...this.swarmVector } })
    }
  },

  getters: {
    isPlugged: (state) => (id: string) => state.plugs.some(p => p.agent_id === id && p.enabled),
    activeCount: (state) => state.plugs.filter(p => p.enabled).length,
    totalWeight: (state) => state.plugs.filter(p => p.enabled).reduce((s, p) => s + p.weight, 0),
    /** Divergence between swarm opinion and the user's current wallet — how much the agents disagree with you */
    divergence(): number {
      const allocation = useAllocationStore()
      const w = allocation.allocationPie
      const s = this.swarmVector
      return (Math.abs(w.fiat - s.fiat) + Math.abs(w.crypto - s.crypto) + Math.abs(w.stocks - s.stocks) + Math.abs(w.commodities - s.commodities)) / 4
    },
    /**
     * Swarm diversity score — variance across plugged agents' personality matrices.
     * High diversity = more independent opinions = higher wisdom-of-crowds confidence.
     * Range 0–1 where 1 = maximally diverse (agents disagree across all axes).
     */
    diversityScore(): number {
      const agents = useAgentsStore()
      const active = this.plugs.filter(p => p.enabled)
      if (active.length < 2) return 0
      const axes: Array<keyof import('~/stores/agents').PersonalityMatrix> = ['risk', 'aggression', 'reaction_speed', 'patience', 'contrarian']
      let totalVariance = 0
      for (const ax of axes) {
        const vals = active.map(p => agents.getAvatarById(p.agent_id)?.personality_matrix[ax] ?? 0.5)
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length
        const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
        totalVariance += variance
      }
      // Normalize: max variance per axis ≈ 0.25 (values spread across [0,1]), 5 axes
      return Math.min(1, totalVariance / (5 * 0.25))
    },
    /** Confidence that the swarm vector beats any single agent. Higher diversity = higher confidence. */
    swarmConfidence(): number {
      const count = this.activeCount
      if (count === 0) return 0
      // Both diversity and count contribute: more agents + more diverse = more confident
      const countBonus = Math.min(0.6, count * 0.15)
      const diversityBonus = this.diversityScore * 0.4
      return Math.min(1, countBonus + diversityBonus)
    }
  }
})
