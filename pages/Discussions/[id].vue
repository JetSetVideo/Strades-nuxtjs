<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDiscussionsStore } from '@/stores/DiscussionsStore';
import { useUsersStore } from '@/stores/users';
import Database from '@/components/Button/Database.vue';

const route = useRoute();
const discussionId = route.params.id;

const discussionsStore = useDiscussionsStore();
const usersStore = useUsersStore();
const discussion = ref(null);
const isLoading = ref(true);
const activeTab = ref('overview');

onMounted(async () => {
  try {
    await discussionsStore.initializeStore();
    await usersStore.initializeStore();
    discussion.value = discussionsStore.getDiscussionById(discussionId);
  } catch (error) {
    console.error("Failed to fetch discussion data:", error);
  } finally {
    isLoading.value = false;
  }
});

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const getCategoryColor = (category) => {
  const colors = {
    crypto: '#f7931a',
    stocks: '#10b981',
    forex: '#3b82f6',
    default: '#6b7280'
  };
  return colors[category] || colors.default;
};

const getRoleBadge = (role) => {
  return role === 'creator' ? '👑 Creator' : '👤 Member';
};

const getCreatorInfo = computed(() => {
  if (!discussion.value) return null;
  return usersStore.getUserById(discussion.value.created_by);
});
</script>

<template>
  <div class="discussion-page">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading discussion...</p>
    </div>

    <!-- Discussion Not Found -->
    <div v-else-if="!discussion" class="not-found">
      <div class="not-found-content">
        <h1>Discussion Not Found</h1>
        <p>The discussion with ID "{{ discussionId }}" could not be found.</p>
        <button @click="$router.push('/discussions')" class="back-btn">
          ← Back to Discussions
        </button>
      </div>
    </div>

    <!-- Main Discussion Content -->
    <div v-else class="discussion-content">
      <!-- Profile Picture and Database Button Header -->
      <div class="page-header">
        <div class="profile-section">
          <router-link
            v-if="getCreatorInfo"
            :to="`/profile/${discussion.created_by}`"
            class="profile-link"
          >
            <img
              :src="getCreatorInfo.avatar_url || '/avatars/Ellipse5.png'"
              :alt="getCreatorInfo.username || 'Creator'"
              class="creator-avatar"
            />
            <div class="creator-info">
              <span class="creator-name">{{ getCreatorInfo.username || 'Unknown' }}</span>
              <span class="creator-role">Discussion Creator</span>
            </div>
          </router-link>
        </div>
        <Database />
      </div>
      <!-- Discussion Header -->
      <div class="discussion-header">
        <div class="discussion-main-info">
          <div class="discussion-category" :style="{ backgroundColor: getCategoryColor(discussion.category) }">
            {{ discussion.category.toUpperCase() }}
          </div>
          <h1 class="discussion-title">{{ discussion.name }}</h1>
          <p class="discussion-description">{{ discussion.description }}</p>

          <div class="discussion-meta">
            <div class="meta-item">
              <span class="label">Created by</span>
              <span class="value">{{ discussion.members.find(m => m.id === discussion.created_by)?.username || discussion.created_by }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Created</span>
              <span class="value">{{ new Date(discussion.created_at).toLocaleDateString() }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Members</span>
              <span class="value">{{ discussion.members.length }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Messages</span>
              <span class="value">{{ discussion.message_count }}</span>
            </div>
          </div>

          <div class="discussion-tags">
            <span
              v-for="tag in discussion.tags"
              :key="tag"
              class="tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="discussion-stats">
          <div class="stat-card">
            <div class="stat-value">{{ discussion.message_count }}</div>
            <div class="stat-label">Messages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ discussion.members.length }}</div>
            <div class="stat-label">Members</div>
          </div>
          <div class="stat-card" v-if="discussion.unread_count > 0">
            <div class="stat-value">{{ discussion.unread_count }}</div>
            <div class="stat-label">Unread</div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="discussion-tabs">
        <div class="tabs-container">
          <button
            v-for="tab in ['overview', 'members', 'messages']"
            :key="tab"
            @click="activeTab = tab"
            :class="['tab-btn', { active: activeTab === tab }]"
          >
            {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="overview-content">
          <div class="overview-grid">
            <!-- Last Message -->
            <div class="overview-card">
              <h3>💬 Latest Activity</h3>
              <div v-if="discussion.last_message" class="last-message">
                <p class="message-text">{{ discussion.last_message.text }}</p>
                <p class="message-timestamp">{{ formatTimestamp(discussion.last_message.timestamp) }}</p>
              </div>
              <div v-else class="no-activity">
                <p>No messages yet. Be the first to start the discussion!</p>
              </div>
            </div>

            <!-- Pinned Message -->
            <div v-if="discussion.pinned_message" class="overview-card">
              <h3>📌 Pinned Message</h3>
              <div class="pinned-message">
                <p class="message-text">{{ discussion.pinned_message.text }}</p>
                <p class="message-meta">
                  By {{ discussion.members.find(m => m.id === discussion.pinned_message.author)?.username || discussion.pinned_message.author }}
                  • {{ formatTimestamp(discussion.pinned_message.timestamp) }}
                </p>
              </div>
            </div>

            <!-- Affiliated Data -->
            <div class="overview-card">
              <h3>📊 Affiliated Assets</h3>
              <div class="affiliated-data">
                <span
                  v-for="asset in discussion.data_affiliated"
                  :key="asset"
                  class="asset-tag"
                >
                  {{ asset }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Members Tab -->
        <div v-if="activeTab === 'members'" class="members-content">
          <div class="members-grid">
            <div
              v-for="member in discussion.members"
              :key="member.id"
              class="member-card"
            >
              <img :src="member.avatar" :alt="member.username" class="member-avatar" />
              <div class="member-info">
                <h4 class="member-username">{{ member.username }}</h4>
                <span class="member-role">{{ getRoleBadge(member.role) }}</span>
                <p class="member-joined">Joined {{ new Date(member.joined_at).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages Tab -->
        <div v-if="activeTab === 'messages'" class="messages-content">
          <div class="messages-placeholder">
            <h3>💭 Discussion Messages</h3>
            <p>Message functionality will be implemented with real-time chat integration.</p>
            <p>Current message count: {{ discussion.message_count }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discussion-page {
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
  width: 50px;
  height: 50px;
  border: 4px solid var(--border-primary);
  border-top: 4px solid var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.not-found-content {
  text-align: center;
  background: var(--card-bg);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.not-found-content h1 {
  color: var(--error-red);
  margin-bottom: var(--spacing-md);
  font-family: var(--font-family-primary);
}

.not-found-content p {
  color: var(--text-gray);
  margin-bottom: var(--spacing-lg);
  font-family: var(--font-family-secondary);
}

.back-btn {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  transition: var(--transition-normal);
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}

/* Discussion Header */
.discussion-header {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-xl);
}

.discussion-main-info {
  flex: 1;
}

.discussion-category {
  display: inline-block;
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: bold;
  font-family: var(--font-family-secondary);
  margin-bottom: var(--spacing-sm);
}

.discussion-title {
  font-size: 2.5rem;
  font-weight: bold;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 var(--spacing-md) 0;
  font-family: var(--font-family-primary);
}

.discussion-description {
  color: var(--text-gray);
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: var(--spacing-lg);
  font-family: var(--font-family-secondary);
}

.discussion-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.meta-item .label {
  color: var(--text-gray);
  font-size: 0.9rem;
  font-family: var(--font-family-secondary);
}

.meta-item .value {
  color: var(--text-white);
  font-weight: 600;
  font-family: var(--font-family-primary);
}

.discussion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-accent);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--border-secondary);
}

.discussion-stats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 150px;
}

.stat-card {
  text-align: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-green);
  display: block;
  margin-bottom: var(--spacing-xs);
  font-family: var(--font-family-primary);
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

/* Tabs */
.discussion-tabs {
  margin-bottom: var(--spacing-xl);
}

.tabs-container {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: 1px solid var(--border-primary);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: var(--transition-normal);
  font-family: var(--font-family-secondary);
  font-weight: 500;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
}

.tab-btn.active {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-color: var(--primary-green);
}

/* Tab Content */
.tab-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

/* Overview Tab */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);
}

.overview-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-primary);
}

.overview-card h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.last-message,
.pinned-message {
  background: var(--bg-tertiary);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
}

.message-text {
  color: var(--text-white);
  margin: 0 0 var(--spacing-sm) 0;
  line-height: 1.5;
  font-family: var(--font-family-secondary);
}

.message-timestamp,
.message-meta {
  color: var(--text-gray);
  font-size: 0.9rem;
  margin: 0;
  font-family: var(--font-family-secondary);
}

.no-activity {
  text-align: center;
  color: var(--text-gray);
  font-style: italic;
  padding: var(--spacing-md);
}

.affiliated-data {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.asset-tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
}

/* Members Tab */
.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.member-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  transition: var(--transition-normal);
}

.member-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-accent);
}

.member-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
}

.member-info {
  flex: 1;
}

.member-username {
  color: var(--text-white);
  margin: 0 0 var(--spacing-xs) 0;
  font-family: var(--font-family-primary);
  font-size: 1.1rem;
}

.member-role {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-accent);
  color: var(--primary-green);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
  font-family: var(--font-family-secondary);
}

.member-joined {
  color: var(--text-gray);
  font-size: 0.9rem;
  margin: 0;
  font-family: var(--font-family-secondary);
}

/* Messages Tab */
.messages-content {
  text-align: center;
  padding: var(--spacing-xxl);
}

.messages-placeholder h3 {
  color: var(--primary-green);
  margin-bottom: var(--spacing-md);
  font-family: var(--font-family-primary);
}

.messages-placeholder p {
  color: var(--text-gray);
  margin: var(--spacing-sm) 0;
  font-family: var(--font-family-secondary);
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.profile-section {
  display: flex;
  align-items: center;
}

.profile-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  text-decoration: none;
  transition: var(--transition-normal);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
}

.profile-link:hover {
  background: var(--bg-secondary);
  transform: translateY(-1px);
}

.creator-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
  transition: var(--transition-normal);
}

.profile-link:hover .creator-avatar {
  border-color: var(--primary-green);
  transform: scale(1.05);
}

.creator-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.creator-name {
  color: var(--text-white);
  font-weight: 600;
  font-family: var(--font-family-primary);
  font-size: 1.1rem;
}

.creator-role {
  color: var(--text-gray);
  font-size: 0.85rem;
  font-family: var(--font-family-secondary);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .discussion-header {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .discussion-stats {
    min-width: auto;
    flex-direction: row;
    justify-content: space-around;
  }

  .page-header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .discussion-page {
    padding: var(--spacing-md);
  }

  .discussion-header {
    padding: var(--spacing-lg);
  }

  .discussion-title {
    font-size: 2rem;
  }

  .overview-grid,
  .members-grid {
    grid-template-columns: 1fr;
  }

  .tabs-container {
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.9rem;
  }

  .tab-content {
    padding: var(--spacing-lg);
  }

  .page-header {
    padding: var(--spacing-md);
  }

  .creator-name {
    font-size: 1rem;
  }

  .creator-avatar {
    width: 40px;
    height: 40px;
  }
}

@media (max-width: 480px) {
  .discussion-meta {
    grid-template-columns: 1fr;
  }

  .member-card {
    flex-direction: column;
    text-align: center;
    gap: var(--spacing-sm);
  }

  .stat-card {
    padding: var(--spacing-sm);
  }

  .stat-value {
    font-size: 1.2rem;
  }

  .page-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-link {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .creator-info {
    align-items: center;
  }
}
</style>

