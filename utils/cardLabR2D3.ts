/**
 * Card lab ROUND 2 — lane d3 (folded / notched corner). Pure helpers for components/CardLab/R2/D3Card.vue + D3List.vue:
 *   - the SIZE SYSTEM per device class (one table, read by the list's CSS comment, the tests and the board),
 *   - the auto-fill column maths the list relies on (so a test proves widths never exceed the class max-width),
 *   - honesty flags → the metric they qualify (a ⚠ marker on the cell + one labelled chip in the checks strip),
 *   - the bottom action plates (samples 3, own strategy 5) and the folded-corner geometry.
 * All exports are prefixed `cardLabR2D3` / `CARD_LAB_R2D3` (Nuxt auto-imports utils).
 */
import type { CardLabFinalFlag } from '~/utils/cardLabFinal'

export type CardLabR2D3Class = 'mobile' | 'tablet' | 'laptop' | 'large'

export interface CardLabR2D3Size {
  cls: CardLabR2D3Class
  /** Viewport range of the class, inclusive lower bound, exclusive upper bound (px). */
  fromVw: number
  toVw: number
  /** auto-fill track minimum (px); the track is `minmax(min(100%, trackMin), 1fr)`. */
  trackMin: number
  /** Card CSS min-width / max-width (px). */
  minW: number
  maxW: number
  /** ONE fixed card height for the whole class (px): every card of a list, sparse or dense. */
  h: number
  /** Corner tile (folded corner holding the style glyph), px. */
  tile: number
  /** Columns this class produces in the lab bench's content box. */
  columns: string
}

/**
 * The size system. Heights are fixed per class and sized for the DENSEST sample at the NARROWEST card of the class
 * (measured, shots-r2/D3); a sparse card keeps the same box and shows its gaps in words.
 */
export const CARD_LAB_R2D3_SIZES: readonly CardLabR2D3Size[] = [
  { cls: 'mobile', fromVw: 0, toVw: 600, trackMin: 280, minW: 280, maxW: 560, h: 580, tile: 58, columns: '1' },
  { cls: 'tablet', fromVw: 600, toVw: 1024, trackMin: 330, minW: 300, maxW: 560, h: 580, tile: 62, columns: '1–2 (2 from a 672 px box)' },
  { cls: 'laptop', fromVw: 1024, toVw: 1440, trackMin: 372, minW: 330, maxW: 480, h: 560, tile: 64, columns: '2–3 (3 from a 1140 px box)' },
  { cls: 'large', fromVw: 1440, toVw: Infinity, trackMin: 380, minW: 360, maxW: 460, h: 560, tile: 66, columns: '3–4+ (4 from a 1556 px box)' },
]

/** Device class of a viewport width (mobile < 600 · tablet 600–1023 · laptop 1024–1439 · large ≥ 1440). */
export function cardLabR2D3Class(vw: number): CardLabR2D3Class {
  return cardLabR2D3Size(vw).cls
}

export function cardLabR2D3Size(vw: number): CardLabR2D3Size {
  return CARD_LAB_R2D3_SIZES.find(s => vw >= s.fromVw && vw < s.toVw) ?? CARD_LAB_R2D3_SIZES[0]
}

/**
 * What `repeat(auto-fill, minmax(min(100%, trackMin), 1fr))` with `gap` gives in a content box of `box` px, then
 * clamped by the card's max-width: { columns, track, card }.
 */
export function cardLabR2D3Grid(box: number, vw: number, gap = 12): { columns: number; track: number; card: number } {
  const s = cardLabR2D3Size(vw)
  const min = Math.min(box, s.trackMin)
  const columns = Math.max(1, Math.floor((box + gap) / (min + gap)))
  const track = (box - gap * (columns - 1)) / columns
  return { columns, track, card: Math.min(track, s.maxW) }
}

export type CardLabR2D3Metric = 'win' | 'sharpe' | 'trades' | 'annual' | 'beta'

const FLAG_TARGET: Record<string, CardLabR2D3Metric> = {
  'win': 'win', 'win-loss': 'win', 'sample': 'trades', 'sharpe-sign': 'sharpe', 'sharpe-gap': 'sharpe',
  'annual': 'annual', 'beta-pair': 'beta',
}
const METRIC_WORD: Record<CardLabR2D3Metric, string> = { win: 'Win', sharpe: 'Sharpe', trades: 'Trades', annual: 'Annual', beta: 'Beta' }

/** The metric cell a flag qualifies (the cell gets a ⚠ marker), or null. */
export function cardLabR2D3FlagTarget(key: string): CardLabR2D3Metric | null {
  return FLAG_TARGET[key] ?? null
}

/**
 * One chip per flag for the checks strip, led by the metric word unless the short text already names it
 * ("Sharpe 0.42 yet annual −1.2%", "beta 0.40 on a pair").
 */
export function cardLabR2D3FlagChips(flags: readonly CardLabFinalFlag[]): Array<{ key: string; target: CardLabR2D3Metric | null; text: string; long: string }> {
  return flags.map((f) => {
    const target = cardLabR2D3FlagTarget(f.key)
    const word = target ? METRIC_WORD[target] : ''
    const named = word && f.short.toLowerCase().startsWith(word.toLowerCase())
    return { key: f.key, target, text: word && !named ? `${word}: ${f.short}` : f.short, long: f.long }
  })
}

export interface CardLabR2D3Plate {
  key: 'copy' | 'edit' | 'view' | 'toggle' | 'share' | 'details'
  label: string
  title: string
  /** Accent edge colour token of the plate. */
  accent: string
}

/** Bottom action plates in order. Samples: ⧉ Use as template · → View · Details. Own: ✎ Edit · → View · Start/Pause/Resume · ⇪ Share · Details. */
export function cardLabR2D3Plates(sample: boolean, statusKey: string): CardLabR2D3Plate[] {
  const run = statusKey === 'active' ? 'Pause' : statusKey === 'paused' ? 'Resume' : 'Start'
  const details: CardLabR2D3Plate = { key: 'details', label: 'Details', title: 'Open the details layer: full rule, checks, tags, dates, likes, comments, visibility, price, agent id', accent: '--text-light-gray' }
  const view: CardLabR2D3Plate = { key: 'view', label: '→ View', title: 'Open the strategy page', accent: '--primary-blue' }
  if (sample) {
    return [
      { key: 'copy', label: '⧉ Use as template', title: 'Copy this sample into a new strategy of yours', accent: '--primary-green' },
      view,
      details,
    ]
  }
  return [
    { key: 'edit', label: '✎ Edit', title: 'Edit this strategy', accent: '--primary-green' },
    view,
    { key: 'toggle', label: run, title: `${run} this strategy`, accent: statusKey === 'active' ? '--warning-orange' : '--primary-green' },
    { key: 'share', label: '⇪ Share', title: 'Share to chat', accent: '--primary-blue' },
    details,
  ]
}

/**
 * Folded corner: the card's own outline with its top-right corner cut at 45° by `fold` px (clip-path polygon).
 * The cut-away triangle is drawn back on the card as the folded flap (dog-ear).
 */
export function cardLabR2D3CutPolygon(fold: number): string {
  const f = Math.max(0, Math.round(fold))
  return `polygon(0 0, calc(100% - ${f}px) 0, 100% ${f}px, 100% 100%, 0 100%)`
}
