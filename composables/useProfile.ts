/**
 * useProfile — Aggregates all data needed to render a trader's full profile.
 *
 * Data sources (lazily fetched, cached in stores):
 *  - users store  → User object (psychology, political, investor profiles, ai_avatars)
 *  - wallets store → user's wallets & performance history
 *  - strategies store → strategies created by this user
 *  - posts JSON   → social posts authored by this user
 *
 * Refresh cadence:
 *  - User metadata + wallet: 30 s background interval (simulates WS push)
 *  - Posts / communities: on-mount only
 *
 * Failure strategy:
 *  - Each sub-fetch is isolated — a failure in strategies never blocks the render.
 *  - Per-section errors are exposed via `sectionErrors`.
 */
import { computed, ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { useUsersStore, type User } from '@/stores/users'
import { useWalletsStore } from '@/stores/wallets'
import { useStrategiesStore } from '@/stores/strategies'
import type { Strategy } from '@/stores/strategies'
import type { Wallet } from '@/stores/wallets'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PostSummary {
  id: string
  author_id: string
  title: string
  content: string
  type: string
  category: string
  assets: string[]
  political_leaning: number
  controversy_index: number
  embedded_allocation: { fiat: number; crypto: number; stocks: number; commodities: number }
  likes_count: number
  comments_count: number
  shares_count: number
  bookmarks_count: number
  timestamp: string
  tags: string[]
  is_pinned: boolean
}

export interface SectionErrors {
  user?: string
  wallets?: string
  strategies?: string
  posts?: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000

export function useProfile(userId: Ref<string> | string) {
  const id = typeof userId === 'string' ? ref(userId) : userId

  const usersStore     = useUsersStore()
  const walletsStore   = useWalletsStore()
  const strategiesStore = useStrategiesStore()

  const loading      = ref(true)
  const sectionErrors = ref<SectionErrors>({})
  const posts        = ref<PostSummary[]>([])
  const communities  = ref<any[]>([])

  // ─── Derived from stores (reactive) ─────────────────────────────────────

  const user = computed<User | null>(() =>
    id.value ? (usersStore.getUserById(id.value) ?? null) : null
  )

  const wallets = computed<Wallet[]>(() =>
    walletsStore.getUserWallets(id.value)
  )

  const defaultWallet = computed<Wallet | null>(() =>
    walletsStore.getDefaultWallet(id.value) ?? null
  )

  const strategies = computed<Strategy[]>(() =>
    strategiesStore.getStrategiesByCreator(id.value)
  )

  // ─── Visual-state helpers (Design.md) ────────────────────────────────────

  /** CSS border-radius driven by risk profile — high risk = sharp corners */
  const dynamicRadius = computed<string>(() => {
    const r = user.value?.psychology_profile?.risk_score ?? 0.5
    return `${Math.round(16 - r * 16)}px`
  })

  /** Colour with saturation proportional to magnitude */
  const perfColor = (pct: number | undefined): string => {
    if (!pct) return 'var(--text-gray)'
    const sat = Math.min(1, Math.abs(pct) / 20)
    return pct >= 0
      ? `oklch(${0.55 + sat * 0.2} ${0.1 + sat * 0.25} 145)`
      : `oklch(${0.45 + sat * 0.15} ${0.1 + sat * 0.2} 25)`
  }

  /** Heartbeat animation duration from execution_frequency (CodingAgent.md) */
  const avatarPulseMs = (freq: number): string =>
    `${Math.round(3000 - freq * 2400)}ms`

  // ─── Fetchers ─────────────────────────────────────────────────────────────

  const loadPosts = async () => {
    try {
      const allPosts = await $fetch<PostSummary[]>('/data/social/posts.json')
      posts.value = allPosts.filter(p => p.author_id === id.value)
    } catch (err) {
      sectionErrors.value.posts = (err as Error).message
    }
  }

  const loadCommunities = async () => {
    try {
      const allComms = await $fetch<any[]>('/data/Discussions.json')
      const memberIds = user.value?.communities ?? []
      communities.value = allComms.filter(c => memberIds.includes(c.id))
    } catch {
      communities.value = []
    }
  }

  /** Full refresh — called on mount and on userId change */
  const refresh = async () => {
    if (!id.value) return
    loading.value = true
    sectionErrors.value = {}

    await Promise.all([
      usersStore.fetchUsers().catch((e: Error) => {
        sectionErrors.value.user = e.message
      }),
      walletsStore.fetchWallets().catch((e: Error) => {
        sectionErrors.value.wallets = e.message
      }),
      strategiesStore.fetchStrategies().catch((e: Error) => {
        sectionErrors.value.strategies = e.message
      }),
      loadPosts(),
      loadCommunities(),
    ])

    loading.value = false
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  let intervalId: ReturnType<typeof setInterval> | null = null

  onMounted(async () => {
    await refresh()

    // Silently re-fetch performance-sensitive data in the background
    intervalId = setInterval(async () => {
      try {
        await usersStore.fetchUsers()
        await walletsStore.fetchWallets()
      } catch {
        // silent — UI keeps last-known data
      }
    }, REFRESH_INTERVAL_MS)
  })

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
  })

  // Re-fetch when userId changes (e.g. navigating between profiles)
  watch(id, async (newId) => {
    if (newId) {
      await refresh()
    }
  })

  return {
    // data
    user,
    wallets,
    defaultWallet,
    strategies,
    posts,
    communities,
    // state
    loading,
    sectionErrors,
    // helpers
    dynamicRadius,
    perfColor,
    avatarPulseMs,
    refresh,
  }
}
