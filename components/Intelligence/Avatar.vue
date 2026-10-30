<script setup lang="ts">
/**
 * "Your avatar": the copy of you that re-weighs your calls with what it learned from your record (by asset
 * class × horizon), your allies' record against you, and how far your targets usually overshoot. Raw (you)
 * vs avatar on the same resolved paper calls, what it learned, and your open calls as it would make them.
 */
import { computed, ref } from 'vue'
import {
  intelAllyRows, intelAvatarRows, intelBiasWords, intelOpenRows, intelTargetScaleWords, intelTrustRows,
  type IntelAvatar,
} from '~/utils/intelligenceV2'

const props = defineProps<{ avatar: IntelAvatar | null | undefined }>()

const ev = computed(() => props.avatar?.evaluation ?? null)
const rows = computed(() => intelAvatarRows(ev.value))
const params = computed(() => props.avatar?.params ?? null)
const trust = computed(() => intelTrustRows(params.value?.by_class_horizon))
const allies = computed(() => intelAllyRows(props.avatar?.allies))
const open = computed(() => intelOpenRows(props.avatar?.open))
const LIMIT = 8
const showAll = ref(false)
const openShown = computed(() => (showAll.value ? open.value : open.value.slice(0, LIMIT)))
const openRow = ref<string | null>(null)
const explainRow = ref<string | null>(null)
const pct = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—')
const TONE: Record<string, string> = { better: 'avatar better', worse: 'you better', same: 'same' }
const better = computed(() => rows.value.filter(r => r.tone === 'better').length)
</script>

<template>
  <div class="av">
    <div v-if="!ev || !ev.n" class="empty">
      <p class="empty-t">Your avatar has nothing to learn from yet.</p>
      <p>It learns from your resolved calls. Make a few calls with a target date and come back after they resolve: it will then show where it would have done better or worse than you.</p>
    </div>

    <template v-else>
      <section>
        <h3 class="sub">You vs your avatar <span class="muted">· same {{ ev.n }} resolved paper calls · tap a row</span></h3>
        <table class="tbl">
          <thead><tr><th scope="col">Measure</th><th scope="col" class="r">You</th><th scope="col" class="r">Avatar</th><th scope="col" class="r">Verdict</th></tr></thead>
          <tbody>
            <template v-for="r in rows" :key="r.key">
              <tr class="tr-click" :aria-expanded="explainRow === r.key" tabindex="0" @click="explainRow = explainRow === r.key ? null : r.key" @keydown.enter="explainRow = explainRow === r.key ? null : r.key">
                <th scope="row">{{ r.label }}</th>
                <td class="r num">{{ r.raw }}</td>
                <td class="r num">{{ r.avatar }}</td>
                <td class="r"><span class="tone" :data-tone="r.tone">{{ TONE[r.tone] }}</span></td>
              </tr>
              <tr v-if="explainRow === r.key" class="x"><td colspan="4">{{ r.explain }}</td></tr>
            </template>
          </tbody>
        </table>
        <p class="cap">
          <template v-if="better">The avatar does better on {{ better }} of {{ rows.length }} measures.</template>
          <template v-else>The avatar does not beat you yet: your own calls hold up.</template>
          It flipped your direction on {{ ev.flips }} call{{ ev.flips === 1 ? '' : 's' }}<template v-if="ev.flips && ev.flip_hit !== null"> and was right on {{ pct(ev.flip_hit) }} of those</template>.
          <template v-if="ev.with_allies !== null"> Allies weighed in on {{ pct(ev.with_allies) }} of calls.</template>
        </p>
      </section>

      <section v-if="params">
        <h3 class="sub">What the avatar learned</h3>
        <ul class="learned">
          <li><b>Targets.</b> {{ intelTargetScaleWords(params.target_scale) }}</li>
          <li><b>Bias.</b> On average your {{ intelBiasWords(params.bias_pts) }}.</li>
          <li><b>Your record.</b> {{ pct(params.own_record.hit) }} right on {{ params.own_record.n }} calls.</li>
        </ul>
        <template v-if="trust.length">
          <h4 class="sub2">Trust in your direction, by class × horizon</h4>
          <ul class="trust">
            <li v-for="t in trust" :key="t.label">
              <span class="t-l">{{ t.label }}</span>
              <span class="track" role="img" :aria-label="`${t.label}: trust ${pct(t.trust)}, ${t.words}, ${t.n} calls`">
                <span class="coin" /><span class="fill" :style="{ width: `${t.bar * 100}%` }" />
              </span>
              <span class="num t-v">{{ pct(t.trust) }}</span>
              <span class="t-w">{{ t.words }} · n {{ t.n }}</span>
            </li>
          </ul>
        </template>
        <template v-if="allies.length">
          <h4 class="sub2">Allies it listens to</h4>
          <div class="ally-wrap">
            <table class="tbl">
              <thead><tr><th scope="col">Ally</th><th scope="col" class="r">Overall</th><th scope="col" class="r">Disagreeing</th><th scope="col" class="r">Agreeing</th></tr></thead>
              <tbody>
                <tr v-for="a in allies" :key="a.id">
                  <th scope="row">{{ a.name }}<span v-if="a.useful" class="chip">worth hearing</span></th>
                  <td class="r num">{{ a.record }}</td>
                  <td class="r num">{{ a.disagreeing }}</td>
                  <td class="r num">{{ a.agreeing }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="cap">"Disagreeing": how often they were right on calls where they took the other side of yours.</p>
        </template>
        <p v-if="avatar?.method" class="cap muted">Method: {{ avatar.method }}.</p>
      </section>

      <section>
        <h3 class="sub">Your open calls, as the avatar sees them <span class="muted">· tap a call</span></h3>
        <p v-if="!open.length" class="cap">No open call right now. Make one with a target date and the avatar will weigh it here.</p>
        <ul class="open">
          <li v-for="o in openShown" :key="o.key">
            <button type="button" class="o" :aria-expanded="openRow === o.key" @click="openRow = openRow === o.key ? null : o.key">
              <span class="o-a"><b class="num">{{ o.asset }}</b> <span class="side" :data-side="o.side">{{ o.side === 'up' ? '▲ up' : '▼ down' }}</span> <span class="muted">by {{ o.target }}</span></span>
              <span class="o-bars">
                <span class="pb"><span class="pb-k">you</span><span class="pb-t"><span class="pb-f u" :style="{ width: `${o.pUser * 100}%` }" /></span><span class="num">{{ pct(o.pUser) }}</span></span>
                <span class="pb"><span class="pb-k">avatar</span><span class="pb-t"><span class="pb-f a" :style="{ width: `${o.pAvatar * 100}%` }" /></span><span class="num">{{ pct(o.pAvatar) }}</span></span>
              </span>
              <span class="o-v" :data-agree="o.agrees">{{ o.agrees ? 'agrees' : 'would flip it' }}</span>
            </button>
            <div v-if="openRow === o.key" class="o-x">
              <p>You call <span class="num">{{ o.chg }}</span>; the avatar's target is <span class="num">{{ o.adjChg }}</span><template v-if="o.adjPrice !== '—'"> (price <span class="num">{{ o.adjPrice }}</span>)</template>. Made {{ o.made }}.</p>
              <p v-if="o.allies_for.length">With you: {{ o.allies_for.join(', ') }}</p>
              <p v-if="o.allies_against.length">Against you: {{ o.allies_against.join(', ') }}</p>
              <p v-if="!o.allies_for.length && !o.allies_against.length" class="muted">No ally called this asset for that date.</p>
            </div>
          </li>
        </ul>
        <button v-if="open.length > LIMIT" type="button" class="more" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show all ${open.length}` }}</button>
        <p class="cap muted">Probabilities are the chance the direction is right. Paper calls only, never money.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.av { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.empty { border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); padding: var(--card-pad); font-size: 0.8rem; color: var(--text-light-gray); }
.empty p { margin: 0 0 0.3rem; }
.empty-t { color: var(--text-white); }
section { min-width: 0; }
.sub { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.sub .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.sub2 { margin: 0.6rem 0 0.3rem; font-size: 0.72rem; font-weight: 600; color: var(--text-light-gray); }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.74rem; color: var(--text-light-gray); }
.tbl th, .tbl td { padding: 0.3rem 0.35rem; border-bottom: 1px solid var(--edge-soft); text-align: left; font-weight: 400; }
.tbl thead th { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.tbl tbody th { color: var(--text-white); }
.r { text-align: right !important; }
.tr-click { cursor: pointer; }
.tr-click:hover { background: var(--nav-hover-bg); }
.tr-click:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: -2px; }
.x td { font-size: 0.68rem; color: var(--text-gray); }
.tone { font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 999px; border: 1px solid var(--edge-raised); white-space: nowrap; }
.tone[data-tone='better'] { border-color: var(--primary-green); color: var(--primary-green); }
.tone[data-tone='worse'] { border-color: var(--warning-orange); color: var(--warning-orange); }
.cap { margin: 0.35rem 0 0; font-size: 0.7rem; color: var(--text-light-gray); }
.learned { margin: 0; padding-left: 1rem; font-size: 0.74rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
.learned b { color: var(--text-white); font-weight: 600; }
.trust { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.trust li { display: grid; grid-template-columns: minmax(0, 8rem) minmax(0, 1fr) 2.5rem; gap: 0.1rem 0.5rem; align-items: center; }
.t-l { font-size: 0.72rem; color: var(--text-light-gray); text-transform: capitalize; }
.t-v { font-size: 0.72rem; color: var(--text-white); text-align: right; }
.t-w { grid-column: 1 / -1; font-size: 0.62rem; color: var(--text-gray); }
.track { position: relative; height: 0.45rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
.coin { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: color-mix(in oklch, var(--domain-agent) 80%, transparent); }
.ally-wrap { overflow-x: auto; max-width: 100%; }
.chip { margin-left: 0.35rem; font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.3rem; border-radius: 999px; border: 1px solid var(--primary-green); color: var(--primary-green); }
.open { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.o { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto; gap: 0.3rem 0.6rem; align-items: center; padding: 0.4rem 0.5rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); min-height: 24px; }
@media (max-width: 520px) { .o { grid-template-columns: minmax(0, 1fr) auto; } .o-bars { grid-column: 1 / -1; grid-row: 2; } }
.o:focus-visible, .more:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.o-a { font-size: 0.74rem; color: var(--text-white); min-width: 0; }
.side { font-size: 0.68rem; }
.side[data-side='up'] { color: var(--app-color-up); }
.side[data-side='down'] { color: var(--app-color-down); }
.o-bars { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.pb { display: grid; grid-template-columns: 2.8rem minmax(0, 1fr) 2.2rem; gap: 0.35rem; align-items: center; font-size: 0.62rem; color: var(--text-gray); }
.pb .num { text-align: right; color: var(--text-light-gray); }
.pb-t { height: 0.35rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
.pb-f { display: block; height: 100%; }
.pb-f.u { background: var(--primary-blue); }
.pb-f.a { background: var(--domain-agent); }
.o-v { font-size: 0.64rem; color: var(--text-gray); white-space: nowrap; }
.o-v[data-agree='false'] { color: var(--warning-orange); }
.o-x { font-size: 0.7rem; color: var(--text-light-gray); padding: 0.3rem 0.6rem; }
.o-x p { margin: 0 0 0.2rem; }
.more { all: unset; cursor: pointer; margin-top: 0.35rem; font-size: 0.72rem; color: var(--primary-blue); min-height: 24px; }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
