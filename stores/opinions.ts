import { defineStore } from 'pinia'
import { useAgentsStore, type OpinionVector } from '~/stores/agents'
import { useAllocationStore } from '~/stores/allocation'
import {
  fromPlugsPayload, PLUG_SAVE_DEBOUNCE_MS, plugsErrorOf, samePlugs, toPlugsPayload,
  type PlugSync, type PlugsPayload,
} from '~/utils/plugsSync'

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
  /**
   * Server sync of plugs + mode (GET/PUT /api/v1/settings/plugs/). Signed out = this tab only.
   * 'error' after a failed save means the change was undone (plugs = the last saved state).
   */
  sync: PlugSync
  syncError: string
  /** The server's list was read for this user: only then may a save overwrite it. */
  loadedFor: string | null
  /** Last state the server confirmed (what a failed save reverts to). */
  saved: PlugsPayload
  /** The account has never saved a list (first visit): the app may plug the personal agent by default. */
  neverSaved: boolean
}

/** Minimal $fetch shape the store needs (injected by connect(), so tests can pass a fake). */
export type PlugsApi = (url: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>

// Client-only plumbing, deliberately outside reactive state. connect() never runs on the server,
// so these module values are never shared between SSR requests.
let api: PlugsApi | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let editedWhileLoading = false
const PLUGS_URL = '/api/v1/settings/plugs/'

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
    lastSnapshot: {},
    sync: 'signed-out',
    syncError: '',
    loadedFor: null,
    saved: { plugs: [], mode: 'advisory' },
    neverSaved: false,
  }),

  actions: {
    plug(agentId: string, weight = 0.5) {
      const w = Math.max(0, Math.min(1, Number.isFinite(weight) ? weight : 0.5))
      const existing = this.plugs.find(p => p.agent_id === agentId)
      if (existing) { existing.weight = w; existing.enabled = true }
      else this.plugs.push({ agent_id: agentId, weight: w, enabled: true })
      this.queueSave()
    },
    unplug(agentId: string) {
      this.plugs = this.plugs.filter(p => p.agent_id !== agentId)
      this.queueSave()
    },
    setWeight(agentId: string, weight: number) {
      const p = this.plugs.find(pl => pl.agent_id === agentId)
      if (!p) return
      p.weight = Math.max(0, Math.min(1, weight))
      this.queueSave()
    },
    setMode(mode: OpinionsState['mode']) {
      this.mode = mode
      this.queueSave()
    },

    /**
     * Read the saved plugs once the user is signed in (call from a page's setup/onMounted with the
     * page's auth state and $api). Signed out = local only (sync 'signed-out', nothing is sent).
     */
    async connect(opts: { signedIn: boolean; userId?: string | number | null; api: PlugsApi }) {
      if (import.meta.server) return
      if (!opts.signedIn) {
        api = null
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
        this.loadedFor = null
        this.sync = 'signed-out'
        this.syncError = ''
        return
      }
      api = opts.api
      const who = String(opts.userId ?? 'me')
      if (this.loadedFor === who || this.sync === 'loading') return
      this.sync = 'loading'
      this.syncError = ''
      editedWhileLoading = false
      try {
        const raw = await api(PLUGS_URL)
        const got = fromPlugsPayload(raw)
        if (!got) throw new Error('not a plugs payload')
        // the server says whether this account ever saved a list (a first visit may get a default plug)
        this.neverSaved = (raw as { saved?: boolean } | null)?.saved === false
        this.saved = got
        this.loadedFor = who
        if (editedWhileLoading) {
          // The user plugged something while the list was loading: keep that and save it.
          this.sync = 'saved'
          this.queueSave()
        } else {
          this.plugs = got.plugs.map(p => ({ ...p }))
          this.mode = got.mode
          this.sync = 'saved'
          // First visit of this account: plug its personal agent (as the local default did) and save it, so
          // every page sees the same list. Never done again once the account has saved any list.
          const personal = useAgentsStore().personalId
          if (this.neverSaved && !got.plugs.length && personal) {
            this.plugs = [{ agent_id: personal, weight: 0.6, enabled: true }]
            this.neverSaved = false
            this.queueSave()
          }
        }
      } catch (e) {
        // Not loaded = never save (a save now would overwrite the list we could not read).
        this.loadedFor = null
        this.sync = 'error'
        this.syncError = plugsErrorOf(e, "Couldn't load your plugged agents, so changes here are not saved. Reload to try again.")
      }
    },

    /** Debounced PUT of plugs + mode (~600 ms after the last change). No-op when signed out. */
    queueSave() {
      if (!api) return
      if (this.sync === 'loading') { editedWhileLoading = true; return }
      if (!this.loadedFor) return
      this.sync = 'saving'
      this.syncError = ''
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => { saveTimer = null; void this.flushSave() }, PLUG_SAVE_DEBOUNCE_MS)
    },

    /** Save now. A refusal or network error reverts to the last saved state and shows why. */
    async flushSave() {
      if (!api || !this.loadedFor) return
      const body = toPlugsPayload(this.plugs, this.mode)
      if (samePlugs(body, this.saved)) { if (!saveTimer) this.sync = 'saved'; return }
      try {
        const got = fromPlugsPayload(await api(PLUGS_URL, { method: 'PUT', body }))
        if (!got) throw new Error('not a plugs payload')
        this.saved = got
        // Adopt the server's cleaned list unless the user changed something meanwhile.
        if (samePlugs(toPlugsPayload(this.plugs, this.mode), body)) {
          this.plugs = got.plugs.map(p => ({ ...p }))
          this.mode = got.mode
        }
        if (!saveTimer) this.sync = 'saved'
      } catch (e) {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
        this.plugs = this.saved.plugs.map(p => ({ ...p }))
        this.mode = this.saved.mode
        this.sync = 'error'
        this.syncError = plugsErrorOf(e, "Couldn't save your plugged agents: the change was undone.")
      }
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
