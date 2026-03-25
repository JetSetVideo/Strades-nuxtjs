<script setup lang="ts">
import type { User } from '@/stores/users'

const props = defineProps<{
  user: User
  isOwn?: boolean
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

const perfColor = (pct: number) => {
  const sat = Math.min(100, Math.abs(pct) * 2.5)
  return pct >= 0 ? `oklch(70% ${sat / 100 * 0.3 + 0.05} 145)` : `oklch(55% ${sat / 100 * 0.3 + 0.05} 25)`
}

// CSS border-radius driven by risk score (Design.md)
const dynamicRadius = computed(() => {
  const r = props.user.psychology_profile?.risk_score ?? 0.5
  return `${Math.round(16 - r * 16)}px`
})

const joinedYear = computed(() =>
  new Date(props.user.joined_date).getFullYear()
)
</script>

<template>
  <div class="hero" :style="{ '--profile-radius': dynamicRadius }">
    <!-- Cover / background accent -->
    <div class="hero-cover">
      <div class="cover-gradient" />
    </div>

    <!-- Identity row -->
    <div class="hero-body">
      <div class="avatar-wrap">
        <img :src="user.avatar_url" :alt="user.username" class="avatar" />
        <span class="online-dot" :class="{ online: user.is_online, offline: !user.is_online }" />
      </div>

      <div class="identity">
        <div class="name-row">
          <h1 class="display-name">{{ user.first_name }} {{ user.last_name }}</h1>
          <span v-if="user.is_verified" class="verified" title="Verified">✓</span>
          <span class="role-tag">{{ user.role }}</span>
        </div>
        <div class="handle">@{{ user.username }} · <span class="user-id">#{{ user.id }}</span></div>
        <p class="bio">{{ user.bio }}</p>
      </div>
    </div>

    <!-- Performance ribbon -->
    <div class="perf-ribbon">
      <div class="perf-tile" :style="{ '--tile-color': perfColor(user.performance_30d) }">
        <span class="perf-label">30d</span>
        <span class="perf-value">{{ user.performance_30d >= 0 ? '+' : '' }}{{ user.performance_30d.toFixed(2) }}%</span>
      </div>
      <div class="perf-tile" :style="{ '--tile-color': perfColor(user.performance_7d) }">
        <span class="perf-label">7d</span>
        <span class="perf-value">{{ user.performance_7d >= 0 ? '+' : '' }}{{ user.performance_7d.toFixed(2) }}%</span>
      </div>
      <div class="perf-tile" :style="{ '--tile-color': perfColor(user.performance_1d) }">
        <span class="perf-label">24h</span>
        <span class="perf-value">{{ user.performance_1d >= 0 ? '+' : '' }}{{ user.performance_1d.toFixed(2) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">Win Rate</span>
        <span class="perf-value">{{ user.win_rate.toFixed(1) }}%</span>
      </div>
      <div class="perf-tile">
        <span class="perf-label">Trades</span>
        <span class="perf-value">{{ user.total_trades.toLocaleString() }}</span>
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
      <span><strong>{{ user.followers_count.toLocaleString() }}</strong> followers</span>
      <span><strong>{{ user.following_count.toLocaleString() }}</strong> following</span>
      <span><strong>{{ user.friends_count }}</strong> contacts</span>
      <span v-if="user.active_strategies_count"><strong>{{ user.active_strategies_count }}</strong> strategies</span>
    </div>

    <!-- CTA -->
    <div v-if="!isOwn" class="cta-row">
      <button class="btn-follow" @click="emit('follow')">Follow</button>
      <button class="btn-message" @click="emit('message')">Message</button>
    </div>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  background: linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border: 1px solid var(--border-primary);
  border-radius: var(--profile-radius, var(--radius-lg));
  overflow: hidden;
  padding-bottom: var(--spacing-lg);
  transition: border-radius var(--app-animation-speed, 0.5s) ease;
}

.hero-cover {
  height: 80px;
  position: relative;
}

.cover-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, oklch(25% 0.05 270) 0%, oklch(15% 0.03 200) 100%);
}

.hero-body {
  display: flex;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg);
  margin-top: -36px;
  align-items: flex-end;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--border-accent);
  object-fit: cover;
  box-shadow: 0 0 16px var(--shadow-accent);
}

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
  color: var(--primary-blue);
  font-size: 0.85rem;
  font-weight: 700;
}

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

/* ── Performance ribbon ─── */
.perf-ribbon {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-sm);
  overflow-x: auto;
  scrollbar-width: none;
}

.perf-ribbon::-webkit-scrollbar { display: none; }

.perf-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 72px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

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
  gap: var(--spacing-xs);
  padding: 0 var(--spacing-lg) var(--spacing-sm);
}

.tag {
  font-size: 0.7rem;
  padding: 3px 10px;
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
  gap: var(--spacing-lg);
  padding: 0 var(--spacing-lg) var(--spacing-sm);
  font-size: 0.8rem;
  color: var(--text-gray);
}

.social-stats strong {
  color: var(--text-white);
}

/* ── CTA ─── */
.cta-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg);
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
  background: transparent;
  border: 1px solid var(--border-accent);
  color: var(--primary-green);
}

.btn-follow:hover  { opacity: 0.85; }
.btn-message:hover { background: rgba(0,255,136,0.08); }
</style>
