import { defineStore } from 'pinia'
import { useAgentsStore, type OpinionVector } from '~/stores/agents'
import { useAssetsStore } from '~/stores/assets'
import { useActivityLog } from '~/composables/useActivityLog'

export type ShareKind = 'asset' | 'opinion' | 'strategy' | 'article' | 'insight'

export interface ShareRecord {
  id: string
  kind: ShareKind
  conversation_id: string
  recipient_ids: string[]
  sender_id: string
  shared_at: string
  /** Asset symbol or id */
  asset_id?: string
  asset_symbol?: string
  /** Allocation opinion snapshot */
  opinion_vector?: OpinionVector
  strategy_id?: string
  title?: string
  url?: string
  note?: string
}

export interface CorrelatedAsset {
  symbol: string
  name: string
  price: number
  change_pct?: number
  asset_id?: string
}

export interface ShareContextItem {
  share: ShareRecord
  assets: CorrelatedAsset[]
  source?: 'message' | 'library'
}

export const useSharesStore = defineStore('shares', {
  state: () => ({
    /** Runtime shares created by the user this session */
    sessionShares: [] as ShareRecord[],
    /** Static library from JSON */
    library: [] as Array<{
      id: string
      title: string
      description?: string
      type: string
      sharedBy?: string
      sharedById: string
      sharedAt: string
      relatedAssets: string[]
      tags?: string[]
      source?: string
      discussionId: string
      url?: string
      engagement?: { likes: number; comments: number; shares: number }
    }>,
    hydrated: false
  }),

  getters: {
    getLibraryByDiscussion: (state) => (discussionId: string) => {
      return state.library.filter(item => item.discussionId === discussionId)
    },

    forConversation: (state) => (conversationId: string): ShareContextItem[] => {
      const fromSession = state.sessionShares
        .filter(s => s.conversation_id === conversationId)
        .map(s => ({ share: s, assets: [], source: 'message' as const }))

      const fromLibrary = state.library
        .filter(item => item.discussionId === conversationId)
        .map(item => ({
          share: {
            id: item.id,
            kind: (item.type === 'strategy' ? 'strategy' : item.type === 'article' ? 'article' : 'insight') as ShareKind,
            conversation_id: item.discussionId,
            recipient_ids: [],
            sender_id: item.sharedById,
            shared_at: item.sharedAt,
            title: item.title,
            url: item.url
          } satisfies ShareRecord,
          assets: item.relatedAssets.map(sym => ({ symbol: sym, name: sym, price: 0 })),
          source: 'library' as const
        }))

      return [...fromSession, ...fromLibrary]
        .sort((a, b) => new Date(b.share.shared_at).getTime() - new Date(a.share.shared_at).getTime())
    },

    assetSymbolsForConversation(): (conversationId: string) => string[] {
      return (conversationId: string) => {
        const items = this.forConversation(conversationId)
        const syms = new Set<string>()
        for (const item of items) {
          if (item.share.asset_symbol) syms.add(item.share.asset_symbol)
          for (const a of item.assets) syms.add(a.symbol)
        }
        return [...syms]
      }
    }
  },

  actions: {
    async hydrate() {
      if (this.hydrated) return
      try {
        const data = await $fetch<typeof this.library>('/data/shared_data.json')
        this.library = data
      } catch {
        this.library = []
      }
      this.hydrated = true
    },

    /** Record a share, journal activity (why + friend profiles), train Avatar */
    share(payload: Omit<ShareRecord, 'id' | 'shared_at'>) {
      const record: ShareRecord = {
        ...payload,
        id: `share_${Date.now()}`,
        shared_at: new Date().toISOString()
      }
      this.sessionShares.unshift(record)

      const { share: logShare } = useActivityLog()
      const agents = useAgentsStore()
      logShare({
        kind: record.kind,
        target: record.asset_symbol
          ?? record.asset_id
          ?? record.strategy_id
          ?? record.title
          ?? record.kind,
        friendIds: record.recipient_ids,
        conversationId: record.conversation_id,
        note: record.note,
        title: record.title,
        trainingPayload: {
          asset_id: record.asset_id,
          asset_symbol: record.asset_symbol,
          strategy_id: record.strategy_id,
          opinion_vector: record.opinion_vector,
          agent_id: agents.personalId,
        },
      })

      return record
    },

    /** Enrich share items with live asset prices */
    correlate(conversationId: string): ShareContextItem[] {
      const assetsStore = useAssetsStore()
      return this.forConversation(conversationId).map(item => {
        const syms = new Set<string>()
        if (item.share.asset_symbol) syms.add(item.share.asset_symbol)
        for (const a of item.assets) syms.add(a.symbol)

        const correlated: CorrelatedAsset[] = [...syms].map(sym => {
          const asset = assetsStore.assets.find(a =>
            a.symbol.toUpperCase() === sym.toUpperCase() || a.id === sym
          )
          return {
            symbol: sym,
            name: asset?.name ?? sym,
            price: asset?.current_price ?? 0,
            asset_id: asset?.id
          }
        }).filter(a => a.price > 0 || a.asset_id)

        return { ...item, assets: correlated.length ? correlated : item.assets }
      })
    },

    toAttachment(record: ShareRecord) {
      return {
        type: 'share' as const,
        share_id: record.id,
        share_kind: record.kind,
        title: record.title ?? record.asset_symbol ?? 'Shared insight',
        description: record.note,
        url: record.url,
        asset_id: record.asset_id,
        asset_symbol: record.asset_symbol,
        opinion_vector: record.opinion_vector,
        strategy_id: record.strategy_id
      }
    }
  }
})
