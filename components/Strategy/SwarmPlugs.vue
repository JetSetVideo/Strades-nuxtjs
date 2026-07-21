<script setup lang="ts">
/**
 * StrategySwarmPlugs — Let the user plug community members and AI avatars
 * into the strategy. Their weighted opinions feed the swarm intelligence engine
 * and influence the strategy's allocation targets.
 */
import { ref, computed } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useAgentsStore } from '@/stores/agents'
import { useOpinionsStore } from '@/stores/opinions'
import UIPill from '@/components/UI/Pill.vue'

const emit = defineEmits<{
  change: []
}>()

const community = useCommunityStore()
const agents = useAgentsStore()
const opinions = useOpinionsStore()

const search = ref('')
const mode = ref<'community' | 'avatars'>('community')

// Load data
if (!community.hydrated) community.fetchCommunity()
if (!agents.hydrated) agents.fetchAgents()

const communityMembers = computed(() => {
  let list = community.list
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(m => m.username?.toLowerCase().includes(q) || m.bio?.toLowerCase().includes(q))
  }
  return list
})

const avatarList = computed(() => {
  let list = agents.list
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(a => a.name?.toLowerCase().includes(q))
  }
  return list
})

function togglePlug(agentId: string) {
  const existing = opinions.plugs.find(p => p.agent_id === agentId)
  if (existing) {
    opinions.unplug(agentId)
  } else {
    opinions.plug(agentId, 0.5)
  }
  opinions.recompute()
  emit('change')
}

function setWeight(agentId: string, weight: number) {
  opinions.setWeight(agentId, weight)
  opinions.recompute()
  emit('change')
}

const isPlugged = (id: string) => opinions.plugs.some(p => p.agent_id === id)

const getWeight = (id: string) => opinions.plugs.find(p => p.agent_id === id)?.weight ?? 0.5

const pluggedCount = computed(() => opinions.plugs.length)

const modeOptions = [
  { id: 'community', label: 'Community' },
  { id: 'avatars', label: 'AI Avatars' },
] as const
</script>

<template>
  <div class="swarm-plugs">
    <div class="swarm-header">
      <div class="swarm-title-row">
        <span class="swarm-title">Swarm Inputs</span>
        <UIPill v-if="pluggedCount > 0" tone="info" size="sm">{{ pluggedCount }} plugged</UIPill>
      </div>
      <p class="swarm-desc">
        Plug community members or AI avatars into your strategy. Their weighted opinions
        will influence the allocation targets via the swarm intelligence engine.
      </p>
    </div>

    <!-- Mode toggle -->
    <div class="mode-toggle">
      <button
        v-for="opt in modeOptions"
        :key="opt.id"
        class="mode-btn"
        :class="{ active: mode === opt.id }"
        @click="mode = opt.id"
      >{{ opt.label }}</button>
    </div>

    <!-- Search -->
    <input
      v-model="search"
      type="text"
      class="search-input"
      :placeholder="`Search ${mode === 'community' ? 'community members' : 'AI avatars'}...`"
    />

    <!-- Swarm vector preview -->
    <div v-if="pluggedCount > 0" class="swarm-preview">
      <span class="preview-label">Swarm Weighted Allocation</span>
      <div class="preview-bar">
        <div class="seg fiat" :style="{ width: `${opinions.swarmVector.fiat}%` }" title="Fiat" />
        <div class="seg crypto" :style="{ width: `${opinions.swarmVector.crypto}%` }" title="Crypto" />
        <div class="seg stocks" :style="{ width: `${opinions.swarmVector.stocks}%` }" title="Stocks" />
        <div class="seg commodities" :style="{ width: `${opinions.swarmVector.commodities}%` }" title="Commodities" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="mode === 'community' && communityMembers.length === 0 && !search" class="empty">
      No community members loaded. Try adding friends or discover new traders.
    </div>
    <div v-else-if="mode === 'avatars' && avatarList.length === 0 && !search" class="empty">
      No AI avatars available. Train your avatar on the Profile page first.
    </div>

    <!-- Community list -->
    <div v-if="mode === 'community'" class="member-list">
      <div
        v-for="m in communityMembers"
        :key="m.id"
        class="member-row"
        :class="{ plugged: isPlugged(m.id) }"
      >
        <img :src="m.avatar_url" :alt="m.username" class="member-avatar" />
        <div class="member-info">
          <span class="member-name">{{ m.username }}</span>
          <span class="member-bio">{{ m.bio || m.trading_style?.replace('_', ' ') }}</span>
        </div>
        <div v-if="isPlugged(m.id)" class="weight-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="getWeight(m.id)"
            @input="setWeight(m.id, Number(($event.target as HTMLInputElement).value))"
            class="weight-slider"
          />
          <span class="weight-val">{{ Math.round(getWeight(m.id) * 100) }}%</span>
        </div>
        <button
          class="plug-btn"
          :class="{ active: isPlugged(m.id) }"
          @click="togglePlug(m.id)"
        >
          {{ isPlugged(m.id) ? 'Unplug' : 'Plug' }}
        </button>
      </div>
    </div>

    <!-- Avatar list -->
    <div v-if="mode === 'avatars'" class="member-list">
      <div
        v-for="a in avatarList"
        :key="a.id"
        class="member-row"
        :class="{ plugged: isPlugged(a.id) }"
      >
        <img :src="a.avatar_url" :alt="a.name" class="member-avatar" />
        <div class="member-info">
          <span class="member-name">{{ a.name }}</span>
          <span class="member-bio">{{ a.trading_style?.replace('_', ' ') }} · Conf: {{ Math.round(a.confidence_score * 100) }}%</span>
        </div>
        <div v-if="isPlugged(a.id)" class="weight-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="getWeight(a.id)"
            @input="setWeight(a.id, Number(($event.target as HTMLInputElement).value))"
            class="weight-slider"
          />
          <span class="weight-val">{{ Math.round(getWeight(a.id) * 100) }}%</span>
        </div>
        <button
          class="plug-btn"
          :class="{ active: isPlugged(a.id) }"
          @click="togglePlug(a.id)"
        >
          {{ isPlugged(a.id) ? 'Unplug' : 'Plug' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swarm-plugs {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.swarm-header { display: flex; flex-direction: column; gap: 0.2rem; }
.swarm-title-row { display: flex; align-items: center; gap: 0.5rem; }
.swarm-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-white);
}
.swarm-desc {
  font-size: 0.72rem;
  color: var(--text-gray);
  margin: 0;
  line-height: 1.4;
}

.mode-toggle {
  display: flex;
  gap: 2px;
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.mode-btn {
  flex: 1;
  padding: 0.3rem;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-gray);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s ease;
}
.mode-btn.active {
  background: rgba(0,255,136,0.12);
  color: var(--primary-green);
}

.search-input {
  width: 100%;
  padding: 0.4rem 0.55rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.78rem;
  font-family: inherit;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: var(--primary-green); }

.swarm-preview {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.preview-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}
.preview-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
}
.seg { transition: width 0.4s ease; }
.seg.fiat { background: #4A90E2; }
.seg.crypto { background: #F5A623; }
.seg.stocks { background: #7ED321; }
.seg.commodities { background: #F8E71C; }

.empty {
  font-size: 0.78rem;
  color: var(--text-gray);
  font-style: italic;
  padding: 0.5rem 0;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 320px;
  overflow-y: auto;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.45rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.member-row:hover { background: rgba(255,255,255,0.04); }
.member-row.plugged {
  border-color: rgba(0,255,136,0.25);
  background: rgba(0,255,136,0.04);
}

.member-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.member-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-white);
}
.member-bio {
  font-size: 0.6rem;
  color: var(--text-gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weight-control {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.weight-slider {
  width: 60px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}
.weight-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary-green);
  cursor: pointer;
}
.weight-val {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--primary-green);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.plug-btn {
  flex-shrink: 0;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border-secondary);
  border-radius: 999px;
  background: transparent;
  color: var(--text-gray);
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: all 0.12s ease;
}
.plug-btn:hover { border-color: var(--primary-green); color: var(--primary-green); }
.plug-btn.active {
  background: rgba(0,255,136,0.12);
  border-color: var(--primary-green);
  color: var(--primary-green);
}
</style>
