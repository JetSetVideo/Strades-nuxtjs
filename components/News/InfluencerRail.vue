<script setup lang="ts">
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

interface Signal {
  type: 'bullish' | 'bearish' | string
  asset: string
  thesis: string
}

interface Influencer {
  id: string
  handle: string
  avatar_url: string
  credibility_score: number
  last_30d_pnl_pct: number
  latest_signal: Signal
}

withDefaults(defineProps<{
  influencers: Influencer[]
  limit?: number
}>(), { limit: 5 })
</script>

<template>
  <UICard title="Influencer Signals" padding="tight">
    <div
      v-for="inf in influencers.slice(0, limit)"
      :key="inf.id"
      class="inf-row"
    >
      <img :src="inf.avatar_url" alt="" class="inf-avatar" />
      <div class="inf-body">
        <div class="inf-head">
          <span class="handle">{{ inf.handle }}</span>
          <UIPill
            :tone="inf.latest_signal.type === 'bullish' ? 'success' : inf.latest_signal.type === 'bearish' ? 'danger' : 'neutral'"
            show-dot
          >{{ inf.latest_signal.asset }}</UIPill>
        </div>
        <p class="thesis">{{ inf.latest_signal.thesis }}</p>
        <div class="inf-meta">
          <span>cred {{ Math.round(inf.credibility_score * 100) }}</span>
          <span>30d {{ inf.last_30d_pnl_pct.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </UICard>
</template>

<style scoped>
.inf-row {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 0.5rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.inf-row:last-child { border-bottom: none; }
.inf-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.inf-body { min-width: 0; }
.inf-head { display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; }
.handle { font-size: 0.78rem; font-weight: 600; }
.thesis {
  margin: 0.2rem 0 0.25rem 0;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.inf-meta {
  display: flex;
  gap: 0.6rem;
  font-size: 0.62rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
