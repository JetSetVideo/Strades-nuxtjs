import { defineStore } from 'pinia'

export interface Datasource {
  description: string
  id: string
  image_url: string
  name: string
}

export const useDatasourcesStore = defineStore('datasourcesStore', {
  state: () => ({
    datasources: [] as Datasource[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getDatasourceById: (state) => (id: string) => {
      return state.datasources.find(datasource => datasource.id === id)
    },

    getDatasourcesCount: (state) => {
      return state.datasources.length;
    }
  },

  actions: {
    async fetchDatasources() {
      try {
        this.loading = true
        const datasourcesData = await $fetch<Datasource[]>('/Datasources.json')
        this.datasources = datasourcesData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch datasources:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchDatasources()
    }
  }
})