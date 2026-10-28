<script setup lang="ts">
/**
 * "You, so far": four tiles that read the timeline as a person — how you call, what your money did,
 * your agents, your opinions — plus when you are active (hour x weekday heatmap from the log rollup).
 * Exact counts come from the events in view; "recent" rates are the server EMAs and say so.
 */
import { computed } from 'vue'
import type { HistoryProfile, HistorySummary } from '~/utils/historyTimeline'
import { histPct, histRelTime, histSignedUsd } from '~/utils/historyTimeline'

const props = defineProps<{
  profile: HistoryProfile | null
  summary: HistorySummary
  /** totals of pre-filled sample rows — shown only when the user has none of their own, and chipped */
  sampleSummary: HistorySummary
  heatmap: { hour: number; dow: number; count: number }[]
  /** Market sentiment + topics only: political profiling is out of the MVP (strades-product frame). */
  reading: { sentiment_bias: number; sample_count: number; topic_affinity: Record<string, number> } | null
  personalAgent: { id: string; name: string; samples: number; status?: string; sample: boolean } | null
  followed: number
  now: number
  /** resolved calls, oldest first: the score strip */
  scored: { id: string; at: string; score: number; right: boolean; asset: string | null; sample: boolean }[]
}>()
const emit = defineEmits<{ select: [id: string] }>()

const c = computed(() => props.profile?.calls ?? null)
// Each tile shows the user's own numbers; with none yet, the sample totals stand in WITH a Sample chip.
const callsSample = computed(() => !props.summary.calls.made && props.sampleSummary.calls.made > 0)
const cs = computed(() => (callsSample.value ? props.sampleSummary : props.summary).calls)
const ownMoney = computed(() => props.summary.realized.n + props.summary.open.positions + props.summary.open.paper + props.summary.backtests.n > 0)
const moneySample = computed(() => !ownMoney.value && (props.sampleSummary.realized.n + props.sampleSummary.open.positions + props.sampleSummary.backtests.n) > 0)
const ms = computed(() => (moneySample.value ? props.sampleSummary : props.summary))

const calibration = computed(() => {
  const v = c.value?.calibration_pct
  if (v == null) return null
  if (Math.abs(v) < 0.25) return 'Your called moves match what markets did.'
  return v > 0 ? `You call moves ${v.toFixed(1)} pts too high on average.` : `You call moves ${Math.abs(v).toFixed(1)} pts too low on average.`
})

const horizon = computed(() => {
  const h = c.value?.horizon_hours
  if (h == null) return null
  return h < 48 ? `${Math.round(h)} h` : h < 24 * 60 ? `${Math.round(h / 24)} d` : `${Math.round(h / 720)} mo`
})

const lean = (v: number, neg: string, pos: string) => (Math.abs(v) < 0.1 ? 'balanced' : `${v < 0 ? neg : pos} ${Math.round(Math.abs(v) * 100)}%`)
const topTopic = computed(() => Object.entries(props.reading?.topic_affinity ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const grid = computed(() => {
  const m = new Map(props.heatmap.map(h => [`${h.dow}:${h.hour}`, h.count]))
  const max = Math.max(1, ...props.heatmap.map(h => h.count))
  return DOW.map((d, dow) => ({ d, cells: Array.from({ length: 24 }, (_, hour) => ({ hour, v: (m.get(`${dow}:${hour}`) ?? 0) / max, n: m.get(`${dow}:${hour}`) ?? 0 })) }))
})
const peak = computed(() => {
  const top = [...props.heatmap].sort((a, b) => b.count - a.count)[0]
  return top ? `${DOW[top.dow]} ${String(top.hour).padStart(2, '0')}:00 UTC` : null
})
const heatLabel = computed(() => (peak.value ? `Activity by weekday and hour (UTC). Busiest: ${peak.value}.` : 'No logged activity yet.'))
</script>

<template>
  <section class="you" aria-labelledby="you-title">
    <header class="you-head">
      <div>
        <h2 id="you-title" class="you-name">{{ profile?.display_name ?? 'You' }}</h2>
        <p class="you-meta">
          <template v-if="profile">
            {{ profile.is_demo ? 'Demo session' : `On Strades for ${profile.days_on_strades} day${profile.days_on_strades === 1 ? '' : 's'}` }}
            <template v-if="profile.is_demo && profile.demo_expires_at"> · deleted {{ histRelTime(profile.demo_expires_at, now) }}</template>
            <template v-if="summary.span.first"> · history since {{ new Date(summary.span.first).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</template>
          </template>
          <template v-else>Sign in to see your own timeline.</template>
        </p>
      </div>
      <p v-if="summary.next" class="you-next">
        <span class="you-next-k">Next</span>
        <span class="you-next-v">{{ summary.next.title }}</span>
        <span class="you-next-t">{{ histRelTime(summary.next.at, now) }}</span>
      </p>
    </header>

    <div class="tiles">
      <article class="tile" style="--lane: var(--primary-blue)">
        <h3 class="tile-k">◎ How you call <span v-if="callsSample" class="chip-sample" title="Pre-filled demo calls replayed on real prices, not yours">Sample</span></h3>
        <p class="tile-big">
          <span class="num">{{ cs.made }}</span> calls
          <span class="tile-sub">· {{ cs.resolved }} scored · {{ cs.open }} open</span>
        </p>
        <ul class="facts">
          <li v-if="cs.resolved">Right direction <b class="num">{{ cs.right }}/{{ cs.resolved }}</b><template v-if="cs.avgScore !== null"> · avg score <b class="num">{{ Math.round(cs.avgScore) }}/100</b></template></li>
          <li v-if="c">Bullish <b class="num">{{ Math.round(c.bullish_share * 100) }}%</b> of the time<template v-if="horizon"> · typical horizon <b>{{ horizon }}</b></template></li>
          <li v-if="calibration">{{ calibration }}</li>
          <li v-if="c && c.hit_rate !== null" class="recent">Recent hit rate (weighted to your last calls) <b class="num">{{ Math.round(c.hit_rate * 100) }}%</b></li>
          <li v-if="!summary.calls.made" class="empty">{{ callsSample ? 'Your own calls will replace these.' : 'No calls yet.' }} Tap a price card on <NuxtLink to="/prices">Prices</NuxtLink> to make one.</li>
        </ul>
      </article>

      <article class="tile" style="--lane: var(--primary-green)">
        <h3 class="tile-k">◈ What your money did <span v-if="moneySample" class="chip-sample" title="Pre-filled demo trades replayed on real prices, not yours">Sample</span></h3>
        <p v-if="ms.realized.n" class="tile-big">
          <span class="num" :data-tone="ms.realized.paper >= 0 ? 'up' : 'down'">{{ histSignedUsd(ms.realized.paper) }}</span>
          <span class="tile-sub">realised on paper · {{ ms.realized.n }} closed</span>
        </p>
        <p v-else class="tile-big"><span class="num">—</span> <span class="tile-sub">nothing closed yet</span></p>
        <ul class="facts">
          <li v-if="ms.realized.real">Real wallet records <b class="num" :data-tone="ms.realized.real >= 0 ? 'up' : 'down'">{{ histSignedUsd(ms.realized.real) }}</b></li>
          <li>Open now: <b class="num">{{ ms.open.positions + ms.open.paper }}</b> position{{ ms.open.positions + ms.open.paper === 1 ? '' : 's' }}</li>
          <li v-if="ms.backtests.best">Best backtest <b class="num">{{ histPct(ms.backtests.best.pct) }}</b> <span class="muted">({{ ms.backtests.n }} run{{ ms.backtests.n === 1 ? '' : 's' }})</span></li>
          <li class="muted">No real money moves through Strades: paper and backtests are simulations.</li>
        </ul>
      </article>

      <article class="tile" style="--lane: var(--domain-agent)">
        <h3 class="tile-k">⬡ Your agents</h3>
        <p class="tile-big">
          <span class="num">{{ summary.open.agents }}</span> running
        </p>
        <ul class="facts">
          <li v-if="personalAgent">Personal agent <NuxtLink :to="`/agents/${personalAgent.id}`">{{ personalAgent.name }}</NuxtLink> · <b class="num">{{ personalAgent.samples.toLocaleString('en-US') }}</b> samples learned<span v-if="personalAgent.sample" class="chip-sample" title="Catalog agent, not trained on your account yet">Sample</span></li>
          <li>Following <b class="num">{{ followed }}</b> {{ followed === 1 ? "agent's opinion" : "agents' opinions" }}</li>
          <li><NuxtLink to="/strategies">Launch or tune agents →</NuxtLink></li>
        </ul>
      </article>

      <article class="tile" style="--lane: var(--domain-social)">
        <h3 class="tile-k">❝ Your opinions</h3>
        <template v-if="reading">
          <p class="tile-big"><span class="num">{{ reading.sample_count }}</span> articles shaped your lens</p>
          <ul class="facts">
            <li>Sentiment of what you read: <b>{{ lean(reading.sentiment_bias, 'bearish', 'bullish') }}</b></li>
            <li v-if="topTopic">Reads mostly <b>{{ topTopic }}</b></li>
          </ul>
        </template>
        <template v-else>
          <p class="tile-big"><span class="num">0</span> articles judged</p>
          <ul class="facts"><li class="empty">React to articles on <NuxtLink to="/news">News</NuxtLink> to build your opinion lens.</li></ul>
        </template>
      </article>
    </div>

    <div class="you-foot">
    <figure v-if="scored.length" class="strip">
      <figcaption class="heat-cap"><span v-if="scored[0]?.sample" class="chip-sample">Sample</span> Every call scored, oldest → newest <span class="muted">· height = score /100 · bright = right direction, dim = wrong</span></figcaption>
      <div class="strip-bars">
        <button
          v-for="s in scored"
          :key="s.id"
          type="button"
          class="strip-b"
          :data-right="s.right"
          :style="{ '--h': `${Math.max(8, s.score)}%` }"
          :aria-label="`${s.asset ?? 'Call'} ${new Date(s.at).toLocaleDateString('en-US')}: score ${Math.round(s.score)}, ${s.right ? 'right' : 'wrong'} direction`"
          @click="emit('select', s.id)"
        ><span class="strip-fill" /></button>
      </div>
    </figure>
    <figure class="heat">
      <figcaption class="heat-cap">When you're active <span v-if="peak" class="muted">· busiest {{ peak }}</span></figcaption>
      <div class="heat-grid" role="img" :aria-label="heatLabel">
        <template v-for="row in grid" :key="row.d">
          <span class="heat-d" aria-hidden="true">{{ row.d[0] }}</span>
          <span v-for="cell in row.cells" :key="cell.hour" class="heat-c" :style="{ '--v': cell.v }" :title="`${row.d} ${cell.hour}:00 UTC · ${cell.n}`" aria-hidden="true" />
        </template>
        <span aria-hidden="true" />
        <span v-for="hr in 24" :key="`h${hr}`" class="heat-h" aria-hidden="true">{{ (hr - 1) % 6 === 0 ? `${hr - 1}h` : '' }}</span>
      </div>
    </figure>
    </div>
  </section>
</template>

<style scoped>
.you { display: flex; flex-direction: column; gap: var(--card-gap); }
.you-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem; align-items: flex-end; }
.you-name { margin: 0; font-family: var(--font-chrome); font-size: 1.05rem; color: var(--text-white); }
.you-meta { margin: 0.1rem 0 0; font-size: 0.74rem; color: var(--text-gray); }
.you-next { margin: 0; display: flex; gap: 0.45rem; align-items: baseline; font-size: 0.76rem; padding: 0.35rem 0.6rem; border-radius: var(--radius-md, 8px); border: 1px dashed var(--edge-raised, rgba(255,255,255,0.09)); max-width: 100%; }
.you-next-k { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.62rem; color: var(--text-gray); }
.you-next-v { color: var(--text-white); overflow-wrap: anywhere; }
.you-next-t { color: var(--primary-blue); white-space: nowrap; }

.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--card-gap); }
.tile { background: var(--surface-raised); border: 1px solid var(--edge-soft); border-top: 2px solid var(--lane); border-radius: var(--radius-md, 8px); padding: var(--card-pad); min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.tile-k { margin: 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lane); }
.tile-big { margin: 0; font-size: 0.85rem; color: var(--text-light-gray); }
.tile-big .num { font-size: 1.35rem; font-weight: 700; color: var(--text-white); }
.tile-sub { font-size: 0.72rem; color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.num[data-tone='up'] { color: var(--app-color-up) !important; }
.num[data-tone='down'] { color: var(--app-color-down) !important; }
.facts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.74rem; color: var(--text-light-gray); }
.facts b { color: var(--text-white); font-weight: 600; }
.facts a, .you a { color: var(--primary-blue); text-decoration: none; }
.facts a:hover { text-decoration: underline; }
.facts a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; border-radius: 2px; }
.recent { color: var(--text-gray); }
.muted, .empty { color: var(--text-gray); }
.chip-sample { margin-left: 0.35rem; font-size: 0.62rem; padding: 0.1rem 0.35rem; border-radius: var(--radius-sm, 4px); color: var(--warning-orange); background: color-mix(in oklch, var(--warning-orange) 12%, transparent); }

.you-foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 26rem); gap: var(--card-gap) 1.25rem; align-items: start; }
.you-foot > .heat:only-child { grid-column: 1 / -1; max-width: 26rem; }
@media (max-width: 760px) { .you-foot { grid-template-columns: minmax(0, 1fr); } }
.strip { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.strip-bars { display: flex; align-items: flex-end; gap: 3px; height: 3.2rem; border-bottom: 1px solid var(--edge-raised); }
.strip-b { all: unset; cursor: pointer; flex: 1 1 0; max-width: 2.2rem; min-width: 4px; height: 100%; display: flex; align-items: flex-end; }
.strip-fill { display: block; width: 100%; height: var(--h); border-radius: 2px 2px 0 0; background: color-mix(in oklch, var(--app-color-down) 45%, transparent); border-top: 2px solid var(--app-color-down); box-sizing: border-box; }
.strip-b[data-right='true'] .strip-fill { background: var(--app-color-up); border-top-color: var(--app-color-up); }
.strip-b:hover .strip-fill, .strip-b:focus-visible .strip-fill { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.heat-h { font-size: 0.6rem; color: var(--text-gray); white-space: nowrap; overflow: visible; line-height: 1.2; }
.heat { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.heat-cap { font-size: 0.7rem; color: var(--text-light-gray); }
.heat-grid { display: grid; grid-template-columns: 0.9rem repeat(24, minmax(0, 1fr)); gap: 2px; }
.heat-d { font-size: 0.6rem; color: var(--text-gray); line-height: 10px; }
.heat-c { height: 10px; border-radius: 2px; background: color-mix(in oklch, var(--primary-blue) calc(var(--v) * 85%), rgba(255,255,255,0.04)); }

@media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
</style>
