/**
 * Predictions Store
 * Persists user price-intuition predictions across sessions via localStorage.
 * Schema includes: user, asset, price snapshot, direction, timeframe, confidence,
 * optional geolocation, and outcome evaluation once the target date passes.
 */
import { defineStore } from 'pinia'

export type PredictionDirection = 'bullish' | 'bearish' | 'neutral'
export type PredictionStatus    = 'pending' | 'accurate' | 'missed' | 'expired'

export interface Prediction {
  id: string
  userId: string
  assetId: string
  assetName: string
  // When & where
  timestamp: string     // ISO datetime recorded
  latitude?: number     // optional geolocation
  longitude?: number
  // Price context
  currentPrice: number
  predictedPrice: number
  predictedChangePct: number  // signed %
  direction: PredictionDirection
  // Timeframe
  timeframe: string   // '1D' | '1W' | '1M' | '3M' | '6M' | '1Y'
  targetDate: string  // ISO date when prediction expires
  // Metadata
  confidence: number  // 1-5 stars
  note: string
  // Outcome (filled on evaluation)
  status: PredictionStatus
  actualPrice?: number
  accuracyScore?: number  // 0-100
}

export interface PredictionStats {
  total: number
  pending: number
  accurate: number
  missed: number
  avgAccuracy: number     // 0-100
  bullishCount: number
  bearishCount: number
  bestStreak: number      // consecutive accurate predictions
  currentStreak: number
}

const STORAGE_KEY = 'strades:predictions'
const TIMEFRAME_DAYS: Record<string, number> = {
  '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 182, '1Y': 365,
}

function loadFromStorage(): Prediction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Prediction[]) : []
  } catch { return [] }
}

function saveToStorage(predictions: Prediction[]): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions)) } catch {}
}

export function computeTargetDate(timeframe: string): string {
  const days = TIMEFRAME_DAYS[timeframe] ?? 1
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function evaluatePrediction(p: Prediction, actualPrice: number): Prediction {
  const actualPct = (actualPrice - p.currentPrice) / p.currentPrice * 100
  const correctDir =
    (p.direction === 'bullish' && actualPct > 0) ||
    (p.direction === 'bearish' && actualPct < 0)

  // Accuracy: 50 pts for correct direction + 50 pts scaled by magnitude accuracy
  let score = 0
  if (correctDir) {
    score = 50
    const denominator = Math.max(0.01, Math.abs(p.predictedChangePct))
    const magnitudeErr = Math.abs(actualPct - p.predictedChangePct) / denominator
    score += Math.round(50 * Math.max(0, 1 - magnitudeErr))
  }
  return {
    ...p,
    status: correctDir ? 'accurate' : 'missed',
    actualPrice,
    accuracyScore: score,
  }
}

export const usePredictionsStore = defineStore('predictions', {
  state: () => ({
    predictions: [] as Prediction[],
    initialized: false,
  }),

  getters: {
    /** All predictions for a given asset */
    byAsset: (state) => (assetId: string) =>
      state.predictions.filter(p => p.assetId === assetId),

    /** All predictions for a given user */
    byUser: (state) => (userId: string) =>
      state.predictions.filter(p => p.userId === userId),

    /** Predictions that have not yet expired */
    pending: (state) =>
      state.predictions.filter(p => p.status === 'pending'),

    /** Predictions still pending but past their target date (awaiting evaluation) */
    toEvaluate: (state) => {
      const today = new Date().toISOString().slice(0, 10)
      return state.predictions.filter(
        p => p.status === 'pending' && p.targetDate < today
      )
    },

    /** All active (pending) predictions for a user+asset across all timeframes */
    activeByAsset: (state) => (userId: string, assetId: string): Prediction[] =>
      state.predictions.filter(
        p => p.userId === userId && p.assetId === assetId && p.status === 'pending'
      ),

    /** Active (pending) prediction for a specific user+asset+timeframe */
    activeForAssetTf: (state) => (userId: string, assetId: string, tf: string): Prediction | null =>
      state.predictions.find(
        p => p.userId === userId && p.assetId === assetId && p.timeframe === tf && p.status === 'pending'
      ) ?? null,

    /** Friends' pending predictions for an asset (excludes currentUserId) */
    friendsForAsset: (state) => (currentUserId: string, assetId: string): Prediction[] =>
      state.predictions.filter(
        p => p.userId !== currentUserId && p.assetId === assetId && p.status === 'pending'
      ),

    /** Community consensus for a specific asset+timeframe */
    consensusForTf: (state) => (assetId: string, tf: string): { count: number; bullPct: number; avgChangePct: number } | null => {
      const preds = state.predictions.filter(
        p => p.assetId === assetId && p.timeframe === tf && p.status === 'pending'
      )
      if (!preds.length) return null
      const bullPct = (preds.filter(p => p.direction === 'bullish').length / preds.length) * 100
      const avgChangePct = preds.reduce((s, p) => s + p.predictedChangePct, 0) / preds.length
      return { count: preds.length, bullPct, avgChangePct }
    },

    /** Recent evaluated predictions for a user (last 7 days) — used for alerts */
    recentAlerts: (state) => (userId: string): Prediction[] => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      return state.predictions
        .filter(p => p.userId === userId && p.status !== 'pending' && p.timestamp > cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5)
    },

    /** Recent N predictions for a given user+asset */
    recentByAsset: (state) => (userId: string, assetId: string, n = 5) =>
      state.predictions
        .filter(p => p.userId === userId && p.assetId === assetId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, n),

    /** Aggregate stats for a user across all assets */
    statsForUser: (state) => (userId: string): PredictionStats => {
      const preds = state.predictions.filter(p => p.userId === userId)
      const evaluated = preds.filter(p => p.status !== 'pending' && p.status !== 'expired')
      const accurate  = evaluated.filter(p => p.status === 'accurate')

      // Calculate streak from most recent backward
      const sorted = [...preds]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .filter(p => p.status !== 'pending' && p.status !== 'expired')

      let currentStreak = 0
      let bestStreak = 0
      let streak = 0
      for (const p of sorted) {
        if (p.status === 'accurate') { streak++; bestStreak = Math.max(bestStreak, streak) }
        else streak = 0
      }
      currentStreak = sorted.findIndex(p => p.status !== 'accurate')
      if (currentStreak === -1) currentStreak = sorted.length

      const avgAccuracy = evaluated.length
        ? Math.round(evaluated.reduce((s, p) => s + (p.accuracyScore ?? 0), 0) / evaluated.length)
        : 0

      return {
        total: preds.length,
        pending: preds.filter(p => p.status === 'pending').length,
        accurate: accurate.length,
        missed: evaluated.filter(p => p.status === 'missed').length,
        avgAccuracy,
        bullishCount: preds.filter(p => p.direction === 'bullish').length,
        bearishCount: preds.filter(p => p.direction === 'bearish').length,
        bestStreak,
        currentStreak,
      }
    },
  },

  actions: {
    /** Initialize from localStorage on app start */
    init() {
      if (this.initialized) return
      this.predictions = loadFromStorage()
      this.initialized = true
      this.evaluateExpired()
    },

    /** Load mock seed data (used in demo / dev) */
    async seedFromFile() {
      try {
        const data = await $fetch<Prediction[]>('/data/predictions.json')
        // Merge: only add if id not already present
        const existing = new Set(this.predictions.map(p => p.id))
        for (const p of data) {
          if (!existing.has(p.id)) this.predictions.push(p)
        }
        saveToStorage(this.predictions)
      } catch {}
    },

    /** Add a new prediction */
    addPrediction(
      params: Omit<Prediction, 'id' | 'status' | 'targetDate'> & { timeframe: string }
    ): Prediction {
      const prediction: Prediction = {
        ...params,
        id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        targetDate: computeTargetDate(params.timeframe),
        status: 'pending',
      }
      this.predictions.push(prediction)
      saveToStorage(this.predictions)
      return prediction
    },

    /** Update outcome when actual price is known */
    evaluatePrediction(predictionId: string, actualPrice: number) {
      const idx = this.predictions.findIndex(p => p.id === predictionId)
      if (idx === -1) return
      this.predictions[idx] = evaluatePrediction(this.predictions[idx]!, actualPrice)
      saveToStorage(this.predictions)
    },

    /** Auto-expire all past-target-date pending predictions */
    evaluateExpired() {
      const today = new Date().toISOString().slice(0, 10)
      let changed = false
      for (const p of this.predictions) {
        if (p.status === 'pending' && p.targetDate < today) {
          // In a real app, fetch actual price from API.
          // Here we mark 'expired' if no actual price provided.
          p.status = 'expired'
          changed = true
        }
      }
      if (changed) saveToStorage(this.predictions)
    },

    /** Update an existing prediction (e.g. user changes their view) */
    updatePrediction(id: string, updates: Partial<Omit<Prediction, 'id'>>) {
      const idx = this.predictions.findIndex(p => p.id === id)
      if (idx !== -1) {
        this.predictions[idx] = { ...this.predictions[idx]!, ...updates }
        saveToStorage(this.predictions)
      }
    },

    /** Delete a prediction by ID */
    deletePrediction(id: string) {
      this.predictions = this.predictions.filter(p => p.id !== id)
      saveToStorage(this.predictions)
    },

    /** Clear all predictions (dev/reset) */
    clearAll() {
      this.predictions = []
      saveToStorage([])
    },
  },
})
