<script setup lang="ts">
/**
 * /CandleChart — the chart workspace: any asset, any range, everything the app knows about it on
 * one chart.
 *
 *  data        utils/assetChart + useAssetSeries (real Binance candles with volume where a feed
 *              exists, else the seeded simulated path, flagged "sim"), same source as every card
 *  chart       components/Chart/Workspace.vue (candles / line, log / %, zoom, pan, crosshair)
 *  indicators  utils/chartIndicators.ts (SMA, EMA, Bollinger, VWAP, volume, RSI, MACD)
 *  overlays    your calls + friends' calls (stores/predictions, useFriendPredictions), paper trades
 *              (stores/paper), price alerts + drawings (stores/assetAnnotations), market events
 *              (global/events.json), up to two comparison assets in % mode
 *  side panel  Predict (PredictPanel), Paper trade (QuickPaperBet), Alerts, Drawings, Info
 *  URL         ?asset=&range=&interval=&ind=&scale=&cmp= — shareable, deep-linkable
 *
 * Layout (sizes in Components.md §15): everything stacks vertically by default; only from
 * 1440 px does the side panel sit next to the chart. Nothing is wider than its container
 * (min-width: 0 on every grid/flex child), the chart never narrower than 280 px.
 * Menus: one open at a time (`openMenu`), closed by Escape or a click anywhere else.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Asset } from '~/types/asset'
import { useAssetsStore } from '~/stores/assets'
import { useAppearanceStore } from '~/stores/appearance'
import { usePredictionsStore } from '~/stores/predictions'
import { usePaperStore } from '~/stores/paper'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { useAssetSeries } from '~/composables/useAssetSeries'
import { useFriendPredictions, friendProfile, targetTsOf } from '~/composables/useFriendPredictions'
import { publicAssetUrl } from '~/composables/useLocalJson'
import {
  HOUR, INTERVALS, pickInterval, priceKindOf, fmtPrice, fmtPct, fmtAxisPrice, typeColor, TYPE_LABEL, realisedHourlySigma,
} from '~/utils/assetChart'
import { INDICATORS, parseIndicators, alignCloses, rsi as rsiOf, sma, type IndicatorId } from '~/utils/chartIndicators'
import ChartWorkspace, { type WsTool, type WsCall, type WsCompare } from '~/components/Chart/Workspace.vue'
import ChartStyleToggle from '~/components/Asset/ChartStyleToggle.vue'
import PredictPanel from '~/components/Asset/PredictPanel.vue'
import AssetQuickPaperBet from '~/components/Asset/QuickPaperBet.vue'
import UIEmptyState from '~/components/UI/EmptyState.vue'

definePageMeta({ title: 'Chart', description: 'Chart workspace: candles, indicators, drawings, alerts, calls.', layout: 'default' })

const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const appearance = useAppearanceStore()
const preds = usePredictionsStore()
const paper = usePaperStore()
const notes = useAssetAnnotationsStore()

const ready = ref(false)
onMounted(async () => {
  preds.init()
  try { paper.hydrate() } catch { /* optional */ }
  notes.hydrateFromStorage()
  if (!assetsStore.assets.length) await assetsStore.initializeStore()
  ready.value = true
  void loadEvents()
  window.addEventListener('keydown', onHotkey)
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('fullscreenchange', onFs)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHotkey)
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('fullscreenchange', onFs)
})

// ── State (mirrored in the URL) ───────────────────────────────────────────
const RANGES = [
  { id: '1D', hours: 24 }, { id: '1W', hours: 168 }, { id: '1M', hours: 720 },
  { id: '3M', hours: 2160 }, { id: '6M', hours: 4368 }, { id: '1Y', hours: 8760 },
]
const q = route.query
const assetId = ref(String(q.asset ?? 'btc').toLowerCase())
const rangeId = ref(RANGES.some(r => r.id === q.range) ? String(q.range) : '3M')
const intervalId = ref(String(q.interval ?? 'auto'))
const indicators = ref<IndicatorId[]>(q.ind !== undefined ? parseIndicators(q.ind) : ['volume', 'sma20'])
const scale = ref<'linear' | 'log' | 'percent'>(['log', 'percent'].includes(String(q.scale)) ? (String(q.scale) as 'log' | 'percent') : 'linear')
const compareIds = ref<string[]>(String(q.cmp ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 2))
const tool = ref<WsTool>('cursor')
const show = ref({ calls: true, friends: false, trades: true, alerts: true, events: true, drawings: true })
const side = ref<'predict' | 'trade' | 'alerts' | 'drawings' | 'info'>('predict')
const settingsOpen = ref(false)

watch([assetId, rangeId, intervalId, indicators, scale, compareIds], () => {
  router.replace({ query: {
    asset: assetId.value, range: rangeId.value,
    ...(intervalId.value !== 'auto' ? { interval: intervalId.value } : {}),
    ind: indicators.value.join(','),
    ...(scale.value !== 'linear' ? { scale: scale.value } : {}),
    ...(compareIds.value.length ? { cmp: compareIds.value.join(',') } : {}),
  } })
}, { deep: true })

// ── Menus (one at a time; Escape or a click elsewhere closes) ─────────────
type MenuId = 'asset' | 'ind' | 'ov' | 'cmp'
const openMenu = ref<MenuId | null>(null)
const pickerInput = ref<HTMLInputElement | null>(null)
const cmpInput = ref<HTMLInputElement | null>(null)
function toggleMenu(id: MenuId) {
  openMenu.value = openMenu.value === id ? null : id
  if (openMenu.value === 'asset') void nextTick(() => pickerInput.value?.focus())
  if (openMenu.value === 'cmp') void nextTick(() => cmpInput.value?.focus())
  if (openMenu.value) void nextTick(() => keepInViewport(id))
}
/** A floating panel that would cross the right edge opens leftwards from its trigger instead. */
function keepInViewport(id: MenuId) {
  const el = document.querySelector<HTMLElement>(`[data-menu="${id}"] .cw-menu-body, [data-menu="${id}"] .cw-pop`)
  if (!el || getComputedStyle(el).position !== 'absolute') return
  el.classList.remove('align-end')
  if (el.getBoundingClientRect().right > document.documentElement.clientWidth - 8) el.classList.add('align-end')
}
function onDocPointer(e: PointerEvent) {
  if (!openMenu.value) return
  const t = e.target as HTMLElement | null
  if (t?.closest(`[data-menu="${openMenu.value}"]`)) return
  openMenu.value = null
}

// ── Asset ─────────────────────────────────────────────────────────────────
const byId = (id: string) => assetsStore.assets.find(a => String(a.id).toLowerCase() === id || String(a.symbol).toLowerCase() === id) ?? null
const asset = computed<Asset | null>(() => byId(assetId.value))
const kind = computed(() => priceKindOf(asset.value))
const currency = computed(() => String(asset.value?.currency || 'USD'))
const tColor = computed(() => typeColor(asset.value?.type))
const change = computed(() => (typeof asset.value?.change_24h_pct === 'number' ? asset.value.change_24h_pct : null))
useHead(() => ({ title: asset.value ? `${asset.value.symbol} chart · Strades` : 'Chart · Strades' }))

function matchList(s: string, exclude: string[] = []) {
  const k = s.trim().toLowerCase()
  const score = (a: Asset) => {
    const sym = a.symbol.toLowerCase()
    if (!k) return 0
    if (sym === k) return 0
    if (sym.startsWith(k)) return 1
    if (a.name.toLowerCase().startsWith(k)) return 2
    return 3
  }
  return assetsStore.assets
    .filter(a => !exclude.includes(String(a.id).toLowerCase()))
    .filter(a => !k || a.symbol.toLowerCase().includes(k) || a.name.toLowerCase().includes(k))
    .sort((a, b) => score(a) - score(b))
    .slice(0, 40)
}
const pickerQ = ref('')
const pickerList = computed(() => matchList(pickerQ.value))
function choose(a: Asset) {
  assetId.value = String(a.id).toLowerCase()
  compareIds.value = compareIds.value.filter(x => x !== assetId.value)
  openMenu.value = null
  pickerQ.value = ''
}

// ── Series ────────────────────────────────────────────────────────────────
const range = computed(() => RANGES.find(r => r.id === rangeId.value)!)
/** Intervals that give 10–500 candles for the range (Binance caps a request at 500). */
const intervalChoices = computed(() => INTERVALS.filter(i => range.value.hours / i.hours >= 10 && range.value.hours / i.hours <= 500))
const autoInterval = computed(() => pickInterval(range.value.hours, 160))
const interval = computed(() => {
  if (intervalId.value !== 'auto') {
    const hit = intervalChoices.value.find(i => i.id === intervalId.value)
    if (hit) return hit
  }
  return autoInterval.value
})
watch(rangeId, () => { if (intervalId.value !== 'auto' && !intervalChoices.value.some(i => i.id === intervalId.value)) intervalId.value = 'auto' })

const win = computed(() => ({ start: Date.now() - range.value.hours * HOUR, maxCandles: Math.ceil(range.value.hours / interval.value.hours) }))
const { candles, allSimulated, simulated, realFrom, now } = useAssetSeries(asset, win)
const cmpA = computed(() => (compareIds.value[0] ? byId(compareIds.value[0]) : null))
const cmpB = computed(() => (compareIds.value[1] ? byId(compareIds.value[1]) : null))
const sA = useAssetSeries(cmpA, win)
const sB = useAssetSeries(cmpB, win)
const CMP_COLORS = ['var(--primary-blue, #00aaff)', 'var(--domain-social, #ff7eb6)']
const compare = computed<WsCompare[]>(() => {
  const times = candles.value.map(c => c.t)
  const out: WsCompare[] = []
  if (cmpA.value && sA.candles.value.length) out.push({ symbol: cmpA.value.symbol, color: CMP_COLORS[0]!, closes: alignCloses(times, sA.candles.value) })
  if (cmpB.value && sB.candles.value.length) out.push({ symbol: cmpB.value.symbol, color: CMP_COLORS[1]!, closes: alignCloses(times, sB.candles.value) })
  return out
})
/** A comparison is only meaningful in %: it forces % whatever scale is picked (said in the toolbar). */
const percentMode = computed(() => scale.value === 'percent' || compare.value.length > 0)
const hasVolume = computed(() => candles.value.some(c => (c.v ?? 0) > 0))
const source = computed(() => {
  if (!asset.value) return ''
  if (allSimulated.value) return 'Simulated path (no market history for this asset)'
  const proxy = (asset.value.live as any)?.proxy
  const base = asset.value.live?.pair && asset.value.live.pair !== 'strades-api' ? `Binance ${asset.value.live.pair}` : 'Live quotes'
  return `${base}${proxy ? ` (proxy: ${proxy})` : ''}${simulated.value ? ' · older part simulated' : ''}`
})

// ── Overlays ──────────────────────────────────────────────────────────────
const friends = useFriendPredictions(asset)
function onFriendsToggle(on: boolean) {
  show.value.friends = on
  if (on && !friends.isRevealed.value) friends.toggle()
}
const calls = computed<WsCall[]>(() => {
  const sym = asset.value?.symbol
  if (!sym) return []
  const out: WsCall[] = []
  if (show.value.calls) {
    for (const p of preds.predictions) {
      if (p.userId !== 'current_user' || p.demo || p.assetId !== sym) continue
      out.push({ id: p.id, t: targetTsOf(p), p: p.predictedPrice, madeT: Date.parse(p.timestamp), madeP: p.currentPrice, mine: true, status: p.status })
    }
  }
  if (show.value.friends && friends.isRevealed.value) {
    for (const p of friends.predictions.value) {
      const prof = friendProfile(p.userId)
      out.push({ id: p.id, t: targetTsOf(p), p: p.predictedPrice, madeT: Date.parse(p.timestamp), madeP: p.currentPrice, mine: false, name: prof.name, avatar: prof.avatar, status: p.status })
    }
  }
  return out
})
const trades = computed(() => (show.value.trades && asset.value
  ? paper.trades.filter(t => t.asset_symbol === asset.value!.symbol || t.asset_id === asset.value!.id)
      .map(t => ({ t: Date.parse(t.timestamp), p: t.simulated_price, side: t.side }))
  : []))
const myTriggers = computed(() => Object.values(notes.triggersById ?? {}).filter(t => asset.value && t.asset_id === String(asset.value.id)))
const triggers = computed(() => (show.value.alerts ? myTriggers.value.filter(t => t.status !== 'cancelled').map(t => ({ id: t.id, p: t.target_price, kind: t.kind, status: t.status })) : []))
const myDrawings = computed(() => Object.values(notes.annotationsById ?? {}).filter(a => asset.value && a.asset_id === String(asset.value.id) && (a.ts_a !== undefined || a.kind === 'level')))
const drawings = computed(() => (show.value.drawings ? myDrawings.value : []))

const marketEvents = ref<{ id: string; title: string; starts_at: string; category: string }[]>([])
async function loadEvents() {
  try {
    const list = await ($fetch as (u: string) => Promise<unknown>)(publicAssetUrl('/data/global/events.json'))
    marketEvents.value = Array.isArray(list) ? (list as any[]) : []
  } catch { marketEvents.value = [] }
}
const events = computed(() => {
  if (!show.value.events || !asset.value) return []
  const type = asset.value.type
  const t0 = candles.value[0]?.t ?? 0
  return marketEvents.value
    .filter(e => e.category === 'macro' || e.category === 'central_bank' || (e.category === 'crypto' && type === 'cryptocurrency') || (e.category === 'earnings' && type === 'stock'))
    .map(e => ({ t: Date.parse(e.starts_at), label: e.title }))
    .filter(e => Number.isFinite(e.t) && e.t >= t0)
})

// Alerts fire from the live price, like on the asset page.
watch(() => [asset.value?.id, asset.value?.current_price] as const, ([id, p]) => {
  if (id && Number(p) > 0) notes.evaluatePrice(String(id), Number(p))
})

// ── Chart events ──────────────────────────────────────────────────────────
const chart = ref<InstanceType<typeof ChartWorkspace> | null>(null)
const hoverI = ref<number | null>(null)
const pendingNote = ref<{ t: number; price: number } | null>(null)
const noteInput = ref<HTMLInputElement | null>(null)
const noteText = ref('')
const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null
function say(s: string) {
  flash.value = s
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = '' }, 2600)
}

function onDraw(a: any) {
  if (!asset.value) return
  notes.addAnnotation({ ...a, asset_id: String(asset.value.id) })
  show.value.drawings = true // a drawing just made must be visible, even if drawings were hidden
  say(a.kind === 'level' ? `Level saved at ${fmtAxisPrice(a.price_a, kind.value)}` : 'Trend line saved')
}
function onNote(p: { t: number; price: number }) {
  pendingNote.value = p
  noteText.value = ''
  void nextTick(() => noteInput.value?.focus())
}
function saveNote() {
  if (!pendingNote.value || !asset.value || !noteText.value.trim()) { pendingNote.value = null; return }
  notes.addAnnotation({ asset_id: String(asset.value.id), kind: 'note', price_a: pendingNote.value.price, ts_a: pendingNote.value.t, label: noteText.value.trim().slice(0, 120) })
  show.value.drawings = true
  pendingNote.value = null
  say('Note saved')
}
function addAlert(price: number) {
  const a = asset.value
  if (!a || !(price > 0)) return
  const cur = Number(a.current_price) || price
  notes.addTrigger({ asset_id: String(a.id), kind: price >= cur ? 'cross_above' : 'cross_below', target_price: +price.toPrecision(6), current_price_at_creation: cur })
  show.value.alerts = true
  side.value = 'alerts'
  say(`Alert set: ${price >= cur ? 'above' : 'below'} ${fmtAxisPrice(price, kind.value)}`)
}
const alertInput = ref('')
const alertError = ref('')
function addAlertFromInput() {
  const raw = alertInput.value.trim().replace(/\s/g, '').replace(',', '.')
  const m = /^(\d+(?:\.\d+)?)([kKmM])?%?$/.exec(raw)
  if (!m) { alertError.value = 'Type a price like 85000, 85.5k or, for a bet, 45%.'; return }
  let v = Number(m[1]) * (m[2]?.toLowerCase() === 'k' ? 1e3 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1)
  if (kind.value === 'probability' && (v > 1 || raw.endsWith('%'))) v /= 100
  if (!(v > 0) || (kind.value === 'probability' && v >= 1)) { alertError.value = 'That price is out of range.'; return }
  alertError.value = ''
  addAlert(v)
  alertInput.value = ''
}
function clearDrawings() {
  for (const d of myDrawings.value) notes.removeAnnotation(d.id)
  say('Drawings cleared')
}

// ── Toolbar actions ───────────────────────────────────────────────────────
function toggleInd(id: IndicatorId) {
  indicators.value = indicators.value.includes(id) ? indicators.value.filter(x => x !== id) : [...indicators.value, id]
}
const cmpQ = ref('')
const cmpList = computed(() => matchList(cmpQ.value, [assetId.value, ...compareIds.value]).slice(0, 30))
function addCompare(a: Asset) {
  if (compareIds.value.length >= 2) return
  compareIds.value = [...compareIds.value, String(a.id).toLowerCase()]
  openMenu.value = null
  cmpQ.value = ''
}
function removeCompare(id: string) { compareIds.value = compareIds.value.filter(x => x !== id) }

const page = ref<HTMLElement | null>(null)
const isFs = ref(false)
function onFs() { isFs.value = !!document.fullscreenElement }
function toggleFs() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else if (page.value?.requestFullscreen) void page.value.requestFullscreen().catch(() => say('Full screen is not available here'))
  else say('Full screen is not available here')
}

/** PNG of the chart: inline the computed colours (CSS variables do not survive serialisation). */
function exportPng() {
  const svg = (chart.value as any)?.svg as SVGSVGElement | undefined
  if (!svg || !(svg instanceof SVGSVGElement)) { say('Nothing to export yet'); return }
  const clone = svg.cloneNode(true) as SVGSVGElement
  const src = svg.querySelectorAll('*')
  const dst = clone.querySelectorAll('*')
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const d = dst[i] as SVGElement
    for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-family', 'font-weight']) d.style.setProperty(p, cs.getPropertyValue(p))
  })
  const w = svg.width.baseVal.value
  const h = svg.height.baseVal.value
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w * 2
    c.height = h * 2
    const ctx = c.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0)
    ctx.fillStyle = 'rgba(255,255,255,.45)'
    ctx.font = '11px sans-serif'
    ctx.fillText(`${asset.value?.symbol ?? ''} · ${rangeId.value} · ${interval.value.id} · Strades`, 10, h - 24)
    URL.revokeObjectURL(url)
    const a = document.createElement('a')
    a.download = `${asset.value?.symbol ?? 'chart'}-${rangeId.value}-${interval.value.id}.png`
    a.href = c.toDataURL('image/png')
    a.click()
    say('PNG downloaded')
  }
  img.onerror = () => { URL.revokeObjectURL(url); say('Export failed') }
  img.src = url
}
async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    say('Link copied')
  } catch {
    // no clipboard permission (http, iframe): select-and-copy fallback
    const ta = document.createElement('textarea')
    ta.value = window.location.href
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand?.('copy')
    ta.remove()
    say(ok ? 'Link copied' : 'Copy failed: the link is in the address bar')
  }
}

const TOOLS: { id: WsTool; label: string; key: string; glyph: string }[] = [
  { id: 'cursor', label: 'Move / zoom', key: 'V', glyph: '✥' },
  { id: 'trend', label: 'Trend line (drag)', key: 'T', glyph: '╱' },
  { id: 'level', label: 'Horizontal level (click)', key: 'H', glyph: '═' },
  { id: 'ruler', label: 'Measure (drag)', key: 'R', glyph: '⟷' },
  { id: 'note', label: 'Note (click)', key: 'N', glyph: '✎' },
  { id: 'alert', label: 'Price alert (click)', key: 'L', glyph: '⚑' },
]
const toolLabel = computed(() => TOOLS.find(t => t.id === tool.value)?.label ?? '')
function onHotkey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (openMenu.value) { openMenu.value = null; return }
    if (pendingNote.value) { pendingNote.value = null; return }
    tool.value = 'cursor'
    return
  }
  const el = e.target as HTMLElement | null
  if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return
  if (e.metaKey || e.ctrlKey || e.altKey || openMenu.value || pendingNote.value) return
  const t = TOOLS.find(x => x.key.toLowerCase() === e.key.toLowerCase())
  if (t) { tool.value = t.id; e.preventDefault() }
}

// ── Info / stats over the loaded range ───────────────────────────────────
const stats = computed(() => {
  const c = candles.value
  if (c.length < 2) return null
  const first = c[0]!
  const last = c[c.length - 1]!
  const hi = Math.max(...c.map(x => x.h))
  const lo = Math.min(...c.map(x => x.l))
  const closes = c.map(x => x.c)
  const r = rsiOf(closes, 14).at(-1)
  const s50 = sma(closes, Math.min(50, closes.length)).at(-1)
  const sigma = realisedHourlySigma(c)
  const vols = c.map(x => x.v ?? 0).filter(v => v > 0)
  return {
    chg: (last.c / first.o - 1) * 100, hi, lo, fromHi: (last.c / hi - 1) * 100,
    annVol: sigma * Math.sqrt(24 * 365) * 100, dayVol: sigma * Math.sqrt(24) * 100,
    rsi: r ?? null, vsSma: s50 ? (last.c / s50 - 1) * 100 : null,
    avgVol: vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : null,
    count: c.length, simShare: c.filter(x => x.sim).length / c.length,
  }
})
const hovered = computed(() => (hoverI.value !== null ? candles.value[hoverI.value] ?? null : null))
const resetKey = computed(() => `${assetId.value}|${rangeId.value}|${interval.value.id}`)
const fmtP = (v: number) => fmtPrice(v, kind.value, currency.value)
const shortT = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const indAvailable = (i: (typeof INDICATORS)[number]) => !i.needsVolume || hasVolume.value
const activeCount = computed(() => indicators.value.length + compareIds.value.length + (scale.value !== 'linear' ? 1 : 0))
const SIDE_TABS = computed(() => [
  ['predict', 'Predict'], ['trade', 'Paper trade'],
  ['alerts', `Alerts${myTriggers.value.length ? ` ${myTriggers.value.length}` : ''}`],
  ['drawings', `Drawings${myDrawings.value.length ? ` ${myDrawings.value.length}` : ''}`],
  ['info', 'Info'],
] as const)
</script>

<template>
  <div ref="page" class="cw" :class="{ fs: isFs }">
    <!-- ── Header: asset (row 1) · quote (row 2 on phones) · view actions ── -->
    <header class="cw-head">
      <div class="cw-pickwrap" data-menu="asset">
        <button type="button" class="cw-pick" :aria-expanded="openMenu === 'asset'" aria-haspopup="listbox" aria-label="Change asset" @click="toggleMenu('asset')">
          <span class="cw-sym" :style="{ color: tColor }">{{ asset?.symbol ?? assetId.toUpperCase() }}</span>
          <span class="cw-name">{{ asset?.name ?? (ready ? 'Unknown asset' : 'Loading…') }}</span>
          <span class="cw-caret" aria-hidden="true">▾</span>
        </button>
        <div v-if="openMenu === 'asset'" class="cw-pop" role="dialog" aria-label="Choose an asset">
          <input ref="pickerInput" v-model="pickerQ" class="cw-input" type="search" placeholder="Search symbol or name" aria-label="Search assets"
            @keydown.enter.prevent="pickerList[0] && choose(pickerList[0])" />
          <ul role="listbox" class="cw-list" aria-label="Assets">
            <li v-for="a in pickerList" :key="a.id">
              <button type="button" role="option" :aria-selected="String(a.id).toLowerCase() === assetId" @click="choose(a)">
                <b :style="{ color: typeColor(a.type) }">{{ a.symbol.length > 10 ? a.symbol.slice(0, 9) + '…' : a.symbol }}</b>
                <span>{{ a.name }}</span>
                <i>{{ TYPE_LABEL[a.type] ?? a.type }}</i>
              </button>
            </li>
            <li v-if="!pickerList.length" class="cw-muted cw-empty">No asset matches “{{ pickerQ }}”.</li>
          </ul>
        </div>
      </div>
      <div v-if="asset" class="cw-quote">
        <span class="cw-price">{{ fmtP(Number(asset.current_price)) }}</span>
        <span v-if="change !== null" class="cw-chg" :class="change >= 0 ? 'up' : 'down'">{{ fmtPct(change, 2) }} <small>24h</small></span>
        <span class="cw-type" :style="{ borderColor: tColor, color: tColor }">{{ TYPE_LABEL[asset.type] ?? asset.type }}</span>
        <NuxtLink :to="`/assets/${asset.id}`" class="cw-link">Asset page →</NuxtLink>
      </div>
      <div class="cw-actions">
        <ChartStyleToggle />
        <span class="cw-actions-x">
          <button type="button" class="cw-btn" title="Download PNG" aria-label="Download the chart as PNG" @click="exportPng">⤓ PNG</button>
          <button type="button" class="cw-btn" title="Copy a link to this view" aria-label="Copy a link to this view" @click="copyLink">⧉ Link</button>
          <button type="button" class="cw-btn" :aria-pressed="isFs" :aria-label="isFs ? 'Exit full screen' : 'Full screen'" @click="toggleFs">{{ isFs ? '⤡ Exit' : '⤢ Full' }}</button>
        </span>
      </div>
    </header>

    <!-- ── Controls: range always; the rest folds on phones ── -->
    <section class="cw-controls" aria-label="Chart settings">
      <div class="cw-line">
        <div class="cw-seg cw-ranges" role="group" aria-label="Range">
          <button v-for="r in RANGES" :key="r.id" type="button" class="cw-chip" :aria-pressed="rangeId === r.id" @click="rangeId = r.id">{{ r.id }}</button>
        </div>
        <button type="button" class="cw-chip cw-settings-btn" :aria-expanded="settingsOpen" aria-controls="cw-settings" @click="settingsOpen = !settingsOpen">
          ⚙ Settings<b v-if="activeCount">{{ activeCount }}</b>
        </button>
      </div>

      <div id="cw-settings" class="cw-settings" :class="{ open: settingsOpen }">
        <label class="cw-field">
          <span class="cw-lbl">Interval</span>
          <select v-model="intervalId" aria-label="Candle interval">
            <option value="auto">Auto · {{ autoInterval.id }}</option>
            <option v-for="i in intervalChoices" :key="i.id" :value="i.id">{{ i.id }}</option>
          </select>
        </label>

        <div class="cw-field">
          <span class="cw-lbl">Scale</span>
          <div class="cw-seg" role="group" aria-label="Price scale">
            <button type="button" class="cw-chip" :aria-pressed="scale === 'linear' && !compare.length" :disabled="compare.length > 0" @click="scale = 'linear'">Linear</button>
            <button type="button" class="cw-chip" :aria-pressed="scale === 'log' && !compare.length" :disabled="kind === 'probability' || compare.length > 0" @click="scale = 'log'">Log</button>
            <button type="button" class="cw-chip" :aria-pressed="percentMode" @click="scale = 'percent'">%</button>
          </div>
          <span v-if="compare.length" class="cw-muted">% while comparing</span>
        </div>

        <div class="cw-field cw-menu" data-menu="ind">
          <span class="cw-lbl">Indicators</span>
          <button type="button" class="cw-chip" :aria-expanded="openMenu === 'ind'" @click="toggleMenu('ind')">ƒ {{ indicators.length ? `${indicators.length} on` : 'Add' }} ▾</button>
          <div v-if="openMenu === 'ind'" class="cw-menu-body" role="group" aria-label="Indicators">
            <label v-for="i in INDICATORS" :key="i.id" class="cw-check" :class="{ off: !indAvailable(i) }" :title="indAvailable(i) ? i.hint : 'Needs real volume (not available for this asset)'">
              <input type="checkbox" :checked="indicators.includes(i.id)" :disabled="!indAvailable(i)" @change="toggleInd(i.id)" />
              <i :style="{ background: i.color }" />
              <span>{{ i.label }}<small v-if="!indAvailable(i)"> · needs volume</small></span>
            </label>
          </div>
        </div>

        <div class="cw-field cw-menu" data-menu="ov">
          <span class="cw-lbl">Overlays</span>
          <button type="button" class="cw-chip" :aria-expanded="openMenu === 'ov'" @click="toggleMenu('ov')">◉ {{ Object.values(show).filter(Boolean).length }} shown ▾</button>
          <div v-if="openMenu === 'ov'" class="cw-menu-body" role="group" aria-label="Overlays">
            <label class="cw-check"><input v-model="show.calls" type="checkbox" /> <span>Your calls</span></label>
            <label class="cw-check" :title="friends.isRevealed.value ? '' : 'Hidden until you reveal them (keeps your own call unbiased)'">
              <input type="checkbox" :checked="show.friends" @change="onFriendsToggle(($event.target as HTMLInputElement).checked)" />
              <span>Friends' calls<small v-if="!friends.isRevealed.value"> · reveals them</small></span>
            </label>
            <label class="cw-check"><input v-model="show.trades" type="checkbox" /> <span>Paper trades</span></label>
            <label class="cw-check"><input v-model="show.alerts" type="checkbox" /> <span>Price alerts</span></label>
            <label class="cw-check"><input v-model="show.drawings" type="checkbox" /> <span>Drawings</span></label>
            <label class="cw-check"><input v-model="show.events" type="checkbox" /> <span>Market events</span></label>
          </div>
        </div>

        <div class="cw-field cw-menu cw-cmp" data-menu="cmp">
          <span class="cw-lbl">Compare</span>
          <span v-for="(id, k) in compareIds" :key="id" class="cw-cmp-chip" :style="{ borderColor: CMP_COLORS[k] }">
            <i :style="{ background: CMP_COLORS[k] }" />{{ byId(id)?.symbol ?? id.toUpperCase() }}
            <button type="button" :aria-label="`Remove ${byId(id)?.symbol ?? id} from the comparison`" @click="removeCompare(id)">✕</button>
          </span>
          <button v-if="compareIds.length < 2" type="button" class="cw-chip" :aria-expanded="openMenu === 'cmp'" @click="toggleMenu('cmp')">+ Add</button>
          <div v-if="openMenu === 'cmp'" class="cw-menu-body cw-menu-wide" role="dialog" aria-label="Compare with">
            <input ref="cmpInput" v-model="cmpQ" class="cw-input" type="search" placeholder="Compare with…" aria-label="Search an asset to compare"
              @keydown.enter.prevent="cmpList[0] && addCompare(cmpList[0])" />
            <ul class="cw-list">
              <li v-for="a in cmpList" :key="a.id"><button type="button" @click="addCompare(a)"><b :style="{ color: typeColor(a.type) }">{{ a.symbol.length > 10 ? a.symbol.slice(0, 9) + '…' : a.symbol }}</b><span>{{ a.name }}</span><i>{{ TYPE_LABEL[a.type] ?? a.type }}</i></button></li>
              <li v-if="!cmpList.length" class="cw-muted cw-empty">No asset matches.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Workspace ── -->
    <div class="cw-body">
      <div class="cw-tools" role="toolbar" aria-label="Drawing tools">
        <button v-for="t in TOOLS" :key="t.id" type="button" class="cw-tool" :aria-pressed="tool === t.id" :title="`${t.label} — ${t.key}`" :aria-label="`${t.label} (${t.key})`" @click="tool = t.id">{{ t.glyph }}</button>
        <span class="cw-tools-sep" aria-hidden="true" />
        <button type="button" class="cw-tool" title="Zoom in (+)" aria-label="Zoom in" @click="chart?.zoomIn()">＋</button>
        <button type="button" class="cw-tool" title="Zoom out (−)" aria-label="Zoom out" @click="chart?.zoomOut()">－</button>
        <button type="button" class="cw-tool" title="Reset view (0 or double click)" aria-label="Reset the view" @click="chart?.reset()">⟲</button>
      </div>

      <div class="cw-chart">
        <ClientOnly>
          <ChartWorkspace
            v-if="asset && candles.length"
            ref="chart"
            :candles="candles" :interval-ms="interval.hours * HOUR" :kind="kind"
            :chart-style="appearance.chartStyle" :log="scale === 'log' && !percentMode" :percent="percentMode"
            :indicators="indicators" :tool="tool" :calls="calls" :trades="trades" :triggers="triggers"
            :annotations="drawings" :events="events" :compare="compare" :reset-key="resetKey"
            :label="`${asset.symbol} ${rangeId} chart`"
            @hover="hoverI = $event" @draw="onDraw" @note="onNote" @alert="addAlert"
            @remove="(id: string) => { notes.removeAnnotation(id); say('Drawing removed') }"
            @tool-done="tool = 'cursor'"
          />
          <UIEmptyState v-else-if="ready && !asset" icon="▥" title="Unknown asset" :message="`No asset “${assetId}”. Pick one from the list.`" />
          <div v-else class="cw-loading">Loading candles…</div>
          <template #fallback><div class="cw-loading">Loading chart…</div></template>
        </ClientOnly>
        <form v-if="pendingNote" class="cw-note" @submit.prevent="saveNote">
          <label>Note at {{ fmtAxisPrice(pendingNote.price, kind) }} · {{ shortT(pendingNote.t) }}
            <input ref="noteInput" v-model="noteText" class="cw-input" maxlength="120" placeholder="What do you see here?" />
          </label>
          <span class="cw-note-actions">
            <button type="submit" class="cw-btn primary" :disabled="!noteText.trim()">Save</button>
            <button type="button" class="cw-btn" @click="pendingNote = null">Cancel</button>
          </span>
        </form>
        <p v-if="tool !== 'cursor'" class="cw-hint">{{ toolLabel }} · Esc to stop</p>
        <p class="cw-flash" role="status" aria-live="polite">{{ flash }}</p>
      </div>

      <!-- ── Panels ── -->
      <aside class="cw-side" aria-label="Chart panels">
        <div class="cw-tabs" role="tablist">
          <button v-for="t in SIDE_TABS" :key="t[0]" type="button" role="tab" :aria-selected="side === t[0]" class="cw-tab" @click="side = t[0]">{{ t[1] }}</button>
        </div>

        <div v-if="asset" class="cw-panel" role="tabpanel">
          <ClientOnly>
            <PredictPanel v-if="side === 'predict'" :asset="asset" :change-pct="change ?? undefined" source="detail" :height="170"
              :friends="friends.predictions.value" :reveal-friends="friends.isRevealed.value" @toggle-friends="friends.toggle()" />
          </ClientOnly>

          <AssetQuickPaperBet v-if="side === 'trade'" :asset-id="String(asset.id)" :asset-symbol="asset.symbol" :current-price="Number(asset.current_price) || 100" />

          <template v-if="side === 'alerts'">
            <form class="cw-row" @submit.prevent="addAlertFromInput">
              <input v-model="alertInput" class="cw-input" inputmode="decimal" :placeholder="kind === 'probability' ? 'Chance, e.g. 45%' : `Price, e.g. ${fmtAxisPrice(Number(asset.current_price) * 1.05, kind)}`" aria-label="Alert price" :aria-invalid="!!alertError" />
              <button type="submit" class="cw-btn primary">Add alert</button>
            </form>
            <p v-if="alertError" class="cw-err" role="alert">{{ alertError }}</p>
            <p class="cw-muted">Or pick the ⚑ tool and click the chart. Alerts fire from the live price and show in Notifications.</p>
            <ul class="cw-items">
              <li v-for="t in myTriggers" :key="t.id" :class="t.status">
                <span>⚑ {{ t.kind === 'cross_above' ? 'Above' : 'Below' }} <b>{{ fmtAxisPrice(t.target_price, kind) }}</b>
                  <i v-if="t.status === 'armed' && Number(asset.current_price) > 0" :class="t.target_price >= Number(asset.current_price) ? 'up' : 'down'"> {{ fmtPct((t.target_price / Number(asset.current_price) - 1) * 100, 2) }} away</i></span>
                <span class="cw-muted">{{ t.status === 'triggered' ? `fired ${shortT(t.triggered_at!)}` : `set at ${fmtAxisPrice(t.current_price_at_creation, kind)}` }}</span>
                <button type="button" class="cw-x" :aria-label="`Delete alert ${t.target_price}`" @click="notes.removeTrigger(t.id)">✕</button>
              </li>
              <li v-if="!myTriggers.length" class="cw-muted">No alert on {{ asset.symbol }} yet.</li>
            </ul>
          </template>

          <template v-if="side === 'drawings'">
            <p class="cw-muted">Tools: trend line (T), level (H), ruler (R), note (N). Click a drawing, then Delete to remove it. Saved on this device per asset.</p>
            <ul class="cw-items">
              <li v-for="d in myDrawings" :key="d.id">
                <span>{{ d.kind === 'level' ? '═ Level' : d.kind === 'trendline' ? '╱ Trend' : '✎ Note' }}
                  <b>{{ d.kind === 'note' ? d.label : fmtAxisPrice(d.price_a ?? 0, kind) }}{{ d.kind === 'trendline' ? ` → ${fmtAxisPrice(d.price_b ?? 0, kind)}` : '' }}</b></span>
                <span v-if="d.ts_a" class="cw-muted">{{ shortT(d.ts_a) }}</span>
                <button type="button" class="cw-x" :aria-label="`Delete ${d.kind}`" @click="notes.removeAnnotation(d.id)">✕</button>
              </li>
              <li v-if="!myDrawings.length" class="cw-muted">No drawing on {{ asset.symbol }} yet.</li>
            </ul>
            <button v-if="myDrawings.length" type="button" class="cw-btn" @click="clearDrawings">Clear all drawings</button>
          </template>

          <template v-if="side === 'info'">
            <dl v-if="stats" class="cw-stats">
              <div><dt>Change ({{ rangeId }})</dt><dd :class="stats.chg >= 0 ? 'up' : 'down'">{{ fmtPct(stats.chg, 2) }}</dd></div>
              <div><dt>High</dt><dd>{{ fmtAxisPrice(stats.hi, kind) }}</dd></div>
              <div><dt>Low</dt><dd>{{ fmtAxisPrice(stats.lo, kind) }}</dd></div>
              <div><dt>From high</dt><dd :class="stats.fromHi >= 0 ? 'up' : 'down'">{{ fmtPct(stats.fromHi, 2) }}</dd></div>
              <div><dt>Volatility</dt><dd>{{ stats.dayVol.toFixed(2) }} %/day · {{ stats.annVol.toFixed(0) }} %/yr</dd></div>
              <div><dt>RSI 14</dt><dd>{{ stats.rsi === null ? '—' : stats.rsi.toFixed(1) }}{{ stats.rsi !== null ? (stats.rsi > 70 ? ' · stretched' : stats.rsi < 30 ? ' · washed out' : '') : '' }}</dd></div>
              <div><dt>vs SMA 50</dt><dd :class="(stats.vsSma ?? 0) >= 0 ? 'up' : 'down'">{{ stats.vsSma === null ? '—' : fmtPct(stats.vsSma, 2) }}</dd></div>
              <div><dt>Avg volume</dt><dd>{{ stats.avgVol === null ? '— (no volume data)' : stats.avgVol.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</dd></div>
              <div><dt>Candles</dt><dd>{{ stats.count }} × {{ interval.id }}</dd></div>
              <div class="wide"><dt>Data</dt><dd>{{ source }}</dd></div>
            </dl>
            <p class="cw-muted">Keyboard: ← → pan · + − zoom · 0 reset · V T H R N L tools · Esc stop.</p>
          </template>
        </div>
      </aside>
    </div>

    <!-- ── Status ── -->
    <footer class="cw-status">
      <span v-if="asset">{{ asset.symbol }} · {{ rangeId }} · {{ interval.id }} · {{ candles.length }} candles</span>
      <span v-if="allSimulated" class="cw-sim">simulated</span>
      <span v-else-if="realFrom" class="cw-sim">sim before {{ shortT(realFrom) }}</span>
      <span class="cw-muted">{{ source }}</span>
      <span v-if="hovered" class="cw-muted cw-hover">{{ shortT(hovered.t) }} · C {{ fmtAxisPrice(hovered.c, kind) }}</span>
      <span class="cw-muted cw-time">updated {{ ready ? new Date(now).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—' }}</span>
    </footer>
  </div>
</template>

<style scoped>
/*
 * Sizes (also in Components.md §15)
 *   page        fills the layout's .page-frame (max 1320 / 1440 / 1680 px); never wider (min-width: 0 everywhere)
 *   chart       min 280 × 300 px; height clamp(300px, 55vh, 900px) from 1024 px
 *   side panel  below the chart up to 1439 px; next to it from 1440 px, 320–380 px wide
 *   menus       max calc(100vw - 24px); inline (not floating) on phones
 *   targets     ≥ 32 px (≥ 36 px on touch screens)
 */
.cw { --cw-gap: 8px; display: flex; flex-direction: column; gap: var(--cw-gap); min-width: 0; max-width: 100%; }
.cw * { box-sizing: border-box; }
.cw.fs { background: var(--secondary-darker, #0a0a0a); padding: 10px; height: 100vh; overflow: auto; }

/* Header */
.cw-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-width: 0; }
.cw-pickwrap { position: relative; min-width: 0; max-width: 100%; }
.cw-pick { display: inline-flex; align-items: baseline; gap: 8px; min-height: 36px; max-width: 100%; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--edge-raised, rgba(255,255,255,.09)); background: var(--surface-raised, #1b1d26); color: var(--text-white, #fff); cursor: pointer; }
.cw-pick:hover { border-color: var(--edge-lit, rgba(255,255,255,.14)); }
.cw-sym { font-family: var(--font-market-data, monospace); font-weight: 800; font-size: 1rem; white-space: nowrap; }
.cw-name { min-width: 0; font-family: var(--font-chrome, sans-serif); font-size: .8rem; color: var(--text-light-gray, #ccc); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28ch; }
.cw-caret { color: var(--text-gray, #888); font-size: .7rem; }
.cw-quote { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; }
.cw-price { font-family: var(--font-market-data, monospace); font-weight: 800; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.cw-chg { font-family: var(--font-market-data, monospace); font-weight: 700; font-size: .8rem; }
.cw-chg small { color: var(--text-gray, #888); font-weight: 400; }
.cw-type { font-size: .6rem; text-transform: uppercase; letter-spacing: .08em; border: 1px solid; border-radius: 999px; padding: 1px 7px; }
.cw-link { display: inline-flex; align-items: center; min-height: 28px; font-size: .72rem; color: rgba(140,180,255,.95); text-decoration: none; }
.cw-link:hover { text-decoration: underline; }
.cw-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; min-width: 0; }
.cw-actions-x { display: inline-flex; gap: 6px; }

/* Floating panels */
.cw-pop, .cw-menu-body {
  position: absolute; top: calc(100% + 4px); left: 0; z-index: 40; max-width: calc(100vw - 24px);
  padding: 6px; border-radius: 10px; background: var(--surface-overlay, #20232e); border: 1px solid var(--edge-raised, rgba(255,255,255,.09)); box-shadow: var(--shadow-depth-3, 0 14px 36px rgba(0,0,0,.55));
}
.cw-pop { width: 360px; }
.cw-pop.align-end, .cw-menu-body.align-end { left: auto; right: 0; }
.cw-menu-body { display: grid; gap: 2px; width: 240px; }
.cw-menu-body.cw-menu-wide { width: 320px; display: block; }
.cw-list { list-style: none; margin: 6px 0 0; padding: 0; max-height: min(320px, 50vh); overflow: auto; }
.cw-list button { display: grid; grid-template-columns: minmax(4.5rem, 6.5rem) minmax(0, 1fr) auto; gap: 6px; align-items: baseline; width: 100%; min-height: 32px; text-align: left; padding: 6px; border: 0; border-radius: 6px; background: transparent; color: var(--text-light-gray, #ddd); cursor: pointer; font-size: .75rem; }
.cw-list button:hover, .cw-list button:focus-visible, .cw-list button[aria-selected="true"] { background: rgba(255,255,255,.06); }
.cw-list b { font-family: var(--font-market-data, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cw-list i { font-style: normal; font-size: .6rem; color: var(--text-gray, #888); text-transform: uppercase; }
.cw-empty { padding: 8px 6px; }
.cw-input { width: 100%; min-height: 32px; padding: 6px 9px; border-radius: 7px; border: 1px solid var(--edge-raised, rgba(255,255,255,.12)); background: rgba(0,0,0,.25); color: var(--text-white, #fff); font: inherit; font-size: .8rem; }
.cw-input:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }
.cw-input[aria-invalid="true"] { border-color: var(--app-color-down, #ff4444); }

/* Controls */
.cw-controls { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 10px; background: var(--surface-base, #12141b); border: 1px solid var(--edge-soft, rgba(255,255,255,.05)); min-width: 0; }
.cw-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cw-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; min-width: 0; }
.cw-ranges { flex: 1; }
.cw-settings { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); align-items: start; gap: 8px 16px; min-width: 0; }
.cw-field { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.cw-field > .cw-seg, .cw-field > .cw-chip, .cw-field > select { max-width: 100%; }
.cw-cmp { flex-direction: row; flex-wrap: wrap; align-items: center; }
.cw-cmp .cw-lbl { flex: 0 0 100%; }
.cw-lbl { font-size: .6rem; text-transform: uppercase; letter-spacing: .07em; color: var(--text-gray, #888); }
.cw-field select { min-height: 32px; max-width: 100%; padding: 0 6px; border-radius: 6px; border: 1px solid var(--edge-raised, rgba(255,255,255,.1)); background: var(--surface-raised, #1b1d26); color: var(--text-white, #fff); font: 600 .72rem var(--font-market-data, monospace); }
.cw-chip { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; min-width: 32px; justify-content: center; padding: 0 9px; border-radius: 6px; border: 1px solid var(--edge-raised, rgba(255,255,255,.1)); background: transparent; color: var(--text-gray, #9aa0a6); font: 600 .72rem/1 var(--font-market-data, monospace); cursor: pointer; white-space: nowrap; }
.cw-chip:hover:not(:disabled) { color: var(--text-white, #fff); }
.cw-chip[aria-pressed="true"], .cw-chip[aria-expanded="true"] { color: var(--text-white, #fff); border-color: rgba(0,170,255,.55); background: rgba(0,170,255,.12); }
.cw-chip:disabled { opacity: .4; cursor: not-allowed; }
.cw-chip b { color: var(--primary-blue, #00aaff); }
.cw-settings-btn { display: none; }
.cw-chip:focus-visible, .cw-btn:focus-visible, .cw-tool:focus-visible, .cw-tab:focus-visible, .cw-pick:focus-visible, .cw-field select:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }
.cw-check { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 4px 6px; border-radius: 6px; font-size: .76rem; color: var(--text-light-gray, #ddd); cursor: pointer; }
.cw-check:hover { background: rgba(255,255,255,.05); }
.cw-check.off { opacity: .5; cursor: not-allowed; }
.cw-check i { flex: 0 0 auto; width: 12px; height: 3px; border-radius: 2px; }
.cw-check small { color: var(--text-gray, #888); }
.cw-cmp-chip { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 2px 0 8px; border-radius: 6px; border: 1px solid; font: 700 .72rem var(--font-market-data, monospace); }
.cw-cmp-chip i { width: 8px; height: 8px; border-radius: 50%; }
.cw-cmp-chip button { border: 0; background: none; color: var(--text-gray, #888); cursor: pointer; min-width: 28px; min-height: 28px; }

/* Workspace: stacked by default */
.cw-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--cw-gap); min-width: 0; }
.cw-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; padding: 4px; border-radius: 10px; background: var(--surface-base, #12141b); border: 1px solid var(--edge-soft, rgba(255,255,255,.05)); min-width: 0; }
.cw-tool { width: 36px; height: 36px; border-radius: 7px; border: 1px solid transparent; background: transparent; color: var(--text-gray, #9aa0a6); font-size: 1rem; cursor: pointer; }
.cw-tool:hover { color: var(--text-white, #fff); background: rgba(255,255,255,.05); }
.cw-tool[aria-pressed="true"] { color: var(--text-white, #fff); border-color: rgba(0,170,255,.55); background: rgba(0,170,255,.14); }
.cw-tools-sep { width: 1px; height: 22px; margin: 0 4px; background: var(--edge-raised, rgba(255,255,255,.09)); }
.cw-chart { position: relative; min-width: 280px; height: clamp(300px, 52vh, 560px); border-radius: 10px; background: var(--surface-sunken, #08090d); border: 1px solid var(--edge-soft, rgba(255,255,255,.05)); overflow: hidden; }
.cw-loading { display: grid; place-items: center; height: 100%; color: var(--text-gray, #888); font-size: .8rem; }
.cw-note { position: absolute; left: 50%; top: 40px; transform: translateX(-50%); z-index: 5; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px; padding: 8px; border-radius: 10px; background: var(--surface-overlay, #20232e); border: 1px solid var(--edge-raised, rgba(255,255,255,.09)); width: min(440px, calc(100% - 16px)); }
.cw-note label { flex: 1 1 200px; display: grid; gap: 4px; font-size: .66rem; color: var(--text-gray, #999); min-width: 0; }
.cw-note-actions { display: inline-flex; gap: 6px; }
.cw-hint { position: absolute; left: 8px; bottom: 26px; margin: 0; padding: 2px 8px; border-radius: 6px; background: rgba(0,170,255,.15); color: var(--text-white, #fff); font-size: .66rem; pointer-events: none; max-width: calc(100% - 90px); }
.cw-flash { position: absolute; right: 64px; bottom: 26px; margin: 0; font-size: .72rem; color: var(--primary-green, #00ff88); pointer-events: none; text-shadow: 0 0 4px #08090d; }

.cw-side { display: flex; flex-direction: column; min-width: 0; border-radius: 10px; background: var(--surface-base, #12141b); border: 1px solid var(--edge-soft, rgba(255,255,255,.05)); }
.cw-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid var(--edge-soft, rgba(255,255,255,.05)); scrollbar-width: none; }
.cw-tabs::-webkit-scrollbar { display: none; }
.cw-tab { flex: 1 0 auto; min-height: 36px; padding: 8px 10px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-gray, #9aa0a6); font: 600 .72rem var(--font-chrome, sans-serif); cursor: pointer; white-space: nowrap; }
.cw-tab[aria-selected="true"] { color: var(--text-white, #fff); border-bottom-color: var(--primary-blue, #00aaff); }
.cw-panel { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cw-row { display: flex; flex-wrap: wrap; gap: 6px; }
.cw-row .cw-input { flex: 1 1 160px; width: auto; }
.cw-btn { min-height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--edge-raised, rgba(255,255,255,.12)); background: transparent; color: var(--text-light-gray, #ddd); font: 600 .72rem var(--font-chrome, sans-serif); cursor: pointer; white-space: nowrap; }
.cw-btn:hover:not(:disabled) { color: var(--text-white, #fff); border-color: var(--edge-lit, rgba(255,255,255,.2)); }
.cw-btn:disabled { opacity: .45; cursor: not-allowed; }
.cw-btn.primary { background: var(--primary-blue, #00aaff); color: #00121c; border-color: transparent; }
.cw-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.cw-items li { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; padding: 5px 6px; border-radius: 6px; background: rgba(255,255,255,.03); font-size: .74rem; font-family: var(--font-market-data, monospace); min-width: 0; }
.cw-items li.triggered { opacity: .6; }
.cw-items li > span:first-child { flex: 1 1 140px; min-width: 0; overflow-wrap: anywhere; }
.cw-x { margin-left: auto; min-width: 32px; min-height: 32px; border: 0; border-radius: 5px; background: transparent; color: var(--text-gray, #888); cursor: pointer; }
.cw-x:hover { color: var(--app-color-down, #ff4444); background: rgba(255,68,68,.08); }
.cw-muted { margin: 0; color: var(--text-gray, #888); font-size: .68rem; }
.cw-err { margin: 0; color: var(--app-color-down, #ff4444); font-size: .7rem; }
.cw-stats { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
.cw-stats div { padding: 6px; border-radius: 7px; background: rgba(255,255,255,.03); min-width: 0; }
.cw-stats div.wide { grid-column: 1 / -1; }
.cw-stats dt { font-size: .58rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-gray, #888); }
.cw-stats dd { margin: 2px 0 0; font-family: var(--font-market-data, monospace); font-size: .78rem; color: var(--text-light-gray, #ddd); overflow-wrap: anywhere; }
.up { color: var(--app-color-up, #00ff88); }
.down { color: var(--app-color-down, #ff4444); }

.cw-status { display: flex; align-items: center; gap: 4px 12px; flex-wrap: wrap; padding: 4px 8px; font-family: var(--font-market-data, monospace); font-size: .66rem; color: var(--text-light-gray, #ccc); min-width: 0; }
.cw-status > * { min-width: 0; overflow-wrap: anywhere; }
.cw-sim { padding: 0 6px; border: 1px dashed currentColor; border-radius: 999px; color: var(--warning-orange, #ffa500); text-transform: uppercase; font-size: .58rem; }
.cw-time { margin-left: auto; }

/* ≥ 1024: vertical tool rail next to the chart; panels still below */
@media (min-width: 1024px) {
  .cw-body { grid-template-columns: 48px minmax(0, 1fr); }
  .cw-tools { flex-direction: column; flex-wrap: nowrap; align-self: start; }
  .cw-tools-sep { width: 22px; height: 1px; margin: 4px 0; }
  .cw-side { grid-column: 1 / -1; }
  .cw-chart { height: clamp(300px, calc(100dvh - var(--nav-top-height, 3.25rem) - var(--nav-bottom-height, 4.1rem) - 210px), 900px); }
  .cw.fs .cw-chart { height: calc(100vh - 170px); }
}
/* ≥ 1440: the panels go to the right of the chart (enough room for both) */
@media (min-width: 1440px) {
  .cw-body { grid-template-columns: 48px minmax(560px, 1fr) clamp(320px, 24vw, 380px); }
  .cw-side { grid-column: auto; max-height: calc(100dvh - var(--nav-top-height, 3.25rem) - var(--nav-bottom-height, 4.1rem) - 150px); overflow: auto; }
}
/* Phones: one line of ranges + Settings; everything else unfolds below it, menus inline */
@media (max-width: 767px) {
  .cw-head { gap: 6px; }
  .cw-pickwrap, .cw-pick { width: 100%; }
  .cw-name { max-width: none; flex: 1; }
  .cw-quote { width: 100%; }
  .cw-actions { width: 100%; margin-left: 0; justify-content: space-between; }
  .cw-settings-btn { display: inline-flex; flex: 0 0 auto; }
  .cw-ranges { flex-wrap: nowrap; justify-content: space-between; }
  .cw-ranges .cw-chip { flex: 1 1 0; padding: 0 4px; min-width: 0; }
  .cw-settings { display: none; flex-direction: column; align-items: stretch; gap: 10px; padding-top: 6px; border-top: 1px solid var(--edge-soft, rgba(255,255,255,.05)); }
  .cw-settings.open { display: flex; }
  .cw-field { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr); align-items: center; }
  .cw-field > .cw-muted { grid-column: 2; }
  .cw-cmp { display: flex; }
  .cw-cmp .cw-lbl { flex: 0 0 5.5rem; }
  .cw-pop, .cw-menu-body, .cw-menu-body.cw-menu-wide { position: static; grid-column: 1 / -1; width: 100%; max-width: 100%; margin-top: 4px; box-shadow: none; }
  .cw-pop { position: absolute; width: 100%; }
  .cw-tools { flex-wrap: nowrap; justify-content: space-between; overflow-x: auto; }
  .cw-tool { flex: 0 0 auto; width: 36px; height: 36px; }
  .cw-tools-sep { display: none; }
  .cw-hover { display: none; }
}
@media (max-width: 480px) {
  .cw-line { flex-wrap: wrap; }
  .cw-ranges { flex: 1 1 100%; }
  .cw-settings-btn { flex: 1 1 100%; }
}
@media (max-width: 380px) {
  .cw-link { display: none; }
  .cw-actions-x .cw-btn { padding: 0 7px; }
  .cw-tool { width: 32px; height: 32px; font-size: .9rem; }
}
@media (pointer: coarse) {
  .cw-chip, .cw-btn, .cw-field select, .cw-input, .cw-check { min-height: 36px; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>
