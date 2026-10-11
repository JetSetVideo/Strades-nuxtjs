<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NewsFacetExcludes, NewsFacetSummary, NewsFilterOption, NewsFilters, NewsSortMode, NewsViewMode } from '~/types/news'
import { statesFromLists, type FilterTriState } from '~/utils/priceFilters'

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

const kindOptions = computed(() => toOptions(props.facets.kinds))
const categoryOptions = computed(() => toOptions(props.facets.categories))
const sentimentOptions = [
  { id: 'bearish', label: 'Bearish' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'bullish', label: 'Bullish' },
]
const politicalOptions = [
  { id: 'left', label: 'Left' },
  { id: 'center_left', label: 'Center left' },
  { id: 'center', label: 'Center' },
  { id: 'center_right', label: 'Center right' },
  { id: 'right', label: 'Right' },
]
const economicOptions = [
  { id: 'dovish', label: 'Dovish' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'hawkish', label: 'Hawkish' },
]

const longGroups = computed(() => [
  { id: 'companies' as const, label: 'Companies & assets', options: toOptions(props.facets.companies) },
  { id: 'currencies' as const, label: 'Currencies', options: toOptions(props.facets.currencies) },
  { id: 'commodities' as const, label: 'Commodities', options: toOptions(props.facets.commodities) },
  { id: 'sources' as const, label: 'Sources', options: toOptions(props.facets.sources) },
  { id: 'owners' as const, label: 'Authors', options: toOptions(props.facets.owners) },
  { id: 'friends' as const, label: 'Friends', options: toOptions(props.facets.friends) },
  { id: 'users' as const, label: 'Users & agents', options: toOptions(props.facets.users) },
  { id: 'areas' as const, label: 'Place', options: toOptions(props.facets.areas) },
].filter(group => group.options.length))

function toOptions(options: NewsFilterOption[]) {
  return options.map(option => ({ id: option.value, label: option.label }))
}

function statesFor(key: keyof NewsFacetExcludes): Record<string, FilterTriState> {
  const include = (props.filters[key] as readonly string[]) ?? []
  const exclude = (props.filters.excluded?.[key] as readonly string[]) ?? []
  return statesFromLists(include, exclude)
}

function cycleEnum(key: EnumFacetKey, id: string) {
  emit('toggle-enum-filter', { key, value: id })
}

function cycleFacet(key: FacetKey, id: string) {
  emit('toggle-filter', { key, value: id })
}
</script>

<template>
  <section class="toolbar" :class="{ expanded }" aria-label="News discovery controls">
    <div class="compact-bar">
      <div class="controls-primary">
        <UIOpChips
          v-if="categoryOptions.length"
          class="category-chips"
          label="Category"
          uppercase
          nowrap
          :options="categoryOptions"
          :states="statesFor('categories')"
          @cycle="cycleFacet('categories', $event)"
        />

        <div class="mode-chips" role="group" aria-label="Sort order">
          <button
            v-for="entry in sorts"
            :key="entry.id"
            type="button"
            class="mode-chip"
            :class="{ active: sortMode === entry.id }"
            :aria-pressed="sortMode === entry.id"
            @click="emit('update:sort', entry.id)"
          >{{ entry.label }}</button>
        </div>

        <button
          class="icon-action"
          type="button"
          title="Import external link"
          aria-label="Import external link"
          @click="emit('open-import')"
        >↗</button>

        <button
          v-if="activeFilterCount"
          class="clear-chip"
          type="button"
          @click="emit('clear')"
        >Clear</button>
      </div>

      <div class="controls-secondary">
        <div class="mode-chips view-chips" role="group" aria-label="News view">
          <button
            v-for="entry in views"
            :key="entry.id"
            type="button"
            class="mode-chip view-chip"
            :class="{ active: view === entry.id }"
            :aria-pressed="view === entry.id"
            @click="emit('update:view', entry.id)"
          >{{ entry.label }}</button>
        </div>

        <div v-if="kindOptions.length" class="chip-group">
          <span class="group-label">Kind</span>
          <UIOpChips
            label="Content kind"
            :options="kindOptions"
            :states="statesFor('kinds')"
            @cycle="cycleEnum('kinds', $event)"
          />
        </div>

        <div class="chip-group">
          <span class="group-label">Sentiment</span>
          <UIOpChips
            label="Market sentiment"
            :options="sentimentOptions"
            :states="statesFor('sentiment')"
            @cycle="cycleEnum('sentiment', $event)"
          />
        </div>

        <button
          class="mode-chip more-chip"
          :class="{ active: expanded || activeFilterCount > 0 }"
          type="button"
          :aria-expanded="expanded"
          aria-controls="news-filter-tree"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Less' : 'More' }}
          <span v-if="activeFilterCount" class="count">{{ activeFilterCount }}</span>
        </button>
      </div>
    </div>

    <div v-if="expanded" id="news-filter-tree" class="filter-tree">
      <div class="leaf">
        <span class="leaf-title">Political axis</span>
        <UIOpChips
          label="Political axis"
          :options="politicalOptions"
          :states="statesFor('political')"
          @cycle="cycleEnum('political', $event)"
        />
      </div>
      <div class="leaf">
        <span class="leaf-title">Economic axis</span>
        <UIOpChips
          label="Economic axis"
          :options="economicOptions"
          :states="statesFor('economic')"
          @cycle="cycleEnum('economic', $event)"
        />
      </div>

      <div v-for="group in longGroups" :key="group.id" class="leaf">
        <span class="leaf-title">{{ group.label }}</span>
        <UIOpChips
          :label="group.label"
          :options="group.options"
          :states="statesFor(group.id)"
          @cycle="cycleFacet(group.id, $event)"
        />
      </div>

      <div class="leaf date-leaf">
        <label class="date-field">
          <span>From</span>
          <input
            type="date"
            :value="filters.dateFrom ?? ''"
            @input="emit('update-date', { key: 'dateFrom', value: (($event.target as HTMLInputElement).value || null) })"
          >
        </label>
        <label class="date-field">
          <span>To</span>
          <input
            type="date"
            :value="filters.dateTo ?? ''"
            @input="emit('update-date', { key: 'dateTo', value: (($event.target as HTMLInputElement).value || null) })"
          >
        </label>
      </div>

      <div class="leaf">
        <span class="leaf-title">My state</span>
        <div class="mode-chips" role="group" aria-label="My state">
          <button
            type="button"
            class="mode-chip"
            :class="{ active: filters.savedOnly }"
            :aria-pressed="filters.savedOnly"
            @click="emit('toggle-flag', 'savedOnly')"
          >Saved</button>
          <button
            type="button"
            class="mode-chip"
            :class="{ active: filters.historyOnly }"
            :aria-pressed="filters.historyOnly"
            @click="emit('toggle-flag', 'historyOnly')"
          >Read history</button>
          <button
            type="button"
            class="mode-chip"
            :class="{ active: filters.predictionOnly }"
            :aria-pressed="filters.predictionOnly"
            @click="emit('toggle-flag', 'predictionOnly')"
          >Predictions</button>
        </div>
      </div>

      <footer class="tree-footer">
        <span>{{ activeFilterCount ? `${activeFilterCount} active filters` : 'All stories visible' }}</span>
        <div>
          <button v-if="activeFilterCount" class="clear-chip" type="button" @click="emit('clear')">Clear all</button>
          <button class="mode-chip view-chip active" type="button" @click="expanded = false">Done</button>
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
}

.compact-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0.45rem;
}

.controls-primary,
.controls-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.controls-primary {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.controls-primary::-webkit-scrollbar { display: none; }

.controls-secondary { flex-wrap: wrap; }

.category-chips { flex-shrink: 0; }

.chip-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 6px;
  border-left: 1px solid var(--border-primary, rgba(255, 255, 255, 0.08));
}

.group-label,
.leaf-title,
.date-field span {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-gray, rgba(255, 255, 255, 0.48));
  font-weight: 700;
  white-space: nowrap;
}

.mode-chips {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  flex-shrink: 0;
  align-items: center;
}

.mode-chip,
.icon-action,
.clear-chip {
  height: 26px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid var(--border-secondary, rgba(255, 255, 255, 0.16));
  border-radius: var(--radius-md, 8px);
  color: var(--text-gray, rgba(255, 255, 255, 0.62));
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 600;
  font-family: var(--font-family-secondary, inherit);
  white-space: nowrap;
  box-shadow: none;
}

.mode-chip:hover,
.icon-action:hover,
.clear-chip:hover { color: var(--text-white, #fff); }

.mode-chip.active {
  background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04));
  border-color: rgba(255,255,255,0.32);
  color: var(--text-white, #fff);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    0 3px 8px rgba(0,0,0,0.55);
}

.view-chip.active {
  background: rgba(0, 255, 136, 0.08);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  box-shadow: none;
}

.icon-action {
  width: 26px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.more-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.count {
  display: inline-grid;
  place-items: center;
  min-width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: rgba(0, 255, 136, 0.14);
  color: var(--primary-green, #00ff88);
  font-size: 0.58rem;
}

.filter-tree {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.65rem 0.45rem 0.5rem;
  border-top: 1px solid var(--edge-soft, rgba(255, 255, 255, 0.05));
}

.leaf {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.date-leaf {
  flex-direction: row;
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
  box-sizing: border-box;
  border-radius: var(--radius-md, 8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.88);
  font: inherit;
}

.tree-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--edge-soft, rgba(255, 255, 255, 0.05));
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.65rem;
}

.tree-footer > div {
  display: flex;
  gap: 0.4rem;
}

@media (max-width: 720px) {
  .controls-primary { flex-wrap: wrap; overflow-x: visible; }
  .date-leaf { flex-direction: column; }
}
</style>
