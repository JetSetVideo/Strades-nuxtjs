<script setup lang="ts">
import UICard from '@/components/UI/Card.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'

interface Agent {
  id: string
  name: string
  avatar_url: string
  trading_style?: string
}

interface AttachedBot {
  id: string
  name: string
  status: 'live' | 'paused' | 'error' | 'stopped' | string
  pnl_today_usd: number
  pnl_30d_pct: number
}

defineProps<{
  agent: Agent | null
  bots: AttachedBot[]
}>()

const fmtPct = (n?: number) => n === undefined ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
</script>

<template>
  <UICard title="Run by">
    <NuxtLink v-if="agent" :to="`/agents/${agent.id}`" class="agent-link">
      <img :src="agent.avatar_url" :alt="agent.name" class="agent-avatar" />
      <div class="agent-info">
        <strong>{{ agent.name }}</strong>
        <small>{{ agent.trading_style }}</small>
      </div>
      <span class="agent-arrow">→</span>
    </NuxtLink>
    <UIEmptyState v-else size="sm" icon="◯" message="No agent assigned. Plug one to automate.">
      <template #action>
        <NuxtLink to="/strategies" class="link-btn">Browse agents →</NuxtLink>
      </template>
    </UIEmptyState>

    <div v-if="bots.length" class="bot-list">
      <span class="sub">{{ bots.length }} bot{{ bots.length === 1 ? '' : 's' }} live</span>
      <NuxtLink
        v-for="b in bots"
        :key="b.id"
        :to="`/bots/${b.id}`"
        class="bot-row"
      >
        <span class="dot" :class="b.status" />
        <span class="bot-name">{{ b.name }}</span>
        <span class="bot-pnl" :class="{ pos: b.pnl_today_usd >= 0, neg: b.pnl_today_usd < 0 }">
          {{ fmtPct(b.pnl_30d_pct) }}
        </span>
      </NuxtLink>
    </div>
  </UICard>
</template>

<style scoped>
.agent-link {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.55rem;
  background: rgba(0,255,136,0.03);
  border: 1px solid rgba(0,255,136,0.18);
  border-radius: var(--app-border-radius, 6px);
  text-decoration: none;
  color: inherit;
  transition: all 0.15s ease;
  min-width: 0;
}
.agent-link:hover {
  background: rgba(0,255,136,0.06);
  border-color: var(--primary-green, #00ff88);
}
.agent-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0,255,136,0.3);
}
.agent-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  overflow: hidden;
}
.agent-info strong {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-info small {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.agent-arrow { color: var(--primary-green, #00ff88); font-size: 0.95rem; }

.link-btn {
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem;
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.link-btn:hover { text-decoration: underline; }

.bot-list {
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.bot-list .sub {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
  margin-bottom: 0.1rem;
}
.bot-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.4rem;
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
  font-size: 0.72rem;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s ease;
}
.bot-row:hover { background: rgba(0,255,136,0.05); }
.bot-row .dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
}
.bot-row .dot.live   { background: var(--success-green, #00ff88); box-shadow: 0 0 5px var(--success-green, #00ff88); }
.bot-row .dot.paused { background: #ffaa00; }
.bot-row .dot.error  { background: #ff4d6a; }
.bot-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: rgba(255,255,255,0.85);
}
.bot-pnl {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bot-pnl.pos { color: var(--success-green, #00ff88); }
.bot-pnl.neg { color: #ff4d6a; }
</style>
