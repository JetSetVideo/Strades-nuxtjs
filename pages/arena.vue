<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDataBetsStore } from '~/stores/dataBets'
import { useCreditsStore } from '~/stores/credits'
import { useAssetsStore } from '~/stores/assets'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { useCurrentUser } from '~/composables/useCurrentUser'

import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import ArenaChallengeCard from '@/components/Arena/ChallengeCard.vue'
import ArenaPostChallengeModal from '@/components/Arena/PostChallengeModal.vue'

definePageMeta({ title: 'Arena', layout: 'default' })

const dataBets = useDataBetsStore()
const credits = useCreditsStore()
const assets = useAssetsStore()
const tracker = useAgentTracker()
const { getUserId } = useCurrentUser()

const tab = ref<'open' | 'mine' | 'settled'>('open')
const modalOpen = ref(false)

let resolveTicker: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  credits.hydrate()
  dataBets.hydrate()
  if (!assets.assets.length) await assets.fetchAssets().catch(() => {})
  dataBets.seedDemo()
  dataBets.resolveDue()
  // Re-check for due challenges periodically — same cadence as other live tickers in the app.
  resolveTicker = setInterval(() => dataBets.resolveDue(), 6000)
})
onUnmounted(() => { if (resolveTicker) clearInterval(resolveTicker) })

const visibleChallenges = computed(() => {
  const uid = getUserId()
  switch (tab.value) {
    case 'mine':
      return dataBets.challenges.filter(c =>
        c.author_id === uid || dataBets.betsForChallenge(c.id).some(b => b.user_id === uid)
      )
    case 'settled':
      return dataBets.settledChallenges
    default:
      return dataBets.openChallenges
  }
})

const kpis = computed(() => [
  { label: 'Free credits', value: credits.balance, suffix: ' cr' },
  { label: 'Open challenges', value: dataBets.openChallenges.length },
  {
    label: 'Net result', value: dataBets.myNetResult, suffix: ' cr',
    tone: dataBets.myNetResult > 0 ? 'positive' as const : dataBets.myNetResult < 0 ? 'negative' as const : 'neutral' as const
  },
  { label: 'Your bets', value: dataBets.myBets.length }
])

interface PostChallengePayload {
  kind: 'market' | 'custom'
  title: string
  description: string
  resolves_in_hours: number
  asset_id?: string
  asset_symbol?: string
  comparator?: 'above' | 'below'
  target_price?: number
}

function handlePost(payload: PostChallengePayload) {
  const created = dataBets.postChallenge({ ...payload, author_id: getUserId() })
  tracker.track('data_challenge_posted', { id: created.id, challenge_id: created.id, kind: created.kind })
}
</script>

<template>
  <UIScreenShell
    title="Arena"
    :kpis="kpis"
    subtitle="Post your own data, or pick a real asset — the community bets free credits, never real money"
  >
    <template #actions>
      <button class="post-btn" @click="modalOpen = true">+ Post a challenge</button>
    </template>

    <div class="tabs" role="tablist">
      <button :class="{ active: tab === 'open' }" @click="tab = 'open'">Open</button>
      <button :class="{ active: tab === 'mine' }" @click="tab = 'mine'">Mine</button>
      <button :class="{ active: tab === 'settled' }" @click="tab = 'settled'">Settled</button>
    </div>

    <UIEmptyState
      v-if="!visibleChallenges.length"
      icon="⚔"
      title="Nothing here yet"
      :message="tab === 'open' ? 'Be the first to post a challenge.' : 'No challenges match this tab yet.'"
    />

    <div v-else class="challenge-grid">
      <ArenaChallengeCard v-for="c in visibleChallenges" :key="c.id" :challenge="c" />
    </div>

    <ArenaPostChallengeModal v-model:open="modalOpen" @submit="handlePost" />
  </UIScreenShell>
</template>

<style scoped>
.tabs { display: flex; gap: 0.4rem; }
.tabs button {
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 0.75rem;
  cursor: pointer;
  text-transform: capitalize;
}
.tabs button.active {
  background: rgba(0,255,136,0.1);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}

.post-btn {
  background: var(--primary-gradient);
  color: #000;
  border: none;
  padding: 0.45rem 0.9rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.challenge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 0.6rem;
}
</style>
