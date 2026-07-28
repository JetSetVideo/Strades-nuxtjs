<script setup lang="ts">
import { computed } from 'vue'
import type { NewsItem, NewsPoliticalScale } from '~/types/news'

interface Article {
  id: string
  title: string
  content: string
  imageUrl?: string
  author?: string
  source?: string
  publishing_date?: string
  category?: string
}

const props = defineProps<{ article: Article }>()
const newsStore = useNewsStore()

const item = computed<NewsItem | null>(() => newsStore.getById(props.article.id))

const onJudge = (value: NewsPoliticalScale | null) => {
  newsStore.setPoliticalJudgment(props.article.id, value)
}
</script>

<template>
  <NewsItemCard
    v-if="item"
    :item="item"
    :followed="newsStore.isAuthorFollowed(item.author.id)"
    @bookmark="newsStore.toggleBookmark(item.id)"
    @reaction="newsStore.setReaction(item.id, $event)"
    @judge="onJudge"
    @comment="newsStore.addComment(item.id, $event)"
    @share="newsStore.shareItem(item.id, $event.recipients, $event.note)"
    @follow-author="newsStore.toggleFollowAuthor(item.author.id)"
    @read="newsStore.recordRead(item.id, 5000)"
  />
</template>

