import {
  useActivityLogStore,
  type ActivityCategory,
  type ActivityWhy,
  type FriendProfileSnapshot,
  type ActivityWith,
} from '~/stores/activityLog'
import { useCommunityStore } from '~/stores/community'
import { useUsersStore } from '~/stores/users'

/**
 * useActivityLog — single entry point for where / when / what / why (+ with) tracking.
 *
 * Examples:
 *   log.pageView('/strategies', { from: '/news' })
 *   log.interact({ action: 'asset_view', target: 'btc', category: 'content', why: { intent: 'research' } })
 *   log.share({ kind: 'asset', target: 'eth', friendIds: ['user_002'], conversationId: 'conv_1' })
 */
export function useActivityLog() {
  const store = useActivityLogStore()

  const resolveFriendProfiles = (friendIds: string[]): FriendProfileSnapshot[] => {
    const users = useUsersStore()
    const community = useCommunityStore()

    return friendIds.map(id => {
      const u = users.getUserById(id)
      const c = community.list.find(f => f.id === id)

      return {
        id,
        username: u?.username ?? c?.username ?? id,
        trading_style: u?.trading_style ?? c?.trading_style,
        specialization: c?.specialization?.map(String),
        avatar_url: u?.avatar_url ?? c?.avatar_url,
      }
    })
  }

  const pageView = (
    page: string,
    opts: {
      from?: string
      route_name?: string
      query?: Record<string, unknown>
      intent?: string
    } = {}
  ) => {
    return store.log({
      where: { page, route_name: opts.route_name },
      what: {
        action: 'page_view',
        target: page,
        category: 'navigation',
      },
      why: {
        intent: opts.intent ?? (opts.from ? 'navigate' : 'land'),
        context: {
          from: opts.from,
          query: opts.query,
        },
      },
    })
  }

  const interact = (input: {
    action: string
    target: string
    category: ActivityCategory
    page?: string
    component?: string
    why?: ActivityWhy
    duration_ms?: number
    with?: ActivityWith
    feedTraining?: boolean
    trainingPayload?: Record<string, unknown>
  }) => {
    const page = input.page
      ?? (import.meta.client ? window.location.pathname : '/')

    return store.log({
      where: { page, component: input.component },
      what: {
        action: input.action,
        target: input.target,
        category: input.category,
      },
      why: input.why ?? { intent: input.action },
      with: input.with,
      duration_ms: input.duration_ms,
      feedTraining: input.feedTraining,
      trainingPayload: input.trainingPayload,
    })
  }

  const share = (input: {
    kind: 'asset' | 'opinion' | 'strategy' | 'article' | 'insight'
    target: string
    friendIds: string[]
    conversationId?: string
    page?: string
    note?: string
    title?: string
    trainingPayload?: Record<string, unknown>
  }) => {
    const profiles = resolveFriendProfiles(input.friendIds)
    const action = `share_${input.kind === 'insight' ? 'article' : input.kind}`

    return store.log({
      where: {
        page: input.page ?? (import.meta.client ? window.location.pathname : '/chat'),
        component: 'ShareBar',
      },
      what: {
        action,
        target: input.target,
        category: 'share',
      },
      why: {
        intent: 'share_with_friends',
        context: {
          note: input.note,
          title: input.title,
          kind: input.kind,
          recipient_count: input.friendIds.length,
        },
      },
      with: {
        friend_ids: input.friendIds,
        friend_profiles: profiles,
        conversation_id: input.conversationId,
      },
      trainingPayload: {
        recipient_ids: input.friendIds,
        conversation_id: input.conversationId,
        ...(input.trainingPayload ?? {}),
      },
    })
  }

  const chatMessage = (input: {
    conversationId: string
    recipientIds: string[]
    length: number
    hasShare?: boolean
  }) => {
    const profiles = resolveFriendProfiles(input.recipientIds)
    return store.log({
      where: {
        page: `/conversations/${input.conversationId}`,
        component: 'ChatComposer',
      },
      what: {
        action: 'chat_message',
        target: input.conversationId,
        category: 'social',
      },
      why: {
        intent: input.hasShare ? 'discuss_shared_content' : 'converse',
        context: { length: input.length },
      },
      with: {
        friend_ids: input.recipientIds,
        friend_profiles: profiles,
        conversation_id: input.conversationId,
      },
      trainingPayload: { length: input.length },
    })
  }

  return {
    store,
    pageView,
    interact,
    share,
    chatMessage,
    reduce: () => store.reduce(),
    hydrate: () => store.hydrate(),
    profile: computed(() => store.tradingRecords),
    recentFeed: computed(() => store.recentFeed),
    needsReduce: computed(() => store.needsReduce),
  }
}
