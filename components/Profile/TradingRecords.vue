<script setup lang="ts">
import type { TradingProfileRecord, ActivityLogEntry } from '~/stores/activityLog'

const props = defineProps<{
  record: TradingProfileRecord
  recent?: ActivityLogEntry[]
}>()

const affinityEntries = computed(() =>
  Object.entries(props.record.content_affinity)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => ({ key: k, value: v }))
)

const affinityMax = computed(() =>
  Math.max(1, ...affinityEntries.value.map(e => e.value))
)

const formatWhen = (iso: string) => {
  const t = new Date(iso).getTime()
  const ms = Date.now() - t
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

const actionLabel = (a: string) => a.replace(/_/g, ' ')
</script>

<template>
  <div class="trading-records">
    <div class="meta-row">
      <span class="meta">{{ record.total_interactions }} interactions</span>
      <span class="meta">{{ record.reduced_epochs }} reduce epochs</span>
      <span class="meta">{{ record.raw_retained }} raw · {{ record.summaries_retained }} summaries</span>
    </div>

    <div class="signals">
      <div class="sig">
        <span class="sig-val">{{ record.trading_signals.asset_views }}</span>
        <span class="sig-lbl">Asset views</span>
      </div>
      <div class="sig">
        <span class="sig-val">{{ record.trading_signals.allocation_changes }}</span>
        <span class="sig-lbl">Rebalances</span>
      </div>
      <div class="sig">
        <span class="sig-val">{{ record.trading_signals.deployments }}</span>
        <span class="sig-lbl">Deploys</span>
      </div>
      <div class="sig">
        <span class="sig-val">{{ record.trading_signals.pauses }}</span>
        <span class="sig-lbl">Pauses</span>
      </div>
    </div>

    <div v-if="affinityEntries.length" class="block">
      <h4 class="block-title">Content affinity</h4>
      <ul class="heat-list">
        <li v-for="a in affinityEntries" :key="a.key">
          <span class="h-name">{{ a.key }}</span>
          <span class="bar">
            <span class="bar-fill" :style="{ width: `${(a.value / affinityMax) * 100}%` }" />
          </span>
          <span class="h-pct">{{ a.value }}</span>
        </li>
      </ul>
    </div>

    <div v-if="record.share_network.length" class="block">
      <h4 class="block-title">Shared with</h4>
      <ul class="share-list">
        <li v-for="f in record.share_network" :key="f.friend_id" class="share-row">
          <div class="share-who">
            <span class="share-name">{{ f.username || f.friend_id }}</span>
            <span v-if="f.trading_style" class="share-style">{{ f.trading_style.replace(/_/g, ' ') }}</span>
          </div>
          <span class="share-count">{{ f.share_count }}×</span>
        </li>
      </ul>
    </div>

    <div v-if="record.top_pages.length" class="block">
      <h4 class="block-title">Where you spend time</h4>
      <ul class="top-list">
        <li v-for="p in record.top_pages.slice(0, 5)" :key="p.page">
          <span class="top-key">{{ p.page }}</span>
          <span class="top-val">{{ p.visits }}</span>
        </li>
      </ul>
    </div>

    <div v-if="recent?.length" class="block">
      <h4 class="block-title">Recent journal</h4>
      <ul class="feed">
        <li v-for="e in recent.slice(0, 8)" :key="e.id" class="feed-row">
          <span class="dot" :class="{ reduced: e.reduced }" />
          <div class="feed-body">
            <div class="feed-title">
              {{ actionLabel(e.what.action) }}
              <span v-if="e.reduced" class="badge">×{{ e.count }}</span>
            </div>
            <div class="feed-meta">
              <span>{{ e.where.page }}</span>
              <span v-if="e.why.intent">· {{ e.why.intent }}</span>
              <span v-if="e.with?.friend_profiles?.length">
                · with {{ e.with.friend_profiles.map(f => f.username || f.id).join(', ') }}
              </span>
            </div>
          </div>
          <span class="feed-time">{{ formatWhen(e.when) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.trading-records {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}
.meta {
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-gray, rgba(255,255,255,0.45));
}
.signals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}
.sig {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.35rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  text-align: center;
}
.sig-val {
  font-size: 1rem;
  font-weight: 700;
  color: var(--primary-green, #00ff88);
}
.sig-lbl {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-gray, rgba(255,255,255,0.45));
}
.block-title {
  margin: 0 0 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  font-weight: 700;
}
.heat-list, .share-list, .top-list, .feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.heat-list li, .top-list li {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.72rem;
}
.h-name, .top-key {
  color: rgba(255,255,255,0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar {
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: var(--primary-green, #00ff88);
  border-radius: 2px;
}
.h-pct, .top-val {
  color: rgba(255,255,255,0.45);
  font-variant-numeric: tabular-nums;
}
.share-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.share-who {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.share-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}
.share-style {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.4);
  text-transform: capitalize;
}
.share-count {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary-green, #00ff88);
}
.feed-row {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  gap: 0.45rem;
  align-items: start;
}
.dot {
  width: 7px;
  height: 7px;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: var(--primary-green, #00ff88);
}
.dot.reduced {
  background: rgba(255,255,255,0.35);
  box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.5);
}
.feed-title {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.85);
  text-transform: capitalize;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.badge {
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.55);
}
.feed-meta {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed-time {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .signals { grid-template-columns: repeat(2, 1fr); }
}
</style>
