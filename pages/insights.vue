<script setup lang="ts">
/**
 * /insights — how your behaviour reads, who you click with, what that tells your agent, and which
 * styles carry risk or benefit across the community.
 *   ProfileCard   declared vs behaviour-read code, axes, metrics, coaching
 *   Directive     the strategy mix + risk budget your profile produces for your agent
 *   Relations     pairs and rooms (list) + every operator of the selected one (detail)
 *   Hierarchy     riskiest vs most beneficial styles (paper call accuracy, never profit)
 * Data: composables/useIntelligence.ts (GET/POST /api/v1/intelligence/*). Query: ?relation=<id>, ?compare=<userId>.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import { isNewcomer } from '~/utils/intelligence'

definePageMeta({ title: 'Insights', description: 'Your behaviour read, your relations, your agent directive and the community hierarchy.', layout: 'default' })
useHead({ title: 'Insights · Strades' })

const route = useRoute()
const router = useRouter()
const intel = useIntelligence()
const {
  status, error, profile, directive, pairs, groups, lastRun, refreshing, refreshError, refreshedAt,
  selectedId, detail, detailStatus, detailError, compareUserId, hierarchy, hierarchyStatus, hierarchyError,
} = intel

const newcomer = computed(() => isNewcomer(profile.value))
const meId = computed(() => profile.value?.user_id ?? null)
const detailEl = ref<HTMLElement | null>(null)

const q = (k: string) => {
  const v = route.query[k]
  return typeof v === 'string' && v ? v : null
}

/** Apply ?relation= / ?compare= (also when a link changes them while the page is open). */
async function applyQuery() {
  const rel = q('relation')
  const cmp = q('compare')
  if (cmp && cmp !== compareUserId.value) await intel.compareWith(cmp)
  else if (rel && !cmp && (rel !== selectedId.value || compareUserId.value)) await intel.loadRelation(rel)
  else if (!rel && !cmp && (selectedId.value || compareUserId.value)) intel.clearSelection()
}

function select(id: string) {
  if (id === selectedId.value && !compareUserId.value) return
  void router.replace({ query: { ...route.query, relation: id, compare: undefined } })
  // on a phone the detail sits below the list: bring it into view (instant: smooth scroll is unreliable)
  nextTick(() => {
    if (detailEl.value && window.matchMedia('(max-width: 900px)').matches) detailEl.value.scrollIntoView({ behavior: 'auto', block: 'start' })
  })
}

function closeDetail() {
  void router.replace({ query: { ...route.query, relation: undefined, compare: undefined } })
}

function retryDetail() {
  const cmp = q('compare')
  const rel = q('relation')
  if (cmp) void intel.compareWith(cmp)
  else if (rel) void intel.loadRelation(rel, true)
}

onMounted(async () => {
  void intel.loadHierarchy()
  await intel.load()
  await applyQuery()
})
watch(() => [route.query.relation, route.query.compare], () => { if (status.value !== 'signed-out') void applyQuery() })
</script>

<template>
  <div class="insights">
    <UIPageHeader title="Insights" subtitle="How your behaviour reads, who you click with, and what it tells your agent." />

    <UIEmptyState
      v-if="status === 'signed-out'"
      icon="◎"
      title="Sign in to see your insights"
      message="Insights read your calls, reads and chats on your account: they need you signed in."
    />

    <ClientOnly v-else>
      <template #fallback>
        <div class="skeleton" aria-busy="true" aria-label="Loading insights"><span v-for="i in 3" :key="i" class="sk-tile" /></div>
      </template>

      <p v-if="status === 'error'" class="banner" data-tone="error" role="alert">
        Insights unavailable ({{ error }}). <button type="button" class="link" @click="intel.load()">Retry</button>
      </p>

      <div v-if="status === 'loading' || status === 'idle'" class="skeleton" aria-busy="true" aria-label="Loading insights"><span v-for="i in 3" :key="i" class="sk-tile" /></div>

      <template v-else-if="status === 'ready'">
        <UICard padding="normal" depth="raised">
          <IntelligenceProfileCard
            :profile="profile"
            :last-run="lastRun"
            :refreshing="refreshing"
            :refresh-error="refreshError"
            :refreshed-at="refreshedAt"
            @refresh="intel.refresh()"
          />
        </UICard>

        <UICard padding="normal">
          <IntelligenceDirective :directive="directive" />
        </UICard>

        <div class="rel-grid">
          <UICard padding="normal" class="rel-list">
            <IntelligenceRelationList
              :pairs="pairs"
              :groups="groups"
              :selected-id="compareUserId ? null : selectedId"
              :newcomer="newcomer"
              :refreshing="refreshing"
              @select="select"
              @refresh="intel.refresh()"
            />
          </UICard>
          <div ref="detailEl" class="rel-detail-wrap">
            <UICard padding="normal" depth="raised" class="rel-detail">
              <IntelligenceRelationDetail
                :detail="detail"
                :status="detailStatus"
                :error="detailError"
                :me-id="meId"
                :compare="!!compareUserId"
                @close="closeDetail"
                @retry="retryDetail"
              />
            </UICard>
          </div>
        </div>
      </template>

      <UICard v-if="status !== 'signed-out'" padding="normal">
        <IntelligenceHierarchy
          :hierarchy="hierarchy"
          :status="hierarchyStatus"
          :error="hierarchyError"
          :my-archetype="newcomer ? null : profile?.archetype ?? null"
          @retry="intel.loadHierarchy(true)"
        />
      </UICard>

      <p class="foot">Behavioural reads, not psychology diagnoses: they describe how you have acted on Strades, and they change as you do. Scores are paper call accuracy, never money.</p>
    </ClientOnly>
  </div>
</template>

<style scoped>
.insights { display: flex; flex-direction: column; gap: var(--page-gap, 0.6rem); min-width: 0; max-width: 100%; overflow-x: clip; }
.insights :deep(.ui-card) { min-width: 0; }
.rel-grid { display: grid; grid-template-columns: minmax(0, 24rem) minmax(0, 1fr); gap: var(--page-gap, 0.6rem); align-items: start; }
.rel-detail-wrap { min-width: 0; scroll-margin-top: calc(var(--nav-top-height, 3.25rem) + 0.5rem); }
@media (max-width: 900px) { .rel-grid { grid-template-columns: minmax(0, 1fr); } }
.banner { margin: 0; font-size: 0.76rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); color: var(--text-light-gray); background: rgba(255,255,255,0.03); border: 1px solid var(--edge-raised); }
.banner[data-tone='error'] { border-color: color-mix(in oklch, var(--error-red) 60%, transparent); }
.link { all: unset; cursor: pointer; color: var(--primary-blue); }
.link:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.skeleton { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--card-gap); }
.sk-tile { height: 7rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); }
@media (max-width: 560px) { .skeleton { grid-template-columns: minmax(0, 1fr); } }
.foot { margin: 0; font-size: 0.66rem; color: var(--text-gray); text-align: center; padding: 0.25rem 0 0.5rem; }
</style>
