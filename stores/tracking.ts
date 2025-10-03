import { defineStore } from 'pinia'

// Types for tracking and analytics
export interface UserInteraction {
  id: string
  user_id: string
  session_id: string
  event_type: 'page_view' | 'component_interaction' | 'asset_view' | 'trade_execution' | 'strategy_follow' | 'social_interaction' | 'search_query'
  target: string
  component: string
  action: string
  timestamp: string
  duration_ms: number | null
  metadata: Record<string, any>
  context: Record<string, any>
}

export interface ComponentUsage {
  id: string
  component_name: string
  component_type: string
  user_id: string
  session_id: string
  page: string
  action: string
  timestamp: string
  render_time_ms: number
  interaction_count: number
  props: Record<string, any>
  metadata: Record<string, any>
}

export interface AnalyticsMetric {
  id: string
  date: string
  metric_type: string
  metric_name: string
  value: number
  previous_value: number
  change_percentage: number
  metadata: Record<string, any>
  calculated_at: string
}

export const useTrackingStore = defineStore('tracking', {
  state: () => ({
    userInteractions: [] as UserInteraction[],
    componentUsage: [] as ComponentUsage[],
    analytics: [] as AnalyticsMetric[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getUserInteractions: (state) => (userId: string, limit = 50) => {
      return state.userInteractions
        .filter(interaction => interaction.user_id === userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
    },

    getComponentUsage: (state) => (componentName: string) => {
      return state.componentUsage.filter(usage => usage.component_name === componentName)
    },

    getAnalyticsByType: (state) => (metricType: string) => {
      return state.analytics.filter(metric => metric.metric_type === metricType)
    },

    getAnalyticsByDateRange: (state) => (startDate: string, endDate: string) => {
      return state.analytics.filter(metric => {
        const metricDate = new Date(metric.date)
        return metricDate >= new Date(startDate) && metricDate <= new Date(endDate)
      })
    },

    getAverageComponentLoadTime: (state) => (componentName: string) => {
      const usages = state.componentUsage.filter(usage => usage.component_name === componentName)
      if (usages.length === 0) return 0

      const totalTime = usages.reduce((sum, usage) => sum + usage.render_time_ms, 0)
      return totalTime / usages.length
    },

    getUserSessionDuration: (state) => (sessionId: string) => {
      const sessionInteractions = state.userInteractions.filter(i => i.session_id === sessionId)
      if (sessionInteractions.length === 0) return 0

      const timestamps = sessionInteractions.map(i => new Date(i.timestamp).getTime())
      const startTime = Math.min(...timestamps)
      const endTime = Math.max(...timestamps)

      return endTime - startTime
    }
  },

  actions: {
    async fetchUserInteractions() {
      try {
        const interactionsData = await $fetch<UserInteraction[]>('/data/tracking/user_interactions.json')
        this.userInteractions = interactionsData
      } catch (error) {
        console.error('Failed to fetch user interactions:', error)
      }
    },

    async fetchComponentUsage() {
      try {
        const usageData = await $fetch<ComponentUsage[]>('/data/tracking/component_usage.json')
        this.componentUsage = usageData
      } catch (error) {
        console.error('Failed to fetch component usage:', error)
      }
    },

    async fetchAnalytics() {
      try {
        const analyticsData = await $fetch<AnalyticsMetric[]>('/data/tracking/analytics.json')
        this.analytics = analyticsData
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      }
    },

    async initializeStore() {
      await Promise.all([
        this.fetchUserInteractions(),
        this.fetchComponentUsage(),
        this.fetchAnalytics()
      ])
    },

    trackUserInteraction(interaction: Omit<UserInteraction, 'id' | 'timestamp'>) {
      const newInteraction: UserInteraction = {
        ...interaction,
        id: `interaction_${Date.now()}`,
        timestamp: new Date().toISOString()
      }

      this.userInteractions.unshift(newInteraction)
      return newInteraction
    },

    trackComponentUsage(usage: Omit<ComponentUsage, 'id' | 'timestamp'>) {
      const newUsage: ComponentUsage = {
        ...usage,
        id: `comp_usage_${Date.now()}`,
        timestamp: new Date().toISOString()
      }

      this.componentUsage.push(newUsage)
      return newUsage
    },

    addAnalyticsMetric(metric: Omit<AnalyticsMetric, 'id' | 'calculated_at'>) {
      const newMetric: AnalyticsMetric = {
        ...metric,
        id: `analytics_${Date.now()}`,
        calculated_at: new Date().toISOString()
      }

      this.analytics.push(newMetric)
      return newMetric
    },

    getUserBehaviorInsights(userId: string) {
      const userInteractions = this.userInteractions.filter(i => i.user_id === userId)

      const insights = {
        total_interactions: userInteractions.length,
        most_visited_pages: this.getMostVisitedPages(userId),
        average_session_duration: this.getAverageSessionDuration(userId),
        preferred_components: this.getPreferredComponents(userId),
        trading_activity: this.getTradingActivity(userId)
      }

      return insights
    },

    getMostVisitedPages(userId: string) {
      const pageViews = this.userInteractions.filter(
        i => i.user_id === userId && i.event_type === 'page_view'
      )

      const pageCount: Record<string, number> = {}
      pageViews.forEach(interaction => {
        pageCount[interaction.target] = (pageCount[interaction.target] || 0) + 1
      })

      return Object.entries(pageCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    },

    getAverageSessionDuration(userId: string) {
      const userSessions = [...new Set(
        this.userInteractions
          .filter(i => i.user_id === userId)
          .map(i => i.session_id)
      )]

      const sessionDurations = userSessions.map(sessionId => this.getUserSessionDuration(sessionId))
      const totalDuration = sessionDurations.reduce((sum, duration) => sum + duration, 0)

      return sessionDurations.length > 0 ? totalDuration / sessionDurations.length : 0
    },

    getPreferredComponents(userId: string) {
      const componentInteractions = this.componentUsage.filter(u => u.user_id === userId)

      const componentCount: Record<string, number> = {}
      componentInteractions.forEach(usage => {
        componentCount[usage.component_name] = (componentCount[usage.component_name] || 0) + 1
      })

      return Object.entries(componentCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    },

    getTradingActivity(userId: string) {
      const tradeInteractions = this.userInteractions.filter(
        i => i.user_id === userId && i.event_type === 'trade_execution'
      )

      return {
        total_trades: tradeInteractions.length,
        assets_traded: [...new Set(tradeInteractions.map(i => i.metadata.asset_symbol))],
        average_trade_value: tradeInteractions.reduce((sum, i) => sum + i.metadata.total_value, 0) / tradeInteractions.length || 0
      }
    }
  }
})
