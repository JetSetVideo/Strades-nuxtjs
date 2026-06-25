<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { PropType } from 'vue'
import type { SearchHistory, SearchSuggestion } from '@/types'
import { useAssetsStore } from '~/stores/assets'
import { useAgentsStore } from '~/stores/agents'
import { useCommunityStore } from '~/stores/community'
import { useAgentTracker } from '~/composables/useAgentTracker'

const props = defineProps({
  searchHistory: { type: Array as PropType<SearchHistory[]>, default: () => [] },
  searchSuggestions: { type: Array as PropType<SearchSuggestion[]>, default: () => [] }
})

const q = ref('')
const isOpen = ref(false)
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const assets = useAssetsStore()
const agents = useAgentsStore()
const community = useCommunityStore()
const tracker = useAgentTracker()

type ResultType = 'asset' | 'agent' | 'person' | 'page' | 'suggestion' | 'history'

interface Result {
  type: ResultType
  id: string
  label: string
  hint?: string
  to: string
  icon?: string
}

interface ResultGroup {
  type: ResultType
  label: string
  results: Result[]
}

const PAGES: Result[] = [
  { type: 'page', id: 'p-prices', label: 'Prices', hint: 'Live markets', to: '/prices', icon: '↗' },
  { type: 'page', id: 'p-news', label: 'News', hint: 'Sentiment + editorial', to: '/news', icon: '◯' },
  { type: 'page', id: 'p-wallet', label: 'Wallet', hint: '100% allocation', to: '/wallet', icon: '◔' },
  { type: 'page', id: 'p-lab', label: 'Trading Lab', hint: 'Strategies, Agents, Bots', to: '/strategies', icon: '◈' },
  { type: 'page', id: 'p-chat', label: 'Chat', hint: 'Conversations', to: '/chat', icon: '◴' },
  { type: 'page', id: 'p-creator', label: 'Creator', hint: 'Build a strategy', to: '/creator', icon: '✚' },
  { type: 'page', id: 'p-profile', label: 'Profile', to: '/profile', icon: '◉' },
  { type: 'page', id: 'p-settings', label: 'Settings', to: '/settings', icon: '⚙' },
  { type: 'page', id: 'p-notifications', label: 'Notifications', to: '/notifications', icon: '◔' },
  { type: 'page', id: 'p-leaderboard', label: 'Leaderboard', to: '/leaderboard', icon: '☷' },
  { type: 'page', id: 'p-quest', label: 'Quests', to: '/quest', icon: '◈' },
  { type: 'page', id: 'p-shop', label: 'Shop', to: '/shop', icon: '◫' }
]

const TYPE_LABELS: Record<ResultType, string> = {
  asset: 'Assets',
  agent: 'Agents',
  person: 'People',
  page: 'Pages',
  suggestion: 'Suggested',
  history: 'Recent'
}

const groups = computed<ResultGroup[]>(() => {
  const term = q.value.trim().toLowerCase()

  if (!term) {
    const out: ResultGroup[] = []
    const history = (props.searchHistory ?? []).slice(0, 4).map((h: any) => ({
      type: 'history' as const, id: 'h-' + h.id, label: h.term, hint: 'Recent', to: '/prices', icon: '↺'
    }))
    if (history.length) out.push({ type: 'history', label: TYPE_LABELS.history, results: history })

    const sugg = (props.searchSuggestions ?? []).slice(0, 6).map((s: any) => ({
      type: 'suggestion' as const, id: 's-' + s.id, label: s.term, hint: 'Suggested', to: '/prices', icon: '✦'
    }))
    if (sugg.length) out.push({ type: 'suggestion', label: TYPE_LABELS.suggestion, results: sugg })

    out.push({ type: 'page', label: TYPE_LABELS.page, results: PAGES.slice(0, 6) })
    return out
  }

  const assetMatches: Result[] = assets.assets
    .filter(a => a.name?.toLowerCase().includes(term) || a.symbol?.toLowerCase().includes(term))
    .slice(0, 6)
    .map(a => ({
      type: 'asset' as const,
      id: 'a-' + a.id,
      label: `${a.symbol} — ${a.name}`,
      hint: a.category ?? 'Asset',
      to: `/assets/${a.id}`,
      icon: '◆'
    }))

  const agentMatches: Result[] = agents.all
    .filter(a => a.name.toLowerCase().includes(term) || a.trading_style.toLowerCase().includes(term))
    .slice(0, 5)
    .map(a => ({
      type: 'agent' as const,
      id: 'ag-' + a.id,
      label: a.name,
      hint: `Agent · v${a.training_state.version}`,
      to: `/agents/${a.id}`,
      icon: '◉'
    }))

  const personMatches: Result[] = community.list
    .filter(u =>
      u.username.toLowerCase().includes(term) ||
      u.trading_style.toLowerCase().includes(term) ||
      u.specialization.some(s => s.includes(term))
    )
    .slice(0, 5)
    .map(u => ({
      type: 'person' as const,
      id: 'u-' + u.id,
      label: u.username,
      hint: u.is_friend ? 'Friend' : `${Math.round(u.match_score * 100)}% match`,
      to: `/profile/${u.id}`,
      icon: u.is_friend ? '◉' : '◌'
    }))

  const pageMatches = PAGES.filter(p => p.label.toLowerCase().includes(term)).slice(0, 5)

  const suggestionMatches = (props.searchSuggestions ?? [])
    .filter((s: any) => s.term.toLowerCase().includes(term))
    .slice(0, 3)
    .map((s: any) => ({ type: 'suggestion' as const, id: 's-' + s.id, label: s.term, hint: 'Suggested', to: '/prices', icon: '✦' }))

  const out: ResultGroup[] = []
  if (assetMatches.length) out.push({ type: 'asset', label: TYPE_LABELS.asset, results: assetMatches })
  if (agentMatches.length) out.push({ type: 'agent', label: TYPE_LABELS.agent, results: agentMatches })
  if (personMatches.length) out.push({ type: 'person', label: TYPE_LABELS.person, results: personMatches })
  if (pageMatches.length) out.push({ type: 'page', label: TYPE_LABELS.page, results: pageMatches })
  if (suggestionMatches.length) out.push({ type: 'suggestion', label: TYPE_LABELS.suggestion, results: suggestionMatches })
  return out
})

// Flat list of results in display order, for arrow-key navigation
const flatResults = computed<Result[]>(() => groups.value.flatMap(g => g.results))

const open = async () => {
  isOpen.value = true
  activeIndex.value = 0
  if (!community.hydrated) community.fetchCommunity()
  await nextTick()
  inputRef.value?.focus()
}
const close = () => { isOpen.value = false; q.value = '' }

const move = (dir: 1 | -1) => {
  if (flatResults.value.length === 0) return
  activeIndex.value = (activeIndex.value + dir + flatResults.value.length) % flatResults.value.length
}

const choose = (r: Result) => {
  close()
  tracker.track('search_used', { query: q.value, type: r.type })
  navigateTo(r.to)
}

const onKey = (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey
  if (isCmd && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    isOpen.value ? close() : open()
    return
  }
  if (!isOpen.value) return
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  if (e.key === 'Enter') {
    e.preventDefault()
    const r = flatResults.value[activeIndex.value]
    if (r) choose(r)
  }
}

watch(q, () => { activeIndex.value = 0 })

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Find what global index a result has within the flat list
const indexOfResult = (r: Result) => flatResults.value.findIndex(x => x.id === r.id)
</script>

<template>
  <div class="search-bar-root" :class="{ open: isOpen }">
    <button class="search-trigger" @click="open" aria-label="Search">
      <span class="icon">⌕</span>
      <span class="placeholder">Search assets, agents, people, pages…</span>
      <kbd class="kbd">⌘K</kbd>
    </button>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isOpen" class="search-backdrop" @click="close">
          <div class="search-modal" @click.stop>
            <header class="modal-head">
              <span class="head-icon">⌕</span>
              <input
                ref="inputRef"
                v-model="q"
                type="text"
                class="search-input"
                placeholder="Search…"
                autocomplete="off"
                spellcheck="false"
              />
              <button v-if="q" class="clear" @click="q = ''" aria-label="Clear">✕</button>
              <kbd class="kbd esc">ESC</kbd>
            </header>

            <div class="result-list" v-if="flatResults.length">
              <div v-for="group in groups" :key="group.type" class="group">
                <h4 class="group-head">
                  <span :class="['group-type', `type-${group.type}`]">{{ group.label }}</span>
                  <span class="group-count">{{ group.results.length }}</span>
                </h4>
                <ul>
                  <li
                    v-for="r in group.results"
                    :key="r.id"
                    :class="['result', `type-${r.type}`, { active: indexOfResult(r) === activeIndex }]"
                    @mouseenter="activeIndex = indexOfResult(r)"
                    @click="choose(r)"
                  >
                    <span class="r-icon">{{ r.icon ?? '·' }}</span>
                    <span class="r-label">{{ r.label }}</span>
                    <span v-if="r.hint" class="r-hint">{{ r.hint }}</span>
                    <span class="r-arrow">↵</span>
                  </li>
                </ul>
              </div>
            </div>

            <div v-else class="no-results">
              <span class="big">⌕</span>
              <p>No matches for "<strong>{{ q }}</strong>"</p>
              <span class="tip">Try a ticker (BTC), an asset name, an agent, a username, or a page.</span>
            </div>

            <footer class="modal-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>ESC</kbd> close</span>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.search-bar-root {
  display: flex;
  flex: 1;
  min-width: 0;
}

.search-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 2.1rem;
  padding: 0 0.5rem 0 0.65rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--app-border-radius, 8px);
  color: rgba(255,255,255,0.55);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  letter-spacing: 0.01em;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.search-trigger:hover {
  border-color: rgba(0,255,136,0.35);
  background: rgba(0,255,136,0.03);
  color: rgba(255,255,255,0.85);
}
.search-trigger .icon { font-size: 0.95rem; color: rgba(255,255,255,0.6); }
.search-trigger .placeholder { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-trigger .kbd {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.6rem;
  font-family: ui-monospace, Menlo, monospace;
  color: rgba(255,255,255,0.6);
}

.search-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 9vh;
  padding-left: 1rem; padding-right: 1rem;
}

.search-modal {
  width: min(680px, 100%);
  background: linear-gradient(180deg, rgba(20,20,28,0.97), rgba(14,14,18,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.55);
  display: flex; flex-direction: column;
  overflow: hidden;
  max-height: 80vh;
}

.modal-head {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.head-icon { font-size: 1rem; color: rgba(255,255,255,0.55); }
.search-input {
  flex: 1; background: none; border: none; outline: none;
  color: #fff; font-size: 0.95rem; font-family: inherit;
}
.search-input::placeholder { color: rgba(255,255,255,0.35); }
.clear {
  background: rgba(255,255,255,0.06);
  border: none; color: rgba(255,255,255,0.7);
  width: 1.4rem; height: 1.4rem;
  border-radius: 4px; cursor: pointer; font-size: 0.7rem;
}
.clear:hover { color: #fff; background: rgba(255,255,255,0.12); }
.kbd.esc {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.62rem;
  color: rgba(255,255,255,0.55);
  font-family: ui-monospace, Menlo, monospace;
}

.result-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.3rem 0;
}
.group + .group { border-top: 1px solid rgba(255,255,255,0.04); margin-top: 0.25rem; padding-top: 0.25rem; }
.group-head {
  margin: 0;
  padding: 0.3rem 0.85rem;
  display: flex; justify-content: space-between; align-items: baseline;
}
.group-type {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.group-type.type-asset { color: #F5A623; }
.group-type.type-agent { color: var(--primary-green, #00ff88); }
.group-type.type-person { color: #b48aff; }
.group-type.type-page { color: var(--primary-blue, #00aaff); }
.group-type.type-suggestion { color: rgba(255,255,255,0.55); }
.group-type.type-history { color: rgba(255,255,255,0.45); }
.group-count {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
}

.group ul { list-style: none; margin: 0; padding: 0; }
.result {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto auto;
  gap: 0.55rem;
  align-items: center;
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  border-left: 2px solid transparent;
  font-size: 0.85rem;
  min-width: 0;
}
.result .r-icon { color: rgba(255,255,255,0.6); text-align: center; }
.result.type-asset .r-icon { color: #F5A623; }
.result.type-agent .r-icon { color: var(--primary-green, #00ff88); }
.result.type-person .r-icon { color: #b48aff; }
.result.type-page .r-icon { color: var(--primary-blue, #00aaff); }
.result .r-label { color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.result .r-hint {
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  padding-right: 0.4rem;
}
.result .r-arrow {
  opacity: 0;
  font-size: 0.85rem;
  color: var(--primary-green, #00ff88);
}
.result.active {
  background: rgba(0,255,136,0.06);
  border-left-color: var(--primary-green, #00ff88);
}
.result.active .r-arrow { opacity: 1; }

.no-results {
  display: flex; flex-direction: column;
  align-items: center; gap: 0.4rem;
  padding: 2rem 1rem;
  color: rgba(255,255,255,0.55);
  text-align: center;
}
.no-results .big { font-size: 1.8rem; color: rgba(255,255,255,0.3); }
.no-results p { margin: 0; font-size: 0.85rem; }
.no-results .tip { font-size: 0.72rem; color: rgba(255,255,255,0.4); }

.modal-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 0.62rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.04em;
}
.modal-foot kbd {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 3px;
  padding: 1px 5px;
  margin-right: 3px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.65);
}

.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }

@media (max-width: 640px) {
  .search-trigger .placeholder { font-size: 0.72rem; }
  .search-trigger .kbd { display: none; }
  .search-backdrop { padding-top: 4vh; }
  .modal-foot { display: none; }
}
</style>
