<script setup lang="ts">/**
 * Data Catalog — Browse every data source available in the Strades ecosystem.
 * Shows schemas, sizes, and lets users discover what they can pull into strategies.
 */
import { ref, computed, onMounted } from 'vue'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

definePageMeta({ title: 'Data Catalog', layout: 'default' })

interface DataSource {
  path: string
  category: string
  type: 'Array' | 'Object' | 'unknown'
  itemCount: number
  keys: string[]
  sizeKB: number
  description: string
}

interface MarketProvider {
  id: string
  name: string
  category: string
  icon: string
  description: string
  latency: string
  cost: number
  reliability: number
  supported_assets: string[]
  tags: string[]
}

const loading = ref(true)
const view = ref<'providers' | 'internal'>('providers')
const sources = ref<DataSource[]>([])
const providers = ref<MarketProvider[]>([])
const search = ref('')
const activeCategory = ref<string | null>(null)

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  core: { label: 'Core Data', icon: '📊' },
  global: { label: 'Macro & Events', icon: '🌍' },
  supply_chain: { label: 'Supply Chain', icon: '🔗' },
  agents: { label: 'Agents & Avatars', icon: '🤖' },
  strategies: { label: 'Strategies', icon: '⚙️' },
  social: { label: 'Social & Posts', icon: '💬' },
  chat: { label: 'Chat & Messages', icon: '✉️' },
  relationships: { label: 'Relationships', icon: '🔀' },
  competitions: { label: 'Competitions', icon: '🏆' },
  quests: { label: 'Quests', icon: '🎯' },
  search: { label: 'Search', icon: '🔍' },
  user: { label: 'Users', icon: '👤' },
  companies: { label: 'Companies', icon: '🏢' },
  tracking: { label: 'Behavior Tracking', icon: '👣' },
  root: { label: 'Misc', icon: '📁' },
}

const PROVIDER_CATEGORY_META: Record<string, { label: string; icon: string }> = {
  market: { label: 'Market Data', icon: '📈' },
  blockchain: { label: 'Blockchain', icon: '⛓' },
  sentiment: { label: 'Sentiment', icon: '💬' },
  macro: { label: 'Macro', icon: '🌍' },
  ai: { label: 'AI-Derived', icon: '🤖' },
  derivatives: { label: 'Derivatives', icon: '📐' },
  fundamental: { label: 'Fundamental', icon: '🏛' },
  community: { label: 'Community', icon: '🎯' },
}

onMounted(async () => {
  const [providerRes, catalogRes] = await Promise.allSettled([
    $fetch<MarketProvider[]>('/data/core/datasources.json'),
    $fetch<DataSource[]>('/data/meta/catalog.json')
  ])
  providers.value = providerRes.status === 'fulfilled' ? providerRes.value : []
  sources.value = catalogRes.status === 'fulfilled' ? catalogRes.value : []
  loading.value = false
})

const categories = computed(() => {
  const cats = new Set(sources.value.map(s => s.category))
  return Array.from(cats).sort()
})

const filtered = computed(() => {
  let list = sources.value
  if (activeCategory.value) list = list.filter(s => s.category === activeCategory.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => s.path.toLowerCase().includes(q) || s.keys.some(k => k.toLowerCase().includes(q)) || s.description.toLowerCase().includes(q))
  }
  return list
})

const catCount = (cat: string) => sources.value.filter(s => s.category === cat).length

const providerCategories = computed(() => {
  const cats = new Set(providers.value.map(p => p.category))
  return Array.from(cats).sort()
})

const filteredProviders = computed(() => {
  let list = providers.value
  if (activeCategory.value) list = list.filter(p => p.category === activeCategory.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return list
})

const providerCatCount = (cat: string) => providers.value.filter(p => p.category === cat).length

// Switching tabs clears a category filter that wouldn't apply to the other list.
function setView(v: 'providers' | 'internal') {
  view.value = v
  activeCategory.value = null
}
</script>

<template>
  <div class="data-catalog">
    <UIPageHeader title="Data Catalog" subtitle="Access to markets, data providers, and every internal data source available to your strategies." />

    <div class="view-tabs" role="tablist">
      <button :class="{ active: view === 'providers' }" @click="setView('providers')">Market &amp; Data Providers</button>
      <button :class="{ active: view === 'internal' }" @click="setView('internal')">Internal App Data</button>
    </div>

    <template v-if="loading">
      <AppSkeletonLoader height="60px" />
      <div class="skel-grid">
        <AppSkeletonLoader v-for="i in 6" :key="i" height="120px" />
      </div>
    </template>

    <template v-else-if="view === 'providers'">
      <div class="toolbar">
        <input v-model="search" type="text" class="search-input" placeholder="Search providers by name, tag, or description..." />
        <div class="category-strip">
          <button class="cat-btn" :class="{ active: !activeCategory }" @click="activeCategory = null">All ({{ providers.length }})</button>
          <button
            v-for="cat in providerCategories"
            :key="cat"
            class="cat-btn" :class="{ active: activeCategory === cat }"
            @click="activeCategory = activeCategory === cat ? null : cat"
          >
            {{ PROVIDER_CATEGORY_META[cat]?.icon ?? '📁' }} {{ PROVIDER_CATEGORY_META[cat]?.label ?? cat }} ({{ providerCatCount(cat) }})
          </button>
        </div>
      </div>

      <div v-if="filteredProviders.length === 0" class="empty">No providers match your search.</div>

      <div v-else class="source-grid">
        <UICard v-for="p in filteredProviders" :key="p.id" :padding="'compact'">
          <div class="source-card">
            <div class="sc-top">
              <span class="sc-path">{{ p.icon }} {{ p.name }}</span>
              <UIPill :tone="p.cost === 0 ? 'success' : 'neutral'" size="sm">{{ p.cost === 0 ? 'free' : `${p.cost} cr` }}</UIPill>
            </div>

            <p class="sc-desc">{{ p.description }}</p>

            <div class="sc-meta">
              <span class="sc-stat"><strong>{{ p.latency }}</strong> latency</span>
              <span class="sc-stat"><strong>{{ Math.round(p.reliability * 100) }}%</strong> reliable</span>
              <span class="sc-cat">{{ PROVIDER_CATEGORY_META[p.category]?.icon }} {{ PROVIDER_CATEGORY_META[p.category]?.label ?? p.category }}</span>
            </div>

            <div class="sc-keys">
              <span v-for="a in p.supported_assets" :key="a" class="key-chip">{{ a }}</span>
            </div>
            <div class="sc-keys">
              <span v-for="t in p.tags" :key="t" class="key-chip more">{{ t }}</span>
            </div>
          </div>
        </UICard>
      </div>
    </template>

    <template v-else>
      <!-- Search + category filter -->
      <div class="toolbar">
        <input v-model="search" type="text" class="search-input" placeholder="Search by name, key, or description..." />
        <div class="category-strip">
          <button class="cat-btn" :class="{ active: !activeCategory }" @click="activeCategory = null">All ({{ sources.length }})</button>
          <button
            v-for="cat in categories"
            :key="cat"
            class="cat-btn" :class="{ active: activeCategory === cat }"
            @click="activeCategory = activeCategory === cat ? null : cat"
          >
            {{ CATEGORY_META[cat]?.icon ?? '📁' }} {{ CATEGORY_META[cat]?.label ?? cat }} ({{ catCount(cat) }})
          </button>
        </div>
      </div>

      <!-- Data source cards -->
      <div v-if="filtered.length === 0" class="empty">No data sources match your search.</div>

      <div v-else class="source-grid">
        <UICard v-for="src in filtered" :key="src.path" :padding="'compact'">
          <div class="source-card">
            <div class="sc-top">
              <span class="sc-path">{{ src.path }}</span>
              <UIPill :tone="src.type === 'Array' ? 'info' : 'neutral'" size="sm">{{ src.type }}</UIPill>
            </div>

            <p class="sc-desc">{{ src.description }}</p>

            <div class="sc-meta">
              <span class="sc-stat">
                <strong>{{ src.itemCount }}</strong> {{ src.type === 'Array' ? 'items' : 'keys' }}
              </span>
              <span class="sc-stat">
                <strong>{{ src.sizeKB }}KB</strong>
              </span>
              <span v-if="src.category" class="sc-cat">
                {{ CATEGORY_META[src.category]?.icon }} {{ CATEGORY_META[src.category]?.label ?? src.category }}
              </span>
            </div>

            <div class="sc-keys">
              <span v-for="k in src.keys.slice(0, 8)" :key="k" class="key-chip">{{ k }}</span>
              <span v-if="src.keys.length > 8" class="key-chip more">+{{ src.keys.length - 8 }}</span>
            </div>

            <!-- Usage hints -->
            <div class="sc-usage">
              <span class="usage-label">Used in:</span>
              <span v-if="src.category === 'global'" class="usage-tag">Dynamic Theme Controller</span>
              <span v-if="src.category === 'supply_chain'" class="usage-tag">Network Graph, Counterparty Card</span>
              <span v-if="src.category === 'strategies'" class="usage-tag">Strategy Detail, Monitor</span>
              <span v-if="src.category === 'social' || src.path.includes('predictions')" class="usage-tag">Consensus Meter, Article Post</span>
              <span v-if="src.category === 'agents'" class="usage-tag">Swarm Plugs, Avatar Card</span>
              <span v-if="src.category === 'core'" class="usage-tag">Profile, Wallet, Community</span>
              <span v-else-if="!['global','supply_chain','strategies','social','agents','core'].includes(src.category)" class="usage-tag">Various pages</span>
            </div>
          </div>
        </UICard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.data-catalog {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.view-tabs { display: flex; gap: 0.4rem; }
.view-tabs button {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.view-tabs button.active {
  background: rgba(0,255,136,0.1);
  border-color: var(--primary-green);
  color: var(--primary-green);
}

.skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.5rem;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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

.category-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.cat-btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border-secondary);
  border-radius: 999px;
  background: transparent;
  color: var(--text-gray);
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.cat-btn:hover { border-color: var(--primary-green); color: var(--primary-green); }
.cat-btn.active { background: rgba(0,255,136,0.08); border-color: var(--primary-green); color: var(--primary-green); }

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.5rem;
}

.source-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.sc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
}
.sc-path {
  font-size: 0.68rem;
  font-weight: 700;
  font-family: ui-monospace, Menlo, monospace;
  color: var(--primary-green);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sc-desc {
  font-size: 0.72rem;
  color: var(--text-light-gray);
  margin: 0;
  line-height: 1.4;
}
.sc-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.62rem;
  color: var(--text-gray);
}
.sc-stat strong { color: var(--text-white); font-weight: 700; }
.sc-cat { margin-left: auto; }

.sc-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.key-chip {
  font-size: 0.55rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text-light-gray);
  font-family: ui-monospace, Menlo, monospace;
}
.key-chip.more { background: rgba(0,255,136,0.06); border-color: rgba(0,255,136,0.15); color: var(--primary-green); }

.sc-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
  font-size: 0.58rem;
}
.usage-label { color: var(--text-gray); }
.usage-tag {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0,170,255,0.06);
  border: 1px solid rgba(0,170,255,0.12);
  color: var(--primary-blue);
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-gray);
  font-size: 0.85rem;
}
</style>
