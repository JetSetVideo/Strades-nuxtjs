/**
 * Default portrait when a desk has no uploaded picture.
 * The silhouette stays a mask; the gradient follows the mind scores.
 * Low scores pull the color toward orange and yellow. High scores cool it
 * toward green and blue. The same seed always draws the same mask.
 */

export interface MaskPsych {
  risk: number
  discipline: number
  patience: number
  aggression: number
}

export interface MaskFace {
  head: string
  eyes: string
  body: string
  from: string
  to: string
  cheek: string
  /** Backdrop behind the mask. */
  plate: string
  /** Card wash. */
  wash: string
  /** Card and portrait edge. */
  edge: string
  /** How solid the mask sits. Low discipline fades it. */
  opacity: number
}

type RGB = [number, number, number]

interface StylePreset extends MaskPsych {
  from: RGB
  to: RGB
  cheek: RGB
}

const PRESETS: Record<string, StylePreset> = {
  scalper: { risk: 0.86, discipline: 0.42, patience: 0.18, aggression: 0.9, from: [255, 90, 40], to: [255, 176, 32], cheek: [255, 70, 110] },
  day_trader: { risk: 0.7, discipline: 0.55, patience: 0.32, aggression: 0.72, from: [0, 196, 255], to: [0, 110, 220], cheek: [120, 220, 255] },
  swing_trader: { risk: 0.55, discipline: 0.7, patience: 0.58, aggression: 0.48, from: [0, 229, 138], to: [0, 140, 255], cheek: [180, 255, 190] },
  position_trader: { risk: 0.28, discipline: 0.84, patience: 0.9, aggression: 0.22, from: [79, 140, 255], to: [40, 70, 160], cheek: [160, 190, 255] },
  buy_hold: { risk: 0.22, discipline: 0.88, patience: 0.92, aggression: 0.16, from: [74, 144, 226], to: [30, 64, 140], cheek: [170, 200, 240] },
  mean_reversion: { risk: 0.48, discipline: 0.74, patience: 0.66, aggression: 0.36, from: [180, 110, 255], to: [90, 40, 180], cheek: [220, 170, 255] },
  carry: { risk: 0.34, discipline: 0.8, patience: 0.78, aggression: 0.24, from: [40, 200, 190], to: [16, 110, 120], cheek: [150, 240, 220] },
  vol_sell: { risk: 0.62, discipline: 0.5, patience: 0.4, aggression: 0.58, from: [255, 176, 32], to: [200, 90, 20], cheek: [255, 220, 120] },
  trend_follow: { risk: 0.66, discipline: 0.6, patience: 0.48, aggression: 0.7, from: [0, 229, 120], to: [0, 140, 70], cheek: [170, 255, 140] },
  macro_overlay: { risk: 0.4, discipline: 0.76, patience: 0.7, aggression: 0.3, from: [244, 193, 69], to: [140, 90, 20], cheek: [255, 220, 140] },
  none: { risk: 0.35, discipline: 0.4, patience: 0.55, aggression: 0.2, from: [150, 156, 168], to: [70, 74, 84], cheek: [120, 124, 134] },
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.5
  return Math.min(1, Math.max(0, n))
}

function channel(n: number) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
}

function blend(a: RGB, b: RGB, t: number): RGB {
  const u = clamp01(t)
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ]
}

function mix(a: RGB, b: RGB, t: number) {
  const [r, g, bch] = blend(a, b, t)
  return `#${channel(r)}${channel(g)}${channel(bch)}`
}

function hash(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function presetFor(style?: string): StylePreset {
  const key = (style || '').toLowerCase().replace(/[\s-]+/g, '_')
  return PRESETS[key] ?? PRESETS.swing_trader
}

/** Premium desks lead, then verified desks, then everyone else. */
export function compareCircle(
  a: { premium?: boolean; verified?: boolean },
  b: { premium?: boolean; verified?: boolean },
): number {
  const rank = (person: { premium?: boolean; verified?: boolean }) =>
    (person.premium ? 0 : 2) + (person.verified ? 0 : 1)
  return rank(a) - rank(b)
}

export function profileMask(seed: string, psych: Partial<MaskPsych> & { style?: string; muted?: boolean } = {}): MaskFace {
  const preset = psych.muted ? PRESETS.none : presetFor(psych.style)
  const risk = clamp01(psych.risk ?? preset.risk)
  const discipline = clamp01(psych.discipline ?? preset.discipline)
  const patience = clamp01(psych.patience ?? preset.patience)
  const aggression = clamp01(psych.aggression ?? preset.aggression)
  const heat = (risk + aggression + (1 - discipline) + (1 - patience)) / 4
  const wobble = psych.muted ? 0 : (hash(seed || 'desk') % 7) - 3

  const crown = 9 + (1 - risk) * 3
  const cheekX = 13 + aggression * 5 + wobble * 0.4
  const jawY = 60 - patience * 7
  const brow = 26 + (1 - patience) * 5
  const shoulder = 8 + discipline * 6

  const head = [
    `M40 ${crown.toFixed(1)}`,
    `C${(22 - aggression * 6).toFixed(1)} ${(14 + wobble).toFixed(1)}, ${cheekX.toFixed(1)} 30, ${(cheekX + 1).toFixed(1)} ${(38 + aggression * 6).toFixed(1)}`,
    `C${(cheekX + 2).toFixed(1)} ${(50 + aggression * 4).toFixed(1)}, ${(26 + patience * 4).toFixed(1)} ${(jawY + 2).toFixed(1)}, 40 ${jawY.toFixed(1)}`,
    `C${(54 - patience * 4).toFixed(1)} ${(jawY + 2).toFixed(1)}, ${(66 - cheekX).toFixed(1)} ${(50 + aggression * 4).toFixed(1)}, ${(79 - cheekX).toFixed(1)} ${(38 + aggression * 6).toFixed(1)}`,
    `C${(80 - cheekX).toFixed(1)} 30, ${(58 + aggression * 6).toFixed(1)} ${(14 - wobble).toFixed(1)}, 40 ${crown.toFixed(1)} Z`,
  ].join(' ')

  const slit = 9 + aggression * 3
  const eyes = `M${(24).toFixed(1)} ${brow.toFixed(1)} h${slit.toFixed(1)} v2.4 h-${slit.toFixed(1)} z M${(46).toFixed(1)} ${brow.toFixed(1)} h${slit.toFixed(1)} v2.4 h-${slit.toFixed(1)} z`

  const body = [
    `M${shoulder.toFixed(1)} 78`,
    `C${(18 + discipline * 4).toFixed(1)} ${(60 + patience * 8).toFixed(1)}, 28 ${(54 + patience * 4).toFixed(1)}, 40 52`,
    `C52 ${(54 + patience * 4).toFixed(1)}, ${(62 - discipline * 4).toFixed(1)} ${(60 + patience * 8).toFixed(1)}, ${(80 - shoulder).toFixed(1)} 78 Z`,
  ].join(' ')

  const warm: RGB = [255, 138, 30]
  const fromRgb = psych.muted
    ? blend(preset.from, [90, 94, 104], 0.35)
    : blend(blend(preset.from, warm, heat * 0.55), [0, 229, 138], (1 - heat) * 0.25)
  const toRgb = psych.muted
    ? blend(preset.to, [40, 42, 48], 0.2)
    : blend(preset.to, [255, 90, 40], heat * 0.35)
  const cheekRgb = psych.muted
    ? blend(preset.cheek, [110, 114, 122], 0.3)
    : blend(preset.cheek, [255, 210, 80], (1 - patience) * 0.4)
  const from = mix(fromRgb, fromRgb, 0)
  const to = mix(toRgb, toRgb, 0)
  const cheek = mix(cheekRgb, cheekRgb, 0)
  const opacity = psych.muted ? 0.72 : 0.55 + discipline * 0.4

  return {
    head,
    eyes,
    body,
    from,
    to,
    cheek,
    plate: mix(toRgb, [12, 14, 18], 0.72),
    wash: `linear-gradient(145deg, ${from}2e, rgba(12,14,18,0.94) 58%, ${to}24)`,
    edge: from,
    opacity,
  }
}

/** Bar fill. A low score stays in orange and yellow. A high score runs through to green. */
export function meterFill(value: number): string {
  const v = clamp01(value)
  const orange = '#ff8a1e'
  const yellow = '#f5d90a'
  const end = v < 0.45
    ? mix([255, 138, 30], [245, 217, 10], v / 0.45)
    : mix([245, 217, 10], [0, 229, 138], (v - 0.45) / 0.55)
  if (v < 0.45) return `linear-gradient(90deg, ${orange}, ${end})`
  return `linear-gradient(90deg, ${yellow}, ${end})`
}
