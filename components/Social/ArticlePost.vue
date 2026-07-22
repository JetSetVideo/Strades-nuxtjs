<template>
  <article class="article-post" :style="composedStyle" :class="{ controversial: highControversy }">
    <header class="post-header">
      <div class="author-info">
        <div class="avatar" :title="post.author_id" />
        <div class="meta-stack">
          <span class="author-name">{{ post.author_id }}</span>
          <span v-if="post.geographic_origin?.name" class="geo">
            ◉ {{ post.geographic_origin.name }}
          </span>
        </div>
      </div>
      <div class="post-meta">
        <span class="leaning-pill" :title="`Political leaning ${post.political_leaning.toFixed(2)}`">
          {{ leaningLabel }}
        </span>
        <span class="comment-count" :class="{ controversial: highControversy }">
          {{ post.interactions.comments }} ✦
        </span>
      </div>
    </header>

    <p class="content">{{ post.content }}</p>

    <div v-if="post.embedded_allocation" class="embedded-allocation">
      <div class="mini-pie-bar" :style="{ borderRadius: 'var(--app-border-radius, 4px)' }">
        <div class="segment bg-fiat" :style="{ width: `${post.embedded_allocation.fiat}%` }"></div>
        <div class="segment bg-crypto" :style="{ width: `${post.embedded_allocation.crypto}%` }"></div>
        <div class="segment bg-stocks" :style="{ width: `${post.embedded_allocation.stocks}%` }"></div>
        <div class="segment bg-commodities" :style="{ width: `${post.embedded_allocation.commodities}%` }"></div>
      </div>
      <div class="allocation-labels">
        <span v-if="post.embedded_allocation.fiat"><i class="dot bg-fiat" />{{ post.embedded_allocation.fiat }}%</span>
        <span v-if="post.embedded_allocation.crypto"><i class="dot bg-crypto" />{{ post.embedded_allocation.crypto }}%</span>
        <span v-if="post.embedded_allocation.stocks"><i class="dot bg-stocks" />{{ post.embedded_allocation.stocks }}%</span>
        <span v-if="post.embedded_allocation.commodities"><i class="dot bg-commodities" />{{ post.embedded_allocation.commodities }}%</span>
      </div>
    </div>

    <footer class="post-footer">
      <span class="weight-bar" :title="`Weight ${(post.weight ?? 0.5).toFixed(2)}`">
        <span class="weight-fill" :style="{ width: `${(post.weight ?? 0.5) * 100}%` }"></span>
      </span>
      <span class="interactions">
        <button class="int-btn" :class="{ liked }" @click.stop="toggleLike" :title="liked ? 'Unlike' : 'Like'">
          ♥ {{ localLikes }}
        </button>
        <button class="int-btn" @click.stop="onShare" title="Share — feeds your opinion profile with 2× weight">
          ↗ {{ post.interactions.shares ?? 0 }}
        </button>
      </span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLivingUI } from '~/composables/useLivingUI'
import { useOpinionProfileStore } from '~/stores/opinionProfile'
import { useAgentTracker } from '~/composables/useAgentTracker'

export interface AllocationPie {
  fiat: number
  crypto: number
  stocks: number
  commodities: number
}

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

// Living UI: confidence = (1 - controversy) so highly controversial posts read sharper
const { dynamicStyles } = useLivingUI({ confidence: 1 - props.post.controversy_index * 0.4 })

// ── Opinion tracking (Phase 23): record article read + political view ────
const opinionStore = useOpinionProfileStore()
const tracker = useAgentTracker()
let recorded = false
let dwellStart = 0

const recordView = () => {
  if (recorded) return
  recorded = true
  const dwell = Date.now() - dwellStart
  // Feed the opinion profiler (political / economic / sentiment leaning)
  opinionStore.recordRead('user_001', {
    id: props.post.id,
    author_id: props.post.author_id,
    category: props.post.category,
    political_leaning: props.post.political_leaning,
    economic_leaning: props.post.economic_leaning,
    sentiment: props.post.sentiment,
    weight: props.post.weight
  })
  // Feed the avatar training pipeline
  tracker.track('article_political_view', { leaning: props.post.political_leaning, controversy: props.post.controversy_index })
  tracker.track('article_dwell', { dwell_ms: dwell })
}

onMounted(() => {
  dwellStart = Date.now()
  // Record after 3s visible dwell — anything less is a drive-by
  const timer = window.setTimeout(recordView, 3000)
  onUnmounted(() => window.clearTimeout(timer))
})

// ── Interactions (Phase 24): like + share feed the opinion profiler ─────
const liked = ref(false)
const localLikes = computed(() => props.post.interactions.likes + (liked.value ? 1 : 0))

const toggleLike = () => { liked.value = !liked.value }

const onShare = () => {
  // Share carries 2× weight in the opinion profiler (stronger signal than read)
  opinionStore.recordShare('user_001', {
    id: props.post.id,
    author_id: props.post.author_id,
    category: props.post.category,
    political_leaning: props.post.political_leaning,
    economic_leaning: props.post.economic_leaning,
    sentiment: props.post.sentiment,
    weight: props.post.weight
  })
  tracker.track('share_article', { controversy: props.post.controversy_index })
  // Optimistic UI: bump the share count locally
  if (props.post.interactions.shares !== undefined) props.post.interactions.shares += 1
}

const composedStyle = computed(() => {
  const normalized = (props.post.political_leaning + 1) / 2 // 0..1
  const hue = 260 - normalized * 230 // 260 (blue) → 30 (red)
  return {
    ...dynamicStyles.value,
    backgroundColor: `oklch(0.24 0.04 ${hue.toFixed(0)} / 0.85)`
  }
})

const highControversy = computed(() => props.post.controversy_index > 0.7)

const leaningLabel = computed(() => {
  const l = props.post.political_leaning
  if (l < -0.4) return 'LEFT'
  if (l < -0.15) return 'CTR-L'
  if (l > 0.4) return 'RIGHT'
  if (l > 0.15) return 'CTR-R'
  return 'CENTER'
})
</script>

<style scoped>
.article-post {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.06);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  /* dynamicStyles supplies padding, radius, transition, scale, opacity */
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}
.author-info { min-width: 0; }
.meta-stack { min-width: 0; }
.author-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.geo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.author-info { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.meta-stack { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.author-name { font-weight: 600; font-size: 0.85rem; }
.geo { font-size: 0.7rem; color: rgba(255,255,255,0.55); }

.avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #555, #222);
  flex-shrink: 0;
}

.post-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.leaning-pill {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}

.comment-count {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.7);
}
.comment-count.controversial,
.article-post.controversial .leaning-pill {
  color: var(--warning-orange, #ffaa00);
  animation: shake 0.45s infinite alternate;
}

@keyframes shake {
  0% { transform: translateX(-0.5px) rotate(-1deg); }
  100% { transform: translateX(0.5px) rotate(1deg); }
}

.content {
  font-size: 0.86rem;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.embedded-allocation {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.mini-pie-bar {
  display: flex;
  height: 6px;
  overflow: hidden;
  background: rgba(255,255,255,0.06);
}
.segment { height: 100%; transition: width 0.3s ease; }

.bg-fiat { background: #4A90E2; }
.bg-crypto { background: #F5A623; }
.bg-stocks { background: #7ED321; }
.bg-commodities { background: #F8E71C; }

.allocation-labels {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.7);
}
.allocation-labels span { display: inline-flex; align-items: center; gap: 0.25rem; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }

.post-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.weight-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.weight-fill {
  display: block;
  height: 100%;
  background: var(--primary-green, #00ff88);
  transition: width 0.3s ease;
}
.interactions {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
}
</style>
