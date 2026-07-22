<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNewsStore } from '@/stores/news'
import { useInfluencersStore } from '@/stores/influencers'
import { useMacroStore } from '@/stores/macro'
import { useOpinionProfileStore } from '~/stores/opinionProfile'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import NewsCard from '@/components/Widget/NewsCard.vue'
import SocialArticlePost from '@/components/Social/ArticlePost.vue'
import NewsInfluencerRail from '@/components/News/InfluencerRail.vue'
import MapButton from '@/components/Map/MapButton.vue'
import type { MapMarker } from '@/components/Map/WorldMap.vue'
import type { TabItem } from '@/components/UI/SectionTabs.vue'

definePageMeta({ title: 'News', layout: 'default' })

const newsStore = useNewsStore()
const influencers = useInfluencersStore()
const macro = useMacroStore()

const loading = ref(true)
const posts = ref<any[]>([])
const tab = ref<'sentiment' | 'editorial' | 'signals'>('sentiment')
const sortMode = ref<'weight' | 'time' | 'controversy'>('weight')
const editorialCategory = ref<string | null>(null)

const tabs = computed<TabItem[]>(() => [
  { id: 'sentiment', label: 'Feed', count: posts.value.length },
  { id: 'editorial', label: 'Editorial' },
  { id: 'signals', label: 'Signals', count: influencers.latestSignals.length }
])

const kpis = computed(() => [
  { label: 'Pulse', value: macro.news_pulse_count },
  { label: 'Followed', value: influencers.followed.length },
  { label: 'Stress', value: Math.round(macro.geopolitical_stress * 100), suffix: '%' }
])

onMounted(async () => {
  const [, postsRes] = await Promise.all([
    newsStore.initializeStore(),
    fetch('/data/social/posts.json').then(r => r.ok ? r.json() : []).catch(() => [])
  ])
  if (!influencers.hydrated) await influencers.fetchInfluencers()
  posts.value = postsRes
  loading.value = false
  if (newsStore.news?.categories?.length > 0) {
    editorialCategory.value = newsStore.news.categories[0].name
  }

  // Seed opinion profiler from existing posts for a first-use profile
  const opinionProfile = useOpinionProfileStore()
  if (opinionProfile.getProfile('user_001').sample_count < 3 && postsRes.length > 0) {
    postsRes.slice(0, 5).forEach((p: any) => {
      opinionProfile.recordRead('user_001', { id: p.id, author_id: p.author_id, category: p.category, political_leaning: p.political_leaning, economic_leaning: p.economic_leaning, sentiment: p.sentiment, weight: p.weight })
    })
  }
})

const sortedPosts = computed(() => {
  const list = [...posts.value]
  if (sortMode.value === 'weight') return list.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  if (sortMode.value === 'controversy') return list.sort((a, b) => (b.controversy_index ?? 0) - (a.controversy_index ?? 0))
  return list.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
})

const newsMapMarkers = computed<MapMarker[]>(() =>
  posts.value.filter(p => p.geographic_origin).map(p => ({
    id: `post-${p.id}`,
    lat: p.geographic_origin.lat,
    lng: p.geographic_origin.lng,
    label: p.geographic_origin.name || 'Post',
    tone: p.controversy_index > 0.7 ? 'negative' : 'info',
    weight: Math.min(1, p.weight ?? 0.5),
    group: 'Posts'
  }))
)
</script>

<template>
  <UIScreenShell
    title="News"
    subtitle="Sentiment · editorial · influencer signals"
    :kpis="kpis"
    :tabs="tabs"
    :tab="tab"
    @update:tab="tab = $event as typeof tab"
  >
    <template #actions>
      <MapButton v-if="newsMapMarkers.length" :markers="newsMapMarkers" title="Origins" :subtitle="`${newsMapMarkers.length} stories`" />
      <UIPill v-if="influencers.consensusBias > 0.15" tone="success" show-dot>BULL</UIPill>
      <UIPill v-else-if="influencers.consensusBias < -0.15" tone="danger" show-dot>BEAR</UIPill>
      <UIPill v-else tone="neutral" show-dot>MIXED</UIPill>
    </template>

    <div v-if="loading" class="loading">
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="80px" />
    </div>

    <template v-else-if="tab === 'sentiment'">
      <div class="sort-row">
        <button :class="{ active: sortMode === 'weight' }" @click="sortMode = 'weight'">Top</button>
        <button :class="{ active: sortMode === 'controversy' }" @click="sortMode = 'controversy'">Hot</button>
        <button :class="{ active: sortMode === 'time' }" @click="sortMode = 'time'">New</button>
      </div>
      <div class="feed">
        <SocialArticlePost v-for="p in sortedPosts" :key="p.id" :post="p" />
        <UIEmptyState v-if="sortedPosts.length === 0" icon="◴" message="No posts yet." />
      </div>
    </template>

    <template v-else-if="tab === 'editorial'">
      <div class="sort-row">
        <button
          v-for="cat in newsStore.news?.categories || []"
          :key="cat.name"
          :class="{ active: cat.name === editorialCategory }"
          @click="editorialCategory = cat.name"
        >{{ cat.name }}</button>
      </div>
      <div class="feed">
        <NewsCard
          v-for="article in newsStore.news?.categories?.find(c => c.name === editorialCategory)?.articles || []"
          :key="article.id"
          :article="article"
        />
      </div>
    </template>

    <template v-else>
      <NewsInfluencerRail :influencers="influencers.latestSignals" />
    </template>
  </UIScreenShell>
</template>

<style scoped>
.loading { display: flex; flex-direction: column; gap: 0.4rem; }
.sort-row { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.sort-row button {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sort-row button.active {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}
.feed { display: flex; flex-direction: column; gap: 0.45rem; }
</style>
