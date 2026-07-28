<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NewsFacetSummary, NewsFilters, NewsSortMode, NewsViewMode } from '~/types/news'

type FacetKey = 'companies' | 'currencies' | 'commodities' | 'owners' | 'users' | 'friends' | 'sources' | 'categories' | 'areas'
type EnumFacetKey = 'kinds' | 'political' | 'economic' | 'sentiment'

const props = defineProps<{
  filters: NewsFilters
  facets: NewsFacetSummary
  sortMode: NewsSortMode
  view: NewsViewMode
  activeFilterCount: number
}>()

const emit = defineEmits<{
  (e: 'update:view', value: NewsViewMode): void
  (e: 'update:sort', value: NewsSortMode): void
  (e: 'toggle-filter', payload: { key: FacetKey; value: string }): void
  (e: 'toggle-enum-filter', payload: { key: EnumFacetKey; value: string }): void
  (e: 'toggle-flag', key: 'savedOnly' | 'historyOnly' | 'predictionOnly'): void
  (e: 'update-date', payload: { key: 'dateFrom' | 'dateTo'; value: string | null }): void
  (e: 'clear'): void
  (e: 'open-import'): void
}>()

const expanded = ref(false)
const openBranch = ref<string | null>(null)

const views: Array<{ id: NewsViewMode; label: string }> = [
  { id: 'feed', label: 'Feed' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'signals', label: 'Signals' },
  { id: 'saved', label: 'Saved' },
  { id: 'history', label: 'History' },
]

const sorts: Array<{ id: NewsSortMode; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'hot', label: 'Hot' },
  { id: 'new', label: 'New' },
]

const branches = computed(() => [
  {
    id: 'markets',
    label: 'Markets',
    count: props.filters.companies.length + props.filters.currencies.length + props.filters.commodities.length,
  },
  {
    id: 'people',
    label: 'People',
    count: props.filters.owners.length + props.filters.users.length + props.filters.friends.length,
  },
  {
    id: 'source',
    label: 'Source',
    count: props.filters.sources.length + props.filters.kinds.length + props.filters.categories.length,
  },
  {
    id: 'interpretation',
    label: 'Interpretation',
    count: props.filters.political.length + props.filters.economic.length + props.filters.sentiment.length,
  },
  {
    id: 'context',
    label: 'Time & place',
    count: props.filters.areas.length + (props.filters.dateFrom ? 1 : 0) + (props.filters.dateTo ? 1 : 0),
  },
  {
    id: 'state',
    label: 'My state',
    count: Number(props.filters.savedOnly) + Number(props.filters.historyOnly) + Number(props.filters.predictionOnly),
  },
])

const activeSummary = computed(() => {
  const labels = [
    ...props.filters.companies,
    ...props.filters.currencies,
    ...props.filters.commodities,
    ...props.filters.areas,
    ...props.filters.categories,
    ...props.filters.friends,
    ...props.filters.political.map(value => value.replace('_', ' ')),
    ...props.filters.sentiment,
  ]
  if (props.filters.savedOnly) labels.push('saved')
  if (props.filters.historyOnly) labels.push('history')
  if (props.filters.predictionOnly) labels.push('predictions')
  return labels.slice(0, 4)
})

const toggleExpanded = () => {
  expanded.value = !expanded.value
  if (!expanded.value) openBranch.value = null
}

const toggleBranch = (id: string) => {
  openBranch.value = openBranch.value === id ? null : id
}

const enumSelected = (key: EnumFacetKey, value: string) =>
  (props.filters[key] as readonly string[]).includes(value)
</script>

<template>
  <section class="toolbar" :class="{ expanded }" aria-label="News discovery controls">
    <div class="compact-bar">
      <div class="compact-controls">
        <label class="compact-select">
          <span class="sr-only">News view</span>
          <select :value="view" @change="emit('update:view', ($event.target as HTMLSelectElement).value as NewsViewMode)">
            <option v-for="entry in views" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
          </select>
        </label>

        <label class="compact-select">
          <span class="sr-only">Sort order</span>
          <select :value="sortMode" @change="emit('update:sort', ($event.target as HTMLSelectElement).value as NewsSortMode)">
            <option v-for="entry in sorts" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
          </select>
        </label>

        <button
          class="filter-toggle"
          :class="{ active: expanded || activeFilterCount > 0 }"
          type="button"
          :aria-expanded="expanded"
          aria-controls="news-filter-tree"
          @click="toggleExpanded"
        >
          Filters
          <span v-if="activeFilterCount" class="count">{{ activeFilterCount }}</span>
          <span class="chevron" aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
        </button>

        <button class="icon-action" type="button" title="Import external link" aria-label="Import external link" @click="emit('open-import')">↗</button>
      </div>
    </div>

    <div v-if="!expanded && activeSummary.length" class="active-summary" aria-label="Active filters">
      <button
        v-for="label in activeSummary"
        :key="label"
        class="summary-chip"
        type="button"
        @click="expanded = true"
      >
        {{ label }}
      </button>
      <button v-if="activeFilterCount > activeSummary.length" class="summary-chip more" type="button" @click="expanded = true">
        +{{ activeFilterCount - activeSummary.length }}
      </button>
      <button class="summary-clear" type="button" @click="emit('clear')">Clear</button>
    </div>

    <div v-if="expanded" id="news-filter-tree" class="filter-tree">
      <nav class="branch-nav" aria-label="Filter groups">
        <button
          v-for="branch in branches"
          :key="branch.id"
          type="button"
          class="branch-button"
          :class="{ active: openBranch === branch.id, selected: branch.count > 0 }"
          :aria-expanded="openBranch === branch.id"
          @click="toggleBranch(branch.id)"
        >
          <span>{{ branch.label }}</span>
          <span v-if="branch.count" class="branch-count">{{ branch.count }}</span>
          <span class="branch-arrow" aria-hidden="true">{{ openBranch === branch.id ? '▾' : '›' }}</span>
        </button>
      </nav>

      <div v-if="openBranch" class="branch-panel">
        <template v-if="openBranch === 'markets'">
          <div class="leaf">
            <span class="leaf-title">Companies & assets</span>
            <div class="chips">
              <button
                v-for="option in facets.companies"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.companies.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'companies', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Currencies</span>
            <div class="chips">
              <button
                v-for="option in facets.currencies"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.currencies.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'currencies', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Commodities</span>
            <div class="chips">
              <button
                v-for="option in facets.commodities"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.commodities.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'commodities', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
        </template>

        <template v-else-if="openBranch === 'people'">
          <div class="leaf">
            <span class="leaf-title">Friends</span>
            <div class="chips">
              <button
                v-for="option in facets.friends"
                :key="option.value"
                type="button"
                class="chip friend-chip"
                :class="{ active: filters.friends.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'friends', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Owners & authors</span>
            <div class="chips">
              <button
                v-for="option in facets.owners"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.owners.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'owners', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Users & agents</span>
            <div class="chips">
              <button
                v-for="option in facets.users"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.users.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'users', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
        </template>

        <template v-else-if="openBranch === 'source'">
          <div class="leaf">
            <span class="leaf-title">Sources</span>
            <div class="chips">
              <button
                v-for="option in facets.sources"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.sources.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'sources', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Content kind</span>
            <div class="chips">
              <button
                v-for="option in facets.kinds"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: enumSelected('kinds', option.value) }"
                @click="emit('toggle-enum-filter', { key: 'kinds', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Categories</span>
            <div class="chips">
              <button
                v-for="option in facets.categories"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.categories.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'categories', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
        </template>

        <template v-else-if="openBranch === 'interpretation'">
          <div class="leaf">
            <span class="leaf-title">Political axis</span>
            <div class="chips">
              <button
                v-for="option in ['left', 'center_left', 'center', 'center_right', 'right']"
                :key="option"
                type="button"
                class="chip"
                :class="{ active: enumSelected('political', option) }"
                @click="emit('toggle-enum-filter', { key: 'political', value: option })"
              >{{ option.replace('_', ' ') }}</button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Economic axis</span>
            <div class="chips">
              <button
                v-for="option in ['dovish', 'neutral', 'hawkish']"
                :key="option"
                type="button"
                class="chip"
                :class="{ active: enumSelected('economic', option) }"
                @click="emit('toggle-enum-filter', { key: 'economic', value: option })"
              >{{ option }}</button>
            </div>
          </div>
          <div class="leaf">
            <span class="leaf-title">Market sentiment</span>
            <div class="chips">
              <button
                v-for="option in ['bearish', 'neutral', 'bullish']"
                :key="option"
                type="button"
                class="chip"
                :class="{ active: enumSelected('sentiment', option) }"
                @click="emit('toggle-enum-filter', { key: 'sentiment', value: option })"
              >{{ option }}</button>
            </div>
          </div>
        </template>

        <template v-else-if="openBranch === 'context'">
          <div class="leaf">
            <span class="leaf-title">Geographic area</span>
            <div class="chips">
              <button
                v-for="option in facets.areas"
                :key="option.value"
                type="button"
                class="chip"
                :class="{ active: filters.areas.includes(option.value) }"
                @click="emit('toggle-filter', { key: 'areas', value: option.value })"
              >{{ option.label }} <small>{{ option.count }}</small></button>
            </div>
          </div>
          <div class="leaf date-leaf">
            <label class="date-field">
              <span>From</span>
              <input type="date" :value="filters.dateFrom ?? ''" @input="emit('update-date', { key: 'dateFrom', value: (($event.target as HTMLInputElement).value || null) })">
            </label>
            <label class="date-field">
              <span>To</span>
              <input type="date" :value="filters.dateTo ?? ''" @input="emit('update-date', { key: 'dateTo', value: (($event.target as HTMLInputElement).value || null) })">
            </label>
          </div>
        </template>

        <template v-else-if="openBranch === 'state'">
          <div class="state-grid">
            <button class="state-option" :class="{ active: filters.savedOnly }" type="button" @click="emit('toggle-flag', 'savedOnly')">
              <strong>Saved</strong><span>Only items in your library</span>
            </button>
            <button class="state-option" :class="{ active: filters.historyOnly }" type="button" @click="emit('toggle-flag', 'historyOnly')">
              <strong>Read history</strong><span>Items you deliberately opened</span>
            </button>
            <button class="state-option" :class="{ active: filters.predictionOnly }" type="button" @click="emit('toggle-flag', 'predictionOnly')">
              <strong>Predictions</strong><span>Items linked to asset forecasts</span>
            </button>
          </div>
        </template>
      </div>

      <footer class="tree-footer">
        <span>{{ activeFilterCount ? `${activeFilterCount} active filters` : 'All information visible' }}</span>
        <div>
          <button v-if="activeFilterCount" class="text-button" type="button" @click="emit('clear')">Clear all</button>
          <button class="done-button" type="button" @click="toggleExpanded">Done</button>
        </div>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  position: relative;
  z-index: 1;
  border-radius: var(--radius-lg, 12px);
  background: var(--surface-base, rgba(20, 20, 28, 0.96));
  border: 1px solid var(--edge-raised, rgba(255, 255, 255, 0.08));
  box-shadow: var(--shadow-depth-1, 0 1px 2px rgba(0,0,0,0.4));
  overflow: clip;
}

.compact-bar {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm, 8px);
  align-items: center;
  min-height: 2.8rem;
  padding: 0.38rem 0.45rem;
}

.compact-select select,
.date-field input {
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.88);
  font: inherit;
}

.compact-controls {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.compact-select select {
  height: 2rem;
  padding: 0 1.7rem 0 0.55rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  cursor: pointer;
}

.filter-toggle,
.icon-action,
.summary-chip,
.summary-clear,
.branch-button,
.chip,
.state-option,
.text-button,
.done-button {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.filter-toggle,
.icon-action {
  height: 2rem;
  border-radius: var(--radius-md, 8px);
  padding: 0 0.65rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.filter-toggle.active,
.branch-button.active,
.branch-button.selected,
.chip.active,
.state-option.active {
  border-color: rgba(0, 255, 136, 0.32);
  background: rgba(0, 255, 136, 0.09);
  color: var(--primary-green, #00ff88);
}

.count,
.branch-count {
  display: inline-grid;
  place-items: center;
  min-width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: rgba(0, 255, 136, 0.14);
  font-size: 0.58rem;
}

.chevron {
  font-size: 0.85rem;
}

.active-summary {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  min-height: 1.7rem;
  padding: 0 0.45rem 0.38rem;
  overflow: hidden;
}

.summary-chip,
.summary-clear,
.chip {
  border-radius: 999px;
  padding: 0.25rem 0.5rem;
  font-size: 0.62rem;
  white-space: nowrap;
}

.summary-chip {
  color: rgba(171, 224, 255, 0.88);
  border-color: rgba(0, 170, 255, 0.2);
}

.summary-chip.more,
.summary-clear {
  color: rgba(255, 255, 255, 0.55);
}

.summary-clear {
  margin-left: auto;
  border: none;
  background: transparent;
}

.filter-tree {
  border-top: 1px solid var(--edge-soft, rgba(255, 255, 255, 0.05));
}

.branch-nav {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.3rem;
  padding: 0.4rem;
  background: var(--surface-sunken, rgba(8, 9, 13, 0.92));
}

.branch-button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.3rem;
  align-items: center;
  min-height: 2rem;
  border-radius: var(--radius-md, 8px);
  padding: 0.35rem 0.5rem;
  text-align: left;
  font-size: 0.65rem;
}

.branch-arrow {
  color: rgba(255, 255, 255, 0.45);
}

.branch-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.65rem;
  max-height: 14rem;
  overflow: auto;
  padding: 0.65rem;
  background: var(--surface-base, rgba(20, 20, 28, 0.96));
}

.leaf {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.leaf-title,
.date-field span {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(255, 255, 255, 0.48);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip small {
  color: rgba(255, 255, 255, 0.42);
}

.date-leaf,
.state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.date-field input {
  height: 2.1rem;
  padding: 0 0.55rem;
}

.state-grid {
  grid-column: 1 / -1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.state-option {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-radius: var(--radius-md, 8px);
  padding: 0.65rem;
  text-align: left;
}

.state-option span {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.65rem;
}

.tree-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.65rem;
  border-top: 1px solid var(--edge-soft, rgba(255, 255, 255, 0.05));
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.65rem;
}

.tree-footer > div {
  display: flex;
  gap: 0.4rem;
}

.text-button,
.done-button {
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font-size: 0.64rem;
}

.text-button {
  border-color: transparent;
  background: transparent;
}

.done-button {
  border-color: rgba(0, 255, 136, 0.32);
  color: var(--primary-green, #00ff88);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1024px) {
  .compact-bar {
    justify-content: stretch;
  }

  .compact-controls {
    overflow-x: auto;
    padding-bottom: 0.1rem;
  }

  .branch-nav {
    display: flex;
    overflow-x: auto;
  }

  .branch-button {
    min-width: 8rem;
  }
}

@media (max-width: 640px) {
  .compact-select {
    display: none;
  }

  .compact-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .state-grid,
  .date-leaf {
    grid-template-columns: 1fr;
  }

  .branch-panel {
    max-height: 18rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toolbar *,
  .toolbar *::before,
  .toolbar *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
