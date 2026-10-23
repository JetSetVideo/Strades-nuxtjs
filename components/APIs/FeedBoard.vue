<script setup lang="ts">
/**
 * One list of price feeds, shared by /apis and the prices API panel.
 * Disconnect writes the same browser preference the prices page reads,
 * so the streamed list and the BETS filters drop together.
 */
import { computed, ref } from 'vue'
import { useFeedPrefsStore } from '~/stores/feedPrefs'
import { useDataFeedsStore, type DataProvider } from '~/stores/dataFeeds'
import {
  LOCAL_FEEDS,
  extraFeedKeys,
  indexAssetsByFeed,
  type FeedAssetInput,
} from '~/utils/assetFeeds'
import { assetClassTheme } from '~/utils/assetClass'
import { BET_COLOR, betSourceLabel, isBetAsset } from '~/utils/betAssets'

const props = defineProps<{
  /** Every asset the book knows, whether or not it is streaming. */
  catalog: FeedAssetInput[]
  /** Assets still on the prices list. */
  active?: FeedAssetInput[]
}>()

const prefs = useFeedPrefsStore()
const feeds = useDataFeedsStore()

const FEED_LABELS: Record<string, string> = {
  prices: 'Prices',
  'prices.bets': 'Bets',
  news: 'News',
}
const FEED_ORDER = ['prices', 'prices.bets', 'news']

const orderedGroups = computed(() => {
  const rank = (feed: string) => {
    const i = FEED_ORDER.indexOf(feed)
    return i === -1 ? FEED_ORDER.length : i
  }
  return [...feeds.groups].sort((a, b) => rank(a.feed) - rank(b.feed) || a.feed.localeCompare(b.feed))
})

const providerIds = computed(() => feeds.providers.map(p => p.id))
const catalogByFeed = computed(() => indexAssetsByFeed(props.catalog))
const activeIds = computed(() => new Set((props.active ?? props.catalog).map(a => a.id)))

const extraFeeds = computed(() =>
  extraFeedKeys(catalogByFeed.value, providerIds.value).map(id => ({
    id,
    label: LOCAL_FEEDS[id]?.label ?? id,
    blurb: LOCAL_FEEDS[id]?.blurb ?? 'Assets tagged with this source.',
  })),
)

const openFeed = ref<string | null>(null)
function toggleFeed(id: string) {
  openFeed.value = openFeed.value === id ? null : id
}

function tally(id: string) {
  const rows = catalogByFeed.value.get(id) ?? []
  const active = rows.filter(a => activeIds.value.has(a.id)).length
  return { rows, active, total: rows.length }
}

function chip(asset: FeedAssetInput) {
  if (isBetAsset(asset)) {
    const tagged = asset.tags?.find(t => {
      const v = t.toLowerCase()
      return v === 'kalshi' || v === 'polymarket'
    })
    const src = betSourceLabel(asset.source || tagged)
    return { label: src ? `BET · ${src}` : 'BET', color: BET_COLOR }
  }
  const theme = assetClassTheme({ symbol: asset.symbol, type: asset.type, category: asset.category })
  return { label: theme.label, color: theme.color }
}

function tone(state: string) {
  if (state === 'ok' || state === 'live') return 'live'
  if (state === 'blocked' || state === 'off' || state === 'error' || state === 'unconfigured' || state === 'idle') return state
  return 'unknown'
}

function stateLabel(state: string) {
  if (state === 'ok' || state === 'live') return 'live'
  if (state === 'unconfigured') return 'not configured'
  return state
}

function rowState(provider: DataProvider) {
  if (provider.state === 'blocked') return 'blocked'
  if (!prefs.isEnabled(provider.id)) return 'off'
  return provider.state
}

function localState(id: string) {
  if (!prefs.isEnabled(id)) return 'off'
  const rows = catalogByFeed.value.get(id) ?? []
  return rows.some(a => a.live) ? 'live' : 'idle'
}

function stop(id: string, label: string) {
  if (!confirm(`Disconnect ${label}? Its prices leave the list until you reconnect.`)) return
  prefs.setEnabled(id, false)
}

function start(id: string) {
  prefs.setEnabled(id, true)
}

const groupLabel = (feed: string, label?: string) => label || FEED_LABELS[feed] || feed
</script>

<template>
  <div class="feed-board">
    <section v-for="g in orderedGroups" :key="g.feed" class="api-group">
      <div class="api-group-head">
        <span class="api-feed">{{ groupLabel(g.feed, g.label) }}</span>
        <code class="api-feed-key">{{ g.feed }}</code>
        <span class="api-group-count">{{ g.providers.length }}</span>
      </div>

      <div
        v-for="p in g.providers"
        :key="p.id"
        class="api-row"
        :class="{ 'is-off': rowState(p) === 'off', 'is-blocked': p.state === 'blocked' }"
      >
        <div class="api-prov">
          <span class="api-prov-label">{{ p.label || p.id }}</span>
          <span class="api-prov-id">{{ p.id }}</span>
        </div>
        <span class="api-badge" :class="tone(rowState(p))">
          <span class="dot" />{{ stateLabel(rowState(p)) }}
        </span>
        <div class="api-detail">
          <span v-if="p.detail">{{ p.detail }}</span>
          <span v-else-if="p.base_url" class="api-url">{{ p.base_url }}</span>
        </div>
        <button
          v-if="p.state !== 'blocked' && prefs.isEnabled(p.id)"
          type="button"
          class="action danger-ghost"
          @click="stop(p.id, p.label || p.id)"
        >Disconnect</button>
        <button
          v-else-if="p.state !== 'blocked'"
          type="button"
          class="action primary"
          @click="start(p.id)"
        >Reconnect</button>
        <span v-else class="api-blocked-note">Unavailable</span>

        <button
          type="button"
          class="api-subtoggle"
          :aria-expanded="openFeed === p.id"
          :title="`${tally(p.id).active} streaming of ${tally(p.id).total}`"
          @click="toggleFeed(p.id)"
        >
          <span class="chev" aria-hidden="true">{{ openFeed === p.id ? '▾' : '◂' }}</span>
          <span>{{ tally(p.id).active }}/{{ tally(p.id).total }}</span>
        </button>
        <ul v-if="openFeed === p.id" class="api-assets">
          <li v-if="!tally(p.id).rows.length" class="api-asset-empty">No assets in the book come from this API.</li>
          <li
            v-for="a in tally(p.id).rows"
            :key="a.id"
            class="api-asset"
            :class="{ idle: !activeIds.has(a.id) }"
          >
            <span
              class="tag"
              :style="{ color: chip(a).color, borderColor: chip(a).color + '55', background: chip(a).color + '18' }"
            >{{ chip(a).label }}</span>
            <span class="sym" :style="{ color: chip(a).color }">{{ a.symbol }}</span>
            <span class="name">{{ a.name }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="extraFeeds.length" class="api-group">
      <div class="api-group-head">
        <span class="api-feed">On this list</span>
        <span class="api-group-count">{{ extraFeeds.length }}</span>
      </div>
      <div
        v-for="f in extraFeeds"
        :key="f.id"
        class="api-row"
        :class="{ 'is-off': !prefs.isEnabled(f.id) }"
      >
        <div class="api-prov">
          <span class="api-prov-label">{{ f.label }}</span>
          <span class="api-prov-id">{{ f.id }}</span>
        </div>
        <span class="api-badge" :class="tone(localState(f.id))">
          <span class="dot" />{{ stateLabel(localState(f.id)) }}
        </span>
        <div class="api-detail">{{ f.blurb }}</div>
        <button
          v-if="prefs.isEnabled(f.id)"
          type="button"
          class="action danger-ghost"
          @click="stop(f.id, f.label)"
        >Disconnect</button>
        <button v-else type="button" class="action primary" @click="start(f.id)">Reconnect</button>
        <button
          type="button"
          class="api-subtoggle"
          :aria-expanded="openFeed === f.id"
          :title="`${tally(f.id).active} streaming of ${tally(f.id).total}`"
          @click="toggleFeed(f.id)"
        >
          <span class="chev" aria-hidden="true">{{ openFeed === f.id ? '▾' : '◂' }}</span>
          <span>{{ tally(f.id).active }}/{{ tally(f.id).total }}</span>
        </button>
        <ul v-if="openFeed === f.id" class="api-assets">
          <li
            v-for="a in tally(f.id).rows"
            :key="a.id"
            class="api-asset"
            :class="{ idle: !activeIds.has(a.id) }"
          >
            <span
              class="tag"
              :style="{ color: chip(a).color, borderColor: chip(a).color + '55', background: chip(a).color + '18' }"
            >{{ chip(a).label }}</span>
            <span class="sym" :style="{ color: chip(a).color }">{{ a.symbol }}</span>
            <span class="name">{{ a.name }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.feed-board { display: flex; flex-direction: column; gap: 0.85rem; min-width: 0; }
.api-group { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.api-group-head { display: flex; align-items: center; gap: 0.45rem; }
.api-feed { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.api-feed-key { font-size: 0.6rem; color: var(--text-secondary, #9aa0a6); }
.api-group-count {
  margin-left: auto;
  font-size: 0.58rem;
  color: var(--text-secondary, #9aa0a6);
  border: 1px solid var(--border-primary, #333);
  border-radius: 999px;
  padding: 0 6px;
}

.api-row {
  display: grid;
  grid-template-columns: minmax(96px, 1fr) auto minmax(0, 1.4fr) auto;
  align-items: center;
  gap: 0.45rem 0.55rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-primary, #2a2a33);
  border-radius: 8px;
  background: rgba(255,255,255,0.02);
  min-width: 0;
}
.api-row.is-off { opacity: 0.62; }
.api-row.is-blocked { opacity: 0.85; }
.api-prov { display: flex; flex-direction: column; min-width: 0; }
.api-prov-label { font-size: 0.76rem; font-weight: 600; }
.api-prov-id { font-size: 0.58rem; color: var(--text-secondary, #9aa0a6); }

.api-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid currentColor;
  white-space: nowrap;
}
.api-badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.api-badge.live { color: var(--app-color-up, #00e58a); }
.api-badge.blocked { color: #ffb020; }
.api-badge.error { color: var(--app-color-down, #ff4444); }
.api-badge.off, .api-badge.idle, .api-badge.unconfigured, .api-badge.unknown { color: var(--text-secondary, #9aa0a6); }

.api-detail {
  font-size: 0.64rem;
  line-height: 1.35;
  color: var(--text-secondary, #9aa0a6);
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.api-url { font-family: var(--font-market-data, monospace); }
.api-blocked-note { font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; color: #ffb020; }

.action {
  justify-self: end;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.82);
  border-radius: 999px;
  padding: 0.22rem 0.55rem;
  font: inherit;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
}
.action.primary { border-color: var(--app-color-up, #00e58a); color: var(--app-color-up, #00e58a); }
.action.danger-ghost:hover { border-color: var(--error-red, #ff4d6a); color: var(--error-red, #ff4d6a); }

.api-subtoggle {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
  background: transparent;
  border: none;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 0.1rem;
  padding: 0.28rem 0 0.02rem;
  color: var(--text-secondary, #9aa0a6);
  font: inherit;
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.api-subtoggle:hover { color: var(--text-white, #fff); }
.chev { width: 0.7rem; text-align: center; }

.api-assets {
  grid-column: 1 / -1;
  list-style: none;
  margin: 0;
  padding: 0.2rem 0 0.05rem;
  max-height: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.api-asset {
  display: grid;
  grid-template-columns: auto minmax(4.5rem, 8rem) minmax(0, 1fr);
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}
.api-asset.idle { opacity: 0.45; }
.tag {
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.sym {
  font-family: var(--font-market-data, ui-monospace, monospace);
  font-size: 0.64rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  font-size: 0.64rem;
  color: var(--text-secondary, #9aa0a6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-asset-empty { font-size: 0.64rem; color: var(--text-secondary, #9aa0a6); }

@media (max-width: 640px) {
  .api-row { grid-template-columns: minmax(0, 1fr) auto; }
  .api-detail { grid-column: 1 / -1; }
  .action, .api-blocked-note { justify-self: start; }
}
</style>
