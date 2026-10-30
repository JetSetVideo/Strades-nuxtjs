<script setup lang="ts">
/**
 * "You, as your behaviour reads": declared vs behaviour-read code, the four axes, archetype, metrics,
 * strengths / weaknesses and coaching advice. These are behavioural reads, not a psychology diagnosis.
 */
import { computed, ref } from 'vue'
import {
  axisBar, axisRead, codeAgreement, intelHour, intelPct, isNewcomer, metricRows, severityTone,
  type IntelLastRun, type IntelProfile,
} from '~/utils/intelligence'

const props = defineProps<{
  profile: IntelProfile | null
  lastRun: IntelLastRun | null
  refreshing: boolean
  refreshError: string | null
  refreshedAt: number | null
}>()
const emit = defineEmits<{ refresh: [] }>()

const newcomer = computed(() => isNewcomer(props.profile))
const code = computed(() => codeAgreement(props.profile?.code_declared, props.profile?.code_inferred))
const axes = computed(() => (props.profile?.axes ?? []).map(a => ({ a, read: axisRead(a), bar: axisBar(a.value) })))
const metrics = computed(() => metricRows(props.profile?.metrics))
const openMetric = ref<string | null>(null)
const mix = computed(() => Object.entries(props.profile?.asset_mix ?? {}).sort((a, b) => b[1] - a[1]))
const hours = computed(() => {
  const h = props.profile?.hours ?? []
  const max = Math.max(0.0001, ...h)
  return h.map((v, i) => ({ i, v: v / max }))
})
const stats = computed(() => props.profile?.stats ?? null)
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
</script>

<template>
  <section class="pc" aria-labelledby="pc-title">
    <header class="pc-head">
      <div class="pc-id">
        <p class="pc-k">Your behaviour reads as</p>
        <h2 id="pc-title" class="pc-arch">{{ newcomer ? 'Still reading you' : profile?.archetype }}</h2>
        <p class="pc-meta">
          <template v-if="profile">
            Last {{ profile.window_days }} days · read {{ when(profile.computed_at) }}
            <template v-if="!newcomer"> · confidence <b class="num">{{ intelPct(profile.code_confidence) }}</b></template>
          </template>
          <template v-if="lastRun"> · community run {{ when(lastRun.at) }} ({{ lastRun.users }} people, {{ lastRun.pairs }} pairs, {{ lastRun.groups }} rooms)</template>
        </p>
      </div>
      <div class="pc-act">
        <button type="button" class="btn" :disabled="refreshing" @click="emit('refresh')">{{ refreshing ? 'Re-analysing…' : 'Re-analyse me now' }}</button>
        <p v-if="refreshError" class="pc-err" role="alert">{{ refreshError }}</p>
        <p v-else-if="refreshedAt && !refreshing" class="pc-ok" role="status">Updated just now.</p>
      </div>
    </header>

    <div v-if="newcomer" class="pc-new">
      <p class="pc-new-t">We need a little more of you before we can read your style.</p>
      <ol class="pc-steps">
        <li>Make <b>3 calls</b> on <NuxtLink to="/prices">Prices</NuxtLink> (up or down, with a target date).</li>
        <li>Read a couple of articles on <NuxtLink to="/news">News</NuxtLink> and say hi in a room.</li>
        <li>Come back and press <b>Re-analyse me now</b>.</li>
      </ol>
      <p class="muted">Your rooms already appear below. Pairs show up once you and someone else have called the same assets.</p>
    </div>

    <template v-else-if="profile">
      <div class="codes">
        <div class="code-box">
          <span class="code-k">You say</span>
          <span class="code-v num">{{ profile.code_declared || '—' }}</span>
        </div>
        <div class="code-box" data-main="true">
          <span class="code-k">Behaviour reads as</span>
          <span class="code-v num">
            <span v-for="(l, i) in code.known ? code.letters : []" :key="i" :data-same="l.same">{{ l.inferred }}</span>
            <template v-if="!code.known">{{ profile.code_inferred || '—' }}</template>
          </span>
        </div>
        <p class="code-note">
          <template v-if="code.known">{{ code.matches }} of 4 letters match what you declared. Letters that differ are dimmed; </template>
          the read comes from how you call, read and chat, not from a test.
        </p>
      </div>

      <ul class="axes" aria-label="Four behaviour axes">
        <li v-for="x in axes" :key="x.a.key" class="axis">
          <span class="axis-l" :data-on="x.a.value < 0">{{ x.a.neg }} <small>{{ x.a.neg_label }}</small></span>
          <span class="axis-track" role="img" :aria-label="x.read.words">
            <span class="axis-mid" />
            <span class="axis-fill" :style="{ left: `${x.bar.left}%`, width: `${x.bar.width}%` }" />
          </span>
          <span class="axis-r" :data-on="x.a.value > 0"><small>{{ x.a.pos_label }}</small> {{ x.a.pos }}</span>
          <span class="axis-w">{{ x.read.words }}</span>
        </li>
      </ul>

      <div class="grid2">
        <div>
          <h3 class="sub">Metrics <span class="muted">· tap a row for what it means</span></h3>
          <ul class="metrics">
            <li v-for="m in metrics" :key="m.key">
              <button type="button" class="metric" :aria-expanded="openMetric === m.key" @click="openMetric = openMetric === m.key ? null : m.key">
                <span class="metric-l">{{ m.label }}</span>
                <span v-if="m.bar !== null" class="metric-bar" aria-hidden="true"><span :style="{ width: `${m.bar * 100}%` }" /></span>
                <span class="metric-v num">{{ m.display }}</span>
              </button>
              <p v-if="openMetric === m.key" class="metric-x">{{ m.explain }}</p>
            </li>
          </ul>
          <p v-if="stats" class="muted small">
            Based on {{ stats.calls ?? 0 }} calls ({{ stats.resolved ?? 0 }} resolved<template v-if="stats.pending">, {{ stats.pending }} pending</template>). Scores are paper call accuracy, never money.
          </p>
        </div>
        <div class="side">
          <div v-if="mix.length">
            <h3 class="sub">What you call</h3>
            <div class="mix" role="img" :aria-label="mix.map(([k, v]) => `${k} ${intelPct(v)}`).join(', ')">
              <span v-for="([k, v], i) in mix" :key="k" class="mix-seg" :data-i="i % 4" :style="{ flexGrow: v }" />
            </div>
            <p class="mix-legend"><span v-for="([k, v], i) in mix" :key="k"><i :data-i="i % 4" />{{ k }} <b class="num">{{ intelPct(v) }}</b></span></p>
          </div>
          <div v-if="hours.length === 24">
            <h3 class="sub">When you're active <span class="muted">· UTC</span></h3>
            <div class="hours" role="img" :aria-label="`Activity by hour (UTC), peak ${intelHour(profile.metrics?.peak_hour_utc)}`">
              <span v-for="h in hours" :key="h.i" class="hour" :style="{ '--v': h.v }" />
            </div>
            <p class="hours-axis" aria-hidden="true"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></p>
          </div>
          <div v-if="profile.strengths.length">
            <h3 class="sub">Strengths</h3>
            <ul class="list" data-tone="up"><li v-for="s in profile.strengths" :key="s">{{ s }}</li></ul>
          </div>
          <div v-if="profile.weaknesses?.length">
            <h3 class="sub">Watch out for</h3>
            <ul class="list" data-tone="warn"><li v-for="s in profile.weaknesses" :key="s">{{ s }}</li></ul>
          </div>
        </div>
      </div>

      <div v-if="profile.advice?.length" class="advice">
        <article v-for="a in profile.advice" :key="a.key" class="adv" :data-tone="severityTone(a.severity)">
          <h4 class="adv-t">{{ a.title }}</h4>
          <p class="adv-b">{{ a.body }}</p>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.pc { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; }
.pc-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.6rem 1rem; align-items: flex-end; }
.pc-id { min-width: 0; }
.pc-k { margin: 0; font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-gray); }
.pc-arch { margin: 0.1rem 0; font-size: 1.15rem; color: var(--text-white); }
.pc-meta { margin: 0; font-size: 0.72rem; color: var(--text-gray); }
.pc-act { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; max-width: 100%; }
.pc-err { margin: 0; font-size: 0.7rem; color: var(--warning-orange); max-width: 22rem; text-align: right; }
.pc-ok { margin: 0; font-size: 0.7rem; color: var(--text-gray); }
.btn {
  all: unset; cursor: pointer; font-size: 0.78rem; font-weight: 600; color: var(--secondary-darker);
  background: var(--primary-blue); padding: 0.45rem 0.85rem; border-radius: var(--radius-md); min-height: 24px;
}
.btn:disabled { opacity: 0.6; cursor: progress; }
.btn:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }

.pc-new { border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); padding: var(--card-pad); display: flex; flex-direction: column; gap: 0.4rem; }
.pc-new-t { margin: 0; font-size: 0.9rem; color: var(--text-white); }
.pc-steps { margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
.pc a { color: var(--primary-blue); text-decoration: none; }
.pc a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }

.codes { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: stretch; }
.code-box { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.45rem 0.7rem; border-radius: var(--radius-md); border: 1px solid var(--edge-raised); background: var(--surface-raised); }
.code-box[data-main='true'] { border-color: color-mix(in oklch, var(--primary-blue) 50%, transparent); }
.code-k { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-gray); }
.code-v { font-size: 1.3rem; font-weight: 700; color: var(--text-white); letter-spacing: 0.12em; }
.code-v [data-same='false'] { color: var(--text-gray); text-decoration: underline dotted; }
.code-note { flex: 1 1 14rem; margin: 0; align-self: center; font-size: 0.72rem; color: var(--text-gray); }

.axes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.axis { display: grid; grid-template-columns: minmax(0, 7.5rem) minmax(0, 1fr) minmax(0, 7.5rem); gap: 0.15rem 0.5rem; align-items: center; }
.axis-l, .axis-r { font-size: 0.8rem; font-weight: 700; color: var(--text-gray); font-family: var(--font-market-data); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.axis-r { text-align: right; }
.axis-l small, .axis-r small { font-family: var(--font-chrome); font-weight: 400; font-size: 0.66rem; }
.axis-l[data-on='true'], .axis-r[data-on='true'] { color: var(--text-white); }
.axis-track { position: relative; height: 0.55rem; border-radius: 999px; background: rgba(255,255,255,0.05); }
.axis-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.axis-fill { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: var(--primary-blue); }
.axis-w { grid-column: 1 / -1; font-size: 0.68rem; color: var(--text-gray); text-align: center; }

.grid2 { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: var(--card-gap) 1.25rem; }
.side { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
@media (max-width: 760px) { .grid2 { grid-template-columns: minmax(0, 1fr); } .axis { grid-template-columns: 2.6rem minmax(0, 1fr) 2.6rem; } .axis-l small, .axis-r small { display: none; } }
.sub { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.sub .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.metrics { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.metric { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; padding: 0.25rem 0.3rem; border-radius: var(--radius-sm); min-height: 24px; }
.metric:hover { background: var(--nav-hover-bg); }
.metric:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.metric-l { font-size: 0.76rem; color: var(--text-light-gray); }
.metric-bar { grid-column: 2; height: 0.35rem; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
.metric-bar span { display: block; height: 100%; background: color-mix(in oklch, var(--primary-blue) 75%, transparent); }
.metric-v { grid-column: 3; font-size: 0.74rem; color: var(--text-white); text-align: right; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 420px) { .metric { grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) minmax(0, auto); } }
.metric-x { margin: 0 0.3rem 0.3rem; font-size: 0.7rem; color: var(--text-gray); }
.small { font-size: 0.68rem; margin: 0.4rem 0 0; }
.muted { color: var(--text-gray); }

.mix { display: flex; height: 0.55rem; border-radius: 999px; overflow: hidden; gap: 2px; }
.mix-seg { flex-basis: 0; min-width: 3px; }
.mix-seg[data-i='0'], .mix-legend i[data-i='0'] { background: var(--primary-blue); }
.mix-seg[data-i='1'], .mix-legend i[data-i='1'] { background: var(--domain-agent); }
.mix-seg[data-i='2'], .mix-legend i[data-i='2'] { background: var(--domain-social); }
.mix-seg[data-i='3'], .mix-legend i[data-i='3'] { background: var(--text-gray); }
.mix-legend { margin: 0.3rem 0 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.7rem; font-size: 0.7rem; color: var(--text-light-gray); text-transform: capitalize; }
.mix-legend i { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 2px; margin-right: 0.25rem; }
.hours { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); gap: 2px; align-items: end; height: 2.2rem; }
.hour { height: calc(8% + var(--v) * 92%); border-radius: 2px 2px 0 0; background: color-mix(in oklch, var(--primary-blue) calc(25% + var(--v) * 75%), transparent); }
.hours-axis { margin: 0.15rem 0 0; display: flex; justify-content: space-between; font-size: 0.58rem; color: var(--text-gray); }
.list { margin: 0; padding-left: 1rem; font-size: 0.76rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
.list[data-tone='up'] li::marker { color: var(--primary-green); }
.list[data-tone='warn'] li::marker { color: var(--warning-orange); }

.advice { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: var(--card-gap); }
.adv { padding: 0.6rem 0.75rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); border-left: 3px solid var(--primary-blue); }
.adv[data-tone='warn'] { border-left-color: var(--warning-orange); }
.adv[data-tone='up'] { border-left-color: var(--primary-green); }
.adv[data-tone='down'] { border-left-color: var(--error-red); }
.adv-t { margin: 0 0 0.2rem; font-size: 0.8rem; color: var(--text-white); }
.adv-b { margin: 0; font-size: 0.74rem; color: var(--text-light-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
