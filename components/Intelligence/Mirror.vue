<script setup lang="ts">
/**
 * The profile "mirror": where you stand against everybody else, how far your calls were from the truth,
 * who in your entourage completes / mirrors / opposes you, your forms of intelligence and financial
 * personality, and what your avatar does better than you. Click tabs; every detail opens on click.
 *
 * Data: composables/useIntelligence.ts (GET /api/v1/intelligence/me/, /space/, /entourage/, /similar/), client-side.
 * Deep links: #intelligence (section), #intelligence-truth | -entourage | -intelligences | -avatar | -factors (tab).
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { intelTruthEmpty } from '~/utils/intelligenceV2'
import type { IntelCommunityV3, IntelProfileV3 } from '~/utils/intelligenceV3'

type Tab = 'space' | 'truth' | 'entourage' | 'intelligences' | 'avatar' | 'factors'
const TABS: { key: Tab; label: string }[] = [
  { key: 'space', label: 'You vs everyone' },
  { key: 'truth', label: 'Distance from truth' },
  { key: 'entourage', label: 'Entourage' },
  { key: 'intelligences', label: 'Intelligences' },
  { key: 'avatar', label: 'Your avatar' },
  { key: 'factors', label: 'Your factors' },
]

const intel = useIntelligence()
const { status, error, community, profileV2, space, spaceStatus, spaceError, entourage, entourageStatus, entourageError, similar, similarStatus, similarError } = intel
/** v3 view of the same payload: community.eigen, profile.space.factors/typicality, profile.influence */
const communityV3 = computed(() => community.value as IntelCommunityV3 | null)
const profileV3 = computed(() => profileV2.value as IntelProfileV3 | null)
const route = useRoute()

const tab = ref<Tab>('space')
const fromHash = (h: string): Tab | null => {
  const k = h.replace(/^#intelligence-?/, '')
  return TABS.some(t => t.key === k) ? (k as Tab) : null
}

const people = computed(() => {
  const g = entourage.value?.groups
  return g ? [...g.completes, ...g.mirrors, ...g.opposes, ...g.differs] : []
})
const truth = computed(() => profileV2.value?.truth ?? null)
const headline = computed(() => {
  const p = profileV2.value
  if (!p || status.value !== 'ready') return ''
  const n = community.value?.n ?? 0
  if (intelTruthEmpty(truth.value)) return `Compared with ${n} measured traders. Your calls have not resolved yet.`
  return `Compared with ${n} measured traders, from ${truth.value!.n} resolved paper calls.`
})

function select(t: Tab) {
  tab.value = t
  if (t === 'entourage' || t === 'space') void intel.loadEntourage()
  if (t === 'factors') void intel.loadSimilar()
}
const onSpace = (x: string, y: string) => { void intel.loadSpace(x, y) }

onMounted(async () => {
  const h = route.hash || ''
  const t = h.startsWith('#intelligence') ? fromHash(h) : null
  if (t) tab.value = t
  await intel.load()
  if (status.value === 'ready') void intel.loadEntourage()
  if (status.value === 'ready' && tab.value === 'factors') void intel.loadSimilar()
  if (h.startsWith('#intelligence')) {
    await nextTick()
    document.getElementById('intelligence')?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }
})
watch(() => route.hash, (h) => { const t = h?.startsWith('#intelligence') ? fromHash(h) : null; if (t) select(t) })
</script>

<template>
  <div class="mi">
    <header class="mi-head">
      <div class="mi-id">
        <p class="mi-k">How you compare</p>
        <h2 class="mi-t">Your mirror</h2>
        <p class="mi-meta">{{ headline || 'Behavioural reads from your paper calls and activity, never a diagnosis.' }}</p>
      </div>
      <NuxtLink to="/insights" class="mi-link" data-testid="insights-entry">Open Insights →</NuxtLink>
    </header>

    <p v-if="status === 'signed-out'" class="mi-msg">Sign in to see how you compare with everybody else.</p>
    <div v-else-if="status === 'idle' || (status === 'loading' && !profileV2)" class="mi-skel" aria-busy="true">
      <span /><span /><span />
    </div>
    <p v-else-if="status === 'error'" class="mi-msg err" role="alert">
      {{ error }} <button type="button" class="lnk" @click="intel.load()">Retry</button>
    </p>
    <template v-else>
      <div class="tabs" role="tablist" aria-label="Your mirror">
        <button
          v-for="t in TABS" :id="`mi-tab-${t.key}`" :key="t.key" type="button" role="tab" class="tab"
          :aria-selected="tab === t.key" :aria-controls="`mi-panel-${t.key}`" @click="select(t.key)"
        >{{ t.label }}</button>
      </div>

      <div :id="`mi-panel-${tab}`" role="tabpanel" :aria-labelledby="`mi-tab-${tab}`" class="panel">
        <template v-if="tab === 'space'">
          <IntelligenceSpaceStrips :space="profileV2?.space" :community="community" :people="people" />
          <h3 class="sub">The community map</h3>
          <IntelligenceSpaceMap
            :community="community" :space="space" :status="spaceStatus" :error="spaceError" :factors="profileV3?.space?.factors" @load="onSpace"
          />
        </template>
        <IntelligenceTruth v-else-if="tab === 'truth'" :truth="truth" />
        <IntelligenceEntourage
          v-else-if="tab === 'entourage'" :entourage="entourage" :status="entourageStatus" :error="entourageError"
          @retry="intel.loadEntourage(true)"
        />
        <IntelligenceIntelligences
          v-else-if="tab === 'intelligences'" :intelligences="profileV2?.intelligences" :finance="profileV2?.finance" :community="community"
        />
        <IntelligenceEigen
          v-else-if="tab === 'factors'" :community="communityV3" :space="profileV3?.space" :influence="profileV3?.influence"
          :similar="similar" :similar-status="similarStatus" :similar-error="similarError" @retry="intel.loadSimilar(true)"
        />
        <IntelligenceAvatar v-else :avatar="profileV2?.avatar" />
      </div>
      <p class="mi-foot">
        Behavioural reads ("reads as"), not a psychology test. Scores are paper call accuracy; capital is paper capital, never real money.
      </p>
    </template>
  </div>
</template>

<style scoped>
.mi { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; padding: var(--card-pad); border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: var(--surface-raised); }
.mi-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0.4rem 1rem; }
.mi-id { min-width: 0; }
.mi-k { margin: 0; font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-gray); }
.mi-t { margin: 0.1rem 0; font-size: 1.1rem; color: var(--text-white); }
.mi-meta { margin: 0; font-size: 0.72rem; color: var(--text-gray); }
.mi-link { font-size: 0.78rem; color: var(--primary-blue); text-decoration: none; min-height: 24px; display: inline-flex; align-items: center; }
.mi-link:focus-visible, .lnk:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.mi-msg { margin: 0; font-size: 0.8rem; color: var(--text-light-gray); }
.mi-msg.err { color: var(--warning-orange); }
.lnk { all: unset; cursor: pointer; color: var(--primary-blue); }
.mi-skel { display: flex; flex-direction: column; gap: 0.5rem; }
.mi-skel span { height: 2.2rem; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.04); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) { .mi-skel span { animation: none; } }
.tabs { display: flex; gap: 0.3rem; overflow-x: auto; scrollbar-width: thin; padding-bottom: 0.15rem; max-width: 100%; }
.tab { all: unset; box-sizing: border-box; cursor: pointer; flex: 0 0 auto; font-size: 0.74rem; padding: 0.4rem 0.75rem; border-radius: 999px; border: 1px solid var(--edge-raised); color: var(--text-light-gray); min-height: 24px; white-space: nowrap; }
.tab:hover { border-color: var(--edge-lit); }
.tab[aria-selected='true'] { background: var(--primary-blue); border-color: var(--primary-blue); color: var(--secondary-darker); font-weight: 600; }
.tab:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }
.panel { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.sub { margin: 0.4rem 0 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.mi-foot { margin: 0; font-size: 0.64rem; color: var(--text-gray); }
</style>
