<script setup lang="ts">
import { computed } from 'vue'
import { useBotsStore } from '~/stores/bots'

const props = defineProps<{
  totalToday: number
}>()

const bots = useBotsStore()

const botPnlToday = computed(() => bots.list.reduce((s, b) => s + (b.pnl_today_usd ?? 0), 0))
const manualPnlToday = computed(() => props.totalToday - botPnlToday.value)

const totalAbs = computed(() => Math.abs(botPnlToday.value) + Math.abs(manualPnlToday.value))
const botShare = computed(() => totalAbs.value === 0 ? 50 : (Math.abs(botPnlToday.value) / totalAbs.value) * 100)
const manualShare = computed(() => 100 - botShare.value)

const topContributor = computed(() => {
  if (!bots.list.length) return null
  return [...bots.list].sort((a, b) => (b.pnl_today_usd ?? 0) - (a.pnl_today_usd ?? 0))[0]
})

const liveBots = computed(() => bots.list.filter(b => b.status === 'live'))

const fmt = (n: number) => {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}
</script>

<template>
  <div class="bot-contrib">
    <header class="head">
      <span class="title">Bot Contribution Today</span>
      <span class="meta">{{ liveBots.length }} live · {{ bots.list.length }} total</span>
    </header>

    <div class="split-bar" :title="`Bots ${fmt(botPnlToday)} · Manual ${fmt(manualPnlToday)}`">
      <span
        class="seg bot"
        :style="{ width: `${botShare}%` }"
        :class="{ neg: botPnlToday < 0 }"
      />
      <span
        class="seg manual"
        :style="{ width: `${manualShare}%` }"
        :class="{ neg: manualPnlToday < 0 }"
      />
    </div>

    <div class="split-legend">
      <div class="legend-item" :class="{ pos: botPnlToday >= 0, neg: botPnlToday < 0 }">
        <span class="swatch bot" />
        <span class="legend-text">
          <span class="legend-name">Bots</span>
          <span class="legend-value">{{ fmt(botPnlToday) }}</span>
        </span>
      </div>
      <div class="legend-item" :class="{ pos: manualPnlToday >= 0, neg: manualPnlToday < 0 }">
        <span class="swatch manual" />
        <span class="legend-text">
          <span class="legend-name">Manual</span>
          <span class="legend-value">{{ fmt(manualPnlToday) }}</span>
        </span>
      </div>
    </div>

    <div class="contributors">
      <span class="sub-title">Top contributor</span>
      <div v-if="topContributor" class="contrib-row" @click="$router.push(`/bots/${topContributor.id}`)">
        <span class="contrib-status" :class="topContributor.status" />
        <span class="contrib-name">{{ topContributor.name }}</span>
        <span class="contrib-pnl" :class="{ pos: (topContributor.pnl_today_usd ?? 0) >= 0, neg: (topContributor.pnl_today_usd ?? 0) < 0 }">
          {{ fmt(topContributor.pnl_today_usd ?? 0) }}
        </span>
      </div>
      <div v-else class="empty">No bots deployed yet.</div>

      <ul v-if="liveBots.length > 1" class="other-bots">
        <li
          v-for="b in liveBots.filter(b => b.id !== topContributor?.id).slice(0, 3)"
          :key="b.id"
          @click="$router.push(`/bots/${b.id}`)"
        >
          <span class="contrib-status" :class="b.status" />
          <span class="contrib-name">{{ b.name }}</span>
          <span class="contrib-pnl" :class="{ pos: (b.pnl_today_usd ?? 0) >= 0, neg: (b.pnl_today_usd ?? 0) < 0 }">
            {{ fmt(b.pnl_today_usd ?? 0) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.bot-contrib {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.head {
  display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem;
}
.title {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.meta { font-size: 0.6rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); font-weight: 600; }

.split-bar {
  display: flex;
  width: 100%;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.06);
}
.seg { height: 100%; transition: width 0.4s ease; }
.seg.bot { background: linear-gradient(90deg, var(--primary-green, #00ff88), var(--primary-blue, #00aaff)); }
.seg.manual { background: rgba(255,255,255,0.18); }
.seg.bot.neg { background: linear-gradient(90deg, #ff4d6a, #ffaa00); }
.seg.manual.neg { background: rgba(255, 77, 106, 0.45); }

.split-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 5px;
  min-width: 0;
}
.swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.swatch.bot { background: linear-gradient(135deg, var(--primary-green, #00ff88), var(--primary-blue, #00aaff)); }
.swatch.manual { background: rgba(255,255,255,0.4); }
.legend-text { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; }
.legend-name {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
}
.legend-value {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.legend-item.pos .legend-value { color: var(--success-green, #00ff88); }
.legend-item.neg .legend-value { color: #ff4d6a; }

.contributors {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.sub-title {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
  margin-bottom: 0.1rem;
}
.contrib-row, .other-bots li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 5px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  cursor: pointer;
  transition: background 0.15s ease;
}
.contrib-row:hover, .other-bots li:hover { background: rgba(0,255,136,0.04); border-color: rgba(0,255,136,0.18); }

.contrib-status {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,0.2);
  flex-shrink: 0;
}
.contrib-status.live { background: var(--success-green, #00ff88); box-shadow: 0 0 5px var(--success-green, #00ff88); }
.contrib-status.paused { background: #ffaa00; }
.contrib-status.error { background: #ff4d6a; }

.contrib-name {
  font-size: 0.78rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.contrib-pnl {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.contrib-pnl.pos { color: var(--success-green, #00ff88); }
.contrib-pnl.neg { color: #ff4d6a; }

.other-bots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.empty {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
  padding: 0.4rem 0.5rem;
}
</style>
