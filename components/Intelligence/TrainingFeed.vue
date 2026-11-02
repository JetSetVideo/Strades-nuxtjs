<script setup lang="ts">
/**
 * The avatar's training feed (Profile › Your mirror › "Your avatar" tab): what it saw (server counts from
 * GET /api/v1/intelligence/me/ `inputs`, contract C6), what it learned (the same behaviour read Insights shows)
 * and what it would do now (the directive, compact, with the launch link). Server numbers only; when the
 * server sends no `inputs`, counts show "—" with the reason.
 */
import { computed } from 'vue'
import { axisRead, intelPct, isNewcomer, type IntelDirective, type IntelProfile } from '~/utils/intelligence'
import { intelInputRows, intelInputsTotal, intelInteractionRows, type IntelInputs } from '~/utils/intelligenceV3'

const props = defineProps<{
  inputs: IntelInputs | null
  profile: IntelProfile | null
  directive: IntelDirective | null
}>()

const rows = computed(() => intelInputRows(props.inputs))
const clicks = computed(() => intelInteractionRows(props.inputs))
const total = computed(() => intelInputsTotal(props.inputs))
const newcomer = computed(() => isNewcomer(props.profile))
/** The two strongest axes, in the words ProfileCard uses. */
const strongest = computed(() => [...(props.profile?.axes ?? [])]
  .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  .slice(0, 2)
  .map(a => axisRead(a).words))
const fmtCount = (n: number | null) => (n === null ? '—' : n.toLocaleString(APP_LOCALE))
</script>

<template>
  <div class="tf" data-testid="training-feed">
    <section class="tf-b" aria-labelledby="tf-saw">
      <h3 id="tf-saw" class="tf-t">What it saw <span class="muted">· last {{ inputs?.window_days ?? 60 }} days, on the server</span></h3>
      <p v-if="!inputs" class="muted">
        Counts unavailable: the server did not send them (older version). Your calls still train it:
        <NuxtLink to="/prices">make a call on Prices</NuxtLink>.
      </p>
      <template v-else>
        <ul class="tf-rows">
          <li v-for="r in rows" :key="r.key" class="tf-row">
            <span class="tf-l">{{ r.label }}</span>
            <b class="tf-n num">{{ fmtCount(r.count) }}</b>
            <NuxtLink :to="r.to" class="tf-more">{{ r.more }} →</NuxtLink>
          </li>
        </ul>
        <p v-if="clicks.length" class="muted">
          Clicks it learns from:
          <span v-for="(c, i) in clicks" :key="c.label">{{ i ? ' · ' : '' }}{{ c.label }} <b class="num">{{ fmtCount(c.count) }}</b></span>
        </p>
        <p v-else class="muted">No plugs, shares or searches counted yet. <NuxtLink to="/agents">Plug an agent</NuxtLink> or share an article on <NuxtLink to="/news">News</NuxtLink>.</p>
        <p class="muted">
          Off-switch and the list of what is collected: <NuxtLink to="/settings#train-avatar">Settings › Account</NuxtLink>.
        </p>
      </template>
    </section>

    <section class="tf-b" aria-labelledby="tf-learned">
      <h3 id="tf-learned" class="tf-t">What it learned</h3>
      <p v-if="newcomer" class="muted">
        Still reading you<template v-if="total !== null"> ({{ fmtCount(total) }} inputs so far)</template>. Three calls on
        <NuxtLink to="/prices">Prices</NuxtLink>, then <NuxtLink to="/insights">Insights › Re-analyse me now</NuxtLink>.
      </p>
      <template v-else-if="profile">
        <p class="tf-arch">Reads as <b>{{ profile.archetype }}</b> <span class="muted">· {{ profile.code_inferred }} · confidence {{ intelPct(profile.code_confidence) }}</span></p>
        <ul class="tf-axes">
          <li v-for="w in strongest" :key="w">{{ w }}</li>
        </ul>
        <NuxtLink to="/insights" class="tf-more">The full read on Insights →</NuxtLink>
      </template>
    </section>

    <section class="tf-b" aria-label="What it would do now">
      <h3 class="tf-t">What it would do now</h3>
      <IntelligenceDirective :directive="directive" compact />
    </section>
  </div>
</template>

<style scoped>
.tf { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.tf-b { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.tf-t { margin: 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.tf-t .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.muted { margin: 0; color: var(--text-gray); font-size: 0.74rem; }
.tf-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.tf-row { display: grid; grid-template-columns: minmax(0, 10rem) 3.5rem minmax(0, 1fr); gap: 0.6rem; align-items: center; font-size: 0.78rem; min-height: 24px; }
@media (max-width: 520px) { .tf-row { grid-template-columns: minmax(0, 1fr) 3rem; } .tf-row .tf-more { grid-column: 1 / -1; } }
.tf-l { color: var(--text-light-gray); }
.tf-n { color: var(--text-white); text-align: right; }
.tf-more, .tf a { color: var(--primary-blue); text-decoration: none; font-size: 0.74rem; }
.tf a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.tf-arch { margin: 0; font-size: 0.85rem; color: var(--text-white); }
.tf-axes { margin: 0; padding-left: 1.1rem; font-size: 0.76rem; color: var(--text-light-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
