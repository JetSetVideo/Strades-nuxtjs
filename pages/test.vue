<script setup lang="ts">
/**
 * /test — gallery of the 19 components no page uses (swarm 2026-11-02 delete list, restored on request; the 12 Button/* ones were deleted on request).
 * Each one renders inside its own error boundary with sample props, so one broken component never blanks the page.
 * Props come from the app's sample JSON where it exists (supply chain, posts, quests), else small inline fixtures.
 */
import { defineComponent, h, onErrorCaptured, ref, computed, onMounted } from 'vue'
import { routeLabel } from '~/utils/routes'
import { useAssetsStore } from '@/stores/assets'

definePageMeta({ title: 'Test' })
useHead({ title: `${routeLabel('/test')} · Strades` })

/** Per-specimen error boundary: shows the error text instead of the component. */
const Specimen = defineComponent({
  props: { name: { type: String, required: true }, file: { type: String, required: true }, note: { type: String, default: '' } },
  setup(props, { slots }) {
    const err = ref<string | null>(null)
    onErrorCaptured((e) => { err.value = String((e as Error)?.message ?? e).slice(0, 300); return false })
    return () => h('section', { class: 'specimen', id: props.name }, [
      h('header', { class: 'spec-head' }, [
        h('strong', props.name),
        h('code', props.file),
        props.note ? h('span', { class: 'spec-note' }, props.note) : null,
      ]),
      h('div', { class: 'spec-body' }, err.value ? [h('p', { class: 'spec-err' }, `Render error: ${err.value}`)] : slots.default?.()),
    ])
  },
})

const base = useRuntimeConfig().app.baseURL || '/'
const { data: chain } = await useAsyncData('test-tsla-chain', () => $fetch<Record<string, any>>(`${base}data/supply_chain/tsla.json`).catch(() => null), { server: false })
const { data: posts } = await useAsyncData('test-posts', () => $fetch<any[]>(`${base}data/social/posts.json`).catch(() => []), { server: false })

const assetsStore = useAssetsStore()
onMounted(() => { if (!assetsStore.assets.length) assetsStore.initializeStore?.() })

// ── Inline fixtures (sample data, not anyone's account) ───────────────────
const avatars = [
  { id: 'av1', name: 'Momentum Max', avatar_url: 'https://i.pravatar.cc/64?u=av1', personality_matrix: { risk: 0.72, aggression: 0.6, reaction_speed: 0.8 }, trading_style: 'momentum', pnl_30d: 6.4, confidence_score: 0.71, execution_frequency: 12, is_public: true, followers: 214 },
  { id: 'av2', name: 'Value Vera', avatar_url: 'https://i.pravatar.cc/64?u=av2', personality_matrix: { risk: 0.31, aggression: 0.2, reaction_speed: 0.35 }, trading_style: 'value', pnl_30d: -1.2, confidence_score: 0.58, execution_frequency: 3, is_public: false, followers: 40 },
]
const communities = [
  { id: 'c1', name: 'BTC swing desk', category: 'crypto', members: 128, message_count: 2204, unread_count: 3, last_message: 'Breakout above 78k?' },
  { id: 'c2', name: 'Macro & rates', category: 'macro', members: 64, message_count: 512, unread_count: 0, last_message: 'CPI Thursday.' },
]
const friends = [
  { id: 'f1', username: 'kenji_intj', avatar_url: 'https://i.pravatar.cc/64?u=f1', bio: 'Patient swing trader', is_friend: true, online: true, timezone: 'Asia/Tokyo', specialization: ['crypto'], trading_style: 'swing', win_rate: 0.58, last_30d_pnl_pct: 4.1, followers: 120, match_score: 0.81, last_active_at: new Date().toISOString() },
  { id: 'f2', username: 'arthuro_value', avatar_url: 'https://i.pravatar.cc/64?u=f2', bio: 'Value, slow, stubborn', is_friend: true, online: false, timezone: 'Europe/Paris', specialization: ['stocks'], trading_style: 'value', win_rate: 0.52, last_30d_pnl_pct: -0.8, followers: 77, match_score: 0.64, last_active_at: new Date(Date.now() - 36e5).toISOString() },
]
const calendar = Array.from({ length: 30 }, (_, i) => {
  const won = (i * 7) % 5
  return { day: i + 1, pnl_eur: Math.round(Math.sin(i / 3) * 120), pnl_pct: +(Math.sin(i / 3) * 1.4).toFixed(2), trades_total: won + 2, trades_won: won, is_upcoming: i > 24 }
})
const record = {
  top_pages: [{ page: '/prices', visits: 42 }, { page: '/wallet', visits: 18 }, { page: '/chat', visits: 11 }],
  top_actions: [{ action: 'asset_click', count: 64 }, { action: 'prediction_set', count: 9 }],
  share_network: [{ friend_id: 'f1', username: 'kenji_intj', trading_style: 'swing', share_count: 4 }],
  content_affinity: { crypto: 0.6, macro: 0.25, stocks: 0.15 },
  trading_signals: { deployments: 2, pauses: 1, allocation_changes: 5, asset_views: 38 },
  last_reduced_at: null,
}
const activeFriends = [
  { id: 'f1', name: 'kenji_intj', count: 2, direction: 'bullish' as const },
  { id: 'f2', name: 'arthuro_value', count: 1, direction: 'bearish' as const },
]
const overlayOn = ref(true)
const isolated = ref<string[]>([])
const toggleFriend = (id: string) => { isolated.value = isolated.value.includes(id) ? isolated.value.filter(x => x !== id) : [...isolated.value, id] }
const article = { id: 'post_001', title: 'Bitcoin tests the 78k ceiling', content: 'Sample article for the gallery: flows, funding and what the desk expects this week.', author: 'Sample desk', source: 'Strades', publishing_date: new Date().toISOString(), category: 'crypto' }
const quest = { id: 'q1', name: 'Make three calls', description: 'State three price calls this week.', difficulty: 'Easy' as const, points: 50, progress: 33, isCompleted: false, category: 'predict' }
const avatarNode = { id: 'n1', type: 'avatar' as const, x: 40, y: 40, confidence_score: 0.7, execution_frequency: 6, params: { name: 'Momentum Max', riskProfile: 0.72 } }
const conditions = ref<unknown[]>([])
const draft = ref('')
const firstPost = computed(() => {
  const p = posts.value?.[0]
  return p ? { ...p, interactions: p.interactions ?? { comments: 0, likes: 0, shares: 0 } } : null
})

const COUNT = 19
</script>

<template>
  <div class="test-page">
    <NavigationBackLink />
    <UIPageHeader :title="routeLabel('/test')" :subtitle="`The ${COUNT} components no page uses, each with sample props. A component that fails shows its error in its own card.`">
      <template #actions>
        <UISourceChip source="sample" note="Every value on this page is sample data for previewing components; none of it is your account." />
      </template>
    </UIPageHeader>

    <nav class="toc" aria-label="Components on this page">
      <a v-for="n in ['Profile','Asset','Widget','Builder','Selector','Social','Agent','Chat']" :key="n" :href="`#g-${n}`">{{ n }}</a>
    </nav>

    <h2 id="g-Profile" class="group">Profile (5)</h2>
    <div class="grid wide">
      <Specimen name="ProfileAvatarsSection" file="components/Profile/AvatarsSection.vue"><ProfileAvatarsSection :avatars="avatars" /></Specimen>
      <Specimen name="ProfileCommunitySection" file="components/Profile/CommunitySection.vue"><ProfileCommunitySection :communities="communities" /></Specimen>
      <Specimen name="ProfileContactsRail" file="components/Profile/ContactsRail.vue"><ProfileContactsRail :friends="friends as any" /></Specimen>
      <Specimen name="ProfileTradingCalendar" file="components/Profile/TradingCalendar.vue"><ProfileTradingCalendar :calendar="calendar" title="Trading calendar (sample)" show-upcoming /></Specimen>
      <Specimen name="ProfileTradingRecords" file="components/Profile/TradingRecords.vue"><ProfileTradingRecords :record="record" :recent="[]" /></Specimen>
    </div>

    <h2 id="g-Asset" class="group">Asset (3) — Tesla sample supply chain</h2>
    <div class="grid wide">
      <Specimen name="AssetGeography" file="components/Asset/Geography.vue">
        <AssetGeography v-if="chain" :facilities="chain.facilities" :suppliers="chain.suppliers" :customers="chain.customers" :shipments="chain.shipments" :headquarters="chain.headquarters" />
        <p v-else class="muted">Loading data/supply_chain/tsla.json…</p>
      </Specimen>
      <Specimen name="AssetShipments" file="components/Asset/Shipments.vue"><AssetShipments :items="chain?.shipments ?? []" /></Specimen>
      <Specimen name="AssetSuppliers" file="components/Asset/Suppliers.vue"><AssetSuppliers :items="chain?.suppliers ?? []" label="Suppliers" /></Specimen>
    </div>

    <h2 id="g-Widget" class="group">Widget (4)</h2>
    <div class="grid wide">
      <Specimen name="WidgetActiveFriendsOverlay" file="components/Widget/ActiveFriendsOverlay.vue">
        <WidgetActiveFriendsOverlay v-model:enabled="overlayOn" :friends="activeFriends" :isolated="isolated" asset-id="btc" @toggle-friend="toggleFriend" @show-all="isolated = []" />
      </Specimen>
      <Specimen name="WidgetNewsCard" file="components/Widget/NewsCard.vue"><WidgetNewsCard :article="article" /></Specimen>
      <Specimen name="WidgetQuest" file="components/Widget/Quest.vue"><WidgetQuest :quest="quest" :is-completed="false" /></Specimen>
      <Specimen name="WidgetSentiment" file="components/Widget/Sentiment.vue"><WidgetSentiment /></Specimen>
    </div>

    <h2 id="g-Builder" class="group">Builder (2)</h2>
    <div class="grid wide">
      <Specimen name="BuilderNodeCanvas" file="components/Builder/NodeCanvas.vue" note="reads the builder store"><BuilderNodeCanvas /></Specimen>
      <Specimen name="BuilderNodesAvatarNode" file="components/Builder/Nodes/AvatarNode.vue"><BuilderNodesAvatarNode :node="avatarNode" /></Specimen>
    </div>

    <h2 id="g-Selector" class="group">Selector (2)</h2>
    <div class="grid wide">
      <Specimen name="SelectorAssets" file="components/Selector/Assets.vue"><SelectorAssets :assets="assetsStore.assets.slice(0, 8)" selected-type="all" /></Specimen>
      <Specimen name="SelectorConditions" file="components/Selector/Conditions.vue"><SelectorConditions v-model="conditions" /></Specimen>
    </div>

    <h2 id="g-Social" class="group">Social (1)</h2>
    <div class="grid wide">
      <Specimen name="SocialArticlePost" file="components/Social/ArticlePost.vue">
        <SocialArticlePost v-if="firstPost" :post="firstPost" />
        <p v-else class="muted">Loading data/social/posts.json…</p>
      </Specimen>
    </div>

    <h2 id="g-Agent" class="group">Agent (1)</h2>
    <div class="grid wide">
      <Specimen name="AgentCompare" file="components/Agent/Compare.vue" note="reads the agents store"><AgentCompare /></Specimen>
    </div>

    <h2 id="g-Chat" class="group">Chat (1)</h2>
    <div class="grid wide">
      <Specimen name="ChatComposer" file="components/Chat/Composer.vue"><ChatComposer v-model="draft" placeholder="Type a sample message…" /></Specimen>
    </div>
  </div>
</template>

<style scoped>
.test-page { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; padding-bottom: 6rem; }
.toc { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.toc a { padding: 0.25rem 0.6rem; border: 1px solid var(--border-primary); border-radius: 999px; font-size: 0.8rem; color: inherit; text-decoration: none; }
.group { margin: 1rem 0 0; font-size: 1rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary, inherit); }
.grid { display: grid; gap: 0.75rem; }
.grid.wide { grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); }
.test-page :deep(.specimen) { border: 1px solid var(--border-primary); border-radius: var(--radius-md, 10px); background: var(--bg-secondary, transparent); overflow: hidden; min-width: 0; }
.test-page :deep(.spec-head) { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; padding: 0.45rem 0.7rem; border-bottom: 1px solid var(--border-primary); font-size: 0.78rem; }
.test-page :deep(.spec-head code) { opacity: 0.6; font-size: 0.72rem; }
.test-page :deep(.spec-note) { color: var(--error-red, #e5484d); font-size: 0.72rem; }
.test-page :deep(.spec-body) { padding: 0.75rem; position: relative; overflow: auto; max-height: 560px; }
.test-page :deep(.spec-err) { color: var(--error-red, #e5484d); font-family: monospace; font-size: 0.78rem; }
.muted { opacity: 0.6; }
</style>
