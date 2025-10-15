import { defineStore } from 'pinia';

export interface SharedItem {
  id: string;
  discussionId: string;
  title: string;
  url: string;
  sharedById: string;
  type: 'article' | 'news' | 'analysis';
}

export const useSharedDataStore = defineStore('sharedData', {
  state: () => ({
    sharedData: [] as SharedItem[],
  }),
  actions: {
    async initializeStore() {
      if (this.sharedData.length > 0) return;
      try {
        const data = await $fetch<SharedItem[]>('/data/shared_data.json');
        this.sharedData = data;
      } catch (error) {
        console.warn('Shared data not available:', error);
        this.sharedData = [];
      }
    },
  },
  getters: {
    getSharedDataByDiscussion: (state) => (discussionId: string) => {
      return state.sharedData.filter((item) => item.discussionId === discussionId);
    },
  },
});
