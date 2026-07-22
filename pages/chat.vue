<script setup>
import { ref, onMounted, computed } from 'vue';
import { navigateTo } from '#app';
import { useChatStore } from '@/stores/chat';
import { useUsersStore } from '@/stores/users';

definePageMeta({
    title: "Messages",
    description: "Chat conversations",
    layout: "default",
});

const chatStore = useChatStore();
const usersStore = useUsersStore();
const isLoading = ref(true);

// Assuming current user is user_001 (the main user)
const currentUserId = 'user_001';

onMounted(async () => {
  try {
    await chatStore.initializeStore();
    await usersStore.initializeStore();
  } catch (error) {
    console.error('Failed to load chat data:', error);
  } finally {
    isLoading.value = false;
  }
});

const userConversations = computed(() => {
  return chatStore.getRecentConversations(currentUserId);
});

const getOtherParticipant = (conversation) => {
  return conversation.participants.find(p => p !== currentUserId);
};

const getUserInfo = (userId) => {
  return usersStore.getUserById(userId);
};

const formatLastMessageTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) { // 7 days
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const getUnreadCount = (conversation) => {
  const unreadKey = `unread_count_${currentUserId}`;
  return conversation[unreadKey] || 0;
};

const navigateToConversation = (conversationId) => {
  navigateTo(`/conversations/${conversationId}`);
};
</script>
<template>
  <div class="chat-page">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading conversations...</p>
    </div>

    <!-- Chat Bot Widget -->
    <div v-else class="chatbot">
      <div class="chatbot-header">
        <h3>💬 AI Trading Assistant</h3>
        <p>Get instant insights and market analysis</p>
      </div>
      <div class="chatbot-actions">
        <button class="chatbot-btn">Ask about market trends</button>
        <button class="chatbot-btn">Strategy recommendations</button>
      </div>
    </div>

    <!-- Conversations List -->
    <div class="conversations-section">
      <div class="section-header">
        <h2>Recent Conversations</h2>
        <span class="conversation-count">{{ userConversations.length }} conversations</span>
      </div>

      <div v-if="userConversations.length === 0" class="empty-state">
        <div class="empty-icon">💭</div>
        <h3>No conversations yet</h3>
        <p>Start chatting with other traders to discuss strategies and market insights.</p>
      </div>

      <div v-else class="conversations-list">
        <div
          v-for="conversation in userConversations"
          :key="conversation.id"
          class="conversation-item"
          @click="navigateToConversation(conversation.id)"
        >
          <div class="conversation-avatar">
            <NuxtLink
              :to="`/profile/${getOtherParticipant(conversation)}`"
              @click.stop
            >
              <img
                :src="getUserInfo(getOtherParticipant(conversation))?.avatar_url || '/avatars/Ellipse5.png'"
                :alt="getUserInfo(getOtherParticipant(conversation))?.username || 'User'"
                class="avatar-link-img"
              />
            </NuxtLink>
          </div>

          <div class="conversation-content">
            <div class="conversation-header">
              <h4 class="conversation-name">
                {{ getUserInfo(getOtherParticipant(conversation))?.username || 'Unknown User' }}
              </h4>
              <span class="conversation-time">
                {{ formatLastMessageTime(conversation.last_message_at) }}
              </span>
            </div>

            <div class="conversation-preview">
              <p class="conversation-topic">{{ conversation.metadata?.topic || 'General discussion' }}</p>
              <div class="conversation-meta">
                <span class="message-count">{{ conversation.message_count }} messages</span>
                <span
                  v-if="getUnreadCount(conversation) > 0"
                  class="unread-badge"
                >
                  {{ getUnreadCount(conversation) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.chat-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: 5rem 1rem 6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.chatbot {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.chatbot-header {
  text-align: center;
  margin-bottom: 1rem;
}

.chatbot-header h3 {
  color: var(--primary-green);
  margin: 0 0 0.5rem 0;
  font-family: var(--font-family-primary);
  font-size: 1.2rem;
}

.chatbot-header p {
  color: var(--text-gray);
  margin: 0;
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.chatbot-actions {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.chatbot-btn {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  font-size: 0.95rem;
  transition: var(--transition-normal);
  text-align: center;
}

.chatbot-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}

.conversations-section {
  flex: 1;
}

.section-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.section-header h2 {
  color: var(--primary-green);
  margin: 0;
  font-family: var(--font-family-primary);
  font-size: 1.4rem;
}

.conversation-count {
  color: var(--text-gray);
  font-size: 0.85rem;
  font-family: var(--font-family-secondary);
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: var(--text-white);
  margin: 0 0 0.5rem 0;
  font-family: var(--font-family-primary);
  font-size: 1.1rem;
}

.empty-state p {
  color: var(--text-gray);
  margin: 0;
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  max-width: 400px;
  margin: 0 auto;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  cursor: pointer;
  transition: var(--transition-normal);
  box-shadow: var(--shadow-primary);
}

.conversation-item:hover {
  transform: translateY(-2px);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-accent);
}

.conversation-avatar {
  flex-shrink: 0;
}

.conversation-avatar a {
  display: block;
}

.conversation-avatar img,
.avatar-link-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
  transition: border-color 0.2s ease, transform 0.2s ease;
  display: block;
}

.avatar-link-img:hover {
  border-color: var(--primary-green);
  transform: scale(1.05);
}

.conversation-content {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.conversation-name {
  color: var(--text-white);
  margin: 0;
  font-family: var(--font-family-primary);
  font-size: 1rem;
  font-weight: 600;
}

.conversation-time {
  color: var(--text-gray);
  font-size: 0.75rem;
  font-family: var(--font-family-secondary);
}

.conversation-preview {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.25rem;
}

.conversation-topic {
  color: var(--text-gray);
  margin: 0;
  font-family: var(--font-family-secondary);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  width: 100%;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.message-count {
  color: var(--text-gray);
  font-size: 0.75rem;
  font-family: var(--font-family-secondary);
}

.unread-badge {
  background: var(--error-red);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  min-width: 18px;
  text-align: center;
}

/* Responsive Design Overrides for larger screens */
@media (min-width: 768px) {
  .chat-page {
    padding: 6rem 2rem;
  }
  
  .section-header {
    flex-direction: row;
    align-items: center;
  }
  
  .section-header h2 {
    font-size: 1.8rem;
  }
  
  .conversation-header {
    flex-direction: row;
    align-items: center;
  }
  
  .conversation-preview {
    flex-direction: row;
    align-items: center;
  }
  
  .conversation-topic {
    width: auto;
  }
}
</style>