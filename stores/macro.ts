import { defineStore } from 'pinia'

export type AssetClass = 'fiat' | 'crypto' | 'stocks' | 'commodities'

export interface GeoPoint { lat: number; lng: number; name?: string }
export interface ActiveFlow { from: AssetClass; to: AssetClass; magnitude: number }

export interface MacroState {
  global_volatility_index: number
  market_sentiment: number
  geopolitical_stress: number
  dominant_asset_class: AssetClass
  flow_velocity: number
  liquidity_index: number
  news_pulse_count: number
  fear_greed: number
  lighting_source_angle: number
  volatility_by_class: Record<AssetClass, number>
  sentiment_by_class: Record<AssetClass, number>
  dominant_geo_stress_region: GeoPoint
  active_flows: ActiveFlow[]
  last_updated: string
  // pipeline metadata
  hydrated: boolean
  tick: number
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

export const useMacroStore = defineStore('macro', {
  state: (): MacroState => ({
    global_volatility_index: 0.5,
    market_sentiment: 0.0,
    geopolitical_stress: 0.5,
    dominant_asset_class: 'fiat',
    flow_velocity: 0.1,
    liquidity_index: 0.6,
    news_pulse_count: 0,
    fear_greed: 50,
    lighting_source_angle: 180,
    volatility_by_class: { fiat: 0.1, crypto: 0.5, stocks: 0.3, commodities: 0.3 },
    sentiment_by_class: { fiat: 0, crypto: 0, stocks: 0, commodities: 0 },
    dominant_geo_stress_region: { lat: 0, lng: 0 },
    active_flows: [],
    last_updated: new Date().toISOString(),
    hydrated: false,
    tick: 0
  }),
  actions: {
    async fetchMacroState() {
      try {
        const res = await fetch('/data/global/macro_state.json')
        if (!res.ok) return
        const data = await res.json()
        this.$patch({
          global_volatility_index: data.global_volatility_index ?? this.global_volatility_index,
          market_sentiment: data.market_sentiment ?? this.market_sentiment,
          geopolitical_stress: data.geopolitical_stress ?? this.geopolitical_stress,
          dominant_asset_class: data.dominant_asset_class ?? this.dominant_asset_class,
          flow_velocity: data.flow_velocity ?? this.flow_velocity,
          liquidity_index: data.liquidity_index ?? this.liquidity_index,
          news_pulse_count: data.news_pulse_count ?? this.news_pulse_count,
          fear_greed: data.fear_greed ?? this.fear_greed,
          lighting_source_angle: data.lighting_source_angle ?? this.lighting_source_angle,
          volatility_by_class: data.volatility_by_class ?? this.volatility_by_class,
          sentiment_by_class: data.sentiment_by_class ?? this.sentiment_by_class,
          dominant_geo_stress_region: data.dominant_geo_stress_region ?? this.dominant_geo_stress_region,
          active_flows: data.active_flows ?? this.active_flows,
          last_updated: data.last_updated ?? new Date().toISOString(),
          hydrated: true
        })
      } catch (e) {
        console.error('Failed to load macro state', e)
      }
    },
    // Batched patch from the pipeline plugin; called via RAF
    applyTick(patch: Partial<MacroState>) {
      this.$patch({ ...patch, tick: this.tick + 1, last_updated: new Date().toISOString() })
    },
    updateVolatility(index: number) {
      this.global_volatility_index = clamp(index)
    },
    nudgeFlowVelocity(delta: number) {
      this.flow_velocity = clamp(this.flow_velocity + delta)
    },
    pushFlow(flow: ActiveFlow) {
      this.active_flows = [flow, ...this.active_flows].slice(0, 8)
    }
  },
  getters: {
    // Animation speed: high volatility = fast (0.3s), low = slow (2s)
    appAnimationSpeed: (state) => Math.max(0.3, 2.0 - state.global_volatility_index * 1.7),
    // Lighting hue: stress shifts blue → red
    appLightingHue: (state) => 240 - state.geopolitical_stress * 210,
    // Border radius: dominant class determines sharpness
    appBorderRadius: (state) => {
      switch (state.dominant_asset_class) {
        case 'crypto': return '4px'
        case 'stocks': return '8px'
        case 'commodities': return '12px'
        default: return '16px'
      }
    },
    // Density: derived from volatility AND dominant class (crypto + high vol = compact)
    appDensityScale: (state) => {
      const volContribution = state.global_volatility_index * 0.3
      const classContribution = state.dominant_asset_class === 'crypto' ? 0.2 : 0
      return clamp(1 - volContribution - classContribution, 0.6, 1)
    },
    // Glow radius for liquid assets: higher liquidity = bigger soft halo
    glowRadiusPx: (state) => Math.round(4 + state.liquidity_index * 20),
    // News pulse: count drives icon urgency
    newsPulseHz: (state) => clamp(state.news_pulse_count / 30, 0.05, 1),
    // oklch fragment for tinting backgrounds
    ambientOklch(): string {
      const sentimentShift = (this as any).market_sentiment as number
      const lightness = 0.22 + sentimentShift * 0.06
      const hue = (this as any).appLightingHue as number
      return `oklch(${lightness.toFixed(3)} 0.05 ${hue.toFixed(1)})`
    },
    // Weight (0..1) for each asset class — components use this to scale themselves
    classWeights: (state) => {
      const vols = state.volatility_by_class
      const sents = state.sentiment_by_class
      const out: Record<AssetClass, number> = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
      ;(Object.keys(vols) as AssetClass[]).forEach(k => {
        // Weight combines class volatility and sentiment magnitude
        out[k] = clamp(0.4 + vols[k] * 0.4 + Math.abs(sents[k]) * 0.2, 0.2, 1)
      })
      // Dominant class gets a boost
      out[state.dominant_asset_class] = clamp(out[state.dominant_asset_class] + 0.15, 0.2, 1)
      return out
    }
  }
})
