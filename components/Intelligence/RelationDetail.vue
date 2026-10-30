<script setup lang="ts">
/**
 * One relation in full: every operator grouped as Agreement (AND/XOR), Overlap (Jaccard / letters),
 * Time (lead-lag, co-presence, week timeline), Space, Influence & two heads; members with roles; advice.
 * Each operator row opens its plain-English meaning on click.
 */
import { computed, ref, watch } from 'vue'
import {
  PART_LABEL, describeComplementarity, describeInfluence, describeLeadLag, describeSpace, explainOperator,
  intelPct, intelScore, intelSigned, intelUnit, labelTone, relationTitle, severityTone, type IntelRelationDetail, type SetOps, type LetterOps,
} from '~/utils/intelligence'
import { intelSpectrum } from '~/utils/intelligenceV3'

const props = defineProps<{
  detail: IntelRelationDetail | null
  status: 'idle' | 'loading' | 'ready' | 'error' | 'signed-out'
  error: string | null
  meId: string | null
  compare?: boolean
}>()
const emit = defineEmits<{ close: []; retry: [] }>()

interface Row { key: string; label?: string; value: string; bar?: number | null }
interface Group { id: string; title: string; hint: string; rows: Row[]; timeline?: boolean }

const open = ref<string | null>(null)
watch(() => props.detail?.id, () => { open.value = null })

const d = computed(() => props.detail)
const isPair = computed(() => d.value?.kind === 'pair')
const A = computed(() => d.value?.members_all?.[0]?.name ?? 'First member')
const B = computed(() => d.value?.members_all?.[1]?.name ?? 'Second member')
const tone = computed(() => labelTone(d.value?.label))

const setRow = (key: string, label: string, s: SetOps | undefined): Row | null =>
  s ? { key, label, value: `${intelPct(s.jaccard)} · ${s.and} both · ${s.or} either · ${s.xor} only one`, bar: s.jaccard } : null
const letterRow = (key: string, l: LetterOps | undefined): Row | null =>
  l ? { key, value: `${l.and}/4 shared ${l.shared || '—'}${l.differs ? ` · differ ${l.differs}` : ''}` } : null

const groups = computed<Group[]>(() => {
  const r = d.value
  if (!r) return []
  const o = r.operators ?? {}
  const clean = (rows: (Row | null)[]) => rows.filter((x): x is Row => !!x)
  if (r.kind === 'pair') {
    const dir = o.direction
    return [
      {
        id: 'agree', title: 'Agreement', hint: 'AND = same side, XOR = opposite sides', rows: clean([
          dir ? { key: 'direction.shared', value: String(dir.shared) } : null,
          dir ? { key: 'direction.and', value: String(dir.and) } : null,
          dir ? { key: 'direction.xor', value: String(dir.xor) } : null,
          dir ? { key: 'direction.agreement', value: intelPct(dir.agreement), bar: dir.agreement } : null,
          typeof o.traits_cosine === 'number' ? { key: 'traits_cosine', value: intelSigned(o.traits_cosine, 2) } : null,
        ]),
      },
      {
        id: 'overlap', title: 'Overlap', hint: 'Jaccard = in both ÷ in either', rows: clean([
          setRow('assets.jaccard', 'Assets in common', o.assets),
          setRow('news.jaccard', 'News in common', o.news),
          letterRow('letters', o.letters),
          letterRow('declared_letters', o.declared_letters),
        ]),
      },
      {
        id: 'time', title: 'Time', hint: 'who moves first, when you are both online, week by week', timeline: true, rows: clean([
          { key: 'lead_lag', value: describeLeadLag(o.lead_lag, A.value, B.value) },
          typeof o.copresence === 'number' ? { key: 'copresence', value: intelPct(o.copresence), bar: o.copresence } : null,
        ]),
      },
      {
        id: 'space', title: 'Space', hint: 'where you each are', rows: clean([
          { key: 'space', value: describeSpace(o.space) },
        ]),
      },
      {
        id: 'influence', title: 'Influence & two heads', hint: 'who follows whom, and whether agreeing helps', rows: clean([
          { key: 'complementarity', value: describeComplementarity(o.complementarity, A.value, B.value) },
          { key: 'influence_ab', label: `${A.value} → ${B.value}`, value: describeInfluence(o.influence_ab, A.value, B.value) },
          { key: 'influence_ba', label: `${B.value} → ${A.value}`, value: describeInfluence(o.influence_ba, B.value, A.value) },
          typeof o.interaction === 'number'
            ? { key: 'interaction', value: `${intelPct(o.interaction)}${o.shared_conversations ? ` · ${o.shared_conversations} shared chat${o.shared_conversations === 1 ? '' : 's'}` : ''}${o.friends ? ' · friends' : ''}`, bar: o.interaction }
            : null,
        ]),
      },
    ]
  }
  const crowd = o.crowd
  return [
    {
      id: 'agree', title: 'Agreement', hint: 'how often members take the same side', rows: clean([
        { key: 'direction.agreement', value: intelPct(r.agreement), bar: r.agreement },
        { key: 'direction.opposition', value: intelPct(r.opposition), bar: r.opposition },
        crowd
          ? { key: 'crowd.gain', value: crowd.n ? `${intelSigned((crowd.gain ?? 0) * 100, 1, ' pts')} · majority ${intelPct(crowd.acc_majority)} vs average member ${intelPct(crowd.acc_mean)} on ${crowd.n} questions` : 'Not enough questions answered by several members yet.' }
          : null,
      ]),
    },
    {
      id: 'overlap', title: 'Overlap', hint: 'how alike the members are', rows: clean([
        typeof o.diversity === 'number' ? { key: 'diversity', value: intelPct(o.diversity), bar: o.diversity } : null,
        typeof o.letter_diversity === 'number' ? { key: 'letter_diversity', value: intelPct(o.letter_diversity), bar: o.letter_diversity } : null,
        typeof o.cohesion_min === 'number' ? { key: 'cohesion_min', value: `${intelScore(o.cohesion_min)}/100 across ${o.pairs ?? 0} pairs`, bar: o.cohesion_min / 100 } : null,
        o.codes?.length ? { key: 'codes', value: o.codes.join(' · ') } : null,
      ]),
    },
    { id: 'time', title: 'Time', hint: 'week by week', timeline: true, rows: [] },
  ]
})

const parts = computed(() => Object.entries(d.value?.operators?.parts ?? {}).map(([k, v]) => ({ k, label: PART_LABEL[k] ?? k, v })))
const members = computed(() => [...(d.value?.members_all ?? [])].sort((a, b) => (b.influence_out ?? 0) - (a.influence_out ?? 0)))

// consensus spectrum (rooms): eigenvalues of the room's agreement matrix, alignment per member
const spectrum = computed(() => (d.value?.kind === 'group' ? intelSpectrum(d.value.operators?.spectral, d.value.members_all ?? [], props.meId) : null))
const specOpen = ref<string | null>(null)
watch(() => props.detail?.id, () => { specOpen.value = null })
const toggleSpec = (k: string) => { specOpen.value = specOpen.value === k ? null : k }
const SPEC_EXPLAIN: Record<string, string> = {
  consensus: 'How much of the room\'s agreement and disagreement follows one single main view. 100% = everyone always on the same side; one over the number of members = no common view at all.',
  second: 'How much follows a second, competing view. When it is close to the main one, the room is split into two camps.',
}
</script>

<template>
  <section class="rd" aria-live="polite" aria-labelledby="rd-title">
    <div v-if="status === 'idle' && !detail" class="rd-empty">
      <h2 id="rd-title" class="rd-t">Pick a relation</h2>
      <p class="muted">Choose a pair or a room on the left to see how you agree, overlap, move in time and space, and influence each other.</p>
    </div>
    <div v-else-if="status === 'loading'" class="sk" aria-busy="true" aria-label="Loading relation"><span v-for="i in 5" :key="i" /></div>
    <div v-else-if="status === 'error'" class="rd-empty">
      <h2 id="rd-title" class="rd-t">{{ compare ? 'No comparison yet' : 'Relation unavailable' }}</h2>
      <p class="muted">{{ error }}</p>
      <div class="row-btns">
        <button type="button" class="link" @click="emit('retry')">Retry</button>
        <button type="button" class="link" @click="emit('close')">Close</button>
      </div>
    </div>

    <template v-else-if="d">
      <header class="rd-head">
        <div class="rd-id">
          <p class="rd-k">{{ compare ? 'Comparison' : d.kind === 'pair' ? 'Pair' : `Room · ${d.size} people` }}</p>
          <h2 id="rd-title" class="rd-t">{{ relationTitle(d) }}</h2>
          <p class="rd-label"><span class="chip" :style="{ '--tone': tone.color }">{{ d.label }}</span> {{ tone.blurb }}</p>
        </div>
        <div class="rd-score">
          <span class="big num">{{ intelScore(d.compatibility) }}<small>/100</small></span>
          <span class="muted">compatibility</span>
          <button type="button" class="link" @click="emit('close')">Close</button>
        </div>
      </header>
      <p v-if="d.conversation_id" class="rd-chat"><NuxtLink :to="`/conversations/${d.conversation_id}`">Open the room's chat →</NuxtLink></p>

      <div class="groups">
        <section v-for="g in groups" :key="g.id" class="grp" :aria-labelledby="`grp-${g.id}`">
          <h3 :id="`grp-${g.id}`" class="grp-t">{{ g.title }} <span class="muted">· {{ g.hint }}</span></h3>
          <table v-if="g.rows.length" class="ops">
            <tbody>
              <template v-for="r in g.rows" :key="r.key">
                <tr>
                  <th scope="row">
                    <button type="button" class="op-k" :aria-expanded="open === r.key" @click="open = open === r.key ? null : r.key">
                      {{ r.label ?? explainOperator(r.key).title }} <span class="q" aria-hidden="true">?</span>
                    </button>
                  </th>
                  <td>
                    <span class="op-v">{{ r.value }}</span>
                    <span v-if="typeof r.bar === 'number'" class="op-bar" aria-hidden="true"><span :style="{ width: `${intelUnit(r.bar) * 100}%` }" /></span>
                  </td>
                </tr>
                <tr v-if="open === r.key" class="op-x"><td colspan="2">{{ explainOperator(r.key).explain }}</td></tr>
              </template>
            </tbody>
          </table>
          <IntelligenceWeekTimeline v-if="g.timeline && d.timeline?.length" :weeks="d.timeline" />
        </section>

        <section v-if="isPair && parts.length" class="grp" aria-labelledby="grp-parts">
          <h3 id="grp-parts" class="grp-t">Compatibility inputs <span class="muted">· each 0–1, averaged into the score</span></h3>
          <ul class="parts">
            <li v-for="p in parts" :key="p.k">
              <span class="p-l">{{ p.label }}</span>
              <span class="op-bar" aria-hidden="true"><span :style="{ width: `${intelUnit(p.v) * 100}%` }" /></span>
              <span class="p-v num">{{ p.v === null ? 'n/a' : intelPct(p.v) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="spectrum" class="grp" aria-labelledby="grp-spec">
        <h3 id="grp-spec" class="grp-t">Consensus spectrum <span class="muted">· does the room move as one, or in camps? tap a line for what it means</span></h3>
        <p v-if="spectrum.empty" class="muted">Not enough calls shared between members yet (at least three members who called the same questions).</p>
        <template v-else>
          <ul class="spec">
            <li>
              <button type="button" class="op-k" :aria-expanded="specOpen === 'consensus'" @click="toggleSpec('consensus')">Main view <span class="q" aria-hidden="true">?</span></button>
              <span class="op-bar" aria-hidden="true"><span :style="{ width: `${spectrum.consensus!.width}%` }" /></span>
              <span class="p-v num">{{ intelPct(spectrum.consensus!.value) }}</span>
              <span class="s-w">{{ spectrum.consensus!.words }}</span>
              <span v-if="specOpen === 'consensus'" class="s-x">{{ spectrum.consensus!.line }} {{ SPEC_EXPLAIN.consensus }}</span>
            </li>
            <li v-if="spectrum.second">
              <button type="button" class="op-k" :aria-expanded="specOpen === 'second'" @click="toggleSpec('second')">Second camp <span class="q" aria-hidden="true">?</span></button>
              <span class="op-bar camp" aria-hidden="true"><span :style="{ width: `${spectrum.second.width}%` }" /></span>
              <span class="p-v num">{{ intelPct(spectrum.second.value) }}</span>
              <span class="s-w">{{ spectrum.second.words }}</span>
              <span v-if="specOpen === 'second'" class="s-x">{{ spectrum.second.line }} {{ SPEC_EXPLAIN.second }}</span>
            </li>
          </ul>
          <p class="muted">From {{ spectrum.members }} members and {{ spectrum.linked }} pairs who called at least three of the same questions. Tap a member for their side.</p>
          <ul class="align" aria-label="Alignment with the room's main view">
            <li v-for="a in spectrum.rows" :key="a.id">
              <button type="button" class="al" :aria-expanded="specOpen === a.id" @click="toggleSpec(a.id)">
                <span class="al-n">{{ a.name }}<template v-if="a.me"> (you)</template>
                  <span v-if="a.bot" class="tag">bot</span><span v-if="a.dissident" class="tag dis">dissident</span>
                </span>
                <span class="al-bar" aria-hidden="true"><span class="al-mid" /><span class="al-fill" :data-side="a.side" :style="{ left: `${a.left}%`, width: `${a.width}%` }" /></span>
                <span class="al-v num">{{ a.value === null ? '—' : intelSigned(a.value, 2) }}</span>
              </button>
              <span v-if="specOpen === a.id" class="s-x">{{ a.name }}: {{ a.words }}.<template v-if="a.dissident"> Marked dissident: against the room's main view.</template> 1 ≈ fully with the main view, below 0 = takes the other side.</span>
            </li>
          </ul>
          <p class="legend"><span><i class="sw with" />with the main view</span><span><i class="sw against" />other side</span></p>
        </template>
      </section>

      <section class="grp" aria-labelledby="grp-members">
        <h3 id="grp-members" class="grp-t">Members <span class="muted">· tap a role for what it means; influence = how much others follow their calls, above chance</span></h3>
        <ul class="members">
          <li v-for="m in members" :key="m.id"><IntelligenceMember :member="m" :me="m.id === meId" show-role show-influence /></li>
        </ul>
      </section>

      <div v-if="d.advice?.length" class="advice">
        <article v-for="a in d.advice" :key="a.key" class="adv" :data-tone="severityTone(a.severity)">
          <h4 class="adv-t">{{ a.title }}</h4>
          <p class="adv-b">{{ a.body }}</p>
        </article>
      </div>
      <p class="muted small">Behavioural reads from calls, reads and activity, not a judgement of anyone's character. Accuracy is on paper calls.</p>
    </template>
  </section>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; }
.rd-empty { display: flex; flex-direction: column; gap: 0.35rem; padding: var(--card-pad); border: 1px dashed var(--edge-raised); border-radius: var(--radius-md); }
.rd-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem; align-items: flex-start; }
.rd-id { min-width: 0; flex: 1 1 14rem; }
.rd-k { margin: 0; font-size: 0.64rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-gray); }
.rd-t { margin: 0.1rem 0; font-size: 1rem; color: var(--text-white); overflow-wrap: anywhere; }
.rd-label { margin: 0; font-size: 0.72rem; color: var(--text-light-gray); }
.chip { color: var(--tone); border: 1px solid color-mix(in oklch, var(--tone) 45%, transparent); border-radius: 999px; padding: 0 0.45rem; text-transform: capitalize; margin-right: 0.3rem; }
.rd-score { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
.big { font-size: 1.6rem; font-weight: 700; color: var(--text-white); line-height: 1; }
.big small { font-size: 0.7rem; color: var(--text-gray); font-weight: 400; }
.rd-chat { margin: 0; font-size: 0.74rem; }
.rd a { color: var(--primary-blue); text-decoration: none; }
.rd a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.groups { display: flex; flex-direction: column; gap: 0.8rem; }
.grp { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.grp-t { margin: 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.grp-t .muted { text-transform: none; letter-spacing: 0; font-weight: 400; }
.ops { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ops th, .ops td { padding: 0.25rem 0.3rem; border-top: 1px solid var(--edge-soft); vertical-align: top; text-align: left; }
.ops th { width: 38%; font-weight: 400; }
.op-k { all: unset; cursor: pointer; font-size: 0.74rem; color: var(--text-light-gray); display: inline-flex; gap: 0.3rem; align-items: center; min-height: 22px; overflow-wrap: anywhere; }
.op-k:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; border-radius: 2px; }
.q { width: 0.9rem; height: 0.9rem; border-radius: 50%; border: 1px solid var(--edge-lit); font-size: 0.58rem; display: inline-flex; align-items: center; justify-content: center; color: var(--text-gray); flex: none; }
.op-k[aria-expanded='true'] .q { border-color: var(--primary-blue); color: var(--primary-blue); }
.op-v { font-size: 0.74rem; color: var(--text-white); overflow-wrap: anywhere; display: block; }
.op-bar { display: block; height: 0.3rem; margin-top: 0.2rem; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
.op-bar span { display: block; height: 100%; background: color-mix(in oklch, var(--primary-blue) 75%, transparent); }
.op-x td { font-size: 0.7rem; color: var(--text-gray); border-top: 0; padding-top: 0; }
.parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.parts li { display: grid; grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) 2.6rem; gap: 0.5rem; align-items: center; }
.parts .op-bar { margin-top: 0; }
.p-l { font-size: 0.72rem; color: var(--text-light-gray); }
.p-v { font-size: 0.7rem; color: var(--text-white); text-align: right; }
.members { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: 0.5rem; }
.advice { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: var(--card-gap); }
.adv { padding: 0.55rem 0.7rem; border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--edge-soft); border-left: 3px solid var(--primary-blue); }
.adv[data-tone='warn'] { border-left-color: var(--warning-orange); }
.adv[data-tone='up'] { border-left-color: var(--primary-green); }
.adv[data-tone='down'] { border-left-color: var(--error-red); }
.adv-t { margin: 0 0 0.2rem; font-size: 0.78rem; color: var(--text-white); }
.adv-b { margin: 0; font-size: 0.72rem; color: var(--text-light-gray); }
.muted { color: var(--text-gray); font-size: 0.72rem; margin: 0; }
.small { font-size: 0.64rem; }
.row-btns { display: flex; gap: 0.5rem; }
.link { all: unset; cursor: pointer; font-size: 0.72rem; color: var(--primary-blue); min-height: 22px; display: inline-flex; align-items: center; }
.link:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; border-radius: 2px; }
.sk { display: flex; flex-direction: column; gap: 0.5rem; }
.sk span { height: 2.4rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
.spec { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.spec li { display: grid; grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) 2.6rem; gap: 0.2rem 0.5rem; align-items: center; }
.spec .op-bar { margin-top: 0; height: 0.45rem; }
.op-bar.camp span { background: color-mix(in oklch, var(--domain-agent) 75%, transparent); }
.s-w { grid-column: 2 / -1; font-size: 0.7rem; color: var(--text-light-gray); }
.s-x { grid-column: 1 / -1; font-size: 0.7rem; color: var(--text-gray); }
.align { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.align li { display: flex; flex-direction: column; gap: 0.1rem; }
.al { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: minmax(0, 8rem) minmax(0, 1fr) 3rem; gap: 0.5rem; align-items: center; min-height: 24px; width: 100%; }
.al:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; border-radius: 2px; }
.al[aria-expanded='true'] .al-n { color: var(--text-white); }
.al-n { font-size: 0.72rem; color: var(--text-light-gray); overflow-wrap: anywhere; }
.al-v { font-size: 0.7rem; color: var(--text-white); text-align: right; }
.al-bar { position: relative; height: 0.4rem; border-radius: 999px; background: rgba(255,255,255,0.05); }
.al-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--edge-lit); }
.al-fill { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: color-mix(in oklch, var(--primary-blue) 75%, transparent); }
.al-fill[data-side='against'] { background: color-mix(in oklch, var(--warning-orange) 75%, transparent); }
.al-fill[data-side='apart'] { background: var(--edge-lit); }
.tag { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0 0.3rem; margin-left: 0.25rem; border-radius: 999px; border: 1px solid var(--edge-lit); color: var(--text-gray); }
.tag.dis { border-color: var(--warning-orange); color: var(--warning-orange); }
.legend { margin: 0; display: flex; gap: 0.8rem; font-size: 0.62rem; color: var(--text-gray); }
.sw { display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 2px; margin-right: 0.25rem; vertical-align: middle; }
.sw.with { background: var(--primary-blue); }
.sw.against { background: var(--warning-orange); }
</style>
