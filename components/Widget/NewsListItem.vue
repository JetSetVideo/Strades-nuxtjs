<script setup>
import { ref, computed } from 'vue';
import ButtonUparrow from '@/components/Button/Uparrow.vue';
import ButtonDownarrow from '@/components/Button/Downarrow.vue';
import ButtonOptions from '@/components/Button/Options.vue';

const props = defineProps({
  article: {
    type: Object,
    required: true,
  },
});

const userVote = ref(null); // null, 'up', or 'down'
const voteCount = ref(33); // Default vote count from Figma

const handleUpvote = () => {
  if (userVote.value === 'up') {
    // Remove upvote
    userVote.value = null;
    voteCount.value -= 1;
  } else if (userVote.value === 'down') {
    // Change from down to up
    userVote.value = 'up';
    voteCount.value += 2;
  } else {
    // Add upvote
    userVote.value = 'up';
    voteCount.value += 1;
  }
};

const handleDownvote = () => {
  if (userVote.value === 'down') {
    // Remove downvote
    userVote.value = null;
    voteCount.value += 1;
  } else if (userVote.value === 'up') {
    // Change from up to down
    userVote.value = 'down';
    voteCount.value -= 2;
  } else {
    // Add downvote
    userVote.value = 'down';
    voteCount.value -= 1;
  }
};

const upvoteActive = computed(() => userVote.value === 'up');
const downvoteActive = computed(() => userVote.value === 'down');
</script>

<template>
  <div class="news-list-item">
    <!-- Voting Section -->
    <div class="voting-section">
      <div @click="handleUpvote" :class="{ 'vote-active': upvoteActive }">
        <ButtonUparrow />
      </div>
      <div class="vote-count">
        {{ voteCount }}
      </div>
      <div @click="handleDownvote" :class="{ 'vote-active': downvoteActive }">
        <ButtonDownarrow />
      </div>
    </div>

    <!-- News Content -->
    <div class="news-content">
      <!-- Author and Meta Info -->
      <div class="news-meta">
        <div class="author-info">
          <div class="author-avatar">
            <img
              :src="article.imageUrl || '/avatars/default.png'"
              :alt="article.author"
              class="avatar-image"
            />
          </div>
          <span class="author-label">Published by:</span>
          <span class="author-name">{{ article.author }}</span>
        </div>

        <div class="news-source">
          {{ article.source }}
        </div>

        <div class="news-time">
          {{ article.publishing_date }}
        </div>
      </div>

      <!-- Asset and Tags Section -->
      <div class="asset-section">
        <div class="asset-info">
          <div class="asset-name">
            {{ article.data_affiliated || 'General' }}
          </div>
          <div class="asset-icon">
            <!-- Placeholder for asset icon -->
            <div class="asset-icon-placeholder">📈</div>
          </div>
        </div>

        <div class="tags-section">
          <span
            v-for="tag in article.tags?.slice(0, 3) || []"
            :key="tag"
            class="tag"
            :class="`tag-${tag.toLowerCase().replace('#', '')}`"
          >
            #{{ tag.replace('#', '') }}
          </span>
        </div>

        <ButtonOptions />
      </div>

      <!-- Title and Summary -->
      <div class="news-text">
        <h3 class="news-title">{{ article.title }}</h3>
        <p class="news-summary">{{ article.content }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.news-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  width: 100%;
  background: #333333;
  border-radius: 10px 0px 10px 0px;
  border: 2px solid;
  border-image: linear-gradient(224deg, rgba(0, 186, 41, 1) 0%, rgba(0, 52, 14, 1) 12%, rgba(0, 77, 17, 1) 29%, rgba(0, 146, 32, 1) 51%, rgba(0, 36, 8, 1) 71%, rgba(0, 146, 58, 1) 88%, rgba(0, 58, 13, 1) 100%) 1;
  box-shadow:
    0px 3px 10px 0px rgba(0, 47, 2, 0.2),
    inset 0px 0px 18px 0px rgba(129, 255, 141, 0.25);
  transition: var(--transition-normal);
}

.news-list-item:hover {
  transform: translateY(-2px);
  box-shadow:
    0px 6px 15px 0px rgba(0, 47, 2, 0.3),
    inset 0px 0px 18px 0px rgba(129, 255, 141, 0.35);
}

/* Voting Section */
.voting-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px;
}

.voting-section > div {
  cursor: pointer;
  transition: var(--transition-normal);
}

.voting-section > div:hover {
  transform: scale(1.1);
}

.vote-active {
  filter: brightness(1.3);
  transform: scale(1.1);
}

.vote-count {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  color: var(--text-white);
  font-family: 'Work Sans', sans-serif;
  min-width: 20px;
}

/* News Content */
.news-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 10px;
}

/* Meta Information */
.news-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.author-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-white);
  font-family: 'Work Sans', sans-serif;
}

.author-avatar {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.author-label,
.author-name {
  color: var(--text-white);
}

.news-source,
.news-time {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.5);
  font-size: 10px;
  font-weight: 400;
  color: var(--text-white);
  font-family: 'Work Sans', sans-serif;
  border-radius: 3px;
}

/* Asset Section */
.asset-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
}

.asset-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 1px;
  background: rgba(38, 38, 38, 0.5);
  border-radius: 3px;
  box-shadow:
    0px 0.3px 1.7px 0px rgba(0, 0, 0, 0.2),
    inset 0px 0.3px 1.7px 0px rgba(255, 255, 255, 0.2);
}

.asset-name {
  font-size: 8px;
  font-weight: 600;
  color: var(--text-white);
  font-family: 'Open Sans', sans-serif;
}

.asset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-icon-placeholder {
  font-size: 6px;
}

.tags-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 1px 4px;
}

.tag {
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 400;
  color: var(--text-white);
  font-family: 'Open Sans', sans-serif;
  text-align: center;
}

.tag-car {
  background: #B92A91;
}

.tag-manufacture {
  background: #2A5223;
}

.tag-usa {
  background: linear-gradient(135deg, #2A5223 0%, #3464DF 0%, #3546DF 43%, #FF0000 52%, #FFFFFF 59%, #FF0000 67%, #FFFFFF 72%, #FF0000 80%, #FFFFFF 86%, #FF0000 93%, #FFFFFF 100%);
}

/* News Text */
.news-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  padding: 1px 10px;
}

.news-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-white);
  font-family: 'Work Sans', sans-serif;
  margin: 0;
  text-align: center;
}

.news-summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-white);
  font-family: 'Work Sans', sans-serif;
  margin: 0;
  text-align: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .news-list-item {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .voting-section {
    flex-direction: row;
    order: 2;
  }

  .news-content {
    order: 1;
  }

  .news-text {
    padding: 0;
  }

  .news-title,
  .news-summary {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .news-title,
  .news-summary {
    font-size: 12px;
  }
}
</style>
