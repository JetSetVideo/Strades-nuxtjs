<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import type { NewsPoliticalScale } from '~/types/news'

definePageMeta({ title: 'News detail', layout: 'default' })

const route = useRoute()
const newsStore = useNewsStore()
await newsStore.initializeStore()

const articleId = computed(() => String(route.params.id))
const article = computed(() => newsStore.getById(articleId.value))

const friendComments = computed(() =>
  article.value?.comments.filter(comment => newsStore.friendIds.includes(comment.userId)) ?? []
)

const relatedStories = computed(() => {
  if (!article.value) return []
  const assets = new Set(article.value.assets)
  return newsStore.items
    .filter(item => item.id !== article.value?.id && item.assets.some(asset => assets.has(asset)))
    .slice(0, 6)
})

const relatedFriends = computed(() => {
  const ids = new Set([
    ...friendComments.value.map(comment => comment.userId),
    ...relatedStories.value.map(item => item.author.id).filter(id => newsStore.friendIds.includes(id)),
  ])
  return [...ids].map(id => {
    const authored = newsStore.items.find(item => item.author.id === id)
    const comment = friendComments.value.find(entry => entry.userId === id)
    return {
      id,
      name: authored?.author.displayName ?? comment?.authorName ?? id,
      avatarUrl: authored?.author.avatarUrl ?? comment?.authorAvatarUrl,
      opinion: comment?.content ?? `Published ${authored?.title ?? 'a related market view'}.`,
    }
  })
})

const onJudge = (value: NewsPoliticalScale | null) => {
  if (article.value) newsStore.setPoliticalJudgment(article.value.id, value)
}
</script>

<template>
  <div class="detail-page">
    <NuxtLink to="/news" class="back-link">← News</NuxtLink>

    <template v-if="article">
      <NewsItemCard
        :item="article"
        :followed="newsStore.isAuthorFollowed(article.author.id)"
        @bookmark="newsStore.toggleBookmark(article.id)"
        @reaction="newsStore.setReaction(article.id, $event)"
        @judge="onJudge"
        @comment="newsStore.addComment(article.id, $event)"
        @share="newsStore.shareItem(article.id, $event.recipients, $event.note)"
        @follow-author="newsStore.toggleFollowAuthor(article.author.id)"
        @read="newsStore.recordRead(article.id, 5000)"
      />

      <div class="detail-grid">
        <main class="story-column">
          <UICard title="Full story" depth="raised">
            <img v-if="article.imageUrl" :src="article.imageUrl" :alt="article.title" class="cover" />
            <article class="prose">
              <p>{{ article.content }}</p>
            </article>
          </UICard>

          <UICard title="Friend opinions">
            <template #action>
              <UIPill tone="info">{{ friendComments.length }} responses</UIPill>
            </template>
            <ul v-if="friendComments.length" class="opinion-list">
              <li v-for="comment in friendComments" :key="comment.id">
                <img v-if="comment.authorAvatarUrl" :src="comment.authorAvatarUrl" alt="" />
                <div>
                  <strong>{{ comment.authorName }}</strong>
                  <p>{{ comment.content }}</p>
                  <time :datetime="comment.createdAt">{{ new Date(comment.createdAt).toLocaleString() }}</time>
                </div>
              </li>
            </ul>
            <UIEmptyState v-else size="sm" icon="◌" message="No friend has commented on this story yet." />
          </UICard>
        </main>

        <aside class="context-column">
          <UICard title="Associated assets" depth="sunken">
            <div v-if="article.assets.length" class="asset-list">
              <NuxtLink v-for="asset in article.assets" :key="asset" :to="`/assets/${asset.toLowerCase()}`">
                <strong>{{ asset }}</strong>
                <span>Open company or asset →</span>
              </NuxtLink>
            </div>
            <UIEmptyState v-else size="sm" icon="◇" message="No financial asset is attached." />
          </UICard>

          <UICard title="Friends in this context" depth="sunken">
            <div v-if="relatedFriends.length" class="friend-list">
              <div v-for="friend in relatedFriends" :key="friend.id" class="friend-row">
                <img v-if="friend.avatarUrl" :src="friend.avatarUrl" alt="" />
                <span>
                  <strong>{{ friend.name }}</strong>
                  <small>{{ friend.opinion }}</small>
                </span>
              </div>
            </div>
            <UIEmptyState v-else size="sm" icon="◎" message="No friend context is available." />
          </UICard>

          <UICard title="Related intelligence" depth="sunken">
            <div v-if="relatedStories.length" class="related-list">
              <NuxtLink v-for="story in relatedStories" :key="story.id" :to="`/articles/${story.id}`">
                <span>{{ story.source.label }} · {{ story.category }}</span>
                <strong>{{ story.title }}</strong>
              </NuxtLink>
            </div>
            <UIEmptyState v-else size="sm" icon="⌁" message="No related stories for these assets." />
          </UICard>
        </aside>
      </div>
    </template>

    <UIEmptyState
      v-else
      icon="◯"
      title="Story not found"
      :message="`The story \`${articleId}\` could not be loaded.`"
    />
  </div>
</template>

<style scoped>
.detail-page,
.story-column,
.context-column,
.asset-list,
.friend-list,
.related-list {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.65rem);
  min-width: 0;
}

.back-link {
  align-self: flex-start;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
}

.back-link:hover {
  color: var(--primary-green, #00ff88);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.7fr);
  gap: var(--page-gap, 0.75rem);
  align-items: start;
}

.cover {
  width: 100%;
  max-height: 26rem;
  border-radius: var(--radius-md, 8px);
  object-fit: cover;
}

.prose p {
  margin: 0;
  color: rgba(255, 255, 255, 0.88);
  font-family: var(--font-family-primary, sans-serif);
  font-size: 0.94rem;
  line-height: 1.72;
  white-space: pre-wrap;
}

.opinion-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.opinion-list li,
.friend-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  padding: 0.55rem;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.025);
}

.opinion-list img,
.friend-row img {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  object-fit: cover;
}

.opinion-list p {
  margin: 0.15rem 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.74rem;
  line-height: 1.45;
}

.opinion-list time,
.friend-row small,
.related-list span,
.asset-list span {
  display: block;
  color: rgba(255, 255, 255, 0.43);
  font-size: 0.62rem;
}

.asset-list a,
.related-list a {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.025);
  color: rgba(255, 255, 255, 0.82);
  text-decoration: none;
}

.asset-list a:hover,
.related-list a:hover {
  border-color: rgba(0, 255, 136, 0.28);
  color: var(--primary-green, #00ff88);
}

.friend-row span {
  min-width: 0;
}

.friend-row small {
  margin-top: 0.15rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
