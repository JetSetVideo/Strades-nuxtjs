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

const loading = ref(true)
const sources = ref<DataSource[]>([])
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
}

onMounted(async () => {
  // Scan public/data for all JSON files
  try {
    const manifest = await $fetch<{ path: string; category: string; type: string; itemCount: number; keys: string[]; sizeKB: number; description: string }[]>('/api/data-catalog')
    sources.value = manifest
  } catch {
    // Fallback: load from static data (no API available)
    const macroKeys = ['global_volatility_index', 'market_sentiment', 'geopolitical_stress', 'dominant_asset_class', 'flow_velocity', 'liquidity_index', 'news_pulse_count', 'fear_greed', 'lighting_source_angle', 'volatility_by_class', 'sentiment_by_class', 'active_flows']
    const supplyKeys = ['asset_id', 'asset_kind', 'headquarters', 'facilities', 'suppliers', 'customers', 'shipments']
    const strategyKeys = ['id', 'name', 'description', 'creator_id', 'category', 'type', 'status', 'risk_level', 'target_assets', 'indicators', 'win_rate', 'sharpe_ratio', 'max_drawdown', 'total_return_percentage']

    sources.value = [
      { path: 'global/macro_state.json', category: 'global', type: 'Object', itemCount: 14, keys: macroKeys, sizeKB: 1, description: 'Live market health — volatility, sentiment, geopolitical stress, capital flows.' },
      { path: 'global/events.json', category: 'global', type: 'Array', itemCount: 7, keys: ['id', 'title', 'category', 'starts_at', 'impact', 'consensus', 'actual'], sizeKB: 1, description: 'Scheduled macro events (Fed, CPI, earnings) with consensus forecasts.' },
      { path: 'global/user_preferences.json', category: 'global', type: 'Object', itemCount: 7, keys: ['user_id', 'base_currency', 'personality_matrix', 'trading_style', 'ui_density_preference', 'behavioral_history', 'favorite_assets'], sizeKB: 1, description: 'User profile & preferences — risk tolerance, UI density, favorite assets.' },
      { path: 'core/wallets.json', category: 'core', type: 'Array', itemCount: 2, keys: ['id', 'user_id', 'name', 'total_value', 'available_balance', 'assets', 'transactions', 'performance_history'], sizeKB: 6, description: 'User wallets with asset allocations, transactions, and performance history.' },
      { path: 'core/strategies.json', category: 'strategies', type: 'Array', itemCount: 5, keys: strategyKeys, sizeKB: 5, description: 'All strategies with backtest metrics, P&L, Sharpe, drawdown, risk level.' },
      { path: 'core/bots.json', category: 'strategies', type: 'Array', itemCount: 4, keys: ['id', 'owner_id', 'name', 'agent_id', 'strategy_id', 'platform_id', 'status', 'started_at'], sizeKB: 2, description: 'Deployed bot instances running strategies on connected platforms.' },
      { path: 'core/community.json', category: 'core', type: 'Array', itemCount: 6, keys: ['id', 'username', 'bio', 'is_friend', 'online', 'specialization', 'trading_style', 'win_rate', 'match_score'], sizeKB: 2, description: 'Community members — friends, discoverable traders, swarm intelligence targets.' },
      { path: 'core/influencers.json', category: 'core', type: 'Array', itemCount: 4, keys: ['id', 'handle', 'name', 'followers', 'credibility_score', 'specialization'], sizeKB: 2, description: 'Market influencers with credibility scores for signal weighting.' },
      { path: 'core/trading_platforms.json', category: 'core', type: 'Array', itemCount: 6, keys: ['id', 'user_id', 'name', 'type', 'status', 'api_health'], sizeKB: 3, description: 'Connected trading platforms (exchanges, brokers) with API health status.' },
      { path: 'predictions.json', category: 'social', type: 'Array', itemCount: 200, keys: ['id', 'userId', 'assetId', 'direction', 'timeframe', 'confidence', 'status', 'accuracyScore'], sizeKB: 8, description: 'Community price predictions — bullish/bearish per asset, with outcome accuracy.' },
      { path: 'social/posts.json', category: 'social', type: 'Array', itemCount: 50, keys: ['id', 'author_id', 'title', 'category', 'political_leaning', 'controversy_index', 'embedded_allocation', 'timestamp'], sizeKB: 8, description: 'Social posts with political bias scores, controversy metrics, embedded allocation opinions.' },
      { path: 'social/notifications.json', category: 'social', type: 'Array', itemCount: 3, keys: ['id', 'message', 'timestamp', 'read'], sizeKB: 1, description: 'User notifications — price alerts, strategy triggers, social activity.' },
      { path: 'supply_chain/apple.json', category: 'supply_chain', type: 'Object', itemCount: 8, keys: supplyKeys, sizeKB: 6, description: 'Apple supply chain — HQ, facilities, suppliers (TSMC, Foxconn), customers, shipments.' },
      { path: 'supply_chain/amazon.json', category: 'supply_chain', type: 'Object', itemCount: 8, keys: supplyKeys, sizeKB: 5, description: 'Amazon supply chain — warehouses, AWS data centers, logistics partners.' },
      { path: 'supply_chain/tesla.json', category: 'supply_chain', type: 'Object', itemCount: 8, keys: supplyKeys, sizeKB: 5, description: 'Tesla supply chain — Gigafactories, battery suppliers (Panasonic, CATL), material flows.' },
      { path: 'supply_chain/btc.json', category: 'supply_chain', type: 'Object', itemCount: 8, keys: supplyKeys, sizeKB: 5, description: 'Bitcoin network — mining pools, hashrate distribution, energy sources, exchange flows.' },
      { path: 'supply_chain/usd.json', category: 'supply_chain', type: 'Object', itemCount: 8, keys: ['asset_id', 'headquarters', 'facilities', 'suppliers', 'customers', 'shipments'], sizeKB: 3, description: 'USD/Fiat infrastructure — central banks, treasury markets, payment rails.' },
      { path: 'agents/avatars.json', category: 'agents', type: 'Array', itemCount: 5, keys: ['id', 'name', 'owner_id', 'kind', 'tagline', 'specialization', 'trading_style', 'personality_matrix', 'opinion_vector', 'confidence_score'], sizeKB: 6, description: 'AI Avatars with personality matrices, opinion vectors (allocation preferences), confidence, and execution frequency.' },
      { path: 'agents/training_log.json', category: 'agents', type: 'Array', itemCount: 5, keys: ['id', 'agent_id', 'ts', 'event', 'delta', 'reward'], sizeKB: 1, description: 'Reinforcement learning training log — events, rewards, behavioral deltas.' },
      { path: 'agents/marketplace.json', category: 'agents', type: 'Object', itemCount: 4, keys: ['featured', 'trending_24h', 'categories', 'recently_listed'], sizeKB: 1, description: 'Avatar marketplace — featured, trending, categorized agent listings.' },
      { path: 'chat/conversations.json', category: 'chat', type: 'Array', itemCount: 6, keys: ['id', 'participants', 'type', 'title', 'last_message_at', 'message_count', 'unread_count'], sizeKB: 3, description: 'Chat conversations with participant lists, unread counts, last activity.' },
      { path: 'chat/messages.json', category: 'chat', type: 'Array', itemCount: 400, keys: ['id', 'conversation_id', 'sender_id', 'text', 'timestamp', 'emotional_urgency'], sizeKB: 9, description: 'Chat messages with emotional urgency scores for swarm pulse detection.' },
      { path: 'relationships/industry_dependencies.json', category: 'relationships', type: 'Object', itemCount: 7, keys: ['technology_supply_chain', 'automotive_supply_chain', 'cloud_computing_ecosystem', 'retail_ecommerce', 'cross_industry_dependencies', 'geopolitical_risks', 'market_interdependencies'], sizeKB: 6, description: 'Cross-industry dependency graph — which sectors rely on each other and geopolitical risk multipliers.' },
      { path: 'competitions/competitions.json', category: 'competitions', type: 'Array', itemCount: 1, keys: ['id', 'name', 'description', 'pot'], sizeKB: 1, description: 'Trading competitions with prize pools, leaderboards, and rankings.' },
      { path: 'quests/quests.json', category: 'quests', type: 'Array', itemCount: 5, keys: ['id', 'title', 'description', 'category_id', 'reward_credits', 'completed', 'progress'], sizeKB: 1, description: 'Gamified quests — educational and challenge-based tasks with credit rewards.' },
    ]
  }
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
</script>

<template>
  <div class="data-catalog">
    <UIPageHeader title="Data Catalog" subtitle="Browse every data source available for your strategies — macro state, supply chains, social sentiment, predictions, and more." />

    <template v-if="loading">
      <AppSkeletonLoader height="60px" />
      <div class="skel-grid">
        <AppSkeletonLoader v-for="i in 6" :key="i" height="120px" />
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
