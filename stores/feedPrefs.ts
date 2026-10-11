import { defineStore } from 'pinia'

/**
 * Which API feeds the user wants to keep receiving, keyed by provider id
 * (e.g. "kalshi", "polymarket").
 *
 * There is no backend endpoint for this preference yet, so the choice is
 * persisted browser-locally (mirrors stores/tradingPrefs.ts). When the backend
 * grows a subscription endpoint, only `persist()` needs to change.
 */
const KEY = 'strades_feed_prefs_v1'

interface FeedPrefsState {
  /** provider id → false means "stop receiving". Absent = enabled. */
  enabled: Record<string, boolean>
  hydrated: boolean
}

export const useFeedPrefsStore = defineStore('feedPrefs', {
  state: (): FeedPrefsState => ({ enabled: {}, hydrated: false }),

  getters: {
    /** A provider id is enabled unless explicitly switched off. */
    isEnabled: (s) => (id: string) => s.enabled[id] !== false,
    /** Number of the given provider ids that are currently switched off. */
    disabledCount: (s) => (ids: string[]) => ids.filter(id => s.enabled[id] === false).length,
  },

  actions: {
    hydrate() {
      if (this.hydrated || !import.meta.client) return
      try {
        const raw = localStorage.getItem(KEY)
        const parsed = raw ? JSON.parse(raw) : null
        if (parsed && typeof parsed === 'object') this.enabled = parsed
      } catch { /* private mode / bad JSON → all feeds stay enabled */ }
      this.hydrated = true
    },

    setEnabled(id: string, on: boolean) {
      this.enabled = { ...this.enabled, [id]: on }
      try {
        localStorage.setItem(KEY, JSON.stringify(this.enabled))
      } catch { /* storage unavailable: keep in memory for this session */ }
    },

    toggle(id: string) {
      this.setEnabled(id, !this.isEnabled(id))
    },
  },
})
