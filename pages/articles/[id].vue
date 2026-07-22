<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNewsStore } from '@/stores/news'
import { useArticleTracker } from '@/composables/useArticleTracker'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import WidgetSentiment from '@/components/Widget/Sentiment.vue'

definePageMeta({ title: 'Article', layout: 'default' })

const route = useRoute()
const articleId = computed(() => String(route.params.id))

const newsStore = useNewsStore()
const loading = ref(true)

onMounted(async () => {
  loading.value = true
  await newsStore.initializeStore()
  loading.value = false
})

const article = computed<any | null>(() => {
  if (!newsStore.news) return null
  for (const category of newsStore.news.categories ?? []) {
    const found = (category.articles ?? []).find((a: any) => a.id === articleId.value)
    if (found) return { ...found, category: category.name }
  }
  return null
})

// Track article reads into the Opinion Profiler (dwell ≥5s)
useArticleTracker(() => article.value ? {
  id: article.value.id,
  author_id: article.value.author ?? 'editorial',
  category: article.value.category,
  political_leaning: article.value.political_leaning,
  economic_leaning: article.value.economic_leaning,
  sentiment: article.value.sentiment,
  weight: 0.5
} : null)

const publishedRel = computed(() => {
  if (!article.value?.publishing_date) return '—'
  const d = new Date(article.value.publishing_date)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})

const minuteRead = computed(() => {
  const words = (article.value?.content ?? '').trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
})

const wordCount = computed(() => (article.value?.content ?? '').trim().split(/\s+/).filter(Boolean).length)
</script>

<template>
  <div class="article-page">
    <!-- Loading shell -->
    <template v-if="loading">
      <AppSkeletonLoader height="20px" width="120px" />
      <AppSkeletonLoader height="32px" width="80%" />
      <div class="skel-row">
        <AppSkeletonLoader height="180px" />
        <AppSkeletonLoader height="180px" />
      </div>
      <AppSkeletonLoader height="320px" />
    </template>

    <template v-else-if="article">
      <UIPageHeader :title="article.title" :subtitle="`By ${article.author} · ${article.source}`">
        <template #actions>
          <UIPill tone="info">{{ article.category }}</UIPill>
          <UIPill ghost tone="neutral">{{ minuteRead }} min read</UIPill>
          <NuxtLink to="/news" class="back-link">← Back</NuxtLink>
        </template>
      </UIPageHeader>

      <!-- Hero: image + meta -->
      <div class="hero">
        <UICard class="hero-image" padding="tight">
          <img
            v-if="article.imageUrl"
            :src="article.imageUrl"
            :alt="article.title"
            class="cover"
            loading="lazy"
          />
          <UIEmptyState v-else size="sm" icon="◯" message="No cover image." />
        </UICard>

        <UICard title="Article details">
          <ul class="meta-list">
            <li><span class="m-label">Author</span><span class="m-value">{{ article.author }}</span></li>
            <li><span class="m-label">Published</span><span class="m-value">{{ publishedRel }}</span></li>
            <li><span class="m-label">Source</span><span class="m-value">{{ article.source }}</span></li>
            <li><span class="m-label">Category</span><span class="m-value">{{ article.category }}</span></li>
            <li v-if="article.data_affiliated">
              <span class="m-label">Related asset</span>
              <NuxtLink
                :to="`/assets/${article.data_affiliated.toLowerCase()}`"
                class="m-link"
              >{{ article.data_affiliated }} →</NuxtLink>
            </li>
            <li><span class="m-label">Length</span><span class="m-value">{{ wordCount }} words</span></li>
          </ul>
        </UICard>
      </div>

      <!-- Body -->
      <UICard title="Story">
        <article class="prose">
          <p>{{ article.content }}</p>
        </article>
      </UICard>

      <!-- Tags -->
      <UICard v-if="article.tags?.length" title="Tags">
        <div class="tags-row">
          <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </UICard>

      <!-- Sentiment -->
      <UICard title="Community sentiment">
        <template #action>
          <UIPill tone="success" show-dot>LIVE</UIPill>
        </template>
        <WidgetSentiment />
      </UICard>
    </template>

    <UIEmptyState
      v-else
      icon="◯"
      title="Article not found"
      :message="`The article \`${articleId}\` could not be loaded.`"
    >
      <template #action>
        <NuxtLink to="/news" class="back-link">← Back to News</NuxtLink>
      </template>
    </UIEmptyState>
  </div>
</template>

<style scoped>
.article-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.75rem);
  min-width: 0;
}

.skel-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.6rem;
}
@media (max-width: 720px) {
  .skel-row { grid-template-columns: 1fr; }
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: stretch;
  min-width: 0;
}
@media (max-width: 720px) {
  .hero { grid-template-columns: 1fr; }
}

.hero-image .cover {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: var(--app-border-radius, 6px);
}

.meta-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.meta-list li {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 0.6rem;
  align-items: baseline;
  padding: 0.35rem 0.45rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
}
.m-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.45);
}
.m-value {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m-link {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--primary-green, #00ff88);
  text-decoration: none;
}
.m-link:hover { text-decoration: underline; }

.prose p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.9);
  font-family: 'Poppins', sans-serif;
  white-space: pre-wrap;
}

.tags-row {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}
.tag {
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--primary-green, #00ff88);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 999px;
}

.back-link {
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: var(--app-border-radius, 6px);
}
.back-link:hover {
  background: rgba(0,255,136,0.08);
}
</style>
