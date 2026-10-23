import { defineStore } from 'pinia'
import { useFeedPrefsStore } from '~/stores/feedPrefs'

/**
 * The data APIs behind /prices and /apis. One list, one switch.
 * Disconnecting a feed is `feedPrefs.setEnabled(id, false)`.
 */
export interface DataProvider {
  id: string
  label: string
  state: 'live' | 'blocked' | 'unconfigured' | 'error' | string
  detail?: string
  base_url?: string
  enabled?: boolean
}

export interface DataFeedGroup {
  feed: string
  label?: string
  providers: DataProvider[]
}

interface ProvidersResponse { groups?: DataFeedGroup[] }

export const useDataFeedsStore = defineStore('dataFeeds', {
  state: () => ({
    groups: [] as DataFeedGroup[],
    loading: false,
    error: null as string | null,
    loaded: false,
  }),

  getters: {
    providers: (s): DataProvider[] => s.groups.flatMap(g => g.providers),
    stateOf(): (id: string) => string | undefined {
      const map = new Map(this.providers.map(p => [p.id, p.state]))
      return (id: string) => map.get(id)
    },
  },

  actions: {
    async load(force = false) {
      if (this.loading) return
      if (this.loaded && !force) return
      this.loading = true
      this.error = null
      try {
        const { $api } = useNuxtApp()
        const res = await ($api as (u: string) => Promise<ProvidersResponse>)('/api/providers/')
        this.groups = Array.isArray(res?.groups) ? res.groups : []
        this.loaded = true
      } catch (e: unknown) {
        const err = e as { response?: { status?: number }; statusCode?: number; status?: number }
        const status = err?.response?.status ?? err?.statusCode ?? err?.status
        this.error = status ? `Providers API returned ${status}.` : 'Providers API unreachable.'
        this.groups = []
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    /** User switch, except a blocked or down provider never counts as receiving. */
    receiving(id: string): boolean {
      const prefs = useFeedPrefsStore()
      const state = this.stateOf(id)
      if (state === 'blocked' || state === 'error' || state === 'unconfigured') return false
      return prefs.isEnabled(id)
    },
  },
})
