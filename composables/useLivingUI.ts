import { computed, type ComputedRef, type CSSProperties } from 'vue'
import { useMacroStore, type AssetClass } from '~/stores/macro'
import { useUserPreferencesStore } from '~/stores/userPreferences'

/**
 * useLivingUI — the missing factorization from Structure.md.
 *
 * Returns CSS custom properties bound to live data so component templates can
 * just spread `dynamicStyles.value` onto a root <div> instead of re-deriving
 * the same bindings each time.
 *
 * Inputs (all optional — omit to use only globals):
 *   - assetClass: tightens or loosens this component to match its class weight
 *   - confidence: 0..1; drives opacity (low confidence = ghosted)
 *   - liquidity: 0..1; drives glow radius
 *   - executionFrequency: 0..1; drives heartbeat speed
 *   - density: 'auto' | 'compact' | 'spacious' — manual override
 */
export interface LivingUIInputs {
  assetClass?: AssetClass
  confidence?: number
  liquidity?: number
  executionFrequency?: number
  density?: 'auto' | 'compact' | 'spacious'
}

export interface LivingUI {
  dynamicStyles: ComputedRef<CSSProperties & Record<string, string | number>>
  classWeight: ComputedRef<number>
  isDominant: ComputedRef<boolean>
  isCompact: ComputedRef<boolean>
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function useLivingUI(inputs: LivingUIInputs = {}): LivingUI {
  const macro = useMacroStore()
  const prefs = useUserPreferencesStore()

  const classWeight = computed(() => {
    if (!inputs.assetClass) return 1
    return macro.classWeights[inputs.assetClass] ?? 0.5
  })

  const isDominant = computed(() =>
    inputs.assetClass !== undefined && macro.dominant_asset_class === inputs.assetClass
  )

  const isCompact = computed(() => {
    if (inputs.density === 'compact') return true
    if (inputs.density === 'spacious') return false
    // auto: compact when risk profile is aggressive OR dominant class is crypto
    return prefs.personality_matrix.risk > 0.6 || macro.dominant_asset_class === 'crypto'
  })

  const dynamicStyles = computed(() => {
    const animationSpeed = macro.appAnimationSpeed
    const radius = macro.appBorderRadius
    const density = macro.appDensityScale
    const opacity = inputs.confidence !== undefined ? clamp(0.4 + inputs.confidence * 0.6, 0.4, 1) : 1
    const scale = inputs.assetClass ? 0.95 + classWeight.value * 0.1 : 1
    const padding = isCompact.value ? '0.5rem 0.75rem' : '1rem 1.25rem'

    // Heartbeat: execution_frequency drives a per-component pulse duration
    const heartbeatDuration = inputs.executionFrequency !== undefined
      ? `${(2.2 - inputs.executionFrequency * 1.8).toFixed(2)}s`
      : '0s'

    // Glow: liquidity drives a soft halo
    const glowColor = isDominant.value
      ? 'rgba(0, 255, 136, 0.35)'
      : 'rgba(255, 255, 255, 0.1)'
    const glowRadius = inputs.liquidity !== undefined
      ? Math.round(4 + inputs.liquidity * macro.glowRadiusPx)
      : 0
    const boxShadow = glowRadius > 0
      ? `0 0 ${glowRadius}px ${glowColor}, 0 4px 12px rgba(0, 0, 0, 0.3)`
      : '0 4px 12px rgba(0, 0, 0, 0.3)'

    return {
      '--lui-animation-speed': `${animationSpeed}s`,
      '--lui-border-radius': radius,
      '--lui-density': density.toString(),
      '--lui-padding': padding,
      '--lui-scale': scale.toString(),
      '--lui-opacity': opacity.toString(),
      '--lui-heartbeat': heartbeatDuration,
      '--lui-glow-radius': `${glowRadius}px`,
      '--lui-glow-color': glowColor,
      transition: `all ${animationSpeed}s ease, transform 0.25s ease`,
      borderRadius: radius,
      padding: padding,
      opacity,
      transform: `scale(${scale})`,
      boxShadow
    }
  })

  return { dynamicStyles, classWeight, isDominant, isCompact }
}
