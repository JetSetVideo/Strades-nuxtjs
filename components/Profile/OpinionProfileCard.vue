<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useOpinionProfileStore } from '~/stores/opinionProfile'

/**
 * Profile/OpinionProfileCard.vue — renders the live, article-derived opinion
 * profile for a user, contrasting it with their friend circle.
 *
 * Complements `PoliticalCard.vue` (which renders the static, self-reported
 * `PoliticalProfile` from the users JSON). This card renders the *dynamic*
 * profile that evolves as the user reads and shares articles.
 */

const props = defineProps<{
  userId: string
  /** Optional friend IDs for the comparison row */
  friendIds?: string[]
}>()

const opinionStore = useOpinionProfileStore()

onMounted(() => opinionStore.hydrate())

const profile = computed(() => opinionStore.getProfile(props.userId))
const topTopics = computed(() => opinionStore.topTopics(props.userId, 4))
const topInfluencers = computed(() => opinionStore.topInfluencers(props.userId, 3))

const friends = computed(() =>
  (props.friendIds ?? []).map(id => ({
    id,
    profile: opinionStore.getProfile(id)
  })).filter(f => f.profile.sample_count > 0)
)

const pct = (v: number) => ((v + 1) / 2) * 100

const leaningColor = (v: number): string => {
  // Blue (left) ↔ Gray (center) ↔ Red (right)
  if (Math.abs(v) < 0.1) return 'oklch(65% 0.02 250)'
  const hue = v < 0 ? 240 : 10
  const sat = Math.min(0.25, Math.abs(v) * 0.3)
  return `oklch(65% ${sat} ${hue})`
}

const econColor = (v: number): string => {
  // Green (dovish) ↔ Gray ↔ Orange (hawkish)
  if (Math.abs(v) < 0.1) return 'oklch(65% 0.02 250)'
  const hue = v < 0 ? 145 : 60
  const sat = Math.min(0.25, Math.abs(v) * 0.3)
  return `oklch(65% ${sat} ${hue})`
}

const leaningLabel = (v: number): string => opinionStore.leaningLabel(v)
const econLabel = (v: number): string => opinionStore.economicLabel(v)
</script>

<template>
  <div class="opinion-card">
    <header class="head">
      <h4>Opinion Profile</h4>
      <span class="confidence" :title="`Based on ${profile.sample_count} article interactions`">
        {{ Math.round(profile.confidence * 100) }}% confidence
      </span>
    </header>

    <p v-if="profile.sample_count === 0" class="empty">
      No article interactions yet. Read or share posts on the News page to build this profile.
    </p>

    <template v-else>
      <!-- Political leaning axis -->
      <div class="axis-row">
        <span class="axis-label left">Left</span>
        <div class="axis-track">
          <div class="axis-fill" :style="{ width: `${pct(profile.political_leaning)}%`, background: leaningColor(profile.political_leaning) }" />
          <div class="axis-dot" :style="{ left: `${pct(profile.political_leaning)}%`, background: leaningColor(profile.political_leaning) }" />
        </div>
        <span class="axis-label right">Right</span>
      </div>
      <div class="axis-caption">
        <span>Political leaning</span>
        <span class="axis-value">{{ leaningLabel(profile.political_leaning) }} ({{ profile.political_leaning.toFixed(2) }})</span>
      </div>

      <!-- Economic leaning axis -->
      <div class="axis-row">
        <span class="axis-label left">Dove</span>
        <div class="axis-track">
          <div class="axis-fill" :style="{ width: `${pct(profile.economic_leaning)}%`, background: econColor(profile.economic_leaning) }" />
          <div class="axis-dot" :style="{ left: `${pct(profile.economic_leaning)}%`, background: econColor(profile.economic_leaning) }" />
        </div>
        <span class="axis-label right">Hawk</span>
      </div>
      <div class="axis-caption">
        <span>Economic leaning</span>
        <span class="axis-value">{{ econLabel(profile.economic_leaning) }} ({{ profile.economic_leaning.toFixed(2) }})</span>
      </div>

      <!-- Sentiment bias -->
      <div class="sentiment-row">
        <span class="sent-label">Market sentiment bias</span>
        <span class="sent-value" :data-tone="profile.sentiment_bias > 0.1 ? 'bull' : profile.sentiment_bias < -0.1 ? 'bear' : 'neutral'">
          {{ profile.sentiment_bias > 0.1 ? '🐂 Bullish' : profile.sentiment_bias < -0.1 ? '🐻 Bearish' : '⚖ Neutral' }}
          ({{ profile.sentiment_bias.toFixed(2) }})
        </span>
      </div>

      <!-- Topic affinity -->
      <div v-if="topTopics.length" class="topics">
        <span class="topics-label">Topic affinity</span>
        <div class="topics-list">
          <span v-for="t in topTopics" :key="t.category" class="topic-chip" :data-cat="t.category">
            {{ t.category }} <b>{{ t.count.toFixed(1) }}</b>
          </span>
        </div>
      </div>

      <!-- Influenced by -->
      <div v-if="topInfluencers.length" class="influencers">
        <span class="inf-label">Influenced by</span>
        <div class="inf-list">
          <span v-for="i in topInfluencers" :key="i.author_id" class="inf-chip">
            @{{ i.author_id }}
          </span>
        </div>
      </div>

      <!-- Friend comparison small-multiples -->
      <div v-if="friends.length" class="friends">
        <span class="friends-label">Friend circle</span>
        <div class="friends-grid">
          <div v-for="f in friends" :key="f.id" class="friend-cell" :title="`${f.id}: ${f.profile.sample_count} articles`">
            <div class="friend-axis">
              <div class="friend-dot" :style="{
                left: `${pct(f.profile.political_leaning)}%`,
                background: leaningColor(f.profile.political_leaning)
              }" />
            </div>
            <span class="friend-name">@{{ f.id.replace('user_', '') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.opinion-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem;
  background: var(--bg-secondary, rgba(255,255,255,0.02));
  border: 1px solid var(--border-primary, rgba(255,255,255,0.07));
  border-radius: var(--radius-md, 8px);
}

.head { display: flex; justify-content: space-between; align-items: center; }
.head h4 { margin: 0; font-size: 0.9rem; font-weight: 600; }
.confidence {
  font-size: 0.7rem;
  color: var(--text-gray);
  padding: 0.15rem 0.5rem;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
}

.empty { font-size: 0.8rem; color: var(--text-gray); font-style: italic; margin: 0; }

.axis-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.axis-label {
  font-size: 0.65rem;
  color: var(--text-gray);
  min-width: 36px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.axis-label.right { text-align: right; }

.axis-track {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  position: relative;
}
.axis-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
.axis-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary, #000);
  transition: left 0.5s ease;
}

.axis-caption {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--text-gray);
  padding-left: 44px;
  padding-right: 44px;
}
.axis-value { font-weight: 600; }

.sentiment-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.5rem;
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
  font-size: 0.78rem;
}
.sent-label { color: var(--text-gray); }
.sent-value[data-tone="bull"] { color: oklch(0.7 0.2 145); }
.sent-value[data-tone="bear"] { color: oklch(0.65 0.2 25); }
.sent-value[data-tone="neutral"] { color: var(--text-gray); }

.topics { display: flex; flex-direction: column; gap: 0.3rem; }
.topics-label, .inf-label, .friends-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-gray);
}
.topics-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.topic-chip {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.topic-chip b { color: var(--primary-blue); margin-left: 0.2rem; }
.topic-chip[data-cat="crypto"] { border-color: oklch(0.7 0.15 80 / 0.4); }
.topic-chip[data-cat="stocks"] { border-color: oklch(0.7 0.15 220 / 0.4); }
.topic-chip[data-cat="forex"] { border-color: oklch(0.7 0.15 40 / 0.4); }
.topic-chip[data-cat="commodities"] { border-color: oklch(0.7 0.15 100 / 0.4); }

.influencers { display: flex; flex-direction: column; gap: 0.3rem; }
.inf-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.inf-chip {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in oklch, var(--primary-blue) 15%, transparent);
  color: var(--primary-blue);
}

.friends { display: flex; flex-direction: column; gap: 0.4rem; }
.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.4rem;
}
.friend-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.friend-axis {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  position: relative;
}
.friend-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--bg-secondary, #000);
}
.friend-name { font-size: 0.65rem; color: var(--text-gray); }
</style>
