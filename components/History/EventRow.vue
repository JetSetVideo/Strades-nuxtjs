<script setup lang="ts">
/**
 * One timeline row. Presentational: everything arrives through props.
 * Value column: P&L (up/down tokens + sign) > score > % move > amount. Mode is a chip, never colour alone.
 */
import { computed } from 'vue'
import { useAppearanceStore } from '~/stores/appearance'
import {
  LANE_META, historyDetail, historyFacts, historyKindLabel, historyVisual, histClockTime, histPct, histRelTime, histSignedUsd, histUsd,
  type HistoryEvent, type HistoryState,
} from '~/utils/historyTimeline'

const appearance = useAppearanceStore()
appearance.hydrate()

const props = defineProps<{ event: HistoryEvent; now: number; expanded?: boolean; selected?: boolean; compact?: boolean }>()
const emit = defineEmits<{ toggle: [id: string] }>()

const e = computed(() => props.event)
const meta = computed(() => LANE_META[e.value.lane])
const look = computed(() => historyVisual(e.value, props.now))
const detailId = computed(() => `hrow-${e.value.id.replace(/[^\w-]/g, '_')}`)

const STATE_COLOR: Record<HistoryState, string> = {
  up: 'var(--app-color-up, #00ff88)',
  down: 'var(--app-color-down, #ff4d6a)',
  warn: 'var(--warning-orange, #ff9f45)',
  flat: 'var(--text-gray, #9aa0a6)',
}

const value = computed(() => {
  const x = e.value
  if (typeof x.pnl_usd === 'number') return { text: histSignedUsd(x.pnl_usd), tone: x.pnl_usd >= 0 ? 'up' : 'down' }
  if (typeof x.score === 'number') return { text: `${Math.round(x.score)}/100`, tone: x.score >= 60 ? 'up' : 'flat' }
  if (typeof x.pct === 'number') return { text: histPct(x.pct), tone: x.pct >= 0 ? 'up' : 'down' }
  if (typeof x.amount_usd === 'number') return { text: histUsd(x.amount_usd), tone: 'flat' }
  return null
})

const progress = computed(() => look.value.bar)

const when = computed(() => {
  const x = e.value
  if (x.tense === 'future') return histRelTime(x.at, props.now)
  if (x.tense === 'present') {
    if (progress.value !== null && Date.parse(x.at) > props.now) return `ends ${histRelTime(x.at, props.now)}`
    return x.start_at ? `since ${histRelTime(x.start_at, props.now).replace(' ago', '')}` : 'now'
  }
  return histClockTime(x.at, appearance.resolvedTimezone)
})

const modeChip = computed(() => {
  switch (e.value.mode) {
    case 'paper': return { text: 'P', title: 'Paper — simulated cash' }
    case 'backtest': return { text: 'Backtest', title: 'Backtest — replayed history, no orders' }
    case 'real': return { text: 'REAL', title: 'Record from an external wallet' }
    default: return null
  }
})

const statusChip = computed(() => {
  const s = e.value.status
  if (!s || ['completed', 'pending', 'closed', 'open'].includes(s)) return null
  return s
})

const assetStyle = computed(() => {
  const a = look.value.asset
  if (!a) return undefined
  return { color: a.color, background: a.tint, borderColor: a.color }
})
const statusStyle = computed(() => {
  const color = STATE_COLOR[look.value.state]
  return { color, background: `color-mix(in oklch, ${color} 14%, transparent)` }
})

const detail = computed(() => historyDetail(e.value))
const facts = computed(() => (props.expanded ? historyFacts(e.value, appearance.resolvedTimezone) : []))
const barLabel = computed(() => {
  if (e.value.tense === 'past') return value.value ? `Settled ${value.value.text}` : 'Settled'
  return `${Math.round((progress.value ?? 0) * 100)}% of the way to ${new Date(e.value.at).toLocaleDateString('en-US')}`
})
</script>

<template>
  <article
    class="hrow"
    :class="{ 'is-sample': e.sample, 'is-selected': selected, 'is-compact': compact }"
    :data-lane="e.lane"
    :data-mode="e.mode || undefined"
    :data-tense="e.tense"
    :data-state="look.state"
    :data-asset="look.asset?.id || undefined"
    :style="{
      '--lane': meta.color,
      '--mark': look.asset?.color || meta.color,
      '--state': STATE_COLOR[look.state],
      '--intensity': String(look.intensity),
    }"
  >
    <button
      type="button"
      class="hrow-main"
      :aria-expanded="!!expanded"
      :aria-controls="expanded ? detailId : undefined"
      @click="emit('toggle', e.id)"
    >
      <span class="hrow-mark" aria-hidden="true"><span class="hrow-dot" /></span>
      <span class="hrow-body">
        <span class="hrow-line">
          <span v-if="e.asset" class="chip chip-asset" :style="assetStyle" :title="look.asset?.label">{{ e.asset }}</span>
          <span v-else class="hrow-name">{{ e.kind === 'day_digest' ? 'Activity' : e.title }}</span>
          <span v-if="detail" class="hrow-detail-text">{{ detail }}</span>
          <span v-if="modeChip" class="chip chip-mode" :data-mode="e.mode" :title="modeChip.title">{{ modeChip.text }}</span>
          <span v-if="e.sample" class="chip chip-sample" title="Pre-filled or catalog data — not something you did">Sample</span>
          <span v-if="e.data?.unsynced" class="chip chip-local" title="Saved on this device; not on the server yet">Device</span>
          <span v-if="statusChip" class="chip chip-status" :data-status="statusChip" :style="statusStyle">{{ statusChip }}</span>
        </span>
        <span v-if="progress !== null" class="hrow-progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="barLabel">
          <span class="hrow-progress-fill" :style="{ width: `${progress * 100}%` }" />
        </span>
      </span>
      <span class="hrow-side">
        <span v-if="value" class="hrow-value" :data-tone="value.tone">{{ value.text }}</span>
        <span class="hrow-when">{{ when }}</span>
      </span>
    </button>
    <div v-if="expanded" :id="detailId" class="hrow-detail">
      <dl class="hrow-facts">
        <template v-for="f in facts" :key="f.label">
          <dt>{{ f.label }}</dt>
          <dd>{{ f.value }}</dd>
        </template>
      </dl>
      <NuxtLink v-if="e.href" :to="e.href" class="hrow-open">Open {{ historyKindLabel(e.kind).toLowerCase() }} →</NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.hrow {
  border-radius: 6px;
  background: transparent;
  min-width: 0;
}
.hrow.is-selected .hrow-main {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), transparent 46%),
    rgba(4, 5, 8, 0.78);
  box-shadow:
    inset 0 0 0 1px color-mix(in oklch, var(--mark, var(--lane)) 42%, transparent),
    0 10px 22px -12px color-mix(in oklch, var(--mark, var(--lane)) 80%, transparent),
    0 0 16px -6px color-mix(in oklch, var(--state, var(--mark, var(--lane))) 50%, transparent);
}
.hrow.is-sample { opacity: 0.78; }
/* Design.md: paper = P chip + dashed mark + 60 % saturation */
.hrow[data-mode='paper'] .hrow-main { filter: saturate(0.6); }
.hrow[data-mode='paper'] .hrow-mark { border-style: dashed; }

.hrow-main {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.28rem 0.35rem;
  cursor: pointer;
  border-radius: inherit;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent 42%),
    rgba(6, 7, 12, 0.62);
  border: 1px solid rgba(255,255,255,0.045);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.05),
    0 8px 18px -12px color-mix(in oklch, var(--mark, var(--lane)) 78%, transparent),
    0 0 14px -6px color-mix(in oklch, var(--state, var(--mark, var(--lane))) 42%, transparent);
  backdrop-filter: blur(8px);
}
.hrow-main:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.hrow-main:hover .hrow-name,
.hrow-main:hover .chip-asset { text-decoration: underline; text-decoration-color: var(--edge-lit); }

.hrow-mark {
  align-self: center;
  box-sizing: border-box;
  width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center; flex: none;
  border: 1.5px solid var(--mark, var(--lane));
  background: color-mix(in oklch, var(--mark, var(--lane)) 10%, transparent);
}
.hrow-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--state, var(--lane));
}
.hrow[data-state='flat'] .hrow-dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--mark, var(--lane)); }
.hrow[data-tense='future'] .hrow-mark { border-style: dashed; background: transparent; }
.hrow[data-tense='future'] .hrow-dot { opacity: 0.45; }
.hrow-body { position: relative; display: flex; flex-direction: column; min-width: 0; padding-bottom: 4px; }
.hrow-line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.28rem; min-width: 0; }
.hrow-name { font-family: var(--font-chrome); font-size: 0.8rem; font-weight: 600; color: var(--text-white); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.hrow-detail-text { font-size: 0.72rem; color: var(--text-gray); white-space: nowrap; }
.chip {
  font-size: 0.68rem; line-height: 1; padding: 0.22rem 0.42rem; border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  background: rgba(255,255,255,0.05); color: var(--text-gray); letter-spacing: 0.02em;
}
.chip-mode { font-weight: 700; color: var(--text-white); }
.chip-mode[data-mode='paper'] { border: 1px dashed var(--text-gray); background: transparent; }
.chip-mode[data-mode='backtest'] { border: 1px dotted var(--domain-agent); background: transparent; color: var(--domain-agent); }
.chip-mode[data-mode='real'] { background: color-mix(in oklch, var(--primary-green) 22%, transparent); }
.chip-sample { color: var(--warning-orange); background: color-mix(in oklch, var(--warning-orange) 12%, transparent); }
.chip-local { color: var(--primary-blue); }
.chip-asset { font-family: var(--font-market-data); color: var(--text-light-gray); }
.chip-status { text-transform: capitalize; }
.chip-status[data-status='accurate'], .chip-status[data-status='live'] { color: var(--app-color-up); }
.chip-status[data-status='missed'], .chip-status[data-status='stopped'] { color: var(--app-color-down); }

.hrow-progress {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: block; height: 2px; border-radius: 2px; overflow: hidden;
  background: transparent;
}
.hrow-progress-fill {
  display: block; height: 100%;
  background: linear-gradient(90deg,
    color-mix(in oklch, var(--mark, var(--lane)) 72%, white 12%),
    color-mix(in oklch, var(--mark, var(--lane)) calc(30% + var(--intensity) * 40%), var(--state, var(--lane))));
}
.hrow[data-state='up'] .hrow-progress-fill {
  background: linear-gradient(90deg,
    color-mix(in oklch, var(--mark, var(--lane)) 70%, var(--app-color-up, #00ff88)),
    color-mix(in oklch, var(--app-color-up, #00ff88) calc(28% + var(--intensity) * 72%), white 8%));
}
.hrow[data-state='down'] .hrow-progress-fill {
  background: linear-gradient(90deg,
    color-mix(in oklch, var(--mark, var(--lane)) 55%, var(--app-color-down, #ff4d6a)),
    color-mix(in oklch, var(--app-color-down, #ff4d6a) calc(40% + var(--intensity) * 45%), black 22%));
}
.hrow[data-state='warn'] .hrow-progress-fill {
  background: linear-gradient(90deg,
    color-mix(in oklch, var(--warning-orange, #ff9f45) 35%, var(--mark, var(--lane))),
    var(--warning-orange, #ff9f45));
}
.hrow[data-state='flat'] .hrow-progress-fill {
  background: linear-gradient(90deg,
    color-mix(in oklch, var(--mark, var(--lane)) 28%, transparent),
    color-mix(in oklch, var(--mark, var(--lane)) calc(20% + var(--intensity) * 55%), transparent));
}
.hrow[data-mode='paper'] .hrow-progress-fill { filter: saturate(0.62); }

.hrow-side { display: flex; flex-direction: row; align-items: baseline; justify-content: flex-end; gap: 0.45rem; text-align: right; align-self: center; }
.hrow-value { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; font-size: 0.8rem; font-weight: 600; color: var(--text-light-gray); white-space: nowrap; }
.hrow-value[data-tone='up'] { color: var(--app-color-up); }
.hrow-value[data-tone='down'] { color: var(--app-color-down); }
.hrow-when {
  font-family: var(--font-market-data);
  font-size: 0.68rem; color: var(--text-gray); white-space: nowrap; font-variant-numeric: tabular-nums;
}

.hrow-detail { padding: 0.15rem 0.4rem 0.4rem 2.1rem; display: flex; flex-direction: column; gap: 0.4rem; }
.hrow-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.2rem 0.8rem; margin: 0; font-size: 0.74rem; }
.hrow-facts dt { color: var(--text-gray); text-transform: capitalize; }
.hrow-facts dd { margin: 0; color: var(--text-light-gray); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hrow-open { align-self: flex-start; font-size: 0.76rem; color: var(--primary-blue); text-decoration: none; }
.hrow-open:hover { text-decoration: underline; }
.hrow-open:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; border-radius: 2px; }

@media (prefers-reduced-motion: no-preference) {
  .hrow.is-selected { animation: hrow-flash 0.9s ease-out 1; }
  @keyframes hrow-flash { from { box-shadow: 0 0 0 3px color-mix(in oklch, var(--lane) 55%, transparent); } }
  .hrow[data-tense='present'] .hrow-dot { animation: hrow-dot 2.4s ease-in-out infinite; }
  @keyframes hrow-dot { 50% { transform: scale(0.72); opacity: 0.65; } }
}

@media (max-width: 480px) {
  .hrow-detail { padding-left: 0.7rem; }
}
</style>
