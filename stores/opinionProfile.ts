import { defineStore } from 'pinia'

/**
 * Opinion Profiler — builds a political & economic leaning profile per user
 * from the articles they read and share.
 *
 * Pipeline (per CodingAgent.md §4):
 *   1. Capture — `recordRead()` / `recordShare()` log interactions with NLP metadata.
 *   2. Decay-weighted moving average — recent articles weigh more:
 *        leaning_new = α · post.leaning + (1 − α) · leaning_old     (α ≈ 0.15)
 *   3. Topic affinity — histogram of article categories engaged with.
 *   4. Influence web — directed edges (reader ← author) with engagement weights.
 *
 * All state is persisted to localStorage so profiles survive reloads.
 */

export type Category = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'macro' | string

export interface ArticleSnapshot {
  id: string
  author_id: string
  category?: Category
  political_leaning?: number     // -1..+1
  economic_leaning?: number      // -1..+1
  sentiment?: number             // -1..+1
  weight?: number                // 0..1 editorial weight
}

export interface OpinionProfile {
  user_id: string
  /** Decay-weighted moving average of political leaning across articles */
  political_leaning: number      // -1..+1
  /** Decay-weighted moving average of economic leaning */
  economic_leaning: number       // -1..+1
  /** Average sentiment of articles engaged with (bearish ↔ bullish) */
  sentiment_bias: number         // -1..+1
  /** Number of articles contributing to this profile */
  sample_count: number
  /** Confidence in the profile (0–1, grows with sample_count) */
  confidence: number
  /** Histogram of categories engaged with */
  topic_affinity: Record<Category, number>
  /** Directed influence edges (author → engagement weight) */
  influence_web: Record<string, number>
  /** Last 20 article IDs that moved this profile */
  recent_article_ids: string[]
  updated_at: string
}

export interface OpinionProfileState {
  profiles: Record<string, OpinionProfile>
  hydrated: boolean
}

const STORAGE_KEY = 'strades_opinion_profiles_v1'
const ALPHA = 0.15               // decay rate for moving average
const MAX_RECENT = 20

const emptyProfile = (userId: string): OpinionProfile => ({
  user_id: userId,
  political_leaning: 0,
  economic_leaning: 0,
  sentiment_bias: 0,
  sample_count: 0,
  confidence: 0,
  topic_affinity: {},
  influence_web: {},
  recent_article_ids: [],
  updated_at: new Date().toISOString()
})

export const useOpinionProfileStore = defineStore('opinionProfile', {
  state: (): OpinionProfileState => ({
    profiles: {},
    hydrated: false
  }),

  getters: {
    getProfile: (s) => (userId: string): OpinionProfile =>
      s.profiles[userId] ?? emptyProfile(userId),

    /** Top N categories the user engages with */
    topTopics: (s) => (userId: string, n = 3): Array<{ category: Category; count: number }> => {
      const p = s.profiles[userId]
      if (!p) return []
      return Object.entries(p.topic_affinity)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n)
    },

    /** Top N influencers for this user */
    topInfluencers: (s) => (userId: string, n = 5): Array<{ author_id: string; weight: number }> => {
      const p = s.profiles[userId]
      if (!p) return []
      return Object.entries(p.influence_web)
        .map(([author_id, weight]) => ({ author_id, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, n)
    },

    /** Human-readable label for the political leaning */
    leaningLabel: () => (value: number): string => {
      if (value < -0.5) return 'Strongly left'
      if (value < -0.15) return 'Left-leaning'
      if (value < 0.15) return 'Centrist'
      if (value < 0.5) return 'Right-leaning'
      return 'Strongly right'
    },

    economicLabel: () => (value: number): string => {
      if (value < -0.5) return 'Strongly dovish'
      if (value < -0.15) return 'Dovish'
      if (value < 0.15) return 'Neutral'
      if (value < 0.5) return 'Hawkish'
      return 'Strongly hawkish'
    }
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) this.profiles = JSON.parse(raw)
      } catch { /* fresh */ }
      this.hydrated = true
    },

    persist() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles))
      } catch { /* quota full — non-fatal */ }
    },

    /**
     * Record an article interaction.
     * `kind` = 'read' (weight 1) or 'share' (weight 2 — sharing is a stronger signal).
     */
    recordInteraction(userId: string, article: ArticleSnapshot, kind: 'read' | 'share' = 'read') {
      if (!this.hydrated) this.hydrate()
      const profile = this.profiles[userId] ?? emptyProfile(userId)
      const w = (kind === 'share' ? 2 : 1) * (article.weight ?? 0.5)
      const a = ALPHA * w

      if (article.political_leaning !== undefined) {
        profile.political_leaning = a * article.political_leaning + (1 - a) * profile.political_leaning
      }
      if (article.economic_leaning !== undefined) {
        profile.economic_leaning = a * article.economic_leaning + (1 - a) * profile.economic_leaning
      }
      if (article.sentiment !== undefined) {
        profile.sentiment_bias = a * article.sentiment + (1 - a) * profile.sentiment_bias
      }

      if (article.category) {
        profile.topic_affinity[article.category] = (profile.topic_affinity[article.category] ?? 0) + w
      }

      // Influence web: author gains weight equal to interaction weight
      if (article.author_id && article.author_id !== userId) {
        profile.influence_web[article.author_id] = (profile.influence_web[article.author_id] ?? 0) + w
      }

      // Recency tracking
      profile.recent_article_ids.unshift(article.id)
      if (profile.recent_article_ids.length > MAX_RECENT) {
        profile.recent_article_ids = profile.recent_article_ids.slice(0, MAX_RECENT)
      }

      profile.sample_count += 1
      // Confidence grows logarithmically: 10 articles ≈ 0.5, 100 articles ≈ 0.9
      profile.confidence = Math.min(0.99, 1 - 1 / (1 + profile.sample_count / 15))
      profile.updated_at = new Date().toISOString()

      this.profiles[userId] = profile
      this.persist()
    },

    recordRead(userId: string, article: ArticleSnapshot) {
      this.recordInteraction(userId, article, 'read')
    },

    recordShare(userId: string, article: ArticleSnapshot) {
      this.recordInteraction(userId, article, 'share')
    },

    /** Bulk-seed a profile from a list of articles (useful for bootstrapping) */
    seedFromArticles(userId: string, articles: ArticleSnapshot[]) {
      for (const a of articles) this.recordRead(userId, a)
    },

    resetProfile(userId: string) {
      delete this.profiles[userId]
      this.persist()
    }
  }
})
