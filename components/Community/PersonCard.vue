<script setup lang="ts">
import UIPill from '@/components/UI/Pill.vue'
import type { CommunityUser } from '@/stores/community'

withDefaults(defineProps<{
  user: CommunityUser
  variant?: 'friend' | 'discover'
}>(), { variant: 'friend' })

defineEmits<{
  (e: 'message', id: string): void
  (e: 'profile', id: string): void
  (e: 'add', user: CommunityUser): void
}>()
</script>

<template>
  <article class="person-card">
    <div class="person-head">
      <img :src="user.avatar_url" :alt="user.username" class="person-avatar" />
      <span class="person-status" :class="{ on: user.online }" :title="user.online ? 'Online' : 'Offline'" />
    </div>
    <div class="person-body">
      <div class="person-name-row">
        <strong>{{ user.username }}</strong>
        <UIPill v-if="variant === 'discover'" tone="info">
          {{ Math.round(user.match_score * 100) }}% match
        </UIPill>
        <UIPill v-else ghost tone="neutral">{{ user.trading_style.replace(/_/g,' ') }}</UIPill>
      </div>
      <p class="person-bio">{{ user.bio }}</p>
      <div class="person-meta">
        <span v-if="variant === 'friend'" class="meta-stat">
          <span class="meta-label">Win</span>
          <span class="meta-value">{{ Math.round(user.win_rate * 100) }}%</span>
        </span>
        <span
          class="meta-stat"
          :class="{ pos: user.last_30d_pnl_pct >= 0, neg: user.last_30d_pnl_pct < 0 }"
        >
          <span class="meta-label">30d</span>
          <span class="meta-value">{{ user.last_30d_pnl_pct.toFixed(1) }}%</span>
        </span>
        <span v-if="variant === 'discover'" class="meta-stat">
          <span class="meta-label">Followers</span>
          <span class="meta-value">
            {{ user.followers >= 1000 ? (user.followers / 1000).toFixed(1) + 'k' : user.followers }}
          </span>
        </span>
        <span class="spec-row">
          <span v-for="s in user.specialization" :key="s" :class="['spec-tag', `spec-${s}`]">{{ s }}</span>
        </span>
      </div>
    </div>
    <div class="person-actions">
      <button v-if="variant === 'discover'" class="link-btn" @click="$emit('add', user)">+ Add friend</button>
      <button v-else class="link-btn" @click="$emit('message', user.id)">Message</button>
      <button
        class="link-btn ghost"
        @click="variant === 'discover' ? $emit('message', user.id) : $emit('profile', user.id)"
      >
        {{ variant === 'discover' ? 'Message' : 'Profile' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.person-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 0.55rem;
  padding: 0.6rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 8px);
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.person-head {
  position: relative;
  grid-row: 1 / 2;
}
.person-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
}
.person-status {
  position: absolute;
  right: -1px; bottom: 1px;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(15,15,15,0.95);
}
.person-status.on {
  background: var(--primary-green, #00ff88);
  box-shadow: 0 0 4px var(--primary-green, #00ff88);
}

.person-body { min-width: 0; overflow: hidden; }
.person-name-row {
  display: flex; justify-content: space-between;
  gap: 0.4rem; align-items: center;
  min-width: 0;
}
.person-name-row strong {
  font-size: 0.92rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.person-bio {
  margin: 0.2rem 0 0.35rem 0;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.person-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
}
.meta-stat {
  display: inline-flex; flex-direction: column;
  line-height: 1.1; min-width: 0;
}
.meta-label {
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
}
.meta-value {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.meta-stat.pos .meta-value { color: var(--success-green, #00ff88); }
.meta-stat.neg .meta-value { color: var(--error-red, #ff4d6a); }

.spec-row { display: inline-flex; gap: 0.2rem; flex-wrap: wrap; margin-left: auto; }
.spec-tag {
  font-size: 0.55rem; font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.spec-fiat        { background: rgba(74,144,226,0.18);  color: #4A90E2; }
.spec-crypto      { background: rgba(245,166,35,0.18);  color: #F5A623; }
.spec-stocks      { background: rgba(126,211,33,0.18);  color: #7ED321; }
.spec-commodities { background: rgba(248,231,28,0.18);  color: #F8E71C; }

.person-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.link-btn {
  flex: 1;
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  text-transform: uppercase;
}
.link-btn.ghost {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}
.link-btn:hover { transform: translateY(-1px); }
</style>
