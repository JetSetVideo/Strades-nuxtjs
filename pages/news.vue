<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UIScreenShell from '@/components/UI/ScreenShell.vue'
import UIPill from '@/components/UI/Pill.vue'
import UICard from '@/components/UI/Card.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import MapButton from '@/components/Map/MapButton.vue'
import type { MapMarker } from '@/components/Map/WorldMap.vue'

type FacetKey = 'companies' | 'currencies' | 'commodities' | 'owners' | 'users' | 'friends' | 'sources' | 'categories' | 'areas'
type EnumFacetKey = 'kinds' | 'political' | 'economic' | 'sentiment'

definePageMeta({ title: 'News', layout: 'default' })

const newsStore = useNewsStore()
const influencers = useInfluencersStore()
const macro = useMacroStore()
const route = useRoute()
const router = useRouter()
const composerOpen = ref(false)
const importOpen = ref(false)

await Promise.all([
  newsStore.initializeStore(),
  influencers.fetchInfluencers(),
])

newsStore.applyQuery(route.query as Record<string, string | string[] | undefined>)

const kpis = computed(() => [
  { label: 'Results', value: newsStore.filteredItems.length },
  { label: 'Saved', value: newsStore.currentUserState.bookmarks.length },
  { label: 'Stress', value: Math.round(macro.geopolitical_stress * 100), suffix: '%' },
  { label: 'Followed', value: newsStore.currentUserState.followedAuthors.length + influencers.followed.length },
])

const mapMarkers = computed<MapMarker[]>(() =>
  newsStore.filteredItems
    .filter(item => item.geographicOrigin && (item.geographicOrigin.lat !== 0 || item.geographicOrigin.lng !== 0))
    .map(item => ({
      id: item.id,
      lat: item.geographicOrigin!.lat,
      lng: item.geographicOrigin!.lng,
      label: item.geographicOrigin?.name || item.title,
      tone: item.controversyIndex > 0.7 ? 'negative' : item.sentiment && item.sentiment > 0 ? 'positive' : 'info',
      weight: Math.min(1, item.weight),
      group: item.kind,
    }))
)

const shareableQuery = computed(() => newsStore.toQuery())

watch(
  shareableQuery,
  query => {
    router.replace({ query })
  },
  { deep: true }
)

usePageAction().onPageAction('news:compose', () => { composerOpen.value = true })

const toggleFlag = (key: 'savedOnly' | 'historyOnly' | 'predictionOnly') => {
  newsStore.updateFilter(key, !newsStore.filters[key] as never)
}

const toggleFacet = (payload: { key: FacetKey; value: string }) => {
  newsStore.toggleFilterValue(payload.key, payload.value)
}

const toggleEnumFacet = (payload: { key: EnumFacetKey; value: string }) => {
  newsStore.toggleEnumFilterValue(payload.key, payload.value)
}

const importArticle = (payload: Parameters<typeof newsStore.importExternalLink>[0]) => {
  newsStore.importExternalLink(payload)
  newsStore.setView('feed')
  newsStore.setSortMode('new')
}

const publishPost = (payload: Parameters<typeof newsStore.publishPost>[0]) => {
  newsStore.publishPost(payload)
  newsStore.setView('feed')
  newsStore.setSortMode('new')
}
</script>

<template>
  <UIScreenShell
    title="News Intelligence Workspace"
    hide-header
    :kpis="kpis"
  >
    <div v-if="newsStore.loading" class="loading">
      <AppSkeletonLoader height="110px" />
      <AppSkeletonLoader height="140px" />
      <AppSkeletonLoader height="140px" />
    </div>

    <div v-else class="workspace">
      <div class="main-column">
        <NewsFilterToolbar
          :filters="newsStore.filters"
          :facets="newsStore.facetSummary"
          :sort-mode="newsStore.sortMode"
          :view="newsStore.view"
          :active-filter-count="newsStore.activeFilterCount"
          @update:view="newsStore.setView($event)"
          @update:sort="newsStore.setSortMode($event)"
          @toggle-filter="toggleFacet"
          @toggle-enum-filter="toggleEnumFacet"
          @toggle-flag="toggleFlag"
          @update-date="newsStore.updateFilter($event.key, $event.value)"
          @clear="newsStore.resetFilters()"
          @open-import="importOpen = true"
        />

        <div class="summary-row">
          <UIPill tone="info">{{ newsStore.filteredItems.length }} results</UIPill>
          <UIPill v-if="newsStore.activeFilterCount" tone="neutral" ghost>{{ newsStore.activeFilterCount }} active filters</UIPill>
          <UIPill v-if="newsStore.filters.predictionOnly" tone="success" ghost>Prediction-linked</UIPill>
          <MapButton
            v-if="mapMarkers.length"
            :markers="mapMarkers"
            title="Origins"
            :subtitle="`${mapMarkers.length} mapped stories`"
          />
        </div>

        <div class="feed">
          <template v-if="newsStore.view === 'signals'">
            <NewsInfluencerRail :influencers="influencers.latestSignals" :limit="12" @follow="influencers.toggleFollow($event)" />
          </template>
          <template v-else>
            <NewsItemCard
              v-for="item in newsStore.filteredItems"
              :key="item.id"
              :item="item"
              :followed="newsStore.isAuthorFollowed(item.author.id)"
              @bookmark="newsStore.toggleBookmark(item.id)"
              @reaction="newsStore.setReaction(item.id, $event)"
              @judge="newsStore.setPoliticalJudgment(item.id, $event)"
              @comment="newsStore.addComment(item.id, $event)"
              @share="newsStore.shareItem(item.id, $event.recipients, $event.note)"
              @follow-author="newsStore.toggleFollowAuthor(item.author.id)"
              @read="newsStore.recordRead(item.id, 5000)"
            />
          </template>

          <UIEmptyState
            v-if="newsStore.view !== 'signals' && newsStore.filteredItems.length === 0"
            icon="◴"
            title="No matching stories"
            message="Adjust the filters, import an external source, or write a new article."
          />
        </div>
      </div>

      <aside class="rail">
        <UICard title="Filter coverage" depth="sunken">
          <div class="rail-list">
            <div><span>Companies</span><strong>{{ newsStore.facetSummary.companies.length }}</strong></div>
            <div><span>Currencies</span><strong>{{ newsStore.facetSummary.currencies.length }}</strong></div>
            <div><span>Commodities</span><strong>{{ newsStore.facetSummary.commodities.length }}</strong></div>
            <div><span>Owners</span><strong>{{ newsStore.facetSummary.owners.length }}</strong></div>
            <div><span>Areas</span><strong>{{ newsStore.facetSummary.areas.length }}</strong></div>
          </div>
        </UICard>

        <UICard title="Recent history" depth="sunken">
          <div v-if="newsStore.history.length" class="history-list">
            <div v-for="entry in newsStore.history.slice(0, 8)" :key="entry.id" class="history-entry">
              <span>{{ entry.kind }}</span>
              <strong>{{ entry.itemId }}</strong>
              <small>{{ new Date(entry.createdAt).toLocaleString() }}</small>
            </div>
          </div>
          <UIEmptyState v-else size="sm" icon="◌" message="Reading, saving and sharing will appear here." />
        </UICard>

        <UICard title="Design boundary" depth="sunken">
          <p class="rail-copy">
            External links are stored with explicit manual provenance. This demo does not pretend to scrape or enrich remote URLs in-browser.
          </p>
        </UICard>
      </aside>
    </div>

    <NewsComposerModal :open="composerOpen" @update:open="composerOpen = $event" @publish="publishPost" />
    <NewsExternalImportModal :open="importOpen" @update:open="importOpen = $event" @submit="importArticle" />
  </UIScreenShell>
</template>

<style scoped>
.loading,
.feed,
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--card-gap, 0.6rem);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
  gap: var(--page-gap, 0.85rem);
  align-items: start;
}

.main-column,
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.85rem);
  min-width: 0;
}

.summary-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.rail-list,
.history-entry {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rail-list > div,
.history-entry {
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-md, 8px);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.rail-list > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.75rem;
}

.history-entry span,
.rail-copy {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.72rem;
  line-height: 1.5;
}

.history-entry strong {
  font-size: 0.76rem;
}

.history-entry small {
  color: rgba(255, 255, 255, 0.45);
}

@media (max-width: 1024px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
