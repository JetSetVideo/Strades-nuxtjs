<script setup lang="ts">
/**
 * Your relation avatars: pairs (you × one person) and rooms (group chats you sit in). Each card shows the
 * compatibility meter and a label chip; a click selects it for the detail panel.
 */
import { computed, ref, watch } from 'vue'
import { intelInitials, intelPct, intelScore, intelUnit, labelTone, memberChip, relationTitle, type IntelRelation } from '~/utils/intelligence'

const props = defineProps<{
  pairs: IntelRelation[]
  groups: IntelRelation[]
  selectedId: string | null
  newcomer: boolean
  refreshing?: boolean
}>()
const emit = defineEmits<{ select: [id: string]; refresh: [] }>()

const tab = ref<'pair' | 'group'>('pair')
// open on rooms when there are no pairs (a newcomer sees their rooms first)
watch(() => [props.pairs.length, props.groups.length], ([p, g]) => {
  if (!p && g) tab.value = 'group'
}, { immediate: true })
// follow an external selection (?relation=) into the right tab
watch(() => props.selectedId, (id) => {
  if (!id) return
  if (props.groups.some(r => r.id === id)) tab.value = 'group'
  else if (props.pairs.some(r => r.id === id)) tab.value = 'pair'
}, { immediate: true })

const list = computed(() => (tab.value === 'pair' ? props.pairs : props.groups))
const codes = (r: IntelRelation) => r.members.map(m => m.mbti).filter(Boolean)
const avatars = (r: IntelRelation) => r.members.slice(0, 5)
</script>

<template>
  <section class="rl" aria-labelledby="rl-title">
    <header class="rl-head">
      <h2 id="rl-title" class="rl-t">Your relations</h2>
      <div class="tabs" role="tablist" aria-label="Relation kind">
        <button type="button" role="tab" :aria-selected="tab === 'pair'" class="tab" @click="tab = 'pair'">Pairs <span class="cnt">{{ pairs.length }}</span></button>
        <button type="button" role="tab" :aria-selected="tab === 'group'" class="tab" @click="tab = 'group'">Rooms <span class="cnt">{{ groups.length }}</span></button>
      </div>
    </header>

    <div v-if="!list.length" class="rl-empty">
      <template v-if="tab === 'pair'">
        <p class="rl-empty-t">{{ newcomer ? 'Your first pairs are a few calls away.' : 'No pairs measured yet.' }}</p>
        <p class="muted">A pair appears when you and someone else have called the same assets. Make 3 calls on <NuxtLink to="/prices">Prices</NuxtLink>, then come back.</p>
        <button type="button" class="link" :disabled="refreshing" @click="emit('refresh')">{{ refreshing ? 'Re-analysing…' : 'Re-analyse me now' }}</button>
      </template>
      <template v-else>
        <p class="rl-empty-t">You're not in a room yet.</p>
        <p class="muted">Join or start a group chat in <NuxtLink to="/chat">Chat</NuxtLink>: each room gets its own avatar here.</p>
      </template>
    </div>

    <ul v-else class="cards">
      <li v-for="r in list" :key="r.id">
        <button type="button" class="card" :aria-pressed="selectedId === r.id" @click="emit('select', r.id)">
          <span class="avs" aria-hidden="true">
            <span v-for="m in avatars(r)" :key="m.id" class="av" :data-bot="m.is_bot">{{ intelInitials(m.name) }}</span>
            <span v-if="r.members.length > 5" class="av more">+{{ r.members.length - 5 }}</span>
          </span>
          <span class="body">
            <span class="name">
              {{ relationTitle(r) }}
              <template v-if="r.kind === 'pair'">
                <span v-for="m in r.members" :key="m.id"><span v-if="memberChip(m)" class="chip-bot">{{ memberChip(m) }}</span></span>
              </template>
            </span>
            <span class="meta">
              <span class="label" :style="{ '--tone': labelTone(r.label).color }">{{ r.label }}</span>
              <span v-if="r.kind === 'group'" class="muted">{{ r.size }} people</span>
              <span v-else-if="codes(r).length" class="code num">{{ codes(r).join(' · ') }}</span>
              <span v-if="r.agreement !== null" class="muted">agree {{ intelPct(r.agreement) }}</span>
            </span>
            <span class="meter" role="img" :aria-label="`Compatibility ${intelScore(r.compatibility)} out of 100`">
              <span class="meter-fill" :style="{ width: `${intelUnit((r.compatibility ?? 0) / 100) * 100}%`, background: labelTone(r.label).color }" />
            </span>
          </span>
          <span class="score num">{{ intelScore(r.compatibility) }}<small>/100</small></span>
        </button>
      </li>
    </ul>
    <p class="foot muted">Compatibility blends trait similarity, agreement, co-presence, interaction, shared assets and proximity. Tap a card for every operator.</p>
  </section>
</template>

<style scoped>
.rl { display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; }
.rl-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
.rl-t { margin: 0; font-size: 1rem; color: var(--text-white); }
.tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); }
.tab { all: unset; cursor: pointer; font-size: 0.74rem; color: var(--text-gray); padding: 0.3rem 0.65rem; border-radius: var(--radius-sm); min-height: 24px; display: inline-flex; align-items: center; gap: 0.3rem; }
.tab[aria-selected='true'] { color: var(--text-white); background: rgba(255,255,255,0.1); }
.tab:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 1px; }
.cnt { font-family: var(--font-market-data); font-size: 0.66rem; color: var(--text-gray); }
.cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.card {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%;
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.6rem; align-items: center;
  padding: 0.5rem 0.6rem; border-radius: var(--radius-md); border: 1px solid var(--edge-soft); background: var(--surface-raised);
}
.card:hover { border-color: var(--edge-lit); }
.card[aria-pressed='true'] { border-color: var(--primary-blue); background: color-mix(in oklch, var(--primary-blue) 8%, transparent); }
.card:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.avs { display: inline-flex; }
.av {
  width: 1.6rem; height: 1.6rem; border-radius: 50%; margin-left: -0.45rem; display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.56rem; font-weight: 700; color: var(--text-white); background: var(--surface-overlay); border: 1px solid var(--edge-lit);
}
.av:first-child { margin-left: 0; }
.av[data-bot='true'] { border-style: dashed; }
.av.more { color: var(--text-gray); }
.body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.name { font-size: 0.8rem; color: var(--text-white); overflow-wrap: anywhere; display: inline-flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
.chip-bot { font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.02rem 0.28rem; border-radius: var(--radius-sm); color: var(--domain-agent); background: color-mix(in oklch, var(--domain-agent) 14%, transparent); }
.meta { display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; align-items: center; font-size: 0.68rem; }
.label { color: var(--tone); border: 1px solid color-mix(in oklch, var(--tone) 45%, transparent); border-radius: 999px; padding: 0 0.4rem; text-transform: capitalize; }
.code { color: var(--text-light-gray); font-size: 0.64rem; }
.meter { height: 0.3rem; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; }
.meter-fill { display: block; height: 100%; opacity: 0.85; }
.score { font-size: 1rem; font-weight: 700; color: var(--text-white); text-align: right; }
.score small { font-size: 0.6rem; color: var(--text-gray); font-weight: 400; }
.rl-empty { border: 1px dashed var(--edge-lit); border-radius: var(--radius-md); padding: var(--card-pad); display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
.rl-empty-t { margin: 0; font-size: 0.86rem; color: var(--text-white); }
.muted { color: var(--text-gray); font-size: 0.72rem; margin: 0; }
.foot { font-size: 0.66rem; }
.rl a { color: var(--primary-blue); text-decoration: none; }
.rl a:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.link { all: unset; cursor: pointer; font-size: 0.74rem; color: var(--primary-blue); border: 1px solid var(--edge-raised); border-radius: var(--radius-md); padding: 0.3rem 0.6rem; min-height: 24px; }
.link:disabled { opacity: 0.6; cursor: progress; }
.link:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
