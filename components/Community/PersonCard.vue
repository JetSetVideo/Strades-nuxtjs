<script setup lang="ts">
import { computed } from 'vue'
import UIPill from '@/components/UI/Pill.vue'
import ProfileMark from '@/components/Profile/Mark.vue'
import type { CommunityUser } from '@/stores/community'
import { profileMask } from '~/utils/profileMask'

const props = withDefaults(defineProps<{
  user?: CommunityUser
  variant?: 'friend' | 'discover' | 'avatar' | 'group'
  empty?: boolean
  /** Discussion or other page. The portrait and the name open this instead of a profile. */
  href?: string
  /** Extra faces for a group or a blended avatar. The first four are drawn. */
  members?: { id: string; style?: string; win?: number }[]
  risk?: number
  aggression?: number
}>(), { variant: 'friend', empty: false, members: () => [] })

defineEmits<{
  (e: 'message', id: string): void
  (e: 'profile', id: string): void
  (e: 'add', user: CommunityUser): void
}>()

const patience = computed(() => {
  const pnl = props.user?.last_30d_pnl_pct
  if (pnl == null || Number.isNaN(pnl)) return undefined
  return Math.min(1, Math.max(0, 0.5 + pnl / 40))
})
const look = computed(() => profileMask(props.empty ? 'nofriend' : (props.user?.id || 'desk'), {
  style: props.user?.trading_style,
  discipline: props.user ? props.user.win_rate : undefined,
  patience: patience.value,
  risk: props.risk,
  aggression: props.aggression,
  muted: props.empty,
}))
const handle = computed(() => (props.user?.handle || props.user?.username || '').replace(/^@/, ''))
const stacked = computed(() => (props.members ?? []).slice(0, 4))
const photo = computed(() => {
  const url = props.user?.avatar_url || ''
  if (!url || url.includes('/avatars/Ellipse')) return ''
  return url
})
</script>

<template>
  <article
    class="person-card"
    :class="{ 'is-empty': empty, paid: user?.premium }"
    :style="empty ? undefined : { background: look.wash, borderColor: look.edge }"
  >
    <template v-if="empty || !user">
      <div class="person-head" aria-hidden="true">
        <ProfileMark seed="nofriend" muted />
      </div>
      <div class="person-body">
        <div class="person-name-row">
          <strong>No friends</strong>
        </div>
        <p class="person-bio">This desk has no one in the circle yet.</p>
      </div>
    </template>

    <template v-else>
      <NuxtLink v-if="href" :to="href" class="person-head" :aria-label="`Open @${handle}`">
        <div v-if="stacked.length > 1" class="face-stack">
          <ProfileMark
            v-for="member in stacked"
            :key="member.id"
            :seed="member.id"
            :trade-style="member.style"
            :discipline="member.win"
          />
        </div>
        <ProfileMark
          v-else
          :seed="user.id"
          :trade-style="user.trading_style"
          :discipline="user.win_rate"
          :patience="patience"
          :risk="risk"
          :aggression="aggression"
        />
      </NuxtLink>
      <button v-else-if="variant !== 'avatar'" type="button" class="person-head" :aria-label="`Open @${handle}`" @click="$emit('profile', user.id)">
        <img v-if="photo && stacked.length < 2" :src="photo" :alt="user.username" class="person-avatar">
        <div v-else-if="stacked.length > 1" class="face-stack">
          <ProfileMark
            v-for="member in stacked"
            :key="member.id"
            :seed="member.id"
            :trade-style="member.style"
            :discipline="member.win"
          />
        </div>
        <ProfileMark
          v-else
          :seed="user.id"
          :trade-style="user.trading_style"
          :discipline="user.win_rate"
          :patience="patience"
          :risk="risk"
          :aggression="aggression"
        />
        <span v-if="stacked.length < 2" class="person-status" :class="{ on: user.online }" :title="user.online ? 'Online' : 'Offline'" />
      </button>
      <div v-else class="person-head" aria-hidden="true">
        <ProfileMark
          :seed="user.id"
          :trade-style="user.trading_style"
          :discipline="user.win_rate"
          :patience="patience"
          :risk="risk"
          :aggression="aggression"
        />
      </div>
      <div class="person-body">
        <div class="person-name-row">
          <NuxtLink v-if="href" :to="href" class="who">
            <strong>{{ user.username }}</strong>
            <span class="at">@{{ handle }}</span>
          </NuxtLink>
          <button v-else type="button" class="who" @click="variant !== 'avatar' && $emit('profile', user.id)">
            <strong>{{ user.username }}</strong>
            <span class="at">@{{ handle }}</span>
          </button>
          <span v-if="variant === 'friend' || variant === 'discover'" class="tick" :class="{ on: user.verified }" :title="user.verified ? 'Verified' : 'Not verified'">✓</span>
          <span v-if="user.premium" class="plan">Paid</span>
          <UIPill v-if="variant === 'discover'" tone="info">
            {{ Math.round(user.match_score * 100) }}% match
          </UIPill>
          <UIPill v-else-if="user.trading_style" ghost tone="neutral">{{ user.trading_style.replace(/_/g,' ') }}</UIPill>
        </div>
        <p class="person-bio">{{ user.bio }}</p>
        <div class="person-meta">
          <span v-if="variant === 'avatar'" class="meta-stat">
            <span class="meta-label">Freq</span>
            <span class="meta-value">{{ Math.round((user.execution_frequency ?? 0) * 100) }}%</span>
          </span>
          <span v-if="variant === 'friend' || variant === 'avatar'" class="meta-stat">
            <span class="meta-label">{{ variant === 'avatar' ? 'Conf' : 'Win' }}</span>
            <span class="meta-value">{{ Math.round(user.win_rate * 100) }}%</span>
          </span>
          <span
            v-if="variant !== 'group'"
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
      <div v-if="variant === 'friend' || variant === 'discover'" class="person-actions">
        <button v-if="variant === 'discover'" class="link-btn add" @click="$emit('add', user)">+ Add friend</button>
        <button class="link-btn send" @click="$emit('message', user.id)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 8.1 13.6 2.6 8.4 13.6 7.2 8.8z" /></svg>
          Message
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped>
.person-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 0.5rem;
  padding: 0.6rem;
  background: linear-gradient(145deg, rgba(120,124,134,0.16), rgba(14,14,18,0.94));
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px 0 14px 0;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.person-card.is-empty {
  background: linear-gradient(145deg, rgba(140,144,156,0.16), rgba(18,18,22,0.96) 60%);
  border-color: rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.55);
}
.person-card.paid { box-shadow: inset 0 0 0 1px rgba(245,217,10,0.35); }
.person-head {
  position: relative;
  grid-row: 1 / 2;
  width: 46px;
  height: 46px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: inherit;
}
.person-card.is-empty .person-head { cursor: default; }
.person-avatar,
.person-head :deep(.mark) {
  width: 46px;
  height: 46px;
  border-radius: 10px 0 10px 0;
  object-fit: cover;
  display: block;
}
.face-stack {
  width: 46px;
  height: 46px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}
.face-stack :deep(.mark) {
  width: 22px;
  height: 22px;
  border-radius: 6px 0 6px 0;
  box-shadow: none;
}
a.person-head, a.who { text-decoration: none; color: inherit; }
.person-status {
  position: absolute;
  right: -1px;
  bottom: 1px;
  width: 10px;
  height: 10px;
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
  display: flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}
.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1 1 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.who strong {
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.at {
  font-style: normal;
  font-size: 0.62rem;
  color: rgba(255,255,255,0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.who:hover strong, .who:hover .at { color: var(--primary-green, #00ff88); }
.tick {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.28);
  line-height: 1;
}
.tick.on { color: var(--primary-blue, #00aaff); }
.plan {
  flex: 0 0 auto;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f5d90a;
  border: 1px solid rgba(245,217,10,0.45);
  border-radius: 999px;
  padding: 0.08rem 0.32rem;
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
  display: inline-flex;
  flex-direction: column;
  line-height: 1.1;
  min-width: 0;
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
.meta-stat.pos .meta-value { color: var(--app-color-up, var(--success-green, #00ff88)); }
.meta-stat.neg .meta-value { color: var(--app-color-down, var(--error-red, #ff4d6a)); }

.spec-row { display: inline-flex; gap: 0.2rem; flex-wrap: wrap; margin-left: auto; }
.spec-tag {
  font-size: 0.55rem;
  font-weight: 700;
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
}
.link-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid transparent;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  padding: 0.4rem 0.6rem;
  border-radius: 10px 0 10px 0;
  cursor: pointer;
  text-transform: uppercase;
}
.link-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.link-btn.send {
  background: rgba(0, 140, 255, 0.16);
  border-color: rgba(79, 168, 255, 0.7);
  color: #8ec8ff;
}
.link-btn.add {
  background: rgba(0,255,136,0.08);
  border-color: rgba(0,255,136,0.3);
  color: var(--primary-green, #00ff88);
}
.link-btn:hover { filter: brightness(1.08); }
</style>
