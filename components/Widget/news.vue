<script setup>
import { useNewsStore } from '@/stores/newsStore';

const props = defineProps({
    article: {
        type: Object,
        required: true,
    },
});

const newsStore = useNewsStore();

const isBookmarked = newsStore.isBookmarked(props.article.id);
</script>

<template>
<div class="widget-news">
    <div class="arrow-buttons">
        <ButtonUparrow />
        <ButtonDownarrow />
    </div>
    <div class="news-cards">
        <NuxtLink :to="`/articles/${article.id}`" class="link-full-width">
        <div class="news-card-content" :style="{ backgroundImage: `url(${article.imageUrl})` }">
            <div class="news-card-text">
                <h3 class="news-title">{{ article.title }}</h3>
                <p class="news-description">{{ article.content }}</p>
                <div class="news-informations">
                    <p class="news-date">{{ article.publishing_date }}</p>
                    <p class="news-author">{{ article.author }}</p>
                    <p class="news-source">{{ article.source }}</p>
                </div>
            </div>
        </div>
        </NuxtLink>
    </div>
    <ButtonBookmark :initial-state="isBookmarked" @toggle="newsStore.toggleBookmark(article.id)" />
</div>
</template>

<style scoped>
.widget-news {
  display: flex;
  background: var(--card-bg);
  position: relative;
  width: 100%;
  padding: var(--spacing-sm);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  transition: var(--transition-normal);
  display: flex; /* Ensure flexbox is enabled */
  align-items: center; /* Vertically align items */
}

.widget-news:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
  border-color: var(--border-accent);
}

.arrow-buttons {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin-left: var(--spacing-sm);
}

.news-cards {
  display: flex;
  width: 100%;
  padding: var(--spacing-sm) 0;
  flex-grow: 1; /* Allow news cards to take up available space */
}

.link-full-width {
  width: 100%;
  text-decoration: none;
  color: inherit;
}

.news-card-content {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  width: 100%;
  min-height: 250px;
  background-size: cover;
  background-position: center;
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;
}

.news-card-text {
  background: rgba(0, 0, 0, 0.7);
  padding: var(--spacing-md);
  color: var(--text-white);
}

.news-title {
  font-size: 1.3rem;
  font-weight: bold;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
  color: var(--text-white);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-description {
  font-size: 0.9rem;
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--text-light-gray);
  font-family: var(--font-family-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.news-informations {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.news-date,
.news-author,
.news-source {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
}

.news-date {
  color: var(--primary-green);
}

.news-author {
  color: var(--primary-blue);
}

.news-source {
  color: var(--text-white);
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Add styles for the bookmark button */
.bookmark-button {
  margin-left: auto; /* Push the button to the far right */
  padding: 0.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .widget-news {
    flex-direction: column;
  }

  .arrow-buttons {
    flex-direction: column;
    margin-left: var(--spacing-sm);
    margin-bottom: 0;
    justify-content: center;
  }

  .news-card-content {
    min-height: 200px;
  }

  .news-title {
    font-size: 1.1rem;
  }

  .news-description {
    font-size: 0.85rem;
  }

  .news-informations {
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .news-card-content {
    min-height: 180px;
  }

  .news-informations {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .news-date,
  .news-author,
  .news-source {
    padding: var(--spacing-xs);
  }
}
</style>

