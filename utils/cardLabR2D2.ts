/**
 * Card lab ROUND 2 — lane d2 (TWO pointed corners · gunmetal grain buttons · per-device size system · in-card Details).
 * Pure helpers for components/CardLab/R2/D2Card.vue and D2List.vue. The card's data model stays
 * utils/cardLabFinal.ts (round-1 honesty kept); this file only adds form: sizes, text budgets, the action row.
 */
import type { CardLabFinalFlag, CardLabFinalModel } from '~/utils/cardLabFinal'

export type CardLabR2D2Device = 'mobile' | 'tablet' | 'laptop' | 'large'

export interface CardLabR2D2Size {
  device: CardLabR2D2Device
  /** Viewport range [from, to) in CSS px. */
  from: number
  to: number
  /** Columns the grid produces in this class (auto-fill on `min`; a range when the list width decides). */
  columns: string
  /** Card min / max width (px): the grid track never goes below min; the card never grows past max (centred). */
  min: number
  max: number
  /** ONE fixed card height for every card of the list in this class (px). */
  height: number
}

/**
 * THE size system (mirrored in D2List.vue's CSS; tests/cardlab-r2-d2.test.ts checks both agree).
 * Height = the natural-height envelope (max over the lab's 6 cards; densest = SPX) at the class's MIN card width, measured
 * every 2 px of width (shots-r2/D2/v3-envelope.json: 308 → 590 · 362 → 543 · 392 → 514) + ~10 px. Every card gets the same
 * box: the card is justify-content: space-between, so a lighter card spreads its spare height over its section gaps, and the
 * sparse never-run card's dashed metrics plate takes it.
 */
export const cardLabR2D2Sizes: readonly CardLabR2D2Size[] = [
  { device: 'mobile', from: 0, to: 600, columns: '1', min: 308, max: 440, height: 600 },
  { device: 'tablet', from: 600, to: 1024, columns: '1–2', min: 362, max: 480, height: 552 },
  { device: 'laptop', from: 1024, to: 1440, columns: '2–3', min: 362, max: 440, height: 552 },
  { device: 'large', from: 1440, to: Infinity, columns: '3–4', min: 392, max: 440, height: 524 },
] as const

/** Device class of a viewport width (CSS px). */
export function cardLabR2D2Device(vw: number): CardLabR2D2Device {
  return (cardLabR2D2Sizes.find(s => vw >= s.from && vw < s.to) ?? cardLabR2D2Sizes[0]).device
}

/** Size row of a device class. */
export function cardLabR2D2Size(device: CardLabR2D2Device): CardLabR2D2Size {
  return cardLabR2D2Sizes.find(s => s.device === device) ?? cardLabR2D2Sizes[0]
}

/** Columns the auto-fill grid gives for a list width (same maths as CSS: floor((W + gap) / (min + gap)), at least 1). */
export function cardLabR2D2Columns(listWidth: number, min: number, gap = 12): number {
  return Math.max(1, Math.floor((listWidth + gap) / (min + gap)))
}

/**
 * Text budget: cut at a word boundary with "…" when longer than `max` characters (the full text lives in the Details
 * layer, so nothing is lost). Returns `{ text, cut }`.
 */
export function cardLabR2D2Clip(text: string, max: number): { text: string; cut: boolean } {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return { text: t, cut: false }
  const head = t.slice(0, max)
  const sp = head.lastIndexOf(' ')
  const out = (sp > max * 0.6 ? head.slice(0, sp) : head).replace(/[\s,.;:—–-]+$/, '')
  return { text: `${out}…`, cut: true }
}

/** Grid metric a flag qualifies (its ⚠ marker sits next to that number; the chip text sits in the checks strip). */
export function cardLabR2D2FlagCell(flag: Pick<CardLabFinalFlag, 'key'>): 'win' | 'sharpe' | 'trades' | 'annual' | 'beta' | 'return' {
  switch (flag.key) {
    case 'win': return 'win'
    case 'win-loss': return 'return'
    case 'sample': return 'trades'
    case 'sharpe-sign':
    case 'sharpe-gap': return 'sharpe'
    case 'annual': return 'annual'
    case 'beta-pair': return 'beta'
    default: return 'return'
  }
}

export interface CardLabR2D2Action {
  key: 'copy' | 'edit' | 'view' | 'toggle' | 'share' | 'details'
  icon: string
  label: string
  title: string
  primary?: boolean
}

/**
 * The bottom row (round-1 set, kept): samples ⧉ Use as template · → View · Details; own ✎ Edit · → View · Start/Pause ·
 * ⇪ Share · Details. `share` is rendered by <ChatShareTo> (it needs an id).
 */
export function cardLabR2D2Actions(m: Pick<CardLabFinalModel, 'sample' | 'id' | 'status'>): CardLabR2D2Action[] {
  const details: CardLabR2D2Action = { key: 'details', icon: 'ⓘ', label: 'Details', title: 'Open the details layer: full description, every check, tags, dates, likes, comments, visibility, price, agent id' }
  if (m.sample) {
    return [
      { key: 'copy', icon: '⧉', label: 'Use as template', title: 'Copy this sample into a new strategy of yours', primary: true },
      { key: 'view', icon: '→', label: 'View', title: 'Open the strategy page' },
      details,
    ]
  }
  const run = m.status.key === 'active' ? { icon: '❚❚', label: 'Pause' } : m.status.key === 'paused' ? { icon: '▶', label: 'Resume' } : { icon: '▶', label: 'Start' }
  return [
    { key: 'edit', icon: '✎', label: 'Edit', title: 'Edit this strategy', primary: true },
    { key: 'view', icon: '→', label: 'View', title: 'Open the strategy page' },
    { key: 'toggle', ...run, title: `${run.label} this strategy` },
    ...(m.id ? [{ key: 'share' as const, icon: '⇪', label: 'Share', title: 'Send it to friends, bots or rooms' }] : []),
    details,
  ]
}
