import { defineStore } from 'pinia'
import type { AssetClass } from '~/stores/macro'
import { isServerUserId, serverPersonCard, type ServerFriend, type ServerProfile } from '~/utils/chatMap'

export interface CommunityUser {
  id: string
  username: string
  avatar_url: string
  bio: string
  is_friend: boolean
  online: boolean
  timezone: string
  specialization: AssetClass[]
  trading_style: string
  win_rate: number
  last_30d_pnl_pct: number
  followers: number
  match_score: number
  last_active_at: string
  /** Catalog @ name when it differs from the display name. */
  handle?: string
  verified?: boolean
  premium?: boolean
  /** How often an AI avatar acts. 0–1. */
  execution_frequency?: number
  /** Server people only (C2). */
  is_bot?: boolean
  can_message?: boolean | null
  /** 'server' = GET /api/v1/social/profiles/ (signed in); absent = the bundled sample roster. */
  source?: 'server' | 'sample'
}

/** C3 friends route: unknown until the first call, 'missing' when the server answers 404 (older backend). */
export type FriendsRoute = 'unknown' | 'ok' | 'missing'

export interface CommunityState {
  list: CommunityUser[]
  hydrated: boolean
  loading: boolean
  error: string | null
  /** Signed in: the server people (C2) with is_friend from C3. Empty until loaded. */
  serverList: CommunityUser[]
  serverState: 'idle' | 'loading' | 'ok' | 'error'
  serverFor: string | null
  friendsRoute: FriendsRoute
  /** user id → the sentence of the last failed friend change. */
  friendErrors: Record<string, string>
}

function statusOf(e: unknown): number {
  const err = e as { status?: number; statusCode?: number; response?: { status?: number } }
  return err?.response?.status ?? err?.status ?? err?.statusCode ?? 0
}
function detailOf(e: unknown): string {
  const err = e as { data?: { detail?: unknown }; response?: { _data?: { detail?: unknown } } }
  const d = err?.data?.detail ?? err?.response?._data?.detail
  return typeof d === 'string' ? d : ''
}

export const useCommunityStore = defineStore('community', {
  state: (): CommunityState => ({
    list: [], hydrated: false, loading: false, error: null,
    serverList: [], serverState: 'idle', serverFor: null, friendsRoute: 'unknown', friendErrors: {},
  }),
  actions: {
    /**
     * Signed in: people from the server (C2 profiles incl. bots + `can_message`) and friendship from C3.
     * Without C3 (404) everyone shows as not-a-friend and the Add friend buttons say "Coming soon".
     */
    async loadServerPeople(force = false) {
      if (import.meta.server) return
      const { isAuthenticated, user } = useAuth()
      if (!isAuthenticated.value) return
      const key = String(user.value?.id ?? '')
      if (!force && this.serverFor === key && this.serverState === 'ok') return
      if (this.serverState === 'loading') return
      this.serverState = 'loading'
      const { $api } = useNuxtApp()
      const call = $api as typeof $fetch
      try {
        const [profiles, friends] = await Promise.all([
          call<ServerProfile[] | { results?: ServerProfile[] }>('/api/v1/social/profiles/'),
          call<{ results?: ServerFriend[] } | ServerFriend[]>('/api/v1/social/friends/').then(
            d => { this.friendsRoute = 'ok'; return Array.isArray(d) ? d : d?.results ?? [] },
            e => { if (statusOf(e) === 404) this.friendsRoute = 'missing'; return [] as ServerFriend[] },
          ),
        ])
        const rows = Array.isArray(profiles) ? profiles : profiles?.results ?? []
        const friendIds = new Set(friends.map(f => String(f.id)))
        this.serverList = rows
          .filter(p => String(p.user_id) !== key)
          .map(p => serverPersonCard(p as ServerProfile & Record<string, unknown>, friendIds.has(String(p.user_id))) as CommunityUser)
        this.serverState = 'ok'
        this.serverFor = key
      } catch (e) {
        console.warn('community: GET /api/v1/social/profiles/ failed', e)
        this.serverState = 'error'
      }
    },

    /**
     * C3: become friends (POST) or stop (DELETE) on the server. Returns 'ok' | 'missing' (route not deployed) |
     * 'error' (the sentence is in friendErrors[userId]). Optimistic, undone on failure.
     */
    async setFriendRemote(userId: string, on: boolean): Promise<'ok' | 'missing' | 'error'> {
      const row = this.serverList.find(u => u.id === userId)
      const before = row?.is_friend
      if (row) row.is_friend = on
      const { [userId]: _drop, ...rest } = this.friendErrors
      this.friendErrors = rest
      const { $api } = useNuxtApp()
      try {
        await ($api as typeof $fetch)(`/api/v1/social/friends/${userId}/`, { method: on ? 'POST' : 'DELETE' })
        this.friendsRoute = 'ok'
        // Friends (and bots) can be messaged: the server says so in C2; mirror it until the next load.
        if (row && on) row.can_message = true
        return 'ok'
      } catch (e) {
        if (row && before !== undefined) row.is_friend = before
        const s = statusOf(e)
        if (s === 404 && this.friendsRoute !== 'ok') { this.friendsRoute = 'missing'; return 'missing' }
        this.friendErrors = {
          ...this.friendErrors,
          [userId]: detailOf(e) || (s ? `Friend change not saved (HTTP ${s}).` : 'Friend change not saved: no connection.'),
        }
        return 'error'
      }
    },

    async fetchCommunity() {
      this.loading = true
      try {
        const res = await fetch('/data/core/community.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.list = await res.json()
        this.hydrated = true
      } catch (e: any) {
        this.error = e.message
        console.error('community.fetchCommunity', e)
      } finally {
        this.loading = false
      }
    },
    toggleFriend(id: string) {
      // A server person (uuid, signed in): the friendship lives on the server (C3).
      const server = this.serverList.find(x => x.id === id)
      if (server && isServerUserId(id)) {
        void this.setFriendRemote(id, !server.is_friend)
        return
      }
      const u = this.list.find(x => x.id === id)
      if (!u) return
      u.is_friend = !u.is_friend

      if (u.is_friend) {
        try {
          const { interact } = useActivityLog()
          interact({
            action: 'friend_added',
            target: id,
            category: 'social',
            component: 'PersonCard',
            why: {
              intent: 'expand_network',
              context: {
                trading_style: u.trading_style,
                specialization: u.specialization,
                match_score: u.match_score,
              },
            },
            with: {
              friend_ids: [id],
              friend_profiles: [{
                id: u.id,
                username: u.username,
                trading_style: u.trading_style,
                specialization: u.specialization.map(String),
                avatar_url: u.avatar_url,
              }],
            },
            trainingPayload: { specialization: u.specialization },
          })
        } catch { /* activity log optional */ }
      }
    }
  },
  getters: {
    friends: (s) => s.list.filter(u => u.is_friend),
    discover: (s) => s.list.filter(u => !u.is_friend),
    /** Signed in and loaded: server friends (C3) / everyone else on the server, bots first. */
    serverFriends: (s) => s.serverList.filter(u => u.is_friend),
    serverDiscover: (s) => [...s.serverList.filter(u => !u.is_friend)]
      .sort((a, b) => Number(b.can_message === true) - Number(a.can_message === true) || Number(!!b.is_bot) - Number(!!a.is_bot)),
    online: (s) => s.list.filter(u => u.online),
    bySpec: (s) => (cls: AssetClass) => s.list.filter(u => u.specialization.includes(cls)),
    /** Top discovery picks ranked by match_score then followers */
    suggestions(): CommunityUser[] {
      return [...this.discover].sort((a, b) => {
        if (a.match_score !== b.match_score) return b.match_score - a.match_score
        return b.followers - a.followers
      })
    }
  }
})
