<script setup lang="ts">
import type { OpinionVector } from '~/stores/agents'
import AgentOpinionVector from '~/components/Agent/OpinionVector.vue'

export interface ShareAttachment {
  type: 'share'
  share_kind?: string
  title?: string
  description?: string
  url?: string
  asset_id?: string
  asset_symbol?: string
  strategy_id?: string
  opinion_vector?: OpinionVector
}

defineProps<{
  attachment: ShareAttachment
  compact?: boolean
}>()
</script>

<template>
  <div class="share-payload" :class="[attachment.share_kind, { compact }]">
    <div class="share-head">
      <span class="share-kind">{{ attachment.share_kind ?? 'share' }}</span>
      <strong class="share-title">{{ attachment.title ?? attachment.asset_symbol ?? 'Shared' }}</strong>
    </div>

    <AgentOpinionVector
      v-if="attachment.opinion_vector"
      :vector="attachment.opinion_vector"
      variant="tiny"
    />

    <p v-if="attachment.description && !compact" class="share-note">{{ attachment.description }}</p>

    <div class="share-links">
      <NuxtLink
        v-if="attachment.asset_id"
        :to="`/assets/${attachment.asset_id}`"
        class="share-link"
      >View asset →</NuxtLink>
      <NuxtLink
        v-else-if="attachment.strategy_id"
        :to="`/strategy/${attachment.strategy_id}`"
        class="share-link"
      >View strategy →</NuxtLink>
      <a
        v-else-if="attachment.url"
        :href="attachment.url"
        target="_blank"
        rel="noopener"
        class="share-link"
      >Open source →</a>
    </div>
  </div>
</template>

<style scoped>
.share-payload {
  margin-top: 0.35rem;
  padding: 0.45rem 0.55rem;
  background: rgba(0,170,255,0.06);
  border: 1px solid rgba(0,170,255,0.2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.share-payload.opinion { border-color: rgba(0,255,136,0.25); background: rgba(0,255,136,0.05); }
.share-payload.asset { border-color: rgba(245,166,35,0.25); background: rgba(245,166,35,0.05); }

.share-head { display: flex; flex-direction: column; gap: 0.1rem; }
.share-kind {
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.share-title { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.95); }
.share-note { margin: 0; font-size: 0.72rem; color: rgba(255,255,255,0.6); line-height: 1.4; }
.share-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.share-link {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--primary-green, #00ff88);
  text-decoration: none;
}
.share-link:hover { text-decoration: underline; }
.compact { padding: 0.35rem 0.45rem; }
</style>
