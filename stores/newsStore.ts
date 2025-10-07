import { defineStore } from 'pinia'

export interface NewsArticle {
  id: string
  title: string
  content: string
  source: string
  imageUrl: string
  author: string
  publishing_date: string
  category: string
  data_affiliated: string
  tags: string[]
}

export interface NewsCategory {
  name: string
  articles: NewsArticle[]
}

export interface NewsData {
  name: string
  categories: NewsCategory[]
}

export const useNewsStore = defineStore('newsStore', {
  state: () => ({
    news: null as NewsData | null,
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getArticlesByCategory: (state) => (categoryName: string) => {
      const category = state.news?.categories.find(c => c.name === categoryName)
      return category ? category.articles : []
    },

    getAllArticles: (state) => {
      if (!state.news) return []
      return state.news.categories.flatMap(category => category.articles)
    }
  },

  actions: {
    async fetchNews() {
      try {
        this.loading = true
        const newsData = await $fetch<NewsData>('/news.json')
        this.news = newsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch news:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchNews()
    }
  }
})