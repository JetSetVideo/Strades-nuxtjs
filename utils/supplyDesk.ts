/**
 * Supply chain desk — layout, currency, and the wired globe.
 *
 * Capitals are stored in US dollars. The settings display currency converts
 * them with the live fiat quote (USD per 1 unit) or, before that quote has
 * loaded, the demo-book price in public/core/assets.json.
 *
 * Motion is driven by lerp(): each frame moves a value part of the way to
 * its target, so a hover, a carousel drag, and the map morph can be
 * interrupted without a jump.
 */
import { orthographic } from '~/utils/navIcons'

export const CURRENCY_CHOICES = ['USD', 'EUR', 'CNY'] as const
export type DisplayCurrency = (typeof CURRENCY_CHOICES)[number]

/** Demo-book USD price of 1 unit (public/core/assets.json). */
const BOOK_USD: Record<DisplayCurrency, number> = { USD: 1, EUR: 1.086, CNY: 0.139 }

const REGION: Record<string, string> = {
  usa: 'US', us: 'US', 'united states': 'US', 'united states of america': 'US',
  uk: 'GB', 'united kingdom': 'GB', england: 'GB', britain: 'GB',
  china: 'CN', prc: 'CN', japan: 'JP', germany: 'DE', france: 'FR',
  'south korea': 'KR', korea: 'KR', switzerland: 'CH', chile: 'CL',
  mexico: 'MX', canada: 'CA', europe: 'EU', 'euro area': 'EU', eurozone: 'EU',
}

/** Linear interpolation. t = 0 stays at a, t = 1 arrives at b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** USD value of 1 unit of `code`. Unknown codes stay at 1 and format as USD. */
export function usdPerUnit(
  code: string,
  quotes: readonly { symbol?: string; current_price?: number | null }[],
): number {
  const c = (CURRENCY_CHOICES as readonly string[]).includes(code) ? code as DisplayCurrency : 'USD'
  if (c === 'USD') return 1
  const q = quotes.find(a => String(a.symbol ?? '').toUpperCase() === c && typeof a.current_price === 'number' && a.current_price > 0)
  return q && q.current_price! > 0 ? q.current_price! : BOOK_USD[c]
}

function currencySymbol(code: string): string {
  const safe = (CURRENCY_CHOICES as readonly string[]).includes(code) ? code : 'USD'
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: safe, currencyDisplay: 'narrowSymbol' }).formatToParts(1)
    return parts.find(p => p.type === 'currency')?.value ?? `${safe} `
  } catch {
    return `${safe} `
  }
}

/** Compact capital in the display currency. Empty when the source has no figure. */
export function formatCapital(usd: number | null | undefined, code: string, perUsd: number): string {
  if (usd == null || !Number.isFinite(usd) || usd === 0) return ''
  const per = perUsd > 0 ? perUsd : 1
  const v = usd / per
  const abs = Math.abs(v)
  const steps: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']]
  let num = v
  let suffix = ''
  for (const [div, mark] of steps) {
    if (abs >= div) { num = v / div; suffix = mark; break }
  }
  const digits = suffix ? (Math.abs(num) >= 100 ? 0 : 1) : 0
  const body = `${Math.abs(num).toFixed(digits)}${suffix}`
  return `${num < 0 ? '-' : ''}${currencySymbol(code)}${body}`
}

/** This row's dollars divided by the column total. 0 when the column has no dollars. */
export function capitalShare(value: number | null | undefined, values: readonly (number | null | undefined)[]): number {
  const mine = value ?? 0
  if (!(mine > 0)) return 0
  const total = values.reduce<number>((s, v) => s + (v && v > 0 ? v : 0), 0)
  return total > 0 ? mine / total : 0
}

/**
 * 0…1 brightness. The largest capitalisation in the column is 1 (full gold);
 * the others scale by how they compare with that leader.
 */
export function toneWeight(share: number, maxShare: number): number {
  if (!(maxShare > 0) || !(share > 0)) return 0
  return clamp(share / maxShare, 0, 1)
}

/** A column longer than this shows the leaders, then one generic card for the tail. */
export const FOLD_AT = 6
/** Named cards kept above the generic card. */
export const MAIN_KEEP = 5

export interface Folded<T> {
  main: { item: T; index: number }[]
  rest: { item: T; index: number }[]
}

/**
 * Keep the largest rows and fold the rest. Short columns stay whole.
 * Original order is preserved inside each group so the list does not reshuffle.
 */
export function foldColumn<T>(items: readonly T[], value: (item: T) => number, tooLong = FOLD_AT, keep = MAIN_KEEP): Folded<T> {
  const ranked = items.map((item, index) => ({ item, index }))
  if (ranked.length <= tooLong) return { main: ranked, rest: [] }
  const leaders = [...ranked].sort((a, b) => value(b.item) - value(a.item) || a.index - b.index).slice(0, keep)
  const keepSet = new Set(leaders.map(r => r.index))
  return {
    main: ranked.filter(r => keepSet.has(r.index)),
    rest: ranked.filter(r => !keepSet.has(r.index)),
  }
}

/** Route id for a supply-chain company that is not itself a listed asset. */
export function partnerSlug(parentId: string, nodeId: string): string {
  return `p-${parentId}-${nodeId}`.toLowerCase()
}

export function parsePartnerSlug(slug: string): { parentId: string; nodeId: string } | null {
  const m = /^p-([a-z0-9]+)-([a-z0-9_]+)$/.exec(slug.trim().toLowerCase())
  if (!m?.[1] || !m[2]) return null
  return { parentId: m[1], nodeId: m[2] }
}

export interface CapitalTone {
  fill: string
  edge: string
  ink: string
  /** 0 cool steel → 1 bright gold */
  gold: number
}

/** Brighter and more gold as `weight` rises from 0 to 1. */
export function capitalTone(weight: number): CapitalTone {
  const g = clamp(weight, 0, 1)
  const r = Math.round(lerp(58, 255, g))
  const gv = Math.round(lerp(78, 206, g))
  const b = Math.round(lerp(112, 64, g))
  const a = lerp(0.16, 0.72, g)
  return {
    fill: `rgba(${r},${gv},${b},${a.toFixed(3)})`,
    edge: `rgba(${Math.min(255, r + 28)},${Math.min(255, gv + 22)},${Math.min(255, b + 8)},${lerp(0.38, 1, g).toFixed(3)})`,
    ink: g > 0.62 ? '#1a1404' : '#f4f6f8',
    gold: g,
  }
}

export function flagEmoji(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(...c.split('').map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

export function countryName(code: string): string {
  const c = code.trim().toUpperCase()
  if (!c) return ''
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) ?? c
  } catch {
    return c
  }
}

/** Last comma-separated piece of a headquarters line, when it names a country. */
export function placeCountry(place?: string | null): { code: string; name: string } | null {
  if (!place) return null
  const parts = place.split(',').map(s => s.trim()).filter(Boolean)
  const last = (parts[parts.length - 1] ?? '').toLowerCase()
  const code = REGION[last]
  if (!code) return null
  return { code, name: countryName(code) }
}

export function linkWidth(share?: number | null): number {
  if (!share) return 1.5
  return Math.max(1.5, Math.min(10, share / 4))
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * Cubic that meets each card on its side, with a horizontal tangent, so the
 * stroke runs into the edge at a right angle. A stacked column (almost no
 * horizontal gap) meets the top and bottom edge the same way, vertically.
 */
export function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  // Stacked cards share a right edge. Bow into the rail so the stroke still meets that side flat.
  if (Math.abs(dx) < 12 && Math.abs(dy) >= 12) {
    const bow = 16
    return `M${r1(x1)},${r1(y1)} C${r1(x1 + bow)},${r1(y1)} ${r1(x2 + bow)},${r1(y2)} ${r1(x2)},${r1(y2)}`
  }
  if (Math.abs(dx) >= 12) {
    const run = Math.max(16, Math.min(Math.abs(dx) * 0.5, 80))
    const dir = Math.sign(dx) || 1
    return `M${r1(x1)},${r1(y1)} C${r1(x1 + dir * run)},${r1(y1)} ${r1(x2 - dir * run)},${r1(y2)} ${r1(x2)},${r1(y2)}`
  }
  const run = Math.max(16, Math.abs(dy) * 0.5)
  const dir = Math.sign(dy) || 1
  return `M${r1(x1)},${r1(y1)} C${r1(x1)},${r1(y1 + dir * run)} ${r1(x2)},${r1(y2 - dir * run)} ${r1(x2)},${r1(y2)}`
}

export interface Frame { x: number; y: number; w: number; h: number }

export interface ChainFrames {
  mode: 'columns' | 'stack'
  left: Frame[]
  right: Frame[]
  center: Frame
  peers: Frame[]
  rail: Frame
  height: number
  supplierLabel: Frame
  clientLabel: Frame
}

const CARD_H = 46
const CENTER_H = 58
const GAP = 3
const GUTTER = 16
const HEAD = 16
const PEER_H = 52
const PEER_GAP = 6
const RAIL_HEAD = 14

function frames(n: number, x: number, y: number, w: number, h: number, gap: number): Frame[] {
  return Array.from({ length: n }, (_, i) => ({ x, y: y + i * (h + gap), w, h }))
}

/**
 * Card boxes for the chain. Narrow widths stack suppliers, the asset,
 * the partner rail, then clients. Peer boxes sit in the rail at scroll 0;
 * the view subtracts the carousel scroll from their x.
 */
export function chainFrames(width: number, leftN: number, rightN: number, peerN: number): ChainFrames {
  const w = Math.max(260, width)
  const centerW = Math.min(220, Math.max(148, w * 0.34))
  const colW = (w - centerW - GUTTER * 2) / 2
  const peerW = Math.min(200, Math.max(148, w * 0.46))
  const railH = peerN ? RAIL_HEAD + PEER_H + 6 : 0

  if (colW < 128) {
    // A rail on the right keeps the connecting line outside the cards.
    const side = 22
    const cardW = w - side
    let y = 0
    const supplierLabel = { x: 0, y, w: cardW, h: leftN ? HEAD : 0 }
    y += supplierLabel.h
    const left = frames(leftN, 0, y, cardW, CARD_H, GAP)
    y += leftN ? leftN * (CARD_H + GAP) - GAP + 10 : 0
    const center = { x: 0, y, w: cardW, h: CENTER_H }
    y += center.h + 8
    const rail = { x: 0, y, w, h: railH }
    const peers = Array.from({ length: peerN }, (_, i) => ({
      x: i * (peerW + PEER_GAP), y: y + RAIL_HEAD, w: peerW, h: PEER_H,
    }))
    y += railH + (railH ? 8 : 0)
    const clientLabel = { x: 0, y, w: cardW, h: rightN ? HEAD : 0 }
    y += clientLabel.h
    const right = frames(rightN, 0, y, cardW, CARD_H, GAP)
    y += rightN ? rightN * (CARD_H + GAP) - GAP : 0
    return { mode: 'stack', left, right, center, peers, rail, height: y + 4, supplierLabel, clientLabel }
  }

  const rows = Math.max(leftN, rightN, 1)
  const block = (n: number) => (n ? n * (CARD_H + GAP) - GAP : 0)
  const colH = block(rows)
  const topOf = (n: number) => HEAD + (colH - block(n)) / 2
  const left = frames(leftN, 0, topOf(leftN), colW, CARD_H, GAP)
  const center = { x: colW + GUTTER, y: HEAD + (colH - CENTER_H) / 2, w: centerW, h: CENTER_H }
  const rightX = center.x + center.w + GUTTER
  const right = frames(rightN, rightX, topOf(rightN), colW, CARD_H, GAP)
  const rail = { x: 0, y: HEAD + colH + 10, w, h: railH }
  const peers = Array.from({ length: peerN }, (_, i) => ({
    x: i * (peerW + PEER_GAP), y: rail.y + RAIL_HEAD, w: peerW, h: PEER_H,
  }))
  return {
    mode: 'columns', left, right, center, peers, rail,
    height: rail.y + rail.h + 4,
    supplierLabel: { x: 0, y: 0, w: colW, h: HEAD },
    clientLabel: { x: rightX, y: 0, w: colW, h: HEAD },
  }
}

export function maxRailScroll(frames: ChainFrames): number {
  const last = frames.peers[frames.peers.length - 1]
  if (!last) return 0
  return Math.max(0, last.x + last.w - (frames.rail.x + frames.rail.w))
}

export interface GlobeBox { cx: number; cy: number; r: number; height: number }

export function globeBox(width: number): GlobeBox {
  const height = Math.max(240, Math.min(440, Math.round(width * 0.78)))
  const r = Math.max(78, Math.min(width, height) * 0.36)
  return { cx: width / 2, cy: height / 2, r, height }
}

/** Orthographic pin. depth > 0 is the near hemisphere; y grows downward. */
export function globeAnchor(lat: number, lng: number, lon0: number, lat0: number, cx: number, cy: number, radius: number) {
  const p = orthographic(lng, lat, lon0, lat0)
  return { x: cx + p.x * radius, y: cy - p.y * radius, depth: p.depth }
}

function arc(lon0: number, lat0: number, cx: number, cy: number, radius: number, fixed: number, parallel: boolean): string {
  let d = ''
  let pen = false
  for (let i = 0; i <= 48; i++) {
    const t = -180 + (360 * i) / 48
    const lat = parallel ? fixed : t
    const lon = parallel ? t : fixed
    const p = orthographic(lon, lat, lon0, lat0)
    if (p.depth <= 0.02) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${r1(cx + p.x * radius)},${r1(cy - p.y * radius)}`
    pen = true
  }
  return d
}

/**
 * Push near-side pins apart so company panels that share a region
 * (a cluster of US clients, for example) stay readable. Far-side pins
 * are left on their geographic point. Positions stay inside the disc.
 */
export function separatePins(
  points: readonly { x: number; y: number; depth: number }[],
  minDist: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number }[] {
  const out = points.map(p => ({ x: p.x, y: p.y }))
  const max = Math.max(12, radius - 6)
  for (let pass = 0; pass < 14; pass++) {
    for (let i = 0; i < out.length; i++) {
      if (points[i]!.depth <= 0) continue
      for (let j = i + 1; j < out.length; j++) {
        if (points[j]!.depth <= 0) continue
        let dx = out[j]!.x - out[i]!.x
        let dy = out[j]!.y - out[i]!.y
        const dist = Math.hypot(dx, dy) || 0.01
        if (dist >= minDist) continue
        const push = (minDist - dist) / 2
        dx /= dist
        dy /= dist
        out[i]!.x -= dx * push
        out[i]!.y -= dy * push
        out[j]!.x += dx * push
        out[j]!.y += dy * push
      }
    }
    for (let i = 0; i < out.length; i++) {
      if (points[i]!.depth <= 0) continue
      const dx = out[i]!.x - cx
      const dy = out[i]!.y - cy
      const dist = Math.hypot(dx, dy)
      if (dist > max) {
        out[i]!.x = cx + (dx / dist) * max
        out[i]!.y = cy + (dy / dist) * max
      }
    }
  }
  return out
}

/** Visible meridians and parallels of a wireframe globe. */
export function wireframe(lon0: number, lat0: number, cx: number, cy: number, radius: number): { parallels: string; meridians: string } {
  const parallels: string[] = []
  const meridians: string[] = []
  for (let lat = -60; lat <= 60; lat += 30) parallels.push(arc(lon0, lat0, cx, cy, radius, lat, true))
  for (let lon = -180; lon < 180; lon += 30) meridians.push(arc(lon0, lat0, cx, cy, radius, lon, false))
  return { parallels: parallels.join(''), meridians: meridians.join('') }
}
