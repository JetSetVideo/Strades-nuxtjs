<script setup lang="ts">
/**
 * "Distance from truth": how far your resolved paper calls were from what happened (predicted move − realised
 * move, in % points), when and on what you are at your best, calibration per confidence level and the weekly
 * series (past, this week, weeks your open calls resolve). Click any bar, day or week to read it.
 */
import { computed, ref, useId, watch } from 'vue'
import {
  INTEL_DAYPART_LABEL, INTEL_HORIZON_LABEL, intelBiasWords, intelCalibrationRows, intelCellLine, intelDayLabel, intelErrorBars,
  intelRankWords, intelTiltWords, intelTruthEmpty, intelTruthWeekGeometry, intelWeekdayHeat, type IntelTruth,
} from '~/utils/intelligenceV2'
import { weekDate, weekOffsetLabel } from '~/utils/intelligence'

const props = defineProps<{ truth: IntelTruth | null | undefined }>()

const empty = computed(() => intelTruthEmpty(props.truth))
const s = computed(() => props.truth?.summary ?? null)
const cm = computed(() => props.truth?.community ?? null)
const pct = (v: number | null | undefined, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—')
const num = (v: number | null | undefined, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—')

const EW = 320
const EH = 90
const err = computed(() => intelErrorBars(props.truth?.error_hist, EW, EH, 4))
const errPick = ref<number | null>(null)
const errSel = computed(() => err.value.bars.find(b => b.i === errPick.value) ?? null)

const cal = computed(() => intelCalibrationRows(props.truth?.calibration))

const TW = 440
const TH = 120
const weeks = computed(() => props.truth?.weeks ?? [])
const tg = computed(() => intelTruthWeekGeometry(weeks.value, TW, TH, 10))
const nowWeek = computed(() => weeks.value.find(w => w.phase === 'now')?.week ?? null)
const wkPick = ref<number | null>(null)
watch(weeks, () => { wkPick.value = nowWeek.value }, { immediate: true })
const wkSel = computed(() => weeks.value.find(w => w.week === wkPick.value) ?? null)
const colW = computed(() => Math.max(6, tg.value.step || TW))
const hatch = `tr-hatch-${useId()}`

const heat = computed(() => intelWeekdayHeat(props.truth?.weekdays))
const dayPick = ref<number | null>(null)
const daySel = computed(() => heat.value.find(h => h.i === dayPick.value) ?? null)
const parts = computed(() => props.truth?.dayparts ?? [])
const partPick = ref<string | null>(null)

const tz = computed(() => {
  const o = props.truth?.tz_offset
  return typeof o === 'number' ? `UTC${o >= 0 ? '+' : '−'}${Math.abs(o)}` : 'your local time'
})
</script>

<template>
  <div class="tr">
    <div v-if="empty" class="tr-empty">
      <p class="tr-empty-t">No resolved call yet<template v-if="truth?.pending">, {{ truth.pending }} waiting for their target date</template>.</p>
      <p>Make a few calls with a target date on <NuxtLink to="/prices">Prices</NuxtLink> and come back after they resolve: we then show how far each was from what really happened.</p>
    </div>

    <template v-else-if="truth && s">
      <ul class="kpis">
        <li><span class="k">Resolved calls</span><b class="num">{{ truth.n }}</b><small>{{ truth.pending }} pending</small></li>
        <li><span class="k">Direction right</span><b class="num">{{ pct(s.hit) }}</b><small>{{ intelRankWords(cm?.hit) }}</small></li>
        <li><span class="k">Mean score</span><b class="num">{{ num(s.score, 0) }}/100</b><small>{{ intelRankWords(cm?.score) }}</small></li>
        <li><span class="k">Distance from truth</span><b class="num">{{ num(s.abs_err) }} pts</b><small>{{ intelRankWords(cm?.abs_err, true) }}</small></li>
        <li><span class="k">Brier skill</span><b class="num">{{ num(s.brier_skill, 3) }}</b><small>{{ intelRankWords(cm?.brier_skill) }}</small></li>
      </ul>
      <p class="lead">
        On average your {{ intelBiasWords(s.bias) }}. Half your calls landed within <b class="num">{{ num(s.median_abs_err) }} pts</b>
        of the realised move, {{ pct(s.within_1pt) }} within 1 pt; 8 in 10 errors fall between
        <span class="num">{{ num(s.p10_err) }}</span> and <span class="num">{{ num(s.p90_err) }}</span> pts. Scores are paper call accuracy, never money.
      </p>

      <div class="grid2">
        <section>
          <h3 class="sub">How far off <span class="muted">· tap a bar</span></h3>
          <svg :viewBox="`0 0 ${EW} ${EH}`" class="svg" role="img" :aria-label="`Error distribution over ${err.total} calls: ${err.bars.map(b => `${b.label} pts ${b.count}`).join(', ')}`">
            <rect
              v-for="b in err.bars" :key="b.i" :x="b.x" :y="b.y" :width="b.w" :height="Math.max(b.h, 1)" class="ebar"
              :data-picked="errPick === b.i" @click="errPick = errPick === b.i ? null : b.i"
            />
            <rect v-for="b in err.bars" :key="`h${b.i}`" :x="b.x" y="0" :width="b.w" :height="EH" class="hit" @click="errPick = errPick === b.i ? null : b.i" />
          </svg>
          <div class="ticks"><span v-for="b in err.bars" :key="b.i">{{ b.label }}</span></div>
          <p class="cap">
            <template v-if="errSel"><b>{{ errSel.label }} pts off</b>: {{ errSel.count }} call{{ errSel.count === 1 ? '' : 's' }} ({{ pct(errSel.share) }})</template>
            <template v-else>Points between your target move and the move that happened.</template>
          </p>
        </section>

        <section>
          <h3 class="sub">Calibration <span class="muted">· are you right as often as you say?</span></h3>
          <ul class="cal">
            <li v-for="c in cal" :key="c.conf" class="cal-row" :data-tone="c.tone">
              <span class="cal-l">Confidence {{ c.conf }}</span>
              <span class="cal-track" role="img" :aria-label="`Confidence ${c.conf}: promises ${pct(c.expected)}, you hit ${pct(c.hit)} on ${c.n} calls`">
                <span class="cal-fill" :style="{ width: `${(c.hit ?? 0) * 100}%` }" />
                <span class="cal-exp" :style="{ left: `${c.expected * 100}%` }" />
              </span>
              <span class="cal-v num">{{ pct(c.hit) }}</span>
              <span class="cal-w">{{ c.words }} · promises {{ pct(c.expected) }} · n {{ c.n }}</span>
            </li>
          </ul>
          <p class="cap"><i class="lg-exp" /> = what that confidence level promises.</p>
        </section>
      </div>

      <section>
        <h3 class="sub">Week by week <span class="muted">· past, now and the weeks your open calls resolve</span></h3>
        <svg :viewBox="`0 0 ${TW} ${TH}`" class="svg" role="img" aria-label="Mean score per week; bars are resolved calls in the past and calls due in future weeks">
          <defs>
            <pattern :id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hatch" /></pattern>
          </defs>
          <rect v-if="tg.pastEnd !== null" x="0" y="0" :width="tg.pastEnd" :height="TH" class="band-past" />
          <rect v-if="tg.futureStart !== null" :x="tg.futureStart" y="0" :width="TW - tg.futureStart" :height="TH" :fill="`url(#${hatch})`" />
          <line x1="10" :x2="TW - 10" :y1="TH / 2" :y2="TH / 2" class="grid" />
          <rect v-for="b in tg.bars" :key="`b${b.w.week}`" :x="b.x - Math.min(6, colW / 3)" :y="b.y" :width="Math.min(12, (colW * 2) / 3)" :height="b.h" class="wbar" :data-future="b.future" />
          <path :d="tg.path" class="line" />
          <circle v-for="p in tg.points.filter(q => q.y !== null)" :key="`p${p.w.week}`" :cx="p.x" :cy="p.y!" r="3" class="dot" />
          <line v-if="tg.nowX !== null" :x1="tg.nowX" :x2="tg.nowX" y1="0" :y2="TH" class="now" />
          <rect v-for="p in tg.points" :key="`h${p.w.week}`" :x="p.x - colW / 2" y="0" :width="colW" :height="TH" class="hit" :data-picked="wkPick === p.w.week" @click="wkPick = p.w.week" />
        </svg>
        <div class="wk-row" role="group" aria-label="Pick a week">
          <button
            v-for="w in weeks" :key="w.week" type="button" class="wk" :data-phase="w.phase" :data-has="w.n > 0 || w.pending > 0"
            :aria-pressed="wkPick === w.week" :aria-label="weekOffsetLabel(w.week, nowWeek)" @click="wkPick = w.week"
          />
        </div>
        <p v-if="wkSel" class="cap">
          <b>{{ weekOffsetLabel(wkSel.week, nowWeek) }}</b> <span class="muted">(week of {{ weekDate(wkSel.week) }})</span> ·
          <template v-if="wkSel.n">{{ intelCellLine(wkSel) }} · {{ intelBiasWords(wkSel.bias) }}</template>
          <template v-else>no resolved call</template>
          <template v-if="wkSel.pending"> · {{ wkSel.pending }} open call{{ wkSel.pending === 1 ? '' : 's' }} due</template>
        </p>
        <p class="legend"><i class="lg-line" />mean score <i class="lg-bar" />resolved calls <i class="lg-due" />calls due <i class="lg-fut" />future</p>
      </section>

      <div class="grid2">
        <section>
          <h3 class="sub">By weekday <span class="muted">· {{ tz }}</span></h3>
          <div class="heat" role="group" aria-label="Score by weekday">
            <button
              v-for="h in heat" :key="h.i" type="button" class="hd" :aria-pressed="dayPick === h.i"
              :style="{ '--v': h.level ?? 0 }" :data-none="h.level === null" @click="dayPick = dayPick === h.i ? null : h.i"
            >
              <span>{{ h.day }}</span><small v-if="h.best">best</small><small v-else-if="h.worst">worst</small>
            </button>
          </div>
          <p class="cap">
            <template v-if="daySel"><b>{{ daySel.day }}</b>: {{ intelCellLine(daySel) }}<template v-if="daySel.thin"> (few calls, read lightly)</template></template>
            <template v-else>Darker = higher mean score. Tap a day.</template>
          </p>
          <h3 class="sub">By time of day</h3>
          <ul class="rows">
            <li v-for="p in parts" :key="p.part">
              <button type="button" class="rowb" :aria-expanded="partPick === p.part" @click="partPick = partPick === p.part ? null : p.part">
                <span>{{ INTEL_DAYPART_LABEL[p.part] ?? p.part }}</span>
                <span class="bar"><span :style="{ width: `${p.n ? (p.score ?? 0) : 0}%` }" /></span>
                <span class="num">{{ p.n ? `${num(p.score, 0)}` : '—' }}</span>
              </button>
              <p v-if="partPick === p.part" class="cap">{{ intelCellLine(p) }} · {{ intelBiasWords(p.bias) }}</p>
            </li>
          </ul>
        </section>

        <section>
          <h3 class="sub">Best and worst days</h3>
          <ul class="list">
            <li v-for="d in truth.best_days ?? []" :key="`b${d.day_index}`" data-tone="up"><span class="tag">best</span> <b>{{ intelDayLabel(d.day_index) }}</b> · {{ intelCellLine(d) }}</li>
            <li v-for="d in truth.worst_days ?? []" :key="`w${d.day_index}`" data-tone="down"><span class="tag">worst</span> <b>{{ intelDayLabel(d.day_index) }}</b> · {{ intelCellLine(d) }}</li>
          </ul>
          <h3 class="sub">Best and worst assets</h3>
          <ul class="list">
            <li v-for="a in truth.best_assets ?? []" :key="`ba${a.asset}`" data-tone="up"><span class="tag">best</span> <b class="num">{{ a.asset }}</b> · {{ intelCellLine(a) }}</li>
            <li v-for="a in truth.worst_assets ?? []" :key="`wa${a.asset}`" data-tone="down"><span class="tag">worst</span> <b class="num">{{ a.asset }}</b> · {{ intelCellLine(a) }}</li>
          </ul>
          <h3 class="sub">By horizon and class</h3>
          <ul class="list">
            <li v-for="h in truth.horizons ?? []" :key="h.horizon"><b>{{ INTEL_HORIZON_LABEL[h.horizon] ?? h.horizon }}</b> · {{ intelCellLine(h) }}</li>
            <li v-for="c in truth.classes ?? []" :key="c.cls"><b class="cap1">{{ c.cls }}</b> · {{ intelCellLine(c) }}</li>
          </ul>
        </section>
      </div>

      <ul class="notes">
        <li v-if="truth.streaks">Longest run of right calls: <b class="num">{{ truth.streaks.best }}</b> · current run: <b class="num">{{ truth.streaks.current }}</b>.</li>
        <li>{{ intelTiltWords(truth.tilt) }}</li>
        <li v-if="truth.learning">
          First half of your calls scored <b class="num">{{ num(truth.learning.first_half_score, 0) }}</b>, the second half
          <b class="num">{{ num(truth.learning.second_half_score, 0) }}</b>
          ({{ truth.learning.delta >= 0 ? 'improving' : 'slipping' }} by {{ Math.abs(truth.learning.delta).toFixed(1) }} pts).
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.tr { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
.tr-empty { border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); padding: var(--card-pad); font-size: 0.8rem; color: var(--text-light-gray); }
.tr-empty p { margin: 0 0 0.3rem; }
.tr-empty-t { color: var(--text-white); }
.tr a { color: var(--primary-blue); text-decoration: none; }
.kpis { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr)); gap: 0.5rem; }
.kpis li { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.5rem 0.65rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); min-width: 0; }
.kpis .k { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-gray); }
.kpis b { font-size: 1rem; color: var(--text-white); }
.kpis small { font-size: 0.64rem; color: var(--text-gray); }
.lead { margin: 0; font-size: 0.76rem; color: var(--text-light-gray); }
.grid2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem 1.25rem; }
@media (max-width: 760px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
section { min-width: 0; }
.sub { margin: 0 0 0.35rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.sub .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.svg { width: 100%; height: auto; display: block; }
.ebar { fill: color-mix(in oklch, var(--primary-blue) 60%, transparent); }
.ebar[data-picked='true'] { fill: var(--primary-blue); }
.hit { fill: transparent; cursor: pointer; }
.hit[data-picked='true'] { fill: rgba(255, 255, 255, 0.07); }
.ticks { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); font-size: 0.55rem; color: var(--text-gray); text-align: center; }
.cap { margin: 0.3rem 0 0; font-size: 0.7rem; color: var(--text-light-gray); }
.muted { color: var(--text-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.cal { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.cal-row { display: grid; grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) 2.8rem; gap: 0.1rem 0.5rem; align-items: center; }
.cal-l { font-size: 0.72rem; color: var(--text-light-gray); }
.cal-track { position: relative; height: 0.5rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
.cal-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--primary-blue); }
.cal-row[data-tone='over'] .cal-fill { background: var(--warning-orange); }
.cal-row[data-tone='thin'] .cal-fill { background: var(--text-gray); }
.cal-exp { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text-white); }
.cal-v { font-size: 0.72rem; color: var(--text-white); text-align: right; }
.cal-w { grid-column: 1 / -1; font-size: 0.64rem; color: var(--text-gray); }
.lg-exp { display: inline-block; width: 2px; height: 0.7rem; background: var(--text-white); vertical-align: middle; }
.band-past { fill: rgba(255, 255, 255, 0.035); }
.hatch { stroke: rgba(255, 255, 255, 0.07); stroke-width: 2; }
.grid { stroke: var(--edge-raised); stroke-dasharray: 3 3; }
.wbar { fill: color-mix(in oklch, var(--domain-agent) 45%, transparent); }
.wbar[data-future='true'] { fill: color-mix(in oklch, var(--warning-orange) 40%, transparent); }
.line { fill: none; stroke: var(--primary-blue); stroke-width: 2; stroke-linejoin: round; }
.dot { fill: var(--primary-blue); }
.now { stroke: var(--text-white); stroke-width: 1.5; }
.wk-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; margin-top: 0.2rem; }
.wk { all: unset; cursor: pointer; height: 0.6rem; border-radius: 2px; background: rgba(255, 255, 255, 0.06); min-width: 0; }
.wk[data-has='true'] { background: color-mix(in oklch, var(--primary-blue) 45%, transparent); }
.wk[data-phase='now'] { box-shadow: inset 0 0 0 1px var(--text-white); }
.wk[aria-pressed='true'] { background: var(--primary-blue); }
.wk:focus-visible, .hd:focus-visible, .rowb:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.legend { margin: 0.2rem 0 0; font-size: 0.62rem; color: var(--text-gray); display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; }
.legend i { display: inline-block; width: 0.7rem; height: 0.45rem; margin-right: 0.2rem; vertical-align: middle; border-radius: 1px; }
.lg-line { background: var(--primary-blue); height: 2px !important; }
.lg-bar { background: color-mix(in oklch, var(--domain-agent) 45%, transparent); }
.lg-due { background: color-mix(in oklch, var(--warning-orange) 40%, transparent); }
.lg-fut { background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.12) 0 2px, transparent 2px 4px); }
.heat { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.hd { all: unset; box-sizing: border-box; cursor: pointer; min-height: 2.4rem; border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.66rem; color: var(--text-white); background: color-mix(in oklch, var(--primary-blue) calc(12% + var(--v) * 70%), transparent); }
.hd[data-none='true'] { background: rgba(255, 255, 255, 0.04); color: var(--text-gray); }
.hd[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--text-white); }
.hd small { font-size: 0.55rem; color: var(--text-light-gray); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.rowb { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 8.5rem) minmax(0, 1fr) 2rem; gap: 0.5rem; align-items: center; font-size: 0.72rem; color: var(--text-light-gray); min-height: 24px; padding: 0.15rem 0.25rem; border-radius: var(--radius-sm); }
.rowb:hover { background: var(--nav-hover-bg); }
.rowb .num { text-align: right; color: var(--text-white); }
.bar { height: 0.35rem; border-radius: 999px; background: rgba(255, 255, 255, 0.05); overflow: hidden; }
.bar span { display: block; height: 100%; background: color-mix(in oklch, var(--primary-blue) 75%, transparent); }
.list { margin: 0 0 0.6rem; padding-left: 1rem; font-size: 0.72rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
.list li[data-tone='up']::marker { color: var(--app-color-up); }
.list li[data-tone='down']::marker { color: var(--app-color-down); }
.cap1 { text-transform: capitalize; }
.tag { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.notes { margin: 0; padding-left: 1rem; font-size: 0.74rem; color: var(--text-light-gray); display: flex; flex-direction: column; gap: 0.2rem; }
</style>
