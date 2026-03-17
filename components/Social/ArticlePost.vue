<template>
  <div class="article-post" :style="dynamicBackground">
    <div class="header">
      <div class="author-info">
        <div class="avatar" />
        <span class="author-name">{{ post.author_id }}</span>
      </div>
      <div class="meta">
        <!-- Phase 6.2 Controversy Animations -->
        <span class="comment-count" :class="{ controversial: post.controversy_index > 0.7 }">
          💬 {{ post.interactions.comments }}
        </span>
      </div>
    </div>
    
    <div class="content">
      <p>{{ post.content }}</p>
      
      <!-- Phase 6.3 Embedded Allocation Opinions -->
      <div v-if="post.embedded_allocation" class="embedded-allocation">
        <div class="mini-pie-bar">
          <div class="segment bg-fiat" :style="{ width: `${post.embedded_allocation.fiat}%` }"></div>
          <div class="segment bg-crypto" :style="{ width: `${post.embedded_allocation.crypto}%` }"></div>
          <div class="segment bg-stocks" :style="{ width: `${post.embedded_allocation.stocks}%` }"></div>
          <div class="segment bg-commodities" :style="{ width: `${post.embedded_allocation.commodities}%` }"></div>
        </div>
        <div class="allocation-labels">
          <span v-if="post.embedded_allocation.fiat">Fiat: {{ post.embedded_allocation.fiat }}%</span>
          <span v-if="post.embedded_allocation.crypto">Crypto: {{ post.embedded_allocation.crypto }}%</span>
          <span v-if="post.embedded_allocation.stocks">Stocks: {{ post.embedded_allocation.stocks }}%</span>
          <span v-if="post.embedded_allocation.commodities">Cmdty: {{ post.embedded_allocation.commodities }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
  political_leaning: number // -1.0 (Left/Blue) to 1.0 (Right/Red)
  controversy_index: number // 0.0 to 1.0
  interactions: { comments: number, likes: number }
  embedded_allocation?: AllocationPie
}

const props = defineProps<{
  post: Post
}>()

// Phase 6.1 Political Leaning Backgrounds
const dynamicBackground = computed(() => {
  const leaning = props.post.political_leaning
  
  // Transform -1.0 -> 1.0 into an oklch color
  // Left (-1) = Blueish, Right (1) = Reddish
  // oklch(0.3 0.1 260) -> blue, oklch(0.3 0.1 30) -> red
  // We map the scale
  const normalized = (leaning + 1) / 2 // 0.0 to 1.0
  const hue = 260 - (normalized * 230) // 260 (blue) down to 30 (red)
  
  return {
    backgroundColor: `oklch(0.25 0.05 ${hue} / 0.8)`,
    borderRadius: 'var(--app-border-radius, 12px)'
  }
})
</script>

<style scoped>
.article-post {
  padding: 1rem;
  margin-bottom: 1rem;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.05);
  transition: all var(--app-animation-speed, 0.5s) ease;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #555;
}

.author-name {
  font-weight: bold;
}

/* Phase 6.2 Controversy Animation */
.controversial {
  animation: shake 0.5s infinite alternate;
  color: #ffaa00;
}

@keyframes shake {
  0% { transform: translateX(-1px) rotate(-2deg); }
  100% { transform: translateX(1px) rotate(2deg); }
}

.content {
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Phase 6.3 Embedded Allocation */
.embedded-allocation {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.mini-pie-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: #333;
  margin-bottom: 0.5rem;
}

.segment { height: 100%; }
.bg-fiat { background: #4A90E2; }
.bg-crypto { background: #F5A623; }
.bg-stocks { background: #7ED321; }
.bg-commodities { background: #F8E71C; }

.allocation-labels {
  display: flex;
  gap: 0.8rem;
  font-size: 0.75rem;
  color: #ccc;
  flex-wrap: wrap;
}
</style>
