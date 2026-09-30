<script setup>
import { ref, onMounted, computed } from 'vue';
import { navigateTo } from '#app';
import { useChatStore } from '@/stores/chat';
import { useUsersStore } from '@/stores/users';
import { useCommunityStore } from '@/stores/community';
import ChatNewMessageModal from '@/components/Chat/NewMessageModal.vue';
import UIScreenShell from '@/components/UI/ScreenShell.vue';
import CommunityPersonCard from '@/components/Community/PersonCard.vue';

definePageMeta({
    title: "Messages",
    description: "Chat conversations",
    layout: "default",
});

const chatStore = useChatStore();
const usersStore = useUsersStore();
const community = useCommunityStore();
const isLoading = ref(true);

const { userId: currentUserId, getUserId } = useCurrentUser();

onMounted(async () => {
  try {
    await Promise.all([
      chatStore.initializeStore(),
      usersStore.initializeStore(),
      community.hydrated ? Promise.resolve() : community.fetchCommunity(),
    ]);
  } catch (error) {
    console.error('Failed to load chat data:', error);
  } finally {
    isLoading.value = false;
  }
});

const userConversations = computed(() => {
  return chatStore.getRecentConversations(getUserId());
});

const getOtherParticipant = (conversation) => {
  return conversation.participants.find(p => p !== getUserId());
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
  const unreadKey = `unread_count_${getUserId()}`;
  return conversation[unreadKey] || 0;
};

const navigateToConversation = (conversationId) => {
  navigateTo(`/conversations/${conversationId}`);
};

// Top-bar "Message" action opens the new-message modal
const newMessageOpen = ref(false);
usePageAction().onPageAction('chat:new-message', () => { newMessageOpen.value = true; });

// ── Conversations / Friends / Discover ─────────────────────────────────
const tab = ref('conversations');
const tabs = [
  { id: 'conversations', label: 'Conversations' },
  { id: 'friends', label: 'Friends' },
  { id: 'discover', label: 'Discover' },
];

const kpis = computed(() => [
  { label: 'Conversations', value: userConversations.value.length },
  { label: 'Friends', value: community.friends.length },
  { label: 'Online now', value: community.online.length },
]);

function onAddFriend(user) {
  community.toggleFriend(user.id);
}
function onViewProfile(id) {
  navigateTo(`/profile/${id}`);
}
</script>
<template>
  <UIScreenShell
    title="Chat"
    subtitle="Talk trades with your circle, or find your next one"
    :kpis="kpis"
    :tabs="tabs"
    :tab="tab"
    @update:tab="tab = $event"
  >
    <template #actions>
      <button class="start-btn compact" @click="newMessageOpen = true">+ New message</button>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading conversations...</p>
    </div>

    <template v-else>
      <!-- ── Conversations tab ── -->
      <div v-if="tab === 'conversations'" class="chat-page">
        <div class="chatbot">
          <div class="chatbot-header">
            <h3>💬 AI Trading Assistant</h3>
            <p>Get instant insights and market analysis</p>
          </div>
          <div class="chatbot-actions">
            <button class="chatbot-btn">Ask about market trends</button>
            <button class="chatbot-btn">Strategy recommendations</button>
          </div>
        </div>

        <div class="conversations-section">
          <div v-if="userConversations.length === 0" class="empty-state">
            <div class="empty-icon">💭</div>
            <h3>No conversations yet</h3>
            <p>Start chatting with other traders to discuss strategies and market insights.</p>
            <button class="start-btn" @click="newMessageOpen = true">+ New message</button>
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

      <!-- ── Friends tab ── -->
      <div v-else-if="tab === 'friends'" class="person-grid">
        <div v-if="!community.friends.length" class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>No friends yet</h3>
          <p>Add traders from Discover to build your circle — their trades and reads train your avatar too.</p>
        </div>
        <CommunityPersonCard
          v-for="u in community.friends"
          :key="u.id"
          :user="u"
          variant="friend"
          @message="newMessageOpen = true"
          @profile="onViewProfile"
          @add="onAddFriend"
        />
      </div>

      <!-- ── Discover tab ── -->
      <div v-else class="person-grid">
        <div v-if="!community.suggestions.length" class="empty-state">
          <div class="empty-icon">🔎</div>
          <h3>No suggestions right now</h3>
          <p>Check back soon — new traders join the desk all the time.</p>
        </div>
        <CommunityPersonCard
          v-for="u in community.suggestions"
          :key="u.id"
          :user="u"
          variant="discover"
          @message="newMessageOpen = true"
          @profile="onViewProfile"
          @add="onAddFriend"
        />
      </div>
    </template>

    <ChatNewMessageModal :open="newMessageOpen" @update:open="newMessageOpen = $event" />
  </UIScreenShell>
</template>
<style scoped>
.chat-page {
  min-height: 100%;
  color: var(--text-white);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
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
  padding: var(--card-pad, 0.85rem);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.chatbot-header {
  text-align: center;
  margin-bottom: 0.6rem;
}

.chatbot-header h3 {
  color: var(--primary-green);
  margin: 0 0 0.5rem 0;
  font-family: var(--font-chrome, var(--font-family-primary));
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
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .chatbot-actions { flex-direction: row; }
  .chatbot-btn { flex: 1; }
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

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  grid-column: 1 / -1;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: var(--text-white);
  margin: 0 0 0.5rem 0;
  font-family: var(--font-chrome, var(--font-family-primary));
}

.empty-state p {
  color: var(--text-gray);
  margin: 0 0 1rem 0;
  font-size: 0.85rem;
}

.start-btn {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
}
.start-btn.compact { padding: 0.4rem 0.85rem; font-size: 0.75rem; white-space: nowrap; }

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.conversation-item {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  padding: 0.6rem;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: var(--transition-fast);
}
.conversation-item:hover { border-color: var(--primary-green); transform: translateY(-1px); }

.conversation-avatar { flex-shrink: 0; }
.avatar-link-img {
  width: 44px; height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-primary);
}

.conversation-content { flex: 1; min-width: 0; }
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.conversation-name {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-white);
  font-family: var(--font-chrome, var(--font-family-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-time {
  font-size: 0.68rem;
  color: var(--text-gray);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.conversation-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2px;
}
.conversation-topic {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-light-gray);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.conversation-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.message-count { font-size: 0.65rem; color: var(--text-gray); }
.unread-badge {
  background: var(--error-red);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  min-width: 1.1rem;
  text-align: center;
}

/* Friends / Discover grid */
.person-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 0.5rem;
}
</style>
