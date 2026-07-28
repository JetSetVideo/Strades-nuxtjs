<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { AllocationPie } from '~/types/allocation'
import type { NewsItem, NewsPoliticalScale } from '~/types/news'

export interface Post {
  id: string
  author_id: string
  content: string
  political_leaning: number
  controversy_index: number
  weight?: number
  category?: string
  economic_leaning?: number
  sentiment?: number
  geographic_origin?: { lat: number; lng: number; name?: string }
  interactions: { comments: number; likes: number; shares?: number }
  embedded_allocation?: AllocationPie
}

const props = defineProps<{ post: Post }>()
const newsStore = useNewsStore()

onMounted(() => {
  window.setTimeout(() => newsStore.recordRead(props.post.id, 3000), 3000)
})

const item = computed<NewsItem>(() => newsStore.getById(props.post.id) ?? {
  id: props.post.id,
  kind: 'social',
  title: props.post.title ?? props.post.content.slice(0, 64),
  content: props.post.content,
  excerpt: props.post.content,
  category: props.post.category ?? 'macro',
  type: props.post.type ?? 'analysis',
  assets: props.post.assets ?? [],
  currencies: [],
  commodities: [],
  tags: props.post.tags ?? [],
  source: { id: `social:${props.post.author_id}`, label: 'Community feed', type: 'social', provenance: 'seeded' },
  author: { id: props.post.author_id, handle: `@${props.post.author_id}`, displayName: props.post.author_id, kind: 'user' },
  geographicOrigin: props.post.geographic_origin,
  politicalLeaning: props.post.political_leaning,
  economicLeaning: props.post.economic_leaning ?? null,
  sentiment: props.post.sentiment ?? null,
  controversyIndex: props.post.controversy_index,
  weight: props.post.weight ?? 0.5,
  publishedAt: props.post.published_at,
  allocation: props.post.embedded_allocation,
  isPinned: false,
  savedByUser: false,
  readByUser: false,
  userReaction: { liked: false, disliked: false, politicalJudgment: null },
  comments: [],
  shares: [],
  counters: {
    likes: props.post.interactions.likes,
    dislikes: 0,
    comments: props.post.interactions.comments,
    shares: props.post.interactions.shares ?? 0,
    bookmarks: props.post.interactions.bookmarks ?? 0,
    judgments: 0,
  },
  predictionSummary: [],
})

const onShare = (payload: { recipients: string[]; note: string }) => {
  newsStore.shareItem(props.post.id, payload.recipients, payload.note)
}

const onJudge = (value: NewsPoliticalScale | null) => {
  newsStore.setPoliticalJudgment(props.post.id, value)
}
</script>

<template>
  <NewsItemCard
    :item="item"
    :followed="newsStore.isAuthorFollowed(item.author.id)"
    @bookmark="newsStore.toggleBookmark(item.id)"
    @reaction="newsStore.setReaction(item.id, $event)"
    @judge="onJudge"
    @comment="newsStore.addComment(item.id, $event)"
    @share="onShare"
    @follow-author="newsStore.toggleFollowAuthor(item.author.id)"
    @read="newsStore.recordRead(item.id, 3000)"
  />
</template>
