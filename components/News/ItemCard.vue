<script setup lang="ts">
import { computed, ref } from 'vue'
import UICard from '@/components/UI/Card.vue'
import ButtonBookmark from '@/components/Button/Bookmark.vue'
import type { NewsItem, NewsPoliticalScale } from '~/types/news'
import { economicLabelFromValue, politicalScaleFromValue, sentimentLabelFromValue } from '~/types/news'

const props = defineProps<{
  item: NewsItem
  followed?: boolean
}>()

const emit = defineEmits<{
  (e: 'bookmark'): void
  (e: 'reaction', value: 'like' | 'dislike' | 'clear'): void
  (e: 'judge', value: NewsPoliticalScale | null): void
  (e: 'comment', value: string): void
  (e: 'share', payload: { recipients: string[]; note: string }): void
  (e: 'follow-author'): void
  (e: 'read'): void
}>()

const metadataOpen = ref(false)
const commentsOpen = ref(false)
const shareOpen = ref(false)
const commentDraft = ref('')
const shareDraft = ref('')
const recipientsDraft = ref('')

const politicalLabel = computed(() => politicalScaleFromValue(props.item.politicalLeaning).replace('_', ' '))
const economicLabel = computed(() => economicLabelFromValue(props.item.economicLeaning))
const sentimentLabel = computed(() => sentimentLabelFromValue(props.item.sentiment))
const combinedTags = computed(() => [...new Set([...props.item.assets, ...props.item.tags])])
const primaryTag = computed(() => combinedTags.value[0] ?? props.item.category)
const hiddenTagCount = computed(() => Math.max(0, combinedTags.value.length - 1))

const judgmentMap: Record<NewsPoliticalScale, number> = {
  left: -1,
  center_left: -0.5,
  center: 0,
  center_right: 0.5,
  right: 1,
}

const judgmentNumeric = computed(() => {
  const judgment = props.item.userReaction.politicalJudgment
  return judgment ? judgmentMap[judgment] : 0
})

const pointerStyle = computed(() => {
  const value = judgmentNumeric.value
  const left = ((value + 1) / 2) * 100
  const rotate = value * 32
  const color = value < -0.1 ? '#ff556d' : value > 0.1 ? '#4a8cff' : '#a4abb8'
  return {
    left: `${left}%`,
    color,
    transform: `translateX(-50%) rotate(${rotate}deg)`,
  }
})

const allocationEntries = computed(() => {
  const allocation = props.item.allocation
  if (!allocation) return []
  return [
    { key: 'fiat', label: 'Fiat', value: Math.round(allocation.fiat), color: '#4a90e2' },
    { key: 'crypto', label: 'Crypto', value: Math.round(allocation.crypto), color: '#f7931a' },
    { key: 'stocks', label: 'Stocks', value: Math.round(allocation.stocks), color: '#5b9cff' },
    { key: 'commodities', label: 'Commodities', value: Math.round(allocation.commodities), color: '#d9b450' },
  ].filter(entry => entry.value > 0)
})

const backgroundTint = computed(() => {
  const value = (props.item.politicalLeaning + 1) / 2
  const hue = 240 - value * 210
  return `linear-gradient(90deg, color-mix(in oklab, oklch(0.33 0.05 ${hue}) 13%, transparent), transparent 38%)`
})

const assetClass = (value: string) => {
  const upper = value.toUpperCase()
  if (['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'LINK'].some(token => upper.includes(token))) return 'asset-crypto'
  if (['XAU', 'XAG', 'HG', 'BRN', 'WTI', 'CL', 'NG', 'OIL', 'COPPER', 'GOLD'].some(token => upper.includes(token))) return 'asset-commodity'
  if (upper.includes('/') || ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD'].includes(upper)) return 'asset-currency'
  if (props.item.assets.includes(value)) return 'asset-stock'
  return `topic-${props.item.category.toLowerCase()}`
}

const onJudgmentInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  const judgment: NewsPoliticalScale =
    value <= -0.75 ? 'left'
      : value <= -0.25 ? 'center_left'
        : value >= 0.75 ? 'right'
          : value >= 0.25 ? 'center_right'
            : 'center'
  emit('judge', judgment)
}

const onComment = () => {
  const content = commentDraft.value.trim()
  if (!content) return
  emit('comment', content)
  commentDraft.value = ''
}

const onShare = () => {
  emit('share', {
    recipients: recipientsDraft.value.split(',').map(value => value.trim()).filter(Boolean),
    note: shareDraft.value.trim(),
  })
  recipientsDraft.value = ''
  shareDraft.value = ''
  shareOpen.value = false
}

const openDetail = () => {
  emit('read')
  navigateTo(`/articles/${props.item.id}`)
}

const onCardClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, textarea, label, select')) return
  openDetail()
}
</script>

<template>
  <UICard
    class="news-item-card"
    :depth="item.kind === 'editorial' ? 'raised' : 'base'"
    :style="{ backgroundImage: backgroundTint }"
    role="link"
    tabindex="0"
    :aria-label="`Open ${item.title}`"
    @click="onCardClick"
    @keydown.enter.self="openDetail"
  >
    <template #header>
      <div class="headline-row">
        <NuxtLink :to="`/articles/${item.id}`" class="headline" @click="emit('read')">{{ item.title }}</NuxtLink>
        <div class="headline-actions">
          <span class="kind-badge">{{ item.kind }}</span>
          <ButtonBookmark :model-value="item.savedByUser" @toggle="emit('bookmark')" />
        </div>
      </div>
    </template>

    <div class="identity-row">
      <button class="identity" type="button" @click.stop="emit('follow-author')">
        <img v-if="item.author.avatarUrl" :src="item.author.avatarUrl" :alt="item.author.displayName" class="avatar">
        <span v-else class="avatar avatar-fallback">{{ item.author.displayName.slice(0, 1) }}</span>
        <span class="author">{{ item.author.displayName }}</span>
        <span class="handle">{{ item.author.handle }}</span>
        <span v-if="followed" class="following">following</span>
      </button>
      <div class="provenance">
        <span>{{ item.source.label }}</span>
        <span v-if="item.geographicOrigin?.name">· {{ item.geographicOrigin.name }}</span>
        <time :datetime="item.publishedAt">· {{ new Date(item.publishedAt).toLocaleString() }}</time>
      </div>
    </div>

    <p class="body">{{ item.content }}</p>

    <div class="intelligence-rail">
      <span class="axis"><small>POL</small>{{ politicalLabel }}</span>
      <span class="axis"><small>ECO</small>{{ economicLabel }}</span>
      <span class="axis" :class="`tone-${sentimentLabel}`"><small>MKT</small>{{ sentimentLabel }}</span>

      <button class="primary-tag" :class="assetClass(primaryTag)" type="button" @click.stop="metadataOpen = !metadataOpen">
        {{ primaryTag }}
      </button>
      <button
        v-if="hiddenTagCount"
        class="more-tag"
        type="button"
        :aria-expanded="metadataOpen"
        @click.stop="metadataOpen = !metadataOpen"
      >+{{ hiddenTagCount }}</button>

      <button
        v-if="allocationEntries.length"
        class="allocation-inline"
        type="button"
        aria-label="Show allocation details"
        :aria-expanded="metadataOpen"
        @click.stop="metadataOpen = !metadataOpen"
      >
        <span class="allocation-bar">
          <i
            v-for="entry in allocationEntries"
            :key="entry.key"
            :style="{ width: `${entry.value}%`, background: entry.color }"
          />
        </span>
        <small>allocation</small>
      </button>
    </div>

    <div v-if="metadataOpen" class="metadata-panel">
      <div class="all-tags">
        <span v-for="tag in combinedTags" :key="tag" class="tag" :class="assetClass(tag)">{{ tag }}</span>
      </div>
      <div v-if="allocationEntries.length" class="allocation-detail">
        <span v-for="entry in allocationEntries" :key="entry.key">
          <i :style="{ background: entry.color }" />
          {{ entry.label }} {{ entry.value }}%
        </span>
      </div>
      <div v-if="item.predictionSummary.length" class="prediction-detail">
        <span v-for="prediction in item.predictionSummary" :key="prediction.assetId">
          {{ prediction.assetId }} · {{ prediction.count }} forecasts · {{ prediction.bullishPercent }}% bullish
        </span>
      </div>
    </div>

    <div class="interaction-line">
      <div class="sentiment-dial">
        <span class="dial-label">My view</span>
        <span class="dial-shell">
          <span class="dial-pointer" :style="pointerStyle" aria-hidden="true" />
          <input
            type="range"
            min="-1"
            max="1"
            step="0.5"
            :value="judgmentNumeric"
            aria-label="Your political judgment, left to right"
            @input="onJudgmentInput"
          >
        </span>
        <span class="dial-edge left">L</span>
        <span class="dial-edge right">R</span>
      </div>

      <div class="social-actions">
        <button class="social-btn" :class="{ active: item.userReaction.liked }" type="button" @click.stop="emit('reaction', 'like')">
          ↑ <span>{{ item.counters.likes }}</span>
        </button>
        <button class="social-btn" :class="{ active: item.userReaction.disliked }" type="button" @click.stop="emit('reaction', 'dislike')">
          ↓ <span>{{ item.counters.dislikes }}</span>
        </button>
        <button class="social-btn" :class="{ active: commentsOpen }" type="button" @click.stop="commentsOpen = !commentsOpen">
          Comment <span>{{ item.counters.comments }}</span>
        </button>
        <button class="social-btn" :class="{ active: shareOpen }" type="button" @click.stop="shareOpen = !shareOpen">
          Share <span>{{ item.counters.shares }}</span>
        </button>
        <button class="controversy" type="button" title="Controversy score" @click.stop="metadataOpen = !metadataOpen">
          {{ Math.round(item.controversyIndex * 100) }}% hot
        </button>
      </div>
    </div>

    <div v-if="commentsOpen" class="expand-panel" @click.stop>
      <div class="comment-compose">
        <textarea v-model="commentDraft" rows="2" :aria-label="`Comment on ${item.title}`" placeholder="Add context, disagreement or evidence..." />
        <button type="button" :disabled="!commentDraft.trim()" @click="onComment">Post</button>
      </div>
      <ul class="comment-list">
        <li v-for="comment in item.comments" :key="comment.id">
          <img v-if="comment.authorAvatarUrl" :src="comment.authorAvatarUrl" alt="" />
          <span>
            <strong>{{ comment.authorName }}</strong>
            {{ comment.content }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="shareOpen" class="expand-panel share-panel" @click.stop>
      <input v-model="recipientsDraft" type="text" aria-label="Share recipients" placeholder="Friends: user_002, user_004..." />
      <input v-model="shareDraft" type="text" aria-label="Share note" placeholder="Optional note" />
      <button type="button" @click="onShare">Share</button>
    </div>
  </UICard>
</template>

<style scoped>
.news-item-card {
  cursor: pointer;
  gap: 0.38rem;
  box-shadow: var(--shadow-depth-1);
}

.news-item-card:focus-visible {
  outline: 2px solid var(--primary-green, #00ff88);
  outline-offset: 2px;
}

.headline-row,
.identity-row,
.intelligence-rail,
.interaction-line,
.social-actions,
.sentiment-dial,
.all-tags,
.allocation-detail,
.comment-compose,
.share-panel {
  display: flex;
  align-items: center;
  min-width: 0;
}

.headline-row {
  justify-content: space-between;
  gap: 0.65rem;
  width: 100%;
}

.headline {
  color: rgba(255, 255, 255, 0.96);
  font-family: var(--font-family-primary, sans-serif);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.headline:hover {
  color: var(--primary-green, #00ff88);
}

.headline-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.kind-badge,
.following {
  border-radius: 999px;
  padding: 0.2rem 0.42rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.58rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.identity-row {
  justify-content: space-between;
  gap: 0.6rem;
}

.identity {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 0.35rem;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  object-fit: cover;
  flex: 0 0 auto;
}

.avatar-fallback {
  display: inline-grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
}

.author {
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.handle,
.provenance {
  color: rgba(255, 255, 255, 0.44);
  font-size: 0.64rem;
}

.provenance {
  display: flex;
  gap: 0.22rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.body {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.8rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.intelligence-rail {
  gap: 0.3rem;
  min-height: 1.65rem;
  overflow: hidden;
  white-space: nowrap;
}

.axis {
  display: inline-flex;
  gap: 0.25rem;
  align-items: baseline;
  padding: 0.22rem 0.38rem;
  border-radius: var(--radius-sm, 4px);
  background: rgba(255, 255, 255, 0.025);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.63rem;
}

.axis small {
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.52rem;
}

.tone-bullish { color: var(--primary-green, #00ff88); }
.tone-bearish { color: #ff667a; }
.tone-neutral { color: #7ebcff; }

.primary-tag,
.more-tag,
.allocation-inline,
.social-btn,
.controversy,
.comment-compose button,
.share-panel button {
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
}

.primary-tag,
.more-tag {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 0.24rem 0.5rem;
  font-size: 0.62rem;
}

.more-tag {
  color: #9aa0aa;
  background: linear-gradient(180deg, #30343b, #1a1d22);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.55);
}

.asset-crypto { color: #ffad42; background: rgba(247, 147, 26, 0.1); border-color: rgba(247, 147, 26, 0.28); }
.asset-stock { color: #79b7ff; background: rgba(74, 144, 226, 0.1); border-color: rgba(74, 144, 226, 0.28); }
.asset-currency { color: #ffb36b; background: rgba(255, 153, 68, 0.1); border-color: rgba(255, 153, 68, 0.28); }
.asset-commodity { color: #e5c15f; background: rgba(217, 180, 80, 0.1); border-color: rgba(217, 180, 80, 0.28); }
.topic-macro { color: #b0b6c0; background: rgba(176, 182, 192, 0.08); }

.allocation-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 5.5rem;
  margin-left: auto;
  border: 0;
  background: transparent;
  padding: 0;
}

.allocation-inline small {
  color: rgba(255, 255, 255, 0.38);
  font-size: 0.54rem;
}

.allocation-bar {
  display: flex;
  width: 4.25rem;
  height: 0.38rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
}

.allocation-bar i {
  height: 100%;
}

.metadata-panel,
.expand-panel {
  padding: 0.5rem;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: var(--surface-sunken, rgba(8, 9, 13, 0.78));
}

.all-tags,
.allocation-detail {
  gap: 0.3rem;
  flex-wrap: wrap;
}

.tag {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.2rem 0.45rem;
  font-size: 0.6rem;
}

.allocation-detail {
  margin-top: 0.45rem;
}

.allocation-detail span,
.prediction-detail {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.62rem;
}

.allocation-detail i {
  display: inline-block;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  margin-right: 0.2rem;
}

.prediction-detail {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.45rem;
}

.interaction-line {
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 1.8rem;
}

.sentiment-dial {
  gap: 0.3rem;
  flex: 1 1 15rem;
  max-width: 20rem;
}

.dial-label,
.dial-edge {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dial-edge.left { color: #ff667a; }
.dial-edge.right { color: #6d9fff; }

.dial-shell {
  position: relative;
  flex: 1;
  height: 1.25rem;
}

.dial-shell::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0.72rem;
  height: 0.24rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #e34c63, #686e79 50%, #3f7fe0);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.65);
}

.dial-pointer {
  position: absolute;
  top: 0.08rem;
  width: 0;
  height: 0;
  border-left: 0.34rem solid transparent;
  border-right: 0.34rem solid transparent;
  border-bottom: 0.62rem solid currentColor;
  transform-origin: 50% 100%;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.65));
  pointer-events: none;
}

.dial-shell input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
}

.social-actions {
  gap: 0.25rem;
  flex: 0 0 auto;
}

.social-btn,
.controversy {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.025);
  padding: 0.28rem 0.48rem;
  font-size: 0.61rem;
  white-space: nowrap;
}

.social-btn span {
  color: rgba(255, 255, 255, 0.44);
  margin-left: 0.16rem;
}

.social-btn.active,
.social-btn:hover {
  color: var(--primary-green, #00ff88);
  border-color: rgba(0, 255, 136, 0.28);
  background: rgba(0, 255, 136, 0.07);
}

.controversy {
  color: #e5a952;
}

.expand-panel {
  cursor: default;
}

.comment-compose,
.share-panel {
  gap: 0.35rem;
}

.comment-compose textarea,
.share-panel input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 8px);
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.86);
  padding: 0.45rem 0.55rem;
  font: inherit;
  font-size: 0.7rem;
}

.comment-compose button,
.share-panel button {
  border-radius: 999px;
  background: rgba(0, 255, 136, 0.08);
  color: var(--primary-green, #00ff88);
  padding: 0.35rem 0.65rem;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 12rem;
  overflow: auto;
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
}

.comment-list li {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.4rem;
  align-items: start;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.68rem;
}

.comment-list img {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
}

.comment-list strong {
  display: block;
  color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 1024px) {
  .interaction-line {
    align-items: stretch;
    flex-direction: column;
  }

  .sentiment-dial {
    flex-basis: auto;
    max-width: none;
  }

  .social-actions {
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .identity-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .provenance,
  .handle,
  .kind-badge {
    display: none;
  }

  .axis:nth-of-type(2) {
    display: none;
  }

  .allocation-inline {
    min-width: auto;
  }

  .allocation-inline small {
    display: none;
  }

  .share-panel {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .news-item-card *,
  .news-item-card *::before,
  .news-item-card *::after {
    transition: none !important;
  }
}
</style>
