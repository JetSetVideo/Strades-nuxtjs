<script setup lang="ts">
import type { PostSummary } from '@/composables/useProfile'

const props = defineProps<{
  posts: PostSummary[]
}>()

/** Political leaning → background tint (Data.md + Components.md) */
const politicalBg = (leaning: number): string => {
  if (leaning > 0.3)  return 'rgba(220, 50, 50, 0.05)'
  if (leaning < -0.3) return 'rgba(50, 100, 220, 0.05)'
  return 'rgba(255,255,255,0.02)'
}

/** Controversy shake animation (Components.md) */
const shakeAnimation = (idx: number): string => {
  if (idx > 0.6) return `controversyShake ${0.3 + (idx - 0.6)}s ease-in-out infinite`
  return 'none'
}

const timeAgo = (ts: string): string => {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (d < 60) return `${d}m ago`
  if (d < 1440) return `${Math.floor(d / 60)}h ago`
  return `${Math.floor(d / 1440)}d ago`
}

const categoryColor = (cat: string): string => {
  const map: Record<string, string> = {
    crypto: 'var(--asset-btc)',
    stocks: 'var(--primary-blue)',
    forex: 'var(--warning-orange)',
    macro: 'var(--text-gray)',
  }
  return map[cat] ?? 'var(--text-gray)'
}
</script>

<template>
  <div class="posts-feed">
    <div v-if="!posts?.length" class="empty">No posts published yet.</div>

    <article
      v-for="post in posts"
      :key="post.id"
      class="post-card"
      :style="{ background: politicalBg(post.political_leaning) }"
    >
      <!-- Pin indicator -->
      <div v-if="post.is_pinned" class="pin-badge">📌 Pinned</div>

      <!-- Category chip -->
      <div class="post-header">
        <span class="category-chip" :style="{ borderColor: categoryColor(post.category), color: categoryColor(post.category) }">
          {{ post.category }}
        </span>
        <span class="type-chip">{{ post.type?.replace(/_/g, ' ') }}</span>
        <span class="timestamp">{{ timeAgo(post.timestamp) }}</span>
      </div>

      <h4 class="post-title">{{ post.title }}</h4>
      <p class="post-content">{{ post.content }}</p>

      <!-- Asset tags -->
      <div class="asset-tags">
        <span v-for="a in post.assets" :key="a" class="asset-tag">{{ a }}</span>
      </div>

      <!-- Embedded allocation mini-chart -->
      <div v-if="post.embedded_allocation" class="alloc-mini">
        <div
          v-for="(pct, key) in post.embedded_allocation"
          :key="key"
          class="alloc-segment"
          :style="{ width: `${pct}%` }"
          :title="`${key}: ${pct}%`"
          :class="`alloc-${key}`"
        />
      </div>

      <!-- Engagement bar -->
      <div class="engagement">
        <span class="eng-item">👍 {{ post.likes_count }}</span>
        <span
          class="eng-item comment-count"
          :style="{ animation: shakeAnimation(post.controversy_index) }"
        >💬 {{ post.comments_count }}</span>
        <span class="eng-item">↗ {{ post.shares_count }}</span>
        <span class="eng-item">🔖 {{ post.bookmarks_count }}</span>
      </div>
    </article>
  </div>
</template>

<style scoped>
.posts-feed {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.post-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  transition: background var(--transition-normal);
}

.pin-badge {
  font-size: 0.7rem;
  color: var(--warning-orange);
}

.post-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.category-chip {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.type-chip {
  font-size: 0.65rem;
  color: var(--text-gray);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-secondary);
  text-transform: capitalize;
}

.timestamp {
  font-size: 0.65rem;
  color: var(--text-gray);
  margin-left: auto;
}

.post-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-white);
  margin: 0;
  line-height: 1.3;
}

.post-content {
  font-size: 0.8rem;
  color: var(--text-light-gray);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.asset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.asset-tag {
  font-size: 0.62rem;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(0,170,255,0.1);
  border: 1px solid rgba(0,170,255,0.2);
  color: var(--primary-blue);
  font-weight: 600;
}

/* Embedded allocation mini bar (Components.md) */
.alloc-mini {
  display: flex;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  gap: 1px;
}

.alloc-segment {
  height: 100%;
  border-radius: 999px;
  min-width: 2px;
  transition: width 0.5s ease;
}

.alloc-fiat        { background: var(--primary-blue); }
.alloc-crypto      { background: var(--asset-btc); }
.alloc-stocks      { background: var(--success-green); }
.alloc-commodities { background: var(--warning-orange); }

/* Engagement */
.engagement {
  display: flex;
  gap: var(--spacing-md);
  font-size: 0.72rem;
  color: var(--text-gray);
  margin-top: var(--spacing-xs);
}

.eng-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

/* Controversy shake (Components.md) */
@keyframes controversyShake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-2px); }
  75%       { transform: translateX(2px); }
}
</style>
