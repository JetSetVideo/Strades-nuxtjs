<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/stores/users'
import ProfileMark from '@/components/Profile/Mark.vue'
import { profileMask } from '~/utils/profileMask'

const props = defineProps<{
  user: User
  isOwn?: boolean
  /** Desk override. The signed-in page can publish a different name. */
  name?: string
  handle?: string
  /** Uploaded picture. Empty draws the performance mask. */
  portrait?: string
  note?: string
  plan?: string
  paid?: boolean
}>()

const emit = defineEmits<{
  follow: []
  message: []
}>()

const riskLabel = computed(() => {
  const map: Record<string, string> = {
    low: 'Conservative',
    moderate: 'Moderate',
    high: 'Aggressive',
    very_high: 'Ultra'
  }
  return map[props.user.risk_tolerance] ?? props.user.risk_tolerance
})

const styleLabel = computed(() => {
  const map: Record<string, string> = {
    scalper: 'Scalper',
    day_trader: 'Day Trader',
    swing_trader: 'Swing Trader',
    position_trader: 'Position'
  }
  return map[props.user.trading_style] ?? props.user.trading_style
})

// CSS border-radius driven by risk score (Design.md)
const dynamicRadius = computed(() => {
  const r = props.user.psychology_profile?.risk_score ?? 0.5
  return `${Math.round(16 - r * 16)}px`
})

const joinedYear = computed(() =>
  new Date(props.user.joined_date).getFullYear()
)

const shownName = computed(() => props.name || `${props.user.first_name} ${props.user.last_name}`)
const shownHandle = computed(() => (props.handle || props.user.username).replace(/^@/, ''))
const face = computed(() => profileMask(props.user.id, {
  style: props.user.trading_style,
  risk: props.user.psychology_profile?.risk_score,
  discipline: props.user.psychology_profile?.discipline_score,
  patience: props.user.psychology_profile?.patience_index,
  aggression: props.user.psychology_profile?.aggression_score,
}))
const photo = computed(() => {
  const url = props.portrait || ''
  if (!url || url.includes('/avatars/Ellipse') || url.includes('pravatar.cc')) return ''
  return url
})
</script>

<template>
  <div class="hero" :style="{ '--profile-radius': dynamicRadius }">
    <div class="hero-cover" :style="{ background: `linear-gradient(120deg, ${face.from}, ${face.to})` }">
      <div class="cover-gradient" />
    </div>

    <div class="hero-body">
      <component
        :is="isOwn ? 'a' : 'div'"
        class="avatar-wrap"
        :href="isOwn ? '/settings#identity' : undefined"
        :title="isOwn ? 'Name and picture in Settings' : undefined"
      >
        <img v-if="photo" :src="photo" :alt="shownName" class="avatar">
        <ProfileMark
          v-else
          class="avatar"
          :seed="user.id"
          :trade-style="user.trading_style"
          :risk="user.psychology_profile?.risk_score"
          :discipline="user.psychology_profile?.discipline_score"
          :patience="user.psychology_profile?.patience_index"
          :aggression="user.psychology_profile?.aggression_score"
        />
        <span class="online-dot" :class="{ online: user.is_online, offline: !user.is_online }" />
      </component>

      <div class="identity">
        <div class="name-row">
          <h1 class="display-name">
            <NuxtLink v-if="isOwn" to="/settings#identity">{{ shownName }}</NuxtLink>
            <template v-else>{{ shownName }}</template>
          </h1>
          <span class="verified" :class="{ on: user.is_verified }" :title="user.is_verified ? 'Verified' : 'Not verified'">✓</span>
          <span class="role-tag" :class="{ paid }">{{ plan || user.role }}</span>
        </div>
        <div class="handle">@{{ shownHandle }} · {{ user.city }}, {{ user.country }}</div>
        <p class="bio">{{ user.bio }}</p>
        <p v-if="note" class="bio note">{{ note }}</p>
      </div>
    </div>

    <!-- Performance ribbon -->
    <div class="perf-ribbon">
      <div class="perf-tile">
        <span class="perf-label">30d</span>
        <span class="perf-value" :class="user.performance_30d < 0 ? 'down' : 'up'">{{ user.performance_30d >= 0 ? '+' : '' }}{{ user.performance_30d.toFixed(1) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">7d</span>
        <span class="perf-value" :class="user.performance_7d < 0 ? 'down' : 'up'">{{ user.performance_7d >= 0 ? '+' : '' }}{{ user.performance_7d.toFixed(1) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">24h</span>
        <span class="perf-value" :class="user.performance_1d < 0 ? 'down' : 'up'">{{ user.performance_1d >= 0 ? '+' : '' }}{{ user.performance_1d.toFixed(1) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">Win</span>
        <span class="perf-value up">{{ user.win_rate.toFixed(1) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">Trades</span>
        <span class="perf-value">{{ user.total_trades.toLocaleString(APP_LOCALE) }}</span>
      </div>
    </div>

    <!-- Tags & metadata -->
    <div class="meta-row">
      <span class="tag risk-tag">{{ riskLabel }}</span>
      <span class="tag style-tag">{{ styleLabel }}</span>
      <span class="tag">{{ user.country }}</span>
      <span class="tag">Since {{ joinedYear }}</span>
      <span class="tag exp-tag">Lv.{{ user.experience?.level }} — {{ user.experience?.title }}</span>
    </div>

    <!-- Social stats -->
    <div class="social-stats">
      <span><strong>{{ user.followers_count.toLocaleString(APP_LOCALE) }}</strong> followers</span>
      <span><strong>{{ user.following_count.toLocaleString(APP_LOCALE) }}</strong> following</span>
      <span><strong>{{ user.friends_count }}</strong> contacts</span>
      <span><strong>{{ user.active_strategies_count }}</strong> strategies</span>
    </div>

    <!-- CTA -->
    <div v-if="!isOwn" class="cta-row">
      <button class="btn-follow" @click="emit('follow')">Follow</button>
      <button class="btn-message" @click="emit('message')">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 8.1 13.6 2.6 8.4 13.6 7.2 8.8z" /></svg>
        Message
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border: 1px solid var(--border-primary);
  border-radius: var(--profile-radius, var(--radius-lg));
  overflow: hidden;
  padding: 0 0 clamp(0.35rem, 1vw, 0.6rem);
  transition: border-radius var(--app-animation-speed, 0.5s) ease;
}

.hero-cover {
  width: 100%;
  height: clamp(48px, 7vw, 72px);
  flex: 0 0 auto;
  position: relative;
}

.cover-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(10,12,16,0.2) 40%, var(--bg-secondary, #12141c) 100%);
}

.hero-body {
  display: flex;
  gap: clamp(0.4rem, 1vw, 0.65rem);
  width: 100%;
  box-sizing: border-box;
  padding: 0 clamp(0.4rem, 1.2vw, 0.7rem);
  margin-top: clamp(-28px, -3.2vw, -32px);
  align-items: flex-end;
  position: relative;
  z-index: 1;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar,
.avatar-wrap :deep(.mark) {
  width: clamp(56px, 12vw, 68px);
  height: clamp(56px, 12vw, 68px);
  border-radius: 14px 0 14px 0;
  object-fit: cover;
  display: block;
}
a.avatar-wrap { text-decoration: none; color: inherit; }

.online-dot {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
}

.online-dot.online  { background: var(--success-green); box-shadow: 0 0 6px var(--success-green); }
.online-dot.offline { background: var(--text-gray); }

.identity {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.display-name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-white);
  margin: 0;
}

.verified {
  color: rgba(255,255,255,0.28);
  font-size: 0.85rem;
  font-weight: 700;
}
.verified.on { color: var(--primary-blue, #00aaff); }
.display-name a { color: inherit; text-decoration: none; }

.role-tag {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 170, 255, 0.12);
  border: 1px solid rgba(0, 170, 255, 0.3);
  color: var(--primary-blue);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.role-tag.paid { color: #f5d90a; border-color: rgba(245,217,10,0.45); background: rgba(245,217,10,0.1); }

.handle {
  font-size: 0.8rem;
  color: var(--text-gray);
  margin-top: 2px;
}

.user-id {
  font-family: monospace;
  opacity: 0.6;
}

.bio {
  font-size: 0.85rem;
  color: var(--text-light-gray);
  margin: 6px 0 0;
  line-height: 1.4;
}
.bio.note { font-size: 0.72rem; color: rgba(255,255,255,0.5); }

/* ── Performance ribbon ─── */
.perf-ribbon {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  gap: clamp(0.2rem, 0.55vw, 0.32rem);
  padding: clamp(0.4rem, 1vw, 0.55rem) clamp(0.4rem, 1.2vw, 0.7rem) clamp(0.12rem, 0.4vw, 0.22rem);
  box-sizing: border-box;
}

.perf-ribbon::-webkit-scrollbar { display: none; }

.perf-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 auto;
  min-width: min-content;
  white-space: nowrap;
  padding: clamp(0.16rem, 0.4vw, 0.28rem) clamp(0.22rem, 0.6vw, 0.38rem);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  border-radius: 10px 0 10px 0;
}
.perf-value.up { color: var(--primary-green, #00ff88); }
.perf-value.down { color: #ff5555; }

.perf-label {
  font-size: 0.65rem;
  color: var(--text-gray);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.perf-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--tile-color, var(--text-white));
  margin-top: 2px;
}

/* ── Tags ─── */
.meta-row {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  gap: clamp(0.16rem, 0.45vw, 0.28rem);
  padding: 0 clamp(0.4rem, 1.2vw, 0.7rem) clamp(0.12rem, 0.4vw, 0.22rem);
  box-sizing: border-box;
}
.meta-row .tag { flex: 1 1 auto; min-width: min-content; text-align: center; white-space: nowrap; }

.tag {
  font-size: 0.7rem;
  padding: 2px clamp(4px, 0.7vw, 8px);
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-primary);
  color: var(--text-light-gray);
}

.risk-tag { border-color: var(--warning-orange); color: var(--warning-orange); }
.style-tag { border-color: var(--primary-blue); color: var(--primary-blue); }
.exp-tag  { border-color: var(--primary-green); color: var(--primary-green); }

/* ── Social stats ─── */
.social-stats {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
  gap: clamp(0.16rem, 0.5vw, 0.32rem);
  padding: 0 clamp(0.4rem, 1.2vw, 0.7rem) clamp(0.12rem, 0.4vw, 0.22rem);
  font-size: 0.75rem;
  color: var(--text-gray);
  box-sizing: border-box;
}
.social-stats > span { flex: 1 1 auto; min-width: min-content; text-align: center; white-space: nowrap; }

.social-stats strong {
  color: var(--text-white);
}

/* ── CTA ─── */
.cta-row {
  display: flex;
  gap: clamp(0.25rem, 0.7vw, 0.4rem);
  padding: 0 clamp(0.4rem, 1.2vw, 0.7rem);
}

.btn-follow, .btn-message {
  padding: 8px 20px;
  border-radius: var(--profile-radius, var(--radius-md));
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-follow {
  background: var(--primary-gradient);
  color: #000;
}

.btn-message {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: rgba(0, 140, 255, 0.16);
  border: 1px solid rgba(79, 168, 255, 0.7);
  color: #8ec8ff;
  border-radius: 10px 0 10px 0;
}
.btn-message svg { width: 14px; height: 14px; fill: currentColor; }
.cta-row { width: 100%; box-sizing: border-box; }
.cta-row .btn-follow, .cta-row .btn-message { flex: 1 1 0; }

.btn-follow:hover  { opacity: 0.85; }
.btn-message:hover { background: rgba(0,255,136,0.08); }
</style>
