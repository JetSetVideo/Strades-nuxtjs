<script setup lang="ts">
/**
 * API panel — every data API this page can draw from, grouped by WHAT IT FEEDS
 * (prices → prices.bets → news …), each row showing the provider label, its
 * live state, and a toggle to keep receiving that feed.
 *
 * Contract: GET /api/providers/
 *   { groups: [ { feed, label, providers: [
 *       { id, label, state: live|blocked|unconfigured|error, detail, base_url, enabled } ] } ] }
 *
 * A provider that the backend reports as "blocked" (Polymarket on the dev
 * network) is shown as blocked — never hidden or softened.
 *
 * The keep-receiving toggle has no backend endpoint yet, so it is persisted
 * browser-locally (stores/feedPrefs.ts) and the panel says so out loud.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useFeedPrefsStore } from '~/stores/feedPrefs'
import {
  extraFeedKeys,
  indexAssetsByFeed,
  LOCAL_FEEDS,
  type FeedAssetInput,
} from '~/utils/assetFeeds'

const props = defineProps<{ open: boolean; assets?: FeedAssetInput[] }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

interface Provider {
  id: string
  label: string
  state: 'live' | 'blocked' | 'unconfigured' | 'error' | string
  detail?: string
  base_url?: string
  enabled?: boolean
}
interface FeedGroup { feed: string; label?: string; providers: Provider[] }
interface ProvidersResponse { groups?: FeedGroup[] }

const feedPrefs = useFeedPrefsStore()

const loading = ref(false)
const error = ref<string | null>(null)
const groups = ref<FeedGroup[]>([])

/** Readable labels for the feeds we know about; the API's own label wins. */
const FEED_LABELS: Record<string, string> = {
  prices: 'Prices',
  'prices.bets': 'Bets',
  news: 'News',
}
const FEED_ORDER = ['prices', 'prices.bets', 'news']

const groupLabel = (g: FeedGroup) => g.label || FEED_LABELS[g.feed] || g.feed
const orderedGroups = computed(() => {
  const rank = (f: string) => {
    const i = FEED_ORDER.indexOf(f)
    return i === -1 ? FEED_ORDER.length : i
  }
  return [...groups.value].sort((a, b) => rank(a.feed) - rank(b.feed) || a.feed.localeCompare(b.feed))
})

const allProviders = computed(() => groups.value.flatMap(g => g.providers))
const receivingCount = computed(() => allProviders.value.filter(p => feedPrefs.isEnabled(p.id)).length)

const board = computed(() => props.assets ?? [])
const byFeed = computed(() => indexAssetsByFeed(board.value))
const liveOnBoard = computed(() => board.value.filter(a => a.live).length)
const assetsFor = (id: string) => byFeed.value.get(id) ?? []

const extraFeeds = computed(() =>
  extraFeedKeys(byFeed.value, allProviders.value.map(p => p.id)).map(id => ({
    id,
    label: LOCAL_FEEDS[id]?.label ?? id,
    blurb: LOCAL_FEEDS[id]?.blurb ?? 'Assets tagged with this source.',
    assets: byFeed.value.get(id) ?? [],
  })),
)

/** Which feed's asset list is open. One at a time keeps a 30-row venue usable. */
const openFeed = ref<string | null>(null)
function toggleFeed(id: string) {
  openFeed.value = openFeed.value === id ? null : id
}

const STATE_LABEL: Record<string, string> = {
  live: 'live',
  ok: 'live',
  blocked: 'blocked',
  unconfigured: 'not configured',
  error: 'error',
}
/** The providers API reports a working venue as "ok"; the panel says "live". */
const stateTone = (s: string) => {
  const key = s === 'ok' ? 'live' : s
  return ['live', 'blocked', 'unconfigured', 'error'].includes(key) ? key : 'unknown'
}
const stateLabel = (s: string) => STATE_LABEL[s] ?? s

async function load() {
  loading.value = true
  error.value = null
  try {
    const { $api } = useNuxtApp()
    const res = await ($api as (u: string) => Promise<ProvidersResponse>)('/api/providers/')
    groups.value = Array.isArray(res?.groups) ? res.groups : []
    if (!groups.value.length) error.value = null
  } catch (e: unknown) {
    const err = e as { response?: { status?: number }; statusCode?: number; status?: number }
    const status = err?.response?.status ?? err?.statusCode ?? err?.status
    error.value = status
      ? `Providers API returned ${status}.`
      : 'Providers API unreachable.'
    groups.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => feedPrefs.hydrate())
watch(
  () => props.open,
  (v) => { if (v) { feedPrefs.hydrate(); load() } },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="api-back" @click="emit('update:open', false)">
        <div class="api-panel" @click.stop role="dialog" aria-label="Data APIs by feed">
          <header class="api-head">
            <div>
              <h3>Data APIs</h3>
              <p class="api-sub">
                {{ liveOnBoard }} of {{ board.length }} assets in this list have a live quote
                <template v-if="allProviders.length"> · {{ receivingCount }}/{{ allProviders.length }} APIs receiving</template>
              </p>
            </div>
            <button class="api-close" @click="emit('update:open', false)" aria-label="Close">✕</button>
          </header>

          <div class="api-body">
            <!-- Honest states -->
            <div v-if="loading" class="api-state">Loading providers…</div>
            <div v-else-if="error" class="api-state err">
              <p>{{ error }}</p>
              <p class="api-hint">Provider status could not be loaded. Asset sources below still come from this list.</p>
              <button class="api-retry" @click="load">Retry</button>
            </div>
            <div v-else-if="!allProviders.length && !extraFeeds.length" class="api-state">
              No providers reported.
            </div>

            <!-- Grouped feeds. Held until provider status arrives so a venue is not listed twice. -->
            <template v-if="!loading">
            <section v-for="g in orderedGroups" :key="g.feed" class="api-group">
              <div class="api-group-head">
                <span class="api-feed">{{ groupLabel(g) }}</span>
                <code class="api-feed-key">{{ g.feed }}</code>
                <span class="api-group-count">{{ g.providers.length }}</span>
              </div>

              <div
                v-for="p in g.providers"
                :key="p.id"
                class="api-row"
                :class="{ 'is-off': !feedPrefs.isEnabled(p.id) }"
              >
                <div class="api-prov">
                  <span class="api-prov-label">{{ p.label || p.id }}</span>
                  <span class="api-prov-id">{{ p.id }}</span>
                </div>

                <span class="api-badge" :class="stateTone(p.state)">
                  <span class="dot" />{{ stateLabel(p.state) }}
                </span>

                <div class="api-detail">
                  <span v-if="p.detail">{{ p.detail }}</span>
                  <span v-else-if="p.base_url" class="api-url">{{ p.base_url }}</span>
                </div>

                <button
                  class="api-toggle"
                  role="switch"
                  :aria-checked="feedPrefs.isEnabled(p.id)"
                  :aria-label="`Keep receiving ${p.label || p.id}`"
                  @click="feedPrefs.toggle(p.id)"
                >
                  <span class="track"><span class="knob" /></span>
                  <span class="api-toggle-txt">{{ feedPrefs.isEnabled(p.id) ? 'On' : 'Off' }}</span>
                </button>

                <button
                  class="api-subtoggle"
                  :aria-expanded="openFeed === p.id"
                  @click="toggleFeed(p.id)"
                >
                  <span>{{ assetsFor(p.id).length }} asset{{ assetsFor(p.id).length === 1 ? '' : 's' }}</span>
                  <span class="chev" :class="{ open: openFeed === p.id }">▾</span>
                </button>
                <ul v-if="openFeed === p.id" class="api-assets">
                  <li v-if="!assetsFor(p.id).length" class="api-asset-empty">No assets in this list come from this API.</li>
                  <li v-for="a in assetsFor(p.id)" :key="a.id" class="api-asset">
                    <span class="api-asset-sym">{{ a.symbol }}</span>
                    <span class="api-asset-name">{{ a.name }}</span>
                  </li>
                </ul>
              </div>
            </section>

            <section v-if="extraFeeds.length" class="api-group">
              <div class="api-group-head">
                <span class="api-feed">On this list</span>
                <span class="api-group-count">{{ extraFeeds.reduce((n, f) => n + f.assets.length, 0) }}</span>
              </div>
              <div v-for="f in extraFeeds" :key="f.id" class="api-row api-row-local">
                <div class="api-prov">
                  <span class="api-prov-label">{{ f.label }}</span>
                  <span class="api-prov-id">{{ f.id }}</span>
                </div>
                <div class="api-detail">{{ f.blurb }}</div>
                <button
                  class="api-subtoggle"
                  :aria-expanded="openFeed === f.id"
                  @click="toggleFeed(f.id)"
                >
                  <span>{{ f.assets.length }} asset{{ f.assets.length === 1 ? '' : 's' }}</span>
                  <span class="chev" :class="{ open: openFeed === f.id }">▾</span>
                </button>
                <ul v-if="openFeed === f.id" class="api-assets">
                  <li v-for="a in f.assets" :key="a.id" class="api-asset">
                    <span class="api-asset-sym">{{ a.symbol }}</span>
                    <span class="api-asset-name">{{ a.name }}</span>
                  </li>
                </ul>
              </div>
            </section>
            </template>
          </div>

          <footer class="api-foot">
            Toggle preference is saved in this browser only — the backend exposes no subscription
            endpoint for feeds yet, so nothing is sent server-side.
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.api-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem;
}
.api-panel {
  width: min(640px, 100%);
  max-height: 78vh;
  background: linear-gradient(180deg, rgba(20,20,28,0.97), rgba(14,14,18,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-white, #fff);
}
.api-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.api-head h3 { margin: 0; font-size: 0.95rem; letter-spacing: 0.02em; }
.api-sub { margin: 3px 0 0; font-size: 0.68rem; color: var(--text-secondary, #9aa0a6); }
.api-close {
  background: rgba(255,255,255,0.05); border: none; color: rgba(255,255,255,0.7);
  width: 1.6rem; height: 1.6rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem;
}
.api-body { padding: 0.7rem 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }

.api-state { font-size: 0.78rem; color: var(--text-secondary, #9aa0a6); padding: 1.2rem 0.2rem; }
.api-state.err { color: var(--app-color-down, #ff6b6b); }
.api-hint { color: var(--text-secondary, #9aa0a6); font-size: 0.72rem; margin: 0.35rem 0 0.6rem; }
.api-retry {
  background: transparent; border: 1px solid var(--border-secondary, #444); color: inherit;
  border-radius: 999px; padding: 4px 12px; font-size: 0.7rem; cursor: pointer;
}

.api-group { display: flex; flex-direction: column; gap: 0.3rem; }
.api-group-head { display: flex; align-items: center; gap: 0.5rem; }
.api-feed { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.api-feed-key { font-size: 0.62rem; color: var(--text-secondary, #9aa0a6); }
.api-group-count {
  margin-left: auto; font-size: 0.6rem; color: var(--text-secondary, #9aa0a6);
  border: 1px solid var(--border-primary, #333); border-radius: 999px; padding: 0 6px;
}

.api-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.1fr) auto minmax(90px, 1.4fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-primary, #2a2a33);
  border-radius: 8px;
  background: rgba(255,255,255,0.02);
}
.api-row.is-off { opacity: 0.55; }
.api-row-local { grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.6fr); }
.api-subtoggle {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 0.15rem;
  padding: 0.35rem 0.1rem 0.05rem;
  color: var(--text-secondary, #9aa0a6);
  font: inherit;
  font-size: 0.66rem;
  cursor: pointer;
}
.api-subtoggle:hover { color: var(--text-white, #fff); }
.chev { display: inline-block; transition: transform 0.15s ease; }
.chev.open { transform: rotate(180deg); }
.api-assets {
  grid-column: 1 / -1;
  list-style: none;
  margin: 0;
  padding: 0.25rem 0 0.1rem;
  max-height: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.api-asset {
  display: grid;
  grid-template-columns: minmax(7.5rem, 13rem) minmax(0, 1fr);
  gap: 0.55rem;
  align-items: baseline;
  font-size: 0.66rem;
}
.api-asset-sym {
  font-family: var(--font-market-data, ui-monospace, monospace);
  color: var(--text-white, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-asset-name {
  color: var(--text-secondary, #9aa0a6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-asset-empty { font-size: 0.66rem; color: var(--text-secondary, #9aa0a6); }
.api-prov { display: flex; flex-direction: column; min-width: 0; }
.api-prov-label { font-size: 0.78rem; font-weight: 600; }
.api-prov-id { font-size: 0.6rem; color: var(--text-secondary, #9aa0a6); }

.api-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap;
}
.api-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.api-badge.live { color: var(--app-color-up, #00e58a); }
.api-badge.blocked { color: #ffb020; }
.api-badge.error { color: var(--app-color-down, #ff4444); }
.api-badge.unconfigured, .api-badge.unknown { color: var(--text-secondary, #9aa0a6); }

.api-detail { font-size: 0.66rem; color: var(--text-secondary, #9aa0a6); overflow: hidden; text-overflow: ellipsis; }
.api-url { font-family: var(--font-market-data, monospace); }

.api-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: none; cursor: pointer; color: inherit; font-family: inherit;
}
.api-toggle .track {
  width: 30px; height: 16px; border-radius: 999px; background: rgba(255,255,255,0.14);
  position: relative; transition: background 0.15s ease;
}
.api-toggle .knob {
  position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
  background: #cfd3d8; transition: transform 0.15s ease, background 0.15s ease;
}
.api-toggle[aria-checked="true"] .track { background: rgba(0,229,138,0.35); }
.api-toggle[aria-checked="true"] .knob { transform: translateX(14px); background: var(--app-color-up, #00e58a); }
.api-toggle-txt { font-size: 0.62rem; font-weight: 700; }

.api-foot {
  padding: 0.6rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.07);
  font-size: 0.62rem; color: var(--text-secondary, #9aa0a6); line-height: 1.4;
}

@media (max-width: 560px) {
  .api-row { grid-template-columns: 1fr auto; grid-template-areas: 'prov badge' 'detail toggle'; row-gap: 0.4rem; }
  .api-detail { grid-column: 1 / -1; }
}

.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
</style>
