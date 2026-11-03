/**
 * Card lab ROUND 2 — lane d1 (one pointed corner · brushed-steel buttons · per-device size system).
 * Pure helpers for components/CardLab/R2/D1Card.vue + D1List.vue. The size table below is the single source of truth:
 * D1List.vue's CSS repeats it literally (tests/cardlab-r2-d1.test.ts checks the two agree).
 */
import { fmtCount, fmtDate, fmtMoney } from '~/utils/format'
import type { CardLabFinalModel } from '~/utils/cardLabFinal'

export type CardLabR2D1ClassKey = 'mobile' | 'tablet' | 'laptop' | 'large'

export interface CardLabR2D1Size {
  key: CardLabR2D1ClassKey
  /** Viewport range of the class, px (max exclusive; null = open). */
  minVw: number
  maxVw: number | null
  /** Fixed number of grid columns in the class. */
  columns: number
  /** Card width floor and cap, px (the grid never stretches a card past maxW: it centres the row instead). */
  minW: number
  maxW: number
  /** Gap between cards, px. */
  gap: number
}

/** Size system (founder: "min and max values depending on the device … the cards are the same size when listed"). */
export const cardLabR2D1Sizes: readonly CardLabR2D1Size[] = [
  { key: 'mobile', minVw: 0, maxVw: 600, columns: 1, minW: 296, maxW: 400, gap: 12 },
  { key: 'tablet', minVw: 600, maxVw: 1024, columns: 2, minW: 256, maxW: 440, gap: 12 },
  { key: 'laptop', minVw: 1024, maxVw: 1440, columns: 3, minW: 296, maxW: 420, gap: 14 },
  { key: 'large', minVw: 1440, maxVw: null, columns: 4, minW: 320, maxW: 400, gap: 16 },
] as const

/**
 * ONE height for every card of a list, a pure function of the card WIDTH (all cards of a list share it), never of the
 * data: max(floor, A, min(B, C)) — three lines over the upper envelope of the densest sample's content height measured
 * every 2 px from 256 to 440 px (r2-D1 sweep v3), + ≥ 5 px. D1Card's CSS writes the same formula with 100cqw = card width.
 */
export const cardLabR2D1Height = {
  floor: 534,
  a: { h: 708, w: 258, k: 1.537 },
  b: { h: 622, w: 313, k: 0.558 },
  c: { h: 598, w: 356, k: 1.1 },
} as const

export function cardLabR2D1HeightAt(cardW: number): number {
  const { floor, a, b, c } = cardLabR2D1Height
  const line = (l: { h: number; w: number; k: number }) => l.h - l.k * (cardW - l.w)
  return Math.max(floor, line(a), Math.min(line(b), line(c)))
}

export function cardLabR2D1ClassOf(vw: number): CardLabR2D1Size {
  return cardLabR2D1Sizes.find(s => vw >= s.minVw && (s.maxVw == null || vw < s.maxVw)) ?? cardLabR2D1Sizes[0]
}

/** Card width the grid gives for a container width (same maths as D1List's CSS: N tracks of minmax(0, maxW), centred). */
export function cardLabR2D1CardWidth(size: CardLabR2D1Size, container: number): number {
  const track = (container - size.gap * (size.columns - 1)) / size.columns
  return Math.min(size.maxW, track)
}

// ── actions (bottom steel row) ─────────────────────────────────────────
export interface CardLabR2D1Action { key: 'copy' | 'edit' | 'view' | 'toggle' | 'share' | 'details'; icon: string; label: string; short: string; title: string }

export function cardLabR2D1RunLabel(statusKey: string): string {
  return statusKey === 'active' ? 'Pause' : statusKey === 'paused' ? 'Resume' : 'Start'
}

/** The action row, in order. Samples: ⧉ Use as template · → View · Details. Own: ✎ Edit · → View · Start/Pause · ⇪ Share · Details. */
export function cardLabR2D1Actions(sample: boolean, statusKey: string, shareable: boolean): CardLabR2D1Action[] {
  const out: CardLabR2D1Action[] = sample
    ? [{ key: 'copy', icon: '⧉', label: 'Use as template', short: 'Template', title: 'Copy this sample into a new strategy of yours' }]
    : [{ key: 'edit', icon: '✎', label: 'Edit', short: 'Edit', title: 'Edit this strategy' }]
  out.push({ key: 'view', icon: '→', label: 'View', short: 'View', title: 'Open the full strategy page' })
  if (!sample) {
    const run = cardLabR2D1RunLabel(statusKey)
    out.push({ key: 'toggle', icon: run === 'Pause' ? '❚❚' : '▶', label: run, short: run, title: `${run} this strategy` })
    if (shareable) out.push({ key: 'share', icon: '⇪', label: 'Share', short: 'Share', title: 'Send it to friends, bots or rooms' })
  }
  out.push({ key: 'details', icon: 'ⓘ', label: 'Details', short: 'More', title: 'Tags, creation date, likes, comments, visibility, price, agent id — opens over the card, the card keeps its size' })
  return out
}

// ── corner tile ───────────────────────────────────────────────────────
const GLYPH_MEANS: Record<string, string> = {
  reversion: 'a price swinging around its mean, traded back toward it',
  pair: 'two related prices; the gap between them is traded when it widens',
  vol: 'a short-straddle payoff tent under a volatility wiggle: sells option premium, earns while prices stay calm',
  momentum: 'a rising staircase: follows a move already under way',
  event: 'a dated event line, then the drift that follows it',
  systematic: 'rules-based, no clearer style word in the record',
}

/** Tooltip of the corner tile: style glyph + what it means + tile colour + the status badge in its corner. */
export function cardLabR2D1CornerTitle(m: Pick<CardLabFinalModel, 'style' | 'classLabel' | 'status'>): string {
  const ev = m.style.evidence.length ? m.style.evidence.join(', ') : 'nothing specific'
  return `Style glyph: ${m.style.label} — ${GLYPH_MEANS[m.style.key] ?? GLYPH_MEANS.systematic}. Read from ${ev}. `
    + `Tile colour = asset class (${m.classLabel}). Corner badge = status: ${m.status.label}.`
}

// ── details layer ─────────────────────────────────────────────────────
export interface CardLabR2D1Row { key: string; label: string; value: string; title: string }

const plural = (n: number | null, w: string) => `${w}${n === 1 ? '' : 's'}`

/** Rows of the in-card Details sheet (the long tail of the record). Missing values print "—", never a default. */
export function cardLabR2D1DetailRows(m: Pick<CardLabFinalModel, 'created' | 'likes' | 'comments' | 'isPublic' | 'price' | 'premium' | 'agentId' | 'lastRun' | 'trades'>): CardLabR2D1Row[] {
  const rows: CardLabR2D1Row[] = [
    { key: 'created', label: 'Created', value: m.created ? fmtDate(m.created) : '—', title: 'created_at' },
    { key: 'likes', label: plural(m.likes, 'Like'), value: fmtCount(m.likes), title: 'likes_count' },
    { key: 'comments', label: plural(m.comments, 'Comment'), value: fmtCount(m.comments), title: 'comments_count' },
    { key: 'visibility', label: 'Visibility', value: m.isPublic == null ? '—' : m.isPublic ? 'Public' : 'Private', title: 'is_public' },
    { key: 'price', label: 'Price', value: fmtMoney(m.price ?? (m.premium ? null : 0), { decimals: 0 }), title: 'price (premium strategies only)' },
  ]
  if (m.agentId) rows.push({ key: 'agent', label: 'Agent id', value: m.agentId, title: 'agent_id' })
  return rows
}
