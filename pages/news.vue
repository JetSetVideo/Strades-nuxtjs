<script setup>
import { ref, onMounted } from 'vue';
import { useNewsStore } from "@/stores/newsStore";

definePageMeta({
  title: 'News',
  description: 'News and events',
  layout: 'news',
})

const newsStore = useNewsStore();
const selectedCategoryName = ref(null);
const loading = ref(true);

// Initialize store on mount
onMounted(async () => {
  await newsStore.initializeStore();
  loading.value = false;
  // Set default category after data is loaded
  if (newsStore.news?.categories?.length > 0) {
    selectedCategoryName.value = newsStore.news.categories[0].name;
  }
});
</script>
<template>
  <div class="news-page">
    <div class="page-header">
      <h1 class="page-title">News & Events</h1>
      <p class="page-description">Stay updated with the latest financial news and market insights</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading news...</p>
    </div>

    <!-- Main Content -->
    <div v-else class="news-content">
      <!-- Calendar Section -->
      <div class="news-alt-options">
        <div class="calendar-section">
          <h3>Calendar</h3>
          <h4>Upcoming Events</h4>
        </div>
        <div class="filter-section">
          <WidgetFilter />
        </div>
      </div>

      <div class="NewsBoard">
        <!-- Category Tabs -->
        <div class="Tabs">
          <div
            v-for="category in newsStore.news?.categories || []"
            :key="category.name"
            class="Tab"
            :class="{ active: category.name === selectedCategoryName }"
            @click="selectedCategoryName = category.name"
          >
            {{ category.name }}
          </div>
        </div>

        <!-- News Articles -->
        <div v-if="selectedCategoryName" class="news">
          <div
            v-for="article in newsStore.news?.categories?.find(category => category.name === selectedCategoryName)?.articles || []"
            :key="article.id"
            class="article"
          >
            <news :article="article" />
          </div>
        </div>

        <!-- Selection Ranking -->
        <div class="selection-ranking">
          <div class="selection-ranking-item">
            <p>Popular</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.news-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: var(--spacing-lg);
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-primary);
}

.page-title {
  font-size: 2.5rem;
  font-weight: bold;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.page-description {
  color: var(--text-gray);
  font-size: 1rem;
  margin: 0;
  font-family: var(--font-family-secondary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xxl);
  color: var(--text-gray);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-primary);
  border-top: 3px solid var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.news-content {
  width: 100%;
}

.news-alt-options {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-lg);
}

.calendar-section {
  flex: 1;
}

.calendar-section h3 {
  color: var(--text-white);
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.calendar-section h4 {
  color: var(--primary-green);
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  font-family: var(--font-family-secondary);
}

.filter-section {
  flex: 1;
}

.NewsBoard {
  width: 100%;
}

.Tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

.Tab {
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
  background: var(--bg-secondary);
  color: var(--text-white);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}

.Tab:hover {
  border-color: var(--border-accent);
  background: var(--bg-tertiary);
}

.Tab.active {
  background: var(--primary-gradient);
  border-color: var(--primary-green);
  color: var(--secondary-darker);
}

.news {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.article {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  transition: var(--transition-normal);
}

.article:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
  border-color: var(--border-accent);
}

.selection-ranking {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.selection-ranking-item {
  display: flex;
  padding: var(--spacing-xs) var(--spacing-sm);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  font-weight: 400;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

/* Responsive Design */
@media (max-width: 768px) {
  .news-page {
    padding: var(--spacing-md);
  }

  .page-title {
    font-size: 2rem;
  }

  .news-alt-options {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .Tabs {
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .Tab {
    flex: 1;
    min-width: 80px;
    text-align: center;
  }
}
</style>

