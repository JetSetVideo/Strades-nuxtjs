import { computed, type Ref, type ComputedRef, type CSSProperties } from 'vue'

export interface AssetTone {
  styles: ComputedRef<CSSProperties & Record<string, string>>
  level: ComputedRef<'strong-up' | 'up' | 'flat' | 'down' | 'strong-down'>
  isPositive: ComputedRef<boolean>
  hex: ComputedRef<string>
}

/**
 * Turn a daily change percentage into the visual tone for an asset card:
 *  - border color, subtle background tint, glow halo, semantic level
 *
 * The output is plain CSS variables / inline styles so any component can
 * spread `styles.value` onto its root element.
 */
export function useAssetTone(change: Ref<number | undefined> | (() => number | undefined)): AssetTone {
  const pct = computed(() => {
    const v = typeof change === 'function' ? change() : change.value
    return Number.isFinite(v ?? NaN) ? (v as number) : 0
  })

  const level = computed<AssetTone['level']['value']>(() => {
    const v = pct.value
    if (v >= 4) return 'strong-up'
    if (v >= 0.5) return 'up'
    if (v <= -4) return 'strong-down'
    if (v <= -0.5) return 'down'
    return 'flat'
  })

  const isPositive = computed(() => pct.value >= 0)

  // Map level → tint values (alpha kept low so the card stays "card-like")
  const styles = computed(() => {
    const v = pct.value
    // Map [-6, +6] → intensity 0..1, anything beyond just clamps
    const intensity = Math.min(1, Math.abs(v) / 6)
    const baseHue = isPositive.value ? 145 : 0       // green vs red
    const bgAlpha = 0.04 + intensity * 0.08          // 0.04..0.12
    const borderAlpha = 0.18 + intensity * 0.45      // 0.18..0.63
    const glow = intensity * 18                       // px

    const borderColor = `hsla(${baseHue} 90% 55% / ${borderAlpha.toFixed(3)})`
    const bgTint = `hsla(${baseHue} 75% 50% / ${bgAlpha.toFixed(3)})`
    const accentColor = `hsl(${baseHue} 85% ${isPositive.value ? 55 : 60}%)`

    return {
      '--asset-accent': accentColor,
      '--asset-border': borderColor,
      '--asset-bg-tint': bgTint,
      '--asset-glow': `0 0 ${glow.toFixed(0)}px ${borderColor}`,
      '--asset-intensity': intensity.toFixed(3)
    }
  })

  const hex = computed(() => {
    // For places that need a single color string (badge, sparkline)
    const positive = isPositive.value
    return positive ? 'var(--primary-green, #00ff88)' : 'var(--error-red, #ff4444)'
  })

  return { styles, level, isPositive, hex }
}
