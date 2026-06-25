import { defineStore } from 'pinia'

export interface UserPersonalityMatrix {
  risk: number
  aggression: number
  reaction_speed: number
  patience: number
}

export interface BehavioralHistory {
  eye_tracking_heat: Record<string, number>
  click_priors: Record<string, string>
}

export interface UserPreferencesState {
  user_id: string
  base_currency: string
  personality_matrix: UserPersonalityMatrix
  trading_style: string
  ui_density_preference: 'auto' | 'compact' | 'spacious'
  behavioral_history: BehavioralHistory
  favorite_assets: string[]
  hydrated: boolean
}

const DEFAULTS: UserPreferencesState = {
  user_id: 'user_001',
  base_currency: 'USD',
  personality_matrix: { risk: 0.5, aggression: 0.5, reaction_speed: 0.5, patience: 0.5 },
  trading_style: 'balanced',
  ui_density_preference: 'auto',
  behavioral_history: { eye_tracking_heat: {}, click_priors: {} },
  favorite_assets: [],
  hydrated: false
}

export const useUserPreferencesStore = defineStore('userPreferences', {
  state: (): UserPreferencesState => ({ ...DEFAULTS }),
  actions: {
    async fetchPreferences() {
      try {
        const res = await fetch('/data/global/user_preferences.json')
        if (!res.ok) return
        const data = await res.json()
        this.$patch({ ...data, hydrated: true })
      } catch (e) {
        console.error('Failed to load user preferences', e)
      }
    },
    setDensity(d: UserPreferencesState['ui_density_preference']) {
      this.ui_density_preference = d
    },
    recordHeatHit(key: string, amount = 0.05) {
      const current = this.behavioral_history.eye_tracking_heat[key] ?? 0
      this.behavioral_history.eye_tracking_heat[key] = Math.min(1, current + amount)
    }
  },
  getters: {
    isAggressive: (state) => state.personality_matrix.risk > 0.6,
    isConservative: (state) => state.personality_matrix.risk < 0.4,
    // Predicted next route based on highest eye-tracking heat
    predictedNextRoute: (state) => {
      const heat = state.behavioral_history.eye_tracking_heat
      const entries = Object.entries(heat)
      if (entries.length === 0) return null
      return entries.sort(([, a], [, b]) => b - a)[0][0]
    }
  }
})
