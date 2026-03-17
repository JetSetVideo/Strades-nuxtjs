import { defineStore } from 'pinia'

export interface MacroState {
  global_volatility_index: number
  market_sentiment: number
  geopolitical_stress: number
  dominant_asset_class: 'fiat' | 'crypto' | 'stocks' | 'commodities'
  last_updated: string
}

export const useMacroStore = defineStore('macro', {
  state: (): MacroState => ({
    global_volatility_index: 0.5,
    market_sentiment: 0.0,
    geopolitical_stress: 0.5,
    dominant_asset_class: 'fiat',
    last_updated: new Date().toISOString()
  }),
  actions: {
    async fetchMacroState() {
      // In development, fetch from mock json
      try {
        const res = await fetch('/data/global/macro_state.json')
        if (res.ok) {
          const data = await res.json()
          this.global_volatility_index = data.global_volatility_index
          this.market_sentiment = data.market_sentiment
          this.geopolitical_stress = data.geopolitical_stress
          this.dominant_asset_class = data.dominant_asset_class
          this.last_updated = data.last_updated
        }
      } catch (e) {
        console.error('Failed to load macro state', e)
      }
    },
    // Used by WebSocket batched updates
    updateVolatility(index: number) {
      this.global_volatility_index = index;
    }
  },
  getters: {
    // Determine how fast background elements should pulse/animate
    appAnimationSpeed: (state) => {
      // 0 = slow (2s), 1 = fast (0.3s)
      const base = 2.0
      const min = 0.3
      return Math.max(min, base - (state.global_volatility_index * 1.7))
    },
    appLightingHue: (state) => {
      // Mapping geopolitical stress (0 to 1) to an oklch hue shift (e.g. 200 blue to 30 red)
      // 0 stress = 240 (cool blue), 1 stress = 30 (warm red/orange)
      const baseHue = 240
      const stressHue = 30
      return baseHue - (state.geopolitical_stress * (baseHue - stressHue))
    },
    appBorderRadius: (state) => {
      switch (state.dominant_asset_class) {
        case 'crypto': return '4px';
        case 'stocks': return '8px';
        case 'commodities': return '12px';
        case 'fiat': default: return '16px';
      }
    }
  }
})
