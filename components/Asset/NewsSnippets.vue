<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps<{
  assetSymbol: string
  assetName?: string
  assetId?: string
}>()

interface Post {
  id: string
  author_id: string
  content: string
  political_leaning?: number
  controversy_index?: number
  weight?: number
  geographic_origin?: { name?: string }
  published_at?: string
  interactions?: { likes?: number; comments?: number }
}

interface Article {
  id: string
  title: string
  content?: string
  source?: string
  publishing_date?: string
  data_affiliated?: string
}

const posts = ref<Post[]>([])
const articles = ref<Article[]>([])
const loading = ref(true)

const fetchData = async () => {
  loading.value = true
  try {
    const [postsRes, newsRes] = await Promise.all([
      fetch('/data/social/posts.json').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/news.json').then(r => r.ok ? r.json() : null).catch(() => null)
    ])
    posts.value = Array.isArray(postsRes) ? postsRes : []
    if (newsRes?.categories) {
      articles.value = newsRes.categories.flatMap((c: any) => c.articles ?? [])
    }
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

const tokens = computed(() => {
  const t = [props.assetSymbol, props.assetName, props.assetId]
    .filter(Boolean)
    .map(s => s!.toLowerCase())
  return t
})

const matchesAsset = (text: string): boolean => {
  if (!text) return false
  const lower = text.toLowerCase()
  return tokens.value.some(t => t && lower.includes(t))
}

const relatedPosts = computed<Post[]>(() => {
  return posts.value
    .filter(p => matchesAsset(p.content ?? ''))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 3)
})

const relatedArticles = computed<Article[]>(() => {
  return articles.value
    .filter(a => matchesAsset(`${a.title} ${a.content ?? ''} ${a.data_affiliated ?? ''}`))
    .sort((a, b) => {
      const ta = a.publishing_date ? new Date(a.publishing_date).getTime() : 0
      const tb = b.publishing_date ? new Date(b.publishing_date).getTime() : 0
      return tb - ta
    })
    .slice(0, 3)
})

const hasContent = computed(() => relatedPosts.value.length > 0 || relatedArticles.value.length > 0)

const leaningTone = (l: number | undefined) => {
  if (l === undefined) return 'neutral'
  if (l > 0.15) return 'warning'
  if (l < -0.15) return 'info'
  return 'neutral'
}

const fmtDate = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const days = (Date.now() - d.getTime()) / 86400000
  if (days < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

defineExpose({ hasContent })
</script>

<template>
  <div class="news-snippets" v-if="!loading && hasContent">
    <ul v-if="relatedPosts.length" class="snippets">
      <li v-for="p in relatedPosts" :key="p.id" class="snippet post">
        <span class="dot" :class="`tone-${leaningTone(p.political_leaning)}`" />
        <div class="body">
          <p class="content">{{ p.content }}</p>
          <div class="meta">
            <span class="author">@{{ p.author_id }}</span>
            <span v-if="p.geographic_origin?.name" class="geo">· {{ p.geographic_origin.name }}</span>
            <span v-if="p.published_at" class="time">· {{ fmtDate(p.published_at) }}</span>
            <span v-if="(p.controversy_index ?? 0) > 0.7" class="hot">HOT</span>
          </div>
        </div>
      </li>
    </ul>

    <ul v-if="relatedArticles.length" class="snippets">
      <li v-for="a in relatedArticles" :key="a.id" class="snippet article">
        <span class="dot tone-info" />
        <div class="body">
          <strong class="title">{{ a.title }}</strong>
          <div class="meta">
            <span v-if="a.source" class="source">{{ a.source }}</span>
            <span v-if="a.publishing_date" class="time">· {{ fmtDate(a.publishing_date) }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
  <div v-else-if="loading" class="loading">
    <span class="dot tone-neutral" />
    <span class="dim">Scanning news…</span>
  </div>
  <div v-else class="loading">
    <span class="dim">No news mentioning {{ assetSymbol }} right now.</span>
  </div>
</template>

<style scoped>
.news-snippets {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.snippets {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.snippet {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 0.5rem;
  padding: 0.4rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
  min-width: 0;
}

.dot {
  width: 7px; height: 7px; border-radius: 50%;
  margin-top: 0.35rem;
  justify-self: center;
}
.dot.tone-info { background: #00aaff; box-shadow: 0 0 4px #00aaff; }
.dot.tone-warning { background: #ffaa00; box-shadow: 0 0 4px #ffaa00; }
.dot.tone-neutral { background: rgba(255,255,255,0.4); }

.body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  overflow: hidden;
}

.snippet .content,
.snippet .title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 500;
  color: rgba(255,255,255,0.85);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.snippet .title {
  font-weight: 600;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6rem;
  color: rgba(255,255,255,0.45);
  flex-wrap: wrap;
  min-width: 0;
}
.author, .source { color: rgba(255,255,255,0.7); font-weight: 600; }
.geo { letter-spacing: 0.04em; }
.hot {
  background: rgba(255,170,0,0.15);
  color: #ffaa00;
  padding: 0px 5px;
  border-radius: 3px;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  font-weight: 800;
  margin-left: 0.2rem;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.55rem;
  font-size: 0.75rem;
}
.dim { color: rgba(255,255,255,0.45); }
</style>
