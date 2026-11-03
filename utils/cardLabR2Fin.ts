/**
 * Card lab ROUND 2 — FINAL (combine lane). Pure helpers for components/CardLab/R2/FinCard.vue + FinList.vue.
 * The data model stays utils/cardLabFinal.ts (round-1 honesty kept); this file only adds form: the size system per device
 * class, text budgets, the action row (one label "Details" everywhere, an accent edge per action) and the crowd line.
 *
 * Provenance of the combined elements (R2-WAVE3.md "Combine target"):
 *   · corner icon  = D2's leaf (two pointed corners), FILLED with the asset-class tone, flush in the corner (D1/D3),
 *                    with D1's status dot + a status ring so live / paused / stopped reads on the icon itself;
 *   · buttons      = D1's brushed-steel plate (best on both visual raters) + D3's accent edge, equal rhythm;
 *   · sizes        = D3's ONE height per device class, tight slack (springs between sections, footer pinned to the row);
 *   · header       = D2's three-slot head (Sample chip top-left, never wrapping · centred title · leaf);
 *   · crowd line   = recovered likes / comments on the glance layer ("N followers · N likes · N comments").
 */
import type { CardLabFinalFlag, CardLabFinalModel } from '~/utils/cardLabFinal'

export type CardLabR2FinDevice = 'mobile' | 'tablet' | 'laptop' | 'large'

export interface CardLabR2FinSize {
  device: CardLabR2FinDevice
  /** Viewport range [from, to) in CSS px. */
  from: number
  to: number
  /** Columns the grid produces in this class (auto-fill on `min`; a range when the list width decides). */
  columns: string
  /** Card min / max width (px): a track never goes below min; a card never grows past max (centred in its track). */
  min: number
  max: number
  /** ONE fixed card height for every card of the list in this class (px). */
  height: number
  /** Corner leaf box (px, ≥ 48). */
  leaf: number
}

/**
 * THE size system (mirrored in FinList.vue's CSS; tests/cardlab-r2-fin.test.ts checks both agree).
 * Height = natural-height envelope of the 6 lab cards (densest = card 3) at the class's NARROWEST card width + a few px
 * (measured v1, every card at the class min width: 312 → 572 · 362 → 513 · 392 → 493). The tablet min (362) keeps ONE column until two cards can each be ≥ 362 px wide
 * (no 261-px phone-narrow cards at 600, D1's defect).
 */
export const cardLabR2FinSizes: readonly CardLabR2FinSize[] = [
  { device: 'mobile', from: 0, to: 600, columns: '1', min: 312, max: 440, height: 580, leaf: 52 },
  { device: 'tablet', from: 600, to: 1024, columns: '1–2', min: 362, max: 480, height: 520, leaf: 56 },
  { device: 'laptop', from: 1024, to: 1440, columns: '2–3', min: 362, max: 440, height: 520, leaf: 56 },
  { device: 'large', from: 1440, to: Infinity, columns: '3–4', min: 392, max: 440, height: 500, leaf: 58 },
] as const

/** Device class of a viewport width (CSS px). */
export function cardLabR2FinDevice(vw: number): CardLabR2FinDevice {
  return (cardLabR2FinSizes.find(s => vw >= s.from && vw < s.to) ?? cardLabR2FinSizes[0]).device
}

/** Size row of a device class. */
export function cardLabR2FinSize(device: CardLabR2FinDevice): CardLabR2FinSize {
  return cardLabR2FinSizes.find(s => s.device === device) ?? cardLabR2FinSizes[0]
}

/** Columns the auto-fill grid gives for a list width (same maths as CSS: floor((W + gap) / (min + gap)), at least 1). */
export function cardLabR2FinColumns(listWidth: number, min: number, gap = 12): number {
  return Math.max(1, Math.floor((listWidth + gap) / (min + gap)))
}

/**
 * Text budget: cut at a word boundary with "…" when longer than `max` characters (the verbatim text is in the Details
 * layer, and the card offers a "full text" link, so nothing is lost silently). Returns `{ text, cut }`.
 */
export function cardLabR2FinClip(text: string, max: number): { text: string; cut: boolean } {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return { text: t, cut: false }
  const head = t.slice(0, max)
  const sp = head.lastIndexOf(' ')
  const out = (sp > max * 0.6 ? head.slice(0, sp) : head).replace(/[\s,.;:—–-]+$/, '')
  return { text: `${out}…`, cut: true }
}

/** Grid metric a flag qualifies (its ⚠ marker sits next to that number; the words sit on the checks strip). */
export function cardLabR2FinFlagCell(flag: Pick<CardLabFinalFlag, 'key'>): 'win' | 'sharpe' | 'trades' | 'annual' | 'beta' | 'return' {
  switch (flag.key) {
    case 'win': return 'win'
    case 'sample': return 'trades'
    case 'sharpe-sign':
    case 'sharpe-gap': return 'sharpe'
    case 'annual': return 'annual'
    case 'beta-pair': return 'beta'
    default: return 'return'
  }
}

export type CardLabR2FinAccent = 'go' | 'nav' | 'warn' | 'plain'

export interface CardLabR2FinAction {
  key: 'copy' | 'edit' | 'view' | 'toggle' | 'share' | 'details'
  icon: string
  label: string
  title: string
  /** Accent edge on the steel plate (D3's idea): go = green · nav = blue · warn = orange · plain = graphite. */
  accent: CardLabR2FinAccent
  primary?: boolean
}

/**
 * The bottom row (round-1 set kept): samples ⧉ Use as template · → View · Details; own ✎ Edit · → View · Start/Pause/Resume ·
 * ⇪ Share · Details. ONE label "Details" on every card (D1's "More" was a rater defect). `share` is rendered by <ChatShareTo>.
 */
export function cardLabR2FinActions(m: Pick<CardLabFinalModel, 'sample' | 'id' | 'status'>): CardLabR2FinAction[] {
  const details: CardLabR2FinAction = {
    key: 'details', icon: 'ⓘ', label: 'Details', accent: 'plain',
    title: 'Open the details layer: full description, every check, tags, dates, visibility, price, agent id (Esc closes)',
  }
  if (m.sample) {
    return [
      { key: 'copy', icon: '⧉', label: 'Use as template', title: 'Copy this sample into a new strategy of yours', accent: 'go', primary: true },
      { key: 'view', icon: '→', label: 'View', title: 'Open the strategy page', accent: 'nav' },
      details,
    ]
  }
  const run = m.status.key === 'active'
    ? { icon: '❚❚', label: 'Pause', accent: 'warn' as const }
    : m.status.key === 'paused' ? { icon: '▶', label: 'Resume', accent: 'go' as const } : { icon: '▶', label: 'Start', accent: 'go' as const }
  return [
    { key: 'edit', icon: '✎', label: 'Edit', title: 'Edit this strategy', accent: 'go', primary: true },
    { key: 'view', icon: '→', label: 'View', title: 'Open the strategy page', accent: 'nav' },
    { key: 'toggle', ...run, title: `${run.label} this strategy` },
    ...(m.id ? [{ key: 'share' as const, icon: '⇪', label: 'Share', title: 'Send it to friends, bots or rooms', accent: 'nav' as const }] : []),
    details,
  ]
}

export interface CardLabR2FinCount {
  key: 'followers' | 'likes' | 'comments'
  /** null = not recorded (shown as "—", never as 0). */
  n: number | null
  word: string
  title: string
}

/**
 * The crowd line on the glance layer: followers · likes · comments (likes / comments were lost to Details in the three
 * designs: D2's blind recall for them was 0 %). A missing count stays "—" (never a default 0).
 */
export function cardLabR2FinCounts(m: Pick<CardLabFinalModel, 'followers' | 'likes' | 'comments'>): CardLabR2FinCount[] {
  const w = (n: number | null, one: string) => (n === 1 ? one : `${one}s`)
  const row = (key: CardLabR2FinCount['key'], n: number | null | undefined, one: string, field: string): CardLabR2FinCount => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : null
    return { key, n: v, word: w(v, one), title: v == null ? `${field}: not recorded` : field }
  }
  return [
    row('followers', m.followers, 'follower', 'followers_count'),
    row('likes', m.likes, 'like', 'likes_count'),
    row('comments', m.comments, 'comment', 'comments_count'),
  ]
}
