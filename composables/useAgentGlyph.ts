import type { ComputedRef } from 'vue'
import { cyrb53 } from '~/composables/useSeededRandom'
import type { Agent } from '~/types/agent'

export interface AgentGlyph {
  initials: string
  style: Record<string, string>
  isClassifier: boolean
}

/**
 * Generates a deterministic identity mark for an agent instead of depending on
 * a raster avatar file (the roster ships with none — every persona is drawn
 * from its own data).
 *
 * generative agents render as a soft radial "personality bloom" (hue drifts
 * with id, warmth with aggression) — a face implied, not depicted.
 * classifier agents (Jev) render as a hard conic scan, banded by regime
 * count, because there is no personality to bloom from — only a decision
 * boundary.
 */
export function useAgentGlyph(agent: ComputedRef<Agent> | Agent): AgentGlyph {
  const a = 'value' in agent ? agent : { value: agent }
  const initials = a.value.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

  const hash = cyrb53(a.value.id)
  const hue = hash % 360
  const isClassifier = a.value.model_type === 'classifier'

  let style: Record<string, string>
  if (isClassifier) {
    const bands = 4 // one per market regime
    const step = 360 / bands
    style = {
      background: `repeating-conic-gradient(from ${hue}deg, oklch(0.5 0.14 ${hue}) 0deg ${step * 0.5}deg, oklch(0.32 0.1 ${hue}) ${step * 0.5}deg ${step}deg)`
    }
  } else {
    const warmth = (a.value.personality_matrix.aggression - 0.5) * 40
    const hue2 = (hue + 24) % 360
    style = {
      background: `radial-gradient(circle at 32% 28%, oklch(0.62 0.15 ${hue + warmth}) 0%, oklch(0.4 0.12 ${hue2}) 65%, oklch(0.24 0.08 ${hue2}) 100%)`
    }
  }

  return { initials, style, isClassifier }
}
