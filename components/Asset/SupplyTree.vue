<script setup lang="ts">
/**
 * SupplyTree — who feeds the asset and who it feeds.
 *
 *   suppliers ──▶ [ ASSET ] ──▶ clients
 *                 similar assets (dashed)
 *
 * Link width follows each partner's share; every node shows its share and
 * nominal value when the data has them, and each column header shows the
 * totals. Partners that are listed assets open their own page.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { navigateTo } from '#app'
import type { TreeNode } from '~/utils/assetChart'

const props = withDefaults(defineProps<{
  center: { symbol: string; name: string; color: string; price?: string }
  suppliers: TreeNode[]
  clients: TreeNode[]
  similar?: TreeNode[]
  supplierLabel?: string
  clientLabel?: string
}>(), { similar: () => [], supplierLabel: 'Suppliers', clientLabel: 'Clients' })

const root = ref<HTMLElement | null>(null)
const width = ref(360)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  width.value = root.value.clientWidth
  ro = new ResizeObserver(([e]) => { if (e) width.value = Math.round(e.contentRect.width) })
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const NODE_H = 30
const GAP = 5
const HEAD = 30
const centerW = computed(() => Math.min(130, Math.max(78, width.value * 0.2)))
const colW = computed(() => Math.max(96, (width.value - centerW.value - 2 * 34) / 2))
const xL = 0
const xC = computed(() => colW.value + 34)
const xR = computed(() => xC.value + centerW.value + 34)

const rows = computed(() => Math.max(props.suppliers.length, props.clients.length, 1 + props.similar.length, 2))
const height = computed(() => HEAD + rows.value * (NODE_H + GAP) + 4)

function colY(n: number, i: number) {
  const block = n * (NODE_H + GAP) - GAP
  const top = HEAD + (rows.value * (NODE_H + GAP) - GAP - block) / 2
  return top + i * (NODE_H + GAP)
}
/** the asset and its similar assets form one block, centred vertically */
const centerY = computed(() => colY(1 + props.similar.length, 0))

function money(v?: number | null) {
  if (!v) return ''
  const a = Math.abs(v)
  return a >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : a >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${Math.round(v).toLocaleString('en-US')}`
}
function fit(s: string, px: number) {
  const max = Math.max(4, Math.floor(px / 5.8))
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
function second(n: TreeNode) {
  const bits = [n.share_pct !== undefined && n.share_pct !== null ? `${n.share_pct}%` : '', money(n.value_usd)].filter(Boolean)
  return bits.length ? bits.join(' · ') : (n.sub ?? '')
}
function stroke(n: TreeNode) {
  return n.share_pct ? Math.max(1.2, Math.min(12, n.share_pct / 4)) : 1.2
}

const cMidY = computed(() => centerY.value + NODE_H / 2)
const left = computed(() => props.suppliers.map((n, i) => {
  const y = colY(props.suppliers.length, i)
  const x1 = xL + colW.value
  const x2 = xC.value
  const my = y + NODE_H / 2
  return { n, y, path: `M${x1},${my} C${x1 + 24},${my} ${x2 - 24},${cMidY.value} ${x2},${cMidY.value}` }
}))
const right = computed(() => props.clients.map((n, i) => {
  const y = colY(props.clients.length, i)
  const x1 = xC.value + centerW.value
  const x2 = xR.value
  const my = y + NODE_H / 2
  return { n, y, path: `M${x1},${cMidY.value} C${x1 + 24},${cMidY.value} ${x2 - 24},${my} ${x2},${my}` }
}))
const sims = computed(() => props.similar.map((n, i) => {
  const y = centerY.value + (i + 1) * (NODE_H + GAP)
  return { n, y }
}))

function totals(list: TreeNode[]) {
  const v = list.reduce((s, n) => s + (n.value_usd ?? 0), 0)
  const p = list.reduce((s, n) => s + (n.share_pct ?? 0), 0)
  return [`${list.length}`, p ? `${Math.round(p)}%` : '', v ? money(v) : ''].filter(Boolean).join(' · ')
}
function open(n: TreeNode) { if (n.assetId) navigateTo(`/assets/${n.assetId}`) }
</script>

<template>
  <div ref="root" class="st">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`${center.name}: ${suppliers.length} suppliers, ${clients.length} clients`">
      <text :x="xL" y="11" class="st-h">{{ supplierLabel }}</text>
      <text :x="xL" y="23" class="st-t">{{ suppliers.length ? totals(suppliers) : 'no data' }}</text>
      <text :x="xR + colW" y="11" class="st-h" text-anchor="end">{{ clientLabel }}</text>
      <text :x="xR + colW" y="23" class="st-t" text-anchor="end">{{ clients.length ? totals(clients) : 'no data' }}</text>

      <path v-for="(l, i) in left" :key="'lp' + i" :d="l.path" class="st-link in" :stroke-width="stroke(l.n)" />
      <path v-for="(r, i) in right" :key="'rp' + i" :d="r.path" class="st-link out" :stroke-width="stroke(r.n)" />
      <line v-for="(s, i) in sims" :key="'sl' + i" :x1="xC + centerW / 2" :x2="xC + centerW / 2" :y1="s.y - GAP" :y2="s.y" class="st-sim-link" />

      <g v-for="(l, i) in left" :key="'l' + i" class="st-node" :class="{ link: l.n.assetId }" @click="open(l.n)">
        <title>{{ l.n.name }}{{ l.n.sub ? ` — ${l.n.sub}` : '' }}</title>
        <rect :x="xL" :y="l.y" :width="colW" :height="NODE_H" rx="6" />
        <text :x="xL + 6" :y="l.y + 12" class="st-name">{{ fit(`${l.n.flag ? l.n.flag + ' ' : ''}${l.n.name}`, colW - 10) }}</text>
        <text :x="xL + 6" :y="l.y + 24" class="st-sub">{{ fit(second(l.n), colW - 10) }}</text>
      </g>

      <g class="st-center">
        <rect :x="xC" :y="centerY" :width="centerW" :height="NODE_H" rx="7" :stroke="center.color" />
        <text :x="xC + centerW / 2" :y="centerY + 12" text-anchor="middle" class="st-name" :fill="center.color">{{ fit(center.symbol, centerW - 8) }}</text>
        <text :x="xC + centerW / 2" :y="centerY + 24" text-anchor="middle" class="st-sub">{{ fit(center.price ?? center.name, centerW - 8) }}</text>
      </g>
      <g v-for="(s, i) in sims" :key="'s' + i" class="st-node sim" :class="{ link: s.n.assetId }" @click="open(s.n)">
        <title>Similar: {{ s.n.name }}</title>
        <rect :x="xC + 6" :y="s.y" :width="centerW - 12" :height="NODE_H - 4" rx="6" />
        <text :x="xC + centerW / 2" :y="s.y + 11" text-anchor="middle" class="st-name">{{ fit(s.n.name, centerW - 16) }}</text>
        <text :x="xC + centerW / 2" :y="s.y + 22" text-anchor="middle" class="st-sub">{{ fit(s.n.sub ?? 'similar', centerW - 16) }}</text>
      </g>

      <g v-for="(r, i) in right" :key="'r' + i" class="st-node" :class="{ link: r.n.assetId }" @click="open(r.n)">
        <title>{{ r.n.name }}{{ r.n.sub ? ` — ${r.n.sub}` : '' }}</title>
        <rect :x="xR" :y="r.y" :width="colW" :height="NODE_H" rx="6" />
        <text :x="xR + 6" :y="r.y + 12" class="st-name">{{ fit(`${r.n.flag ? r.n.flag + ' ' : ''}${r.n.name}`, colW - 10) }}</text>
        <text :x="xR + 6" :y="r.y + 24" class="st-sub">{{ fit(second(r.n), colW - 10) }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.st { width: 100%; overflow: hidden; }
svg { display: block; font-family: var(--font-market-data, ui-monospace, monospace); }
.st-h { fill: var(--text-light-gray, rgba(255,255,255,.8)); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; font-family: var(--font-family-secondary, inherit); }
.st-t { fill: var(--text-gray, #9aa0a6); font-size: 9.5px; }
.st-link { fill: none; stroke-linecap: round; opacity: .55; }
.st-link.in { stroke: rgba(120, 170, 255, .9); }
.st-link.out { stroke: var(--app-color-up, #00ff88); }
.st-sim-link { stroke: rgba(255,255,255,.3); stroke-dasharray: 2 2; }
.st-node rect { fill: rgba(255,255,255,.04); stroke: rgba(255,255,255,.12); }
.st-node.link { cursor: pointer; }
.st-node.link:hover rect { fill: rgba(255,255,255,.09); stroke: rgba(255,255,255,.35); }
.st-node.sim rect { stroke-dasharray: 3 2; }
.st-center rect { fill: rgba(255,255,255,.07); stroke-width: 1.5; }
.st-name { fill: var(--text-white, #fff); font-size: 10px; font-weight: 700; }
.st-sub { fill: var(--text-gray, #9aa0a6); font-size: 9px; font-variant-numeric: tabular-nums; }
</style>
