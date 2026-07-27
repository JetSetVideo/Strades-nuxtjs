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
  hydrated: boolean
  tick: number
  // Derived from live price ticker (updated by prices.vue)
  gainers_count: number
  losers_count: number
  avg_change_pct: number
  top_gainer_pct: number
  top_loser_pct: number
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
    tick: 0,
    gainers_count: 0,
    losers_count: 0,
    avg_change_pct: 0,
    top_gainer_pct: 0,
    top_loser_pct: 0,
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
    },
    updateFromPriceChanges(changes: Record<string, number>) {
      const vals = Object.values(changes).filter(v => Number.isFinite(v))
      if (!vals.length) return
      const gainers = vals.filter(v => v > 0)
      const losers  = vals.filter(v => v < 0)
      const avg     = vals.reduce((s, v) => s + v, 0) / vals.length

      this.gainers_count  = gainers.length
      this.losers_count   = losers.length
      this.avg_change_pct = +avg.toFixed(3)
      this.top_gainer_pct = gainers.length ? +Math.max(...gainers).toFixed(2) : 0
      this.top_loser_pct  = losers.length  ? +Math.min(...losers).toFixed(2)  : 0

      this.market_sentiment = Math.max(-1, Math.min(1, avg / 8))

      const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length
      const stdDev   = Math.sqrt(variance)
      this.global_volatility_index = Math.min(1, stdDev / 15)
    }
  },
  getters: {
    appAnimationSpeed: (state) => Math.max(0.3, 2.0 - state.global_volatility_index * 1.7),
    appLightingHue: (state) => 240 - state.geopolitical_stress * 210,
    appBorderRadius: (state) => {
      switch (state.dominant_asset_class) {
        case 'crypto': return '4px'
        case 'stocks': return '8px'
        case 'commodities': return '12px'
        default: return '16px'
      }
    },
    appDensityScale: (state) => {
      const volContribution = state.global_volatility_index * 0.3
      const classContribution = state.dominant_asset_class === 'crypto' ? 0.2 : 0
      return clamp(1 - volContribution - classContribution, 0.6, 1)
    },
    glowRadiusPx: (state) => Math.round(4 + state.liquidity_index * 20),
    newsPulseHz: (state) => clamp(state.news_pulse_count / 30, 0.05, 1),
    ambientOklch(): string {
      const sentimentShift = (this as any).market_sentiment as number
      const lightness = 0.22 + sentimentShift * 0.06
      const hue = (this as any).appLightingHue as number
      return `oklch(${lightness.toFixed(3)} 0.05 ${hue.toFixed(1)})`
    },
    classWeights: (state) => {
      const vols = state.volatility_by_class
      const sents = state.sentiment_by_class
      const out: Record<AssetClass, number> = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
      ;(Object.keys(vols) as AssetClass[]).forEach(k => {
        out[k] = clamp(0.4 + vols[k] * 0.4 + Math.abs(sents[k]) * 0.2, 0.2, 1)
      })
      out[state.dominant_asset_class] = clamp(out[state.dominant_asset_class] + 0.15, 0.2, 1)
      return out
    }
  }
})
