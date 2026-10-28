<script setup lang="ts">
/**
 * SupplyTree — suppliers feed the asset, the asset feeds clients, and the
 * partners sit in a carousel under the book.
 *
 * Hover or focus a link and that company comes forward on the z axis.
 * The Map control morphs the same cards onto a wireframe globe. Every
 * motion (lift, carousel, rotation, morph) is a lerp toward a target, so
 * a finger, a mouse, or the keyboard can interrupt it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { navigateTo } from '#app'
import { globeDots, landPoints } from '~/utils/navGlobe'
import { clamp, type TreeNode } from '~/utils/assetChart'
import {
  capitalShare, capitalTone, chainFrames, foldColumn, formatCapital, globeAnchor, globeBox,
  lerp, linkPath, linkWidth, maxRailScroll, separatePins, toneWeight, wireframe,
  type CapitalTone, type Folded, type Frame,
} from '~/utils/supplyDesk'

const props = withDefaults(defineProps<{
  center: {
    symbol: string
    name: string
    color: string
    price?: string
    logo?: string
    flag?: string
    country?: string
    city?: string
    lat?: number | null
    lng?: number | null
    /** Listed asset this card opens. */
    id?: string
  }
  suppliers: TreeNode[]
  clients: TreeNode[]
  similar?: TreeNode[]
  supplierLabel?: string
  clientLabel?: string
  currency?: string
  usdPer?: number
  /** Known customer total, such as "200M+". Shown on the Consumers card. */
  consumerTotal?: string
}>(), {
  similar: () => [],
  supplierLabel: 'Suppliers',
  clientLabel: 'Clients',
  currency: 'USD',
  usdPer: 1,
  consumerTotal: '',
})

const root = ref<HTMLElement | null>(null)
const railEl = ref<HTMLElement | null>(null)
const width = ref(360)
const morph = ref(0)
const targetMorph = ref(0)
const lon = ref(0)
const targetLon = ref(0)
const tilt = ref(18)
const targetTilt = ref(18)
const scroll = ref(0)
const targetScroll = ref(0)
const lifts = ref<Record<string, number>>({})
const hover = ref<string | null>(null)
const pin = ref<string | null>(null)
const hiddenLogo = ref<Record<string, boolean>>({})
const reduce = ref(false)
const focus = computed(() => hover.value ?? pin.value)

let raf = 0
let ro: ResizeObserver | null = null
let railDrag: { x: number; origin: number; lastX: number; lastT: number; vx: number } | null = null
let mapDrag: { x: number; y: number; lon: number; tilt: number; lastX: number; lastY: number; lastT: number; vx: number; vy: number } | null = null
let dragged = false

const peers = computed(() => props.similar)
const suppliersOpen = ref(false)
const clientsOpen = ref(false)
const supplierFold = computed(() => foldColumn(props.suppliers, n => n.value_usd ?? 0))
const clientFold = computed(() => foldColumn(props.clients, n => n.value_usd ?? 0))
watch(() => props.suppliers, () => { suppliersOpen.value = false })
watch(() => props.clients, () => { clientsOpen.value = false })

function shownCount(fold: Folded<TreeNode>, open: boolean, extraGeneric: boolean) {
  const generic = fold.rest.length > 0 || extraGeneric ? 1 : 0
  return fold.main.length + generic + (open && fold.rest.length > 0 ? fold.rest.length : 0)
}
const layout = computed(() => chainFrames(
  width.value,
  shownCount(supplierFold.value, suppliersOpen.value, false),
  shownCount(clientFold.value, clientsOpen.value, !!props.consumerTotal),
  peers.value.length,
))
const maxScroll = computed(() => maxRailScroll(layout.value))
const globe = computed(() => globeBox(width.value))
const stageH = computed(() => Math.ceil(lerp(layout.value.height, globe.value.height, morph.value)))
const mappable = computed(() => {
  if (typeof props.center.lat === 'number' && typeof props.center.lng === 'number') return true
  return [...props.suppliers, ...props.clients, ...peers.value].some(n => typeof n.lat === 'number' && typeof n.lng === 'number')
})

watch(() => [props.center.lng, props.center.lat] as const, ([lng, lat]) => {
  if (typeof lng !== 'number' || targetMorph.value > 0.5) return
  lon.value = lng
  targetLon.value = lng
  if (typeof lat === 'number') {
    const t = clamp(lat, -40, 40)
    tilt.value = t
    targetTilt.value = t
  }
}, { immediate: true })

watch(maxScroll, (max) => {
  targetScroll.value = clamp(targetScroll.value, 0, max)
  scroll.value = clamp(scroll.value, 0, max)
})

function money(usd?: number | null) {
  return formatCapital(usd, props.currency, props.usdPer)
}
function totals(list: TreeNode[]) {
  const v = list.reduce((s, n) => s + (n.value_usd ?? 0), 0)
  const p = list.reduce((s, n) => s + (n.share_pct ?? 0), 0)
  return [String(list.length), p ? `${Math.round(p)}%` : '', money(v) || ''].filter(Boolean).join(' · ')
}
function tonesOf(list: TreeNode[]): CapitalTone[] {
  const values = list.map(n => n.value_usd)
  const shares = values.map(v => capitalShare(v, values))
  const max = Math.max(0, ...shares)
  return shares.map(s => capitalTone(toneWeight(s, max)))
}
function initials(name: string) {
  const parts = name.replace(/[()]/g, ' ').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w[0] ?? ''))
  return parts.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '•'
}

interface Card {
  key: string
  title: string
  /** Market value, shown larger than the origin line. */
  capital: string
  /** Country, product, or role. Smaller than the name and the capital. */
  origin: string
  end: string
  flag: string
  logo: string
  initials: string
  /** Folded-member count drawn in the logo slot. */
  count: string
  fill: string
  edge: string
  ink: string
  assetId?: string
  /** Set on the generic card. Clicking it expands the tail instead of navigating. */
  fold: '' | 's' | 'c'
  expanded: boolean
  /** Fades out once the globe is showing. The members take its place. */
  mapHide: boolean
  label: string
  x: number
  y: number
  w: number
  h: number
  z: number
  opacity: number
  scale: number
  lift: number
}

interface Link {
  key: string
  nodeKey: string
  d: string
  width: number
  kind: 'in' | 'out'
  opacity: number
  label: string
}

const view = computed(() => {
  const m = morph.value
  const g = globe.value
  const frames = layout.value
  const hot = focus.value
  const hotLift = hot ? (lifts.value[hot] ?? 0) : 0
  const sTones = tonesOf(props.suppliers)
  const cTones = tonesOf(props.clients)
  const pTones = tonesOf(peers.value)

  const anchor = (lat?: number | null, lng?: number | null) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return globeAnchor(lat, lng, lon.value, tilt.value, g.cx, g.cy, g.r)
  }
  const spots = [
    { key: 'asset', lat: props.center.lat, lng: props.center.lng },
    ...props.suppliers.map((n, i) => ({ key: `s${i}`, lat: n.lat, lng: n.lng })),
    ...props.clients.map((n, i) => ({ key: `c${i}`, lat: n.lat, lng: n.lng })),
    ...peers.value.map((n, i) => ({ key: `p${i}`, lat: n.lat, lng: n.lng })),
  ]
  const rawPins = spots.map(s => ({ key: s.key, pin: anchor(s.lat, s.lng) }))
  const frontPins = rawPins.filter(r => r.pin && r.pin.depth > 0).map(r => r.pin!)
  const spread = separatePins(frontPins, 54, g.cx, g.cy, g.r)
  const pinAt = new Map<string, { x: number; y: number; depth: number }>()
  let spreadI = 0
  for (const row of rawPins) {
    if (!row.pin) continue
    if (row.pin.depth > 0) {
      const moved = spread[spreadI++]!
      pinAt.set(row.key, { x: moved.x, y: moved.y, depth: row.pin.depth })
    } else pinAt.set(row.key, row.pin)
  }

  function pose(key: string, frame: Frame, peer = false, opts?: { mapHide?: boolean; globeOnly?: boolean }): { x: number; y: number; w: number; h: number; z: number; opacity: number; scale: number; lift: number; depth: number | null } {
    const lift = lifts.value[key] ?? 0
    const placed = pinAt.get(key) ?? null
    // On the globe a company rests as a small pin. Focus grows it back into the full panel.
    const gw = lerp(48, peer ? 156 : 176, lift)
    const gh = lerp(42, peer ? 74 : 68, lift)
    const from = peer ? { ...frame, x: frame.x - scroll.value } : frame
    const gx = placed ? placed.x - gw / 2 : from.x
    const gy = placed ? placed.y - gh / 2 : from.y
    const depth = placed ? placed.depth : null
    const back = depth != null && depth <= 0
    let opacity = back ? lerp(1, 0, m) : 1
    if (opts?.globeOnly) opacity = placed && (depth ?? 0) > 0 ? m : 0
    else if (opts?.mapHide) opacity *= 1 - m
    else if (!placed && m > 0) opacity = lerp(1, peer ? 0 : 0.25, m)
    if (hot && hot !== key && m < 0.45) opacity *= lerp(1, 0.62, hotLift)
    return {
      x: lerp(from.x, gx, m),
      y: lerp(from.y, gy, m),
      w: lerp(from.w, placed ? gw : from.w, m),
      h: lerp(from.h, placed ? gh : from.h, m),
      z: lift * 46 + (depth != null ? Math.max(0, depth) * 20 * m : 0),
      opacity,
      scale: 1 + lift * 0.07,
      lift,
      depth,
    }
  }

  function card(
    key: string, title: string, capital: string, origin: string, end: string,
    flag: string, logo: string, tone: CapitalTone | null, edge: string, assetId: string | undefined,
    frame: Frame, peer = false, label = '', extra?: Partial<Pick<Card, 'fold' | 'expanded' | 'count' | 'mapHide'>> & { globeOnly?: boolean },
  ): Card {
    const p = pose(key, frame, peer, { mapHide: extra?.mapHide, globeOnly: extra?.globeOnly })
    return {
      key, title, capital, origin, end, flag, logo, initials: initials(title),
      count: extra?.count ?? '',
      fill: tone?.fill ?? 'rgba(255,255,255,.07)',
      edge: tone?.edge ?? edge,
      ink: tone?.ink ?? '#f4f6f8',
      assetId, label,
      fold: extra?.fold ?? '',
      expanded: extra?.expanded ?? false,
      mapHide: extra?.mapHide ?? false,
      x: p.x, y: p.y, w: p.w, h: p.h, z: p.z, opacity: p.opacity, scale: p.scale, lift: p.lift,
    }
  }

  function originOf(n: TreeNode) {
    const place = n.country || ''
    const detail = n.role || (n.sub && n.sub !== place ? n.sub : '')
    return [place, detail].filter(Boolean).join(' · ')
  }
  function companyCard(key: string, n: TreeNode, tone: CapitalTone | null, frame: Frame, peer = false, globeOnly = false): Card {
    const title = peer ? (n.realName || n.name) : n.name
    return card(
      key, title, money(n.value_usd), originOf(n),
      !peer && n.share_pct != null ? `${n.share_pct}%` : '',
      n.flag ?? '', n.logo ?? '', tone, 'rgba(255,255,255,.2)', n.assetId, frame, peer,
      `${title}${n.country ? `, ${n.country}` : ''}${n.sub ? `, ${n.sub}` : ''}`,
      { globeOnly },
    )
  }
  function groupTone(rest: TreeNode[], all: TreeNode[]): CapitalTone {
    const values = all.map(n => n.value_usd)
    const total = values.reduce<number>((s, v) => s + (v && v > 0 ? v : 0), 0)
    const restSum = rest.reduce((s, n) => s + (n.value_usd && n.value_usd > 0 ? n.value_usd : 0), 0)
    const shares = values.map(v => capitalShare(v, values))
    return capitalTone(toneWeight(total > 0 ? restSum / total : 0, Math.max(0, ...shares)))
  }
  function shareSum(list: TreeNode[]) {
    const p = list.reduce((s, n) => s + (n.share_pct ?? 0), 0)
    return p ? `${Math.round(p)}%` : ''
  }

  interface Slot { key: string; node: TreeNode | null; fold: '' | 's' | 'c' }
  function slots(side: 's' | 'c', fold: Folded<TreeNode>, open: boolean, headcount: string): Slot[] {
    const out: Slot[] = fold.main.map(r => ({ key: `${side}${r.index}`, node: r.item, fold: '' }))
    if (fold.rest.length || (side === 'c' && headcount)) out.push({ key: `${side}-more`, node: null, fold: side })
    if (open) for (const r of fold.rest) out.push({ key: `${side}${r.index}`, node: r.item, fold: '' })
    return out
  }

  const sFold = supplierFold.value
  const cFold = clientFold.value
  const sOpen = suppliersOpen.value
  const cOpen = clientsOpen.value
  const head = props.consumerTotal.trim()
  const leftSlots = slots('s', sFold, sOpen, '')
  const rightSlots = slots('c', cFold, cOpen, head)
  const shown = new Set([...leftSlots, ...rightSlots].map(s => s.key))

  function column(side: 's' | 'c', fold: Folded<TreeNode>, list: Slot[], framesOf: Frame[], tones: CapitalTone[], open: boolean): Card[] {
    const genericAt = list.findIndex(s => s.fold)
    const dock = genericAt >= 0 ? (framesOf[genericAt] ?? frames.center) : frames.center
    return list.map((slot, i) => {
      const frame = framesOf[i] ?? frames.center
      if (!slot.node) {
        const rest = fold.rest.map(r => r.item)
        const count = side === 'c' && head ? head : String(rest.length)
        const title = side === 'c' ? 'Consumers' : 'Others'
        const capital = money(rest.reduce((s, n) => s + (n.value_usd ?? 0), 0))
        const origin = side === 'c' ? 'customers' : 'suppliers'
        return card(
          slot.key, title, capital, origin, shareSum(rest),
          '', '', rest.length ? groupTone(rest, side === 's' ? props.suppliers : props.clients) : null,
          'rgba(255,255,255,.2)', undefined, frame, false,
          `${title}, ${count}`,
          { fold: rest.length ? side : '', expanded: open && rest.length > 0, count, mapHide: true },
        )
      }
      const index = Number(slot.key.slice(1))
      return companyCard(slot.key, slot.node, tones[index] ?? null, frame)
    }).concat(
      // Members folded out of the column still sit on the globe, docked on the generic card until the map opens.
      fold.rest.filter(r => !shown.has(`${side}${r.index}`)).map(r => companyCard(
        `${side}${r.index}`, r.item,
        tones[r.index] ?? null,
        dock, false, true,
      )),
    )
  }

  const left = column('s', sFold, leftSlots, frames.left, sTones, sOpen)
  const right = column('c', cFold, rightSlots, frames.right, cTones, cOpen)
  const center = card(
    'asset', props.center.name, props.center.price ?? '',
    [props.center.country, props.center.city].filter(Boolean).join(' · ') || props.center.symbol,
    '', props.center.flag ?? '', props.center.logo ?? '', null, props.center.color, props.center.id,
    frames.center, false,
    `${props.center.name}${props.center.country ? `, ${props.center.country}` : ''}`,
  )
  const row = peers.value.map((n, i) => companyCard(
    `p${i}`, n, pTones[i] ?? null, frames.peers[i] ?? frames.rail, true,
  ))

  function link(key: string, nodeKey: string, kind: 'in' | 'out', share: number | null | undefined, from: Frame, name: string, globeOnly = false): Link {
    const pin = pinAt.get(nodeKey) ?? null
    const centerPin = pinAt.get('asset') ?? null
    const lift = lifts.value[nodeKey] ?? 0
    const stacked = frames.mode === 'stack'
    // Columns meet across the gutter. A stacked column meets along the right-hand rail.
    const x1 = kind === 'in' ? from.x + from.w : frames.center.x + frames.center.w
    const y1 = kind === 'in' ? from.y + from.h / 2 : frames.center.y + frames.center.h / 2
    const x2 = kind === 'in'
      ? frames.center.x + (stacked ? frames.center.w : 0)
      : from.x + (stacked ? from.w : 0)
    const y2 = kind === 'in' ? frames.center.y + frames.center.h / 2 : from.y + from.h / 2
    const gx1 = kind === 'in' ? (pin?.x ?? x1) : (centerPin?.x ?? x1)
    const gy1 = kind === 'in' ? (pin?.y ?? y1) : (centerPin?.y ?? y1)
    const gx2 = kind === 'in' ? (centerPin?.x ?? x2) : (pin?.x ?? x2)
    const gy2 = kind === 'in' ? (centerPin?.y ?? y2) : (pin?.y ?? y2)
    const aDepth = kind === 'in' ? (pin?.depth ?? null) : (centerPin?.depth ?? null)
    const bDepth = kind === 'in' ? (centerPin?.depth ?? null) : (pin?.depth ?? null)
    let opacity = 0.45 + lift * 0.55
    if (globeOnly) opacity *= m
    else if (aDepth == null || bDepth == null) opacity *= 1 - m
    else if (aDepth <= 0 || bDepth <= 0) opacity *= m > 0.72 ? 0 : 1 - m
    return {
      key, nodeKey, kind, label: name,
      d: linkPath(lerp(x1, gx1, m), lerp(y1, gy1, m), lerp(x2, gx2, m), lerp(y2, gy2, m)),
      width: linkWidth(share) * (1 + lift * 0.7),
      opacity,
    }
  }

  function columnLinks(side: 's' | 'c', kind: 'in' | 'out', fold: Folded<TreeNode>, list: Slot[], framesOf: Frame[], open: boolean) {
    const genericAt = list.findIndex(s => s.fold)
    const dock = genericAt >= 0 ? (framesOf[genericAt] ?? frames.center) : frames.center
    const visible = list.flatMap((slot, i) => {
      if (!slot.node) {
        if (!fold.rest.length) return []
        const share = fold.rest.reduce((s, r) => s + (r.item.share_pct ?? 0), 0)
        return [link(`${kind}-more`, slot.key, kind, share, framesOf[i] ?? frames.center, side === 'c' ? 'Consumers' : 'Others')]
      }
      return [link(`${kind}-${slot.key}`, slot.key, kind, slot.node.share_pct, framesOf[i] ?? frames.center, slot.node.name)]
    })
    const hidden = open ? [] : fold.rest.map(r => link(
      `${kind}-map-${r.index}`, `${side}${r.index}`, kind, r.item.share_pct, dock, r.item.name, true,
    ))
    return [...visible, ...hidden]
  }

  const links = [
    ...columnLinks('s', 'in', sFold, leftSlots, frames.left, sOpen),
    ...columnLinks('c', 'out', cFold, rightSlots, frames.right, cOpen),
  ]
  const chainLeft = left.filter(c => !c.key.startsWith('s') || shown.has(c.key) || c.fold)
  const chainRight = right.filter(c => !c.key.startsWith('c') || shown.has(c.key) || c.fold)
  const mapCards = [...left, ...right].filter(c => !shown.has(c.key) && !c.fold)
  return { center, left: chainLeft, right: chainRight, mapCards, row, links }
})

const land = computed(() => {
  if (morph.value < 0.02) return { front: '', mid: '', rim: '' }
  const g = globe.value
  return globeDots(landPoints(), lon.value, tilt.value, g.r, g.cx, g.cy)
})
const wires = computed(() => {
  const g = globe.value
  return wireframe(lon.value, tilt.value, g.cx, g.cy, g.r)
})

function tick() {
  const step = reduce.value ? 1 : 0.18
  morph.value = lerp(morph.value, targetMorph.value, step)
  if (!mapDrag) {
    lon.value = lerp(lon.value, targetLon.value, reduce.value ? 1 : 0.14)
    tilt.value = lerp(tilt.value, targetTilt.value, reduce.value ? 1 : 0.14)
  }
  if (!railDrag) scroll.value = lerp(scroll.value, clamp(targetScroll.value, 0, maxScroll.value), step)
  const keys = ['asset', 's-more', 'c-more', ...props.suppliers.map((_, i) => `s${i}`), ...props.clients.map((_, i) => `c${i}`), ...peers.value.map((_, i) => `p${i}`)]
  const hot = focus.value
  const next: Record<string, number> = {}
  let liftMoving = false
  for (const key of keys) {
    const goal = hot === key ? 1 : 0
    const v = lerp(lifts.value[key] ?? 0, goal, step)
    next[key] = v
    if (Math.abs(v - goal) > 0.012) liftMoving = true
  }
  lifts.value = next
  const moving = liftMoving
    || Math.abs(morph.value - targetMorph.value) > 0.004
    || Math.abs(lon.value - targetLon.value) > 0.06
    || Math.abs(tilt.value - targetTilt.value) > 0.06
    || Math.abs(scroll.value - clamp(targetScroll.value, 0, maxScroll.value)) > 0.5
    || !!mapDrag || !!railDrag
  raf = moving ? requestAnimationFrame(tick) : 0
}
function wake() {
  if (!raf) raf = requestAnimationFrame(tick)
}

function toggleMap() {
  if (!mappable.value) return
  targetMorph.value = targetMorph.value > 0.5 ? 0 : 1
  wake()
}
function nudge(dir: number) {
  targetScroll.value = clamp(targetScroll.value + dir * 168, 0, maxScroll.value)
  wake()
}
function hideLogo(key: string) {
  hiddenLogo.value = { ...hiddenLogo.value, [key]: true }
}
/** Wide wordmarks collapse to a speck in the card. Initials read more clearly. */
function onLogo(key: string, event: Event) {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth > img.naturalHeight * 1.8) hideLogo(key)
}
function open(id?: string) {
  if (dragged || !id) return
  navigateTo(`/assets/${id}`)
}
function onCard(card: Card) {
  if (dragged) return
  if (card.fold === 's' && supplierFold.value.rest.length) {
    suppliersOpen.value = !suppliersOpen.value
    wake()
    return
  }
  if (card.fold === 'c' && clientFold.value.rest.length) {
    clientsOpen.value = !clientsOpen.value
    wake()
    return
  }
  open(card.assetId)
}
function onOver(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  const el = (e.target as Element | null)?.closest?.('[data-key]')
  hover.value = el?.getAttribute('data-key') ?? null
  wake()
}
function onOut(e: PointerEvent) {
  const next = e.relatedTarget
  const el = next instanceof Element ? next.closest('[data-key]') : null
  if (!el) hover.value = null
  wake()
}
function onFocusIn(e: FocusEvent) {
  const el = (e.target as Element | null)?.closest?.('[data-key]')
  const key = el?.getAttribute('data-key')
  if (key) pin.value = key
  wake()
}
function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget
  if (!(next instanceof Element) || !root.value?.contains(next)) {
    pin.value = null
    wake()
  }
}
function onPathUp(key: string) {
  pin.value = pin.value === key ? null : key
  wake()
}
function moveFocus(dir: number) {
  const order = [
    ...view.value.left.map(c => c.key),
    'asset',
    ...view.value.row.map(c => c.key),
    ...view.value.right.map(c => c.key),
  ]
  const cur = pin.value ?? hover.value
  const i = Math.max(0, order.indexOf(cur ?? order[0]!))
  const next = order[(i + dir + order.length) % order.length]!
  pin.value = next
  root.value?.querySelector<HTMLElement>(`.co[data-key="${next}"]`)?.focus()
  wake()
}
function onKey(e: KeyboardEvent) {
  if (targetMorph.value > 0.5) {
    const lonStep = e.key === 'ArrowLeft' ? -14 : e.key === 'ArrowRight' ? 14 : 0
    const tiltStep = e.key === 'ArrowUp' ? 8 : e.key === 'ArrowDown' ? -8 : 0
    if (!lonStep && !tiltStep) return
    e.preventDefault()
    targetLon.value += lonStep
    targetTilt.value = clamp(targetTilt.value + tiltStep, -40, 40)
    wake()
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    moveFocus(e.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.target as Element | null)?.closest?.('.rail')) {
    e.preventDefault()
    nudge(e.key === 'ArrowRight' ? 1 : -1)
  }
}

function onRailDown(e: PointerEvent) {
  if (targetMorph.value > 0.5) return
  if ((e.target as Element | null)?.closest?.('.edge')) return
  railDrag = { x: e.clientX, origin: scroll.value, lastX: e.clientX, lastT: e.timeStamp, vx: 0 }
  dragged = false
  railEl.value?.setPointerCapture?.(e.pointerId)
}
function onRailMove(e: PointerEvent) {
  if (!railDrag) return
  const total = e.clientX - railDrag.x
  if (Math.abs(total) > 4) dragged = true
  const dt = Math.max(8, e.timeStamp - railDrag.lastT)
  railDrag.vx = (e.clientX - railDrag.lastX) / dt
  railDrag.lastX = e.clientX
  railDrag.lastT = e.timeStamp
  const next = clamp(railDrag.origin - total, 0, maxScroll.value)
  scroll.value = next
  targetScroll.value = next
}
function onRailUp() {
  if (!railDrag) return
  targetScroll.value = clamp(scroll.value - railDrag.vx * 220, 0, maxScroll.value)
  railDrag = null
  wake()
}
function onWheel(e: WheelEvent) {
  if (targetMorph.value > 0.5 || !peers.value.length) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (!delta) return
  e.preventDefault()
  targetScroll.value = clamp(targetScroll.value + delta, 0, maxScroll.value)
  wake()
}

function onStageDown(e: PointerEvent) {
  if (targetMorph.value < 0.5) return
  if ((e.target as Element | null)?.closest?.('.co, .edge, .hit')) return
  mapDrag = { x: e.clientX, y: e.clientY, lon: lon.value, tilt: tilt.value, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, vx: 0, vy: 0 }
  dragged = false
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onStageMove(e: PointerEvent) {
  if (!mapDrag) return
  const dt = Math.max(8, e.timeStamp - mapDrag.lastT)
  mapDrag.vx = (e.clientX - mapDrag.lastX) / dt
  mapDrag.vy = (e.clientY - mapDrag.lastY) / dt
  mapDrag.lastX = e.clientX
  mapDrag.lastY = e.clientY
  mapDrag.lastT = e.timeStamp
  lon.value = mapDrag.lon - (e.clientX - mapDrag.x) * 0.35
  tilt.value = clamp(mapDrag.tilt + (e.clientY - mapDrag.y) * 0.22, -40, 40)
  targetLon.value = lon.value
  targetTilt.value = tilt.value
}
function onStageUp() {
  if (!mapDrag) return
  targetLon.value = lon.value - mapDrag.vx * 160
  targetTilt.value = clamp(tilt.value + mapDrag.vy * 80, -40, 40)
  mapDrag = null
  wake()
}

function box(card: Card, local = false) {
  const rail = layout.value.rail
  const x = local ? card.x - rail.x : card.x
  const y = local ? card.y - rail.y : card.y
  return {
    width: `${card.w}px`,
    height: `${card.h}px`,
    transform: `translate3d(${x}px, ${y}px, ${card.z}px) scale(${card.scale})`,
    opacity: String(card.opacity),
    zIndex: String(3 + Math.round(card.lift * 8)),
    background: card.fill,
    borderColor: card.edge,
    color: card.ink,
    '--mark': `${Math.max(32, Math.round(card.h))}px`,
    '--lift': String(card.lift),
    pointerEvents: card.opacity < 0.08 ? 'none' : 'auto',
  }
}
function labelStyle(frame: Frame) {
  return {
    width: `${frame.w}px`,
    transform: `translate3d(${frame.x}px, ${frame.y}px, 0)`,
    opacity: String(frame.h ? 1 - morph.value : 0),
  }
}

onMounted(() => {
  reduce.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (root.value) {
    width.value = Math.max(260, root.value.clientWidth || 360)
    ro = new ResizeObserver(([e]) => {
      if (!e) return
      width.value = Math.max(260, Math.round(e.contentRect.width))
      wake()
    })
    ro.observe(root.value)
  }
  wake()
})
watch(railEl, (el, prev) => {
  prev?.removeEventListener('wheel', onWheel)
  el?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  ro?.disconnect()
  railEl.value?.removeEventListener('wheel', onWheel)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div
    ref="root"
    class="st"
    @pointerover="onOver"
    @pointerout="onOut"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown="onKey"
  >
    <button
      type="button"
      class="st-map"
      :aria-pressed="targetMorph > 0.5"
      :disabled="!mappable"
      :title="mappable ? (targetMorph > 0.5 ? 'Back to the supply chain' : 'Show these companies on the world map') : 'No locations published for this asset'"
      @click="toggleMap"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.4" />
        <ellipse cx="12" cy="12" rx="3.2" ry="8" fill="none" stroke="currentColor" stroke-width="1.1" />
        <path d="M4.2 12h15.6M6.4 8.2h11.2M6.4 15.8h11.2" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
      {{ targetMorph > 0.5 ? 'Chain' : 'Map' }}
    </button>

    <div
      class="stage"
      :class="{ mapping: targetMorph > 0.5 }"
      :style="{ height: stageH + 'px' }"
      @pointerdown="onStageDown"
      @pointermove="onStageMove"
      @pointerup="onStageUp"
      @pointercancel="onStageUp"
    >
      <svg class="wires" :width="width" :height="stageH" aria-hidden="true">
        <circle class="limb" :cx="globe.cx" :cy="globe.cy" :r="globe.r" :opacity="morph" />
        <path :d="wires.parallels" class="wire" :opacity="morph * 0.9" />
        <path :d="wires.meridians" class="wire" :opacity="morph * 0.9" />
        <path :d="land.rim" class="land rim" :opacity="morph" />
        <path :d="land.mid" class="land mid" :opacity="morph" />
        <path :d="land.front" class="land front" :opacity="morph" />
        <path
          v-for="l in view.links" :key="l.key" :d="l.d"
          class="link" :class="l.kind" :stroke-width="l.width" :opacity="l.opacity"
        />
        <path
          v-for="l in view.links" :key="'h' + l.key" :d="l.d"
          class="hit" :data-key="l.nodeKey" tabindex="0" role="button"
          :aria-label="`Bring ${l.label} forward`"
          @pointerup="onPathUp(l.nodeKey)"
        />
      </svg>

      <p v-if="suppliers.length" class="col-label" :style="labelStyle(layout.supplierLabel)">
        <b>{{ supplierLabel }}</b>
        <small>{{ totals(suppliers) }}</small>
      </p>
      <p v-if="clients.length" class="col-label right" :style="labelStyle(layout.clientLabel)">
        <b>{{ clientLabel }}</b>
        <small>{{ totals(clients) }}</small>
      </p>

      <button
        v-for="card in [...view.left, view.center, ...view.right, ...view.mapCards]"
        :key="card.key"
        type="button"
        class="co"
        :class="{ 'has-end': !!card.end, link: !!card.assetId || !!card.fold }"
        :data-key="card.key"
        :style="box(card)"
        :tabindex="card.opacity < 0.2 ? -1 : 0"
        :aria-hidden="card.opacity < 0.08 ? true : undefined"
        :aria-expanded="card.fold ? card.expanded : undefined"
        :aria-label="card.label || card.title"
        @click="onCard(card)"
      >
        <span class="logo" aria-hidden="true">
          <img v-if="card.logo && !hiddenLogo[card.key]" :src="card.logo" alt="" @load="onLogo(card.key, $event)" @error="hideLogo(card.key)" />
          <span v-else class="letters" :class="{ wide: card.count.length > 3 }">{{ card.count || card.initials }}</span>
        </span>
        <span class="body">
          <span class="name-row">
            <span class="name">{{ card.title }}</span>
            <span v-if="card.flag" class="flag-sm">{{ card.flag }}</span>
          </span>
          <span v-if="card.capital" class="capital">{{ card.capital }}</span>
          <span v-if="card.origin" class="origin">{{ card.origin }}</span>
        </span>
        <span v-if="card.end" class="pct">{{ card.end }}</span>
      </button>

      <div
        v-if="peers.length"
        ref="railEl"
        class="rail"
        :class="{ mapping: morph > 0.2 }"
        :style="{
          width: layout.rail.w + 'px',
          height: layout.rail.h + 'px',
          transform: `translate3d(${layout.rail.x}px, ${layout.rail.y}px, 0)`,
          overflow: morph > 0.04 ? 'visible' : 'hidden',
        }"
        @pointerdown.stop="onRailDown"
        @pointermove="onRailMove"
        @pointerup="onRailUp"
        @pointercancel="onRailUp"
      >
        <p class="rail-label" :style="{ opacity: 1 - morph }">Partners &amp; competitors</p>
        <button v-if="maxScroll > 0" type="button" class="edge prev" aria-label="Previous partners" @click="nudge(-1)">‹</button>
        <button
          v-for="card in view.row"
          :key="card.key"
          type="button"
          class="co peer"
          :class="{ 'has-end': !!card.end, link: !!card.assetId }"
          :data-key="card.key"
          :style="box(card, true)"
          :aria-label="card.label"
          @click="onCard(card)"
        >
          <span class="logo" aria-hidden="true">
            <img v-if="card.logo && !hiddenLogo[card.key]" :src="card.logo" alt="" @load="onLogo(card.key, $event)" @error="hideLogo(card.key)" />
            <span v-else class="letters">{{ card.initials }}</span>
          </span>
          <span class="body">
            <span class="name-row">
              <span class="name">{{ card.title }}</span>
              <span v-if="card.flag" class="flag-sm">{{ card.flag }}</span>
            </span>
            <span v-if="card.capital" class="capital">{{ card.capital }}</span>
            <span v-if="card.origin" class="origin">{{ card.origin }}</span>
          </span>
          <span v-if="card.end" class="pct">{{ card.end }}</span>
        </button>
        <button v-if="maxScroll > 0" type="button" class="edge next" aria-label="Next partners" @click="nudge(1)">›</button>
      </div>

      <p class="map-hint" :style="{ opacity: morph }">Drag, or use the arrow keys, to turn the map</p>
    </div>
  </div>
</template>

<style scoped>
.st { width: 100%; position: relative; }
.st-map {
  position: absolute; top: -22px; right: 0; z-index: 6;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 7px 0 7px 0;
  border: 1px solid rgba(255,255,255,.22); background: rgba(0,0,0,.4); color: #fff;
  font: 700 10px/1.2 var(--font-family-secondary, inherit); letter-spacing: .06em; text-transform: uppercase;
  cursor: pointer;
}
.st-map[aria-pressed="true"] { color: #ffe7a8; border-color: rgba(255, 214, 120, .85); }
.st-map:disabled { opacity: .4; cursor: default; }
.st-map:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; }

.stage { position: relative; width: 100%; perspective: 980px; touch-action: pan-y; }
.stage.mapping { touch-action: none; cursor: grab; }
.wires { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.limb { fill: rgba(8, 12, 18, .35); stroke: rgba(255,255,255,.4); stroke-width: 1; }
.wire { fill: none; stroke: rgba(150, 196, 255, .7); stroke-width: .8; }
.land { fill: none; stroke-linecap: round; }
.land.front { stroke: rgba(255,255,255,.8); stroke-width: 2.5; }
.land.mid { stroke: rgba(255,255,255,.4); stroke-width: 1.7; }
.land.rim { stroke: rgba(255,255,255,.18); stroke-width: 1.1; }
.link { fill: none; stroke-linecap: round; pointer-events: none; }
.link.in { stroke: rgba(120, 170, 255, .95); }
.link.out { stroke: var(--app-color-up, #00ff88); }
.hit { fill: none; stroke: transparent; stroke-width: 18; pointer-events: stroke; cursor: pointer; }
.hit:focus-visible { stroke: rgba(255,255,255,.35); }

.col-label, .rail-label, .map-hint { pointer-events: none; margin: 0; }
.col-label {
  position: absolute; left: 0; top: 0; z-index: 2;
  display: flex; justify-content: space-between; gap: 6px; align-items: baseline;
  font-size: 9px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--text-light-gray, rgba(255,255,255,.8));
}
.col-label.right { justify-content: flex-end; }
.col-label b { font-weight: 700; }
.col-label small { font-size: 9px; color: var(--text-gray, #9aa0a6); letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }

.rail { position: absolute; left: 0; top: 0; z-index: 4; touch-action: none; }
.rail-label {
  position: absolute; left: 0; top: 0; right: 0;
  font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  color: var(--text-light-gray, rgba(255,255,255,.75));
}
.edge {
  position: absolute; top: 18px; bottom: 2px; width: 26px; z-index: 6;
  border: 0; color: #fff; font-size: 18px; line-height: 1; cursor: pointer;
  background: linear-gradient(90deg, rgba(8,10,14,.9), rgba(8,10,14,0));
}
.edge.next { right: 0; background: linear-gradient(270deg, rgba(8,10,14,.9), rgba(8,10,14,0)); }
.edge.prev { left: 0; }
.edge:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); }
.rail.mapping .edge, .rail.mapping .rail-label { opacity: 0; pointer-events: none; }
.map-hint {
  position: absolute; left: 0; right: 0; bottom: 2px; z-index: 5;
  text-align: center; font-size: 10px; color: rgba(255,255,255,.7);
}

.co {
  position: absolute; top: 0; left: 0; box-sizing: border-box;
  display: grid; grid-template-columns: var(--mark, 36px) minmax(0, 1fr);
  align-items: stretch;
  margin: 0; padding: 0; overflow: hidden; border-radius: 6px;
  border: 1px solid transparent; background: transparent; color: inherit;
  font-family: inherit; text-align: left; cursor: default;
  transform-origin: center center; transform-style: preserve-3d;
  box-shadow: 0 8px 18px rgba(0,0,0, calc(var(--lift, 0) * .45));
}
.co.has-end { grid-template-columns: var(--mark, 36px) minmax(0, 1fr) auto; }
.co.link { cursor: pointer; }
.co:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; }
.logo {
  align-self: stretch; display: grid; place-items: center; min-width: 0;
  background: rgba(0,0,0,.28); overflow: hidden;
}
.logo img { width: 100%; height: 100%; object-fit: contain; }
.letters {
  font-size: 12px; font-weight: 700; letter-spacing: .02em; line-height: 1;
}
.letters.wide { font-size: 9px; padding: 0 2px; text-align: center; }
.body {
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  min-width: 0; padding: 2px 4px; gap: 0;
}
.name-row {
  display: flex; align-items: baseline; justify-content: center; gap: 3px;
  width: 100%; min-width: 0;
}
.name, .capital, .origin {
  min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.name { flex: 0 1 auto; font-size: 13px; font-weight: 700; line-height: 1.1; }
.flag-sm { flex: none; font-size: 11px; line-height: 1; }
.capital {
  width: 100%; font-size: 12px; font-weight: 600; line-height: 1.15;
  font-variant-numeric: tabular-nums; font-family: var(--font-market-data, inherit);
}
.origin { width: 100%; font-size: 9px; line-height: 1.15; opacity: .68; }
.pct {
  align-self: center; padding: 0 5px 0 1px;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  font-family: var(--font-market-data, inherit);
}

@media (pointer: coarse), (max-width: 720px) {
  .edge { width: 34px; font-size: 22px; }
  .name { font-size: 13px; }
  .capital { font-size: 12px; }
  .pct { font-size: 13px; }
}
</style>
