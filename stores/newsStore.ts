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
    bookmarks: [] as string[], // stores article IDs
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
    },
    isBookmarked: (state) => (articleId: string) => {
      return state.bookmarks.includes(articleId);
    }
  },

  actions: {
    async fetchNews() {
      try {
        this.loading = true
        const [newsData, bookmarksData] = await Promise.all([
          $fetch<NewsData>('/news.json'),
          $fetch<string[]>('/data/social/bookmarks.json').catch(() => []) // Default to empty array on error
        ]);
        this.news = newsData;
        this.bookmarks = bookmarksData;
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch news:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchNews()
    },

    toggleBookmark(articleId: string) {
      const index = this.bookmarks.indexOf(articleId);
      if (index > -1) {
        this.bookmarks.splice(index, 1);
      } else {
        this.bookmarks.push(articleId);
      }
      // In a real app, you would also persist this change to the backend/localStorage.
    }
  }
})