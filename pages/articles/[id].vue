<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useNewsStore } from '@/stores/newsStore';

const route = useRoute();
const articleId = route.params.id;

const newsStore = useNewsStore();
const loading = ref(false);

// Find the article by ID across all articles
const article = computed(() => {
  if (!newsStore.news) return null;
  for (const category of newsStore.news.categories) {
    const foundArticle = category.articles.find(a => a.id === articleId);
    if (foundArticle) {
      return foundArticle;
    }
  }
  return null;
});

// Initialize store on mount
onMounted(async () => {
  loading.value = true;
  await newsStore.initializeStore();
  loading.value = false;
});

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
</script>

<template>
  <div class="article-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading article...</p>
    </div>

    <!-- Article Content -->
    <div v-else-if="article" class="article-content">
      <!-- Article Header -->
      <div class="article-header">
        <div class="article-image">
          <img :src="article.imageUrl" :alt="article.title" />
        </div>
        <div class="article-meta">
          <div class="article-category">
            <span class="category-badge">{{ article.category }}</span>
          </div>
          <h1 class="article-title">{{ article.title }}</h1>
          <div class="article-info">
            <div class="info-item">
              <span class="info-label">By:</span>
              <span class="info-value">{{ article.author }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Published:</span>
              <span class="info-value">{{ formatDate(article.publishing_date) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Source:</span>
              <span class="info-value">{{ article.source }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Article Body -->
      <div class="article-body">
        <div class="article-text">
          <p>{{ article.content }}</p>
        </div>

        <!-- Tags -->
        <div v-if="article.tags && article.tags.length > 0" class="tags-section">
          <h3>Tags:</h3>
          <div class="tags-list">
            <span v-for="tag in article.tags" :key="tag" class="tag-item">{{ tag }}</span>
          </div>
        </div>

        <!-- Related Asset -->
        <div v-if="article.data_affiliated" class="asset-section">
          <h3>Related Asset:</h3>
          <div class="asset-info">
            <span class="asset-symbol">{{ article.data_affiliated }}</span>
            <span class="asset-label">Related Financial Data</span>
          </div>
        </div>

        <!-- Sentiment Analysis -->
        <div class="sentiment-section">
          <h3>Community Sentiment</h3>
          <WidgetSentiment />
        </div>
      </div>
    </div>

    <!-- Article Not Found -->
    <div v-else class="article-not-found">
      <h2>Article Not Found</h2>
      <p>The article with ID "{{ articleId }}" could not be found.</p>
      <NuxtLink to="/news" class="back-link">← Back to News</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.article-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: var(--spacing-lg);
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

.article-content {
  max-width: 1200px;
  margin: 0 auto;
}

.article-header {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  align-items: start;
}

.article-image {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-primary);
}

.article-image img {
  width: 100%;
  height: 300px;
  object-fit: cover;
  display: block;
}

.article-meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.article-category {
  margin-bottom: var(--spacing-sm);
}

.category-badge {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  text-transform: uppercase;
}

.article-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--text-white);
  font-family: var(--font-family-primary);
  line-height: 1.2;
  margin: 0;
}

.article-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.info-label {
  color: var(--text-gray);
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
  min-width: 80px;
}

.info-value {
  color: var(--text-white);
  font-size: 0.9rem;
  font-family: var(--font-family-primary);
}

.article-body {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-primary);
  border: 1px solid var(--border-primary);
}

.article-text {
  margin-bottom: var(--spacing-xl);
}

.article-text p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-white);
  font-family: var(--font-family-primary);
  margin: 0;
}

.tags-section,
.asset-section,
.sentiment-section {
  margin-bottom: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-primary);
}

.tags-section h3,
.asset-section h3,
.sentiment-section h3 {
  color: var(--text-white);
  font-size: 1.2rem;
  font-weight: 600;
  font-family: var(--font-family-primary);
  margin: 0 0 var(--spacing-md) 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.tag-item {
  background: var(--bg-accent);
  color: var(--primary-green);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--primary-green);
}

.asset-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--bg-secondary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.asset-symbol {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--primary-green);
  font-family: var(--font-family-secondary);
}

.asset-label {
  color: var(--text-gray);
  font-size: 0.9rem;
  font-family: var(--font-family-primary);
}

.article-not-found {
  text-align: center;
  padding: var(--spacing-xxl);
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  max-width: 600px;
  margin: 0 auto;
}

.article-not-found h2 {
  color: var(--text-white);
  font-size: 2rem;
  font-weight: bold;
  font-family: var(--font-family-primary);
  margin: 0 0 var(--spacing-md) 0;
}

.article-not-found p {
  color: var(--text-gray);
  font-size: 1rem;
  font-family: var(--font-family-primary);
  margin: 0 0 var(--spacing-lg) 0;
}

.back-link {
  display: inline-block;
  color: var(--primary-green);
  text-decoration: none;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--primary-green);
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
}

.back-link:hover {
  background: var(--bg-accent);
  color: var(--text-white);
}

/* Responsive Design */
@media (max-width: 768px) {
  .article-page {
    padding: var(--spacing-md);
  }

  .article-header {
    grid-template-columns: 1fr;
    gap: var(--spacing-lg);
  }

  .article-image img {
    height: 200px;
  }

  .article-title {
    font-size: 2rem;
  }

  .article-body {
    padding: var(--spacing-lg);
  }

  .article-text p {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .article-title {
    font-size: 1.5rem;
  }

  .article-header {
    gap: var(--spacing-md);
  }

  .article-body {
    padding: var(--spacing-md);
  }

  .tags-list {
    justify-content: center;
  }

  .asset-info {
    flex-direction: column;
    text-align: center;
    gap: var(--spacing-sm);
  }
}
</style>

