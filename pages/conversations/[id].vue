<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useChatStore } from '@/stores/chat';
import { useUsersStore } from '@/stores/users';
import { useSharesStore } from '@/stores/shares';
import { useAgentsStore } from '@/stores/agents';
import DatabaseButton from '@/components/Button/Database.vue';
import ChatShareBar from '@/components/Chat/ShareBar.vue';
import ChatSharePayload from '@/components/Chat/SharePayload.vue';
import ChatSharedContextPanel from '@/components/Chat/SharedContextPanel.vue';
import ChatNewMessageModal from '@/components/Chat/NewMessageModal.vue';

const route = useRoute();
const conversationId = route.params.id;

const chatStore = useChatStore();
const usersStore = useUsersStore();
const sharesStore = useSharesStore();
const agents = useAgentsStore();
const conversation = ref(null);
const messages = ref([]);
const newMessage = ref('');
const isLoading = ref(true);
const editingMessage = ref(null)
const fileAttachment = ref(null)

const { userId: currentUserId, getUserId } = useCurrentUser();

// Top-bar "Message" action opens the new-message modal
const newMessageModalOpen = ref(false);
usePageAction().onPageAction('chat:new-message', () => { newMessageModalOpen.value = true; });

onMounted(async () => {
  try {
    await chatStore.initializeStore();
    await usersStore.initializeStore();
    await sharesStore.hydrate();

    conversation.value = chatStore.getConversationById(conversationId);
    messages.value = chatStore.getConversationMessages(conversationId);

    // Mark messages as read
    chatStore.markMessagesAsRead(conversationId, getUserId());
  } catch (error) {
    console.error('Failed to load conversation:', error);
  } finally {
    isLoading.value = false;
  }
});

const getOtherParticipant = computed(() => {
  if (!conversation.value) return null;
  return conversation.value.participants.find(p => p !== getUserId());
});

const getOtherParticipantInfo = computed(() => {
  if (!getOtherParticipant.value) return null;
  return usersStore.getUserById(getOtherParticipant.value);
});

const sharedContext = computed(() =>
  sharesStore.correlate(String(conversationId))
);

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

const refreshMessages = () => {
  messages.value = chatStore.getConversationMessages(conversationId);
};

const sendMessage = () => {
  if (!newMessage.value.trim()) return;

  const uid = getUserId();
  const messageData = {
    conversation_id: conversationId,
    sender_id: uid,
    recipient_ids: conversation.value.participants.filter(p => p !== uid),
    content: newMessage.value,
    message_type: 'text',
    attachments: [],
    reactions: [],
    reply_to: null,
    metadata: {
      character_count: newMessage.value.length,
      mentions: [],
      hashtags: []
    }
  };

  chatStore.sendMessage(messageData);
  refreshMessages();
  newMessage.value = '';

  nextTick(() => {
    scrollToBottom();
  });
};

const shareContent = (kind) => {
  if (!conversation.value) return;
  const uid = getUserId();
  const recipients = conversation.value.participants.filter(p => p !== uid);
  const opinion = agents.personal?.opinion_vector;

  const record = sharesStore.share({
    kind,
    conversation_id: String(conversationId),
    recipient_ids: recipients,
    sender_id: uid,
    asset_symbol: kind === 'asset' ? 'BTC' : undefined,
    asset_id: kind === 'asset' ? 'btc' : undefined,
    strategy_id: kind === 'strategy' ? 'strategy_001' : undefined,
    opinion_vector: kind === 'opinion' ? opinion : undefined,
    title: kind === 'asset'
      ? 'BTC watch'
      : kind === 'strategy'
        ? 'Shared strategy'
        : 'My allocation',
    note: newMessage.value.trim() || undefined,
  });

  chatStore.sendMessage({
    conversation_id: conversationId,
    sender_id: uid,
    recipient_ids: recipients,
    content: newMessage.value.trim() || `Shared ${kind}`,
    message_type: 'text',
    attachments: [sharesStore.toAttachment(record)],
    reactions: [],
    reply_to: null,
    metadata: {
      character_count: (newMessage.value.trim() || `Shared ${kind}`).length,
      mentions: [],
      hashtags: [],
    },
  });

  newMessage.value = '';
  refreshMessages();
  nextTick(() => scrollToBottom());
};

const scrollToBottom = () => {
  const messagesContainer = document.querySelector('.messages-container');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
};

const addReaction = (messageId, reaction) => {
  chatStore.addReaction(messageId, getUserId(), reaction);
};

const startReply = (messageId) => {
  // Set replying to messageId
}

const editMessage = (message) => {
  editingMessage.value = message.id
  newMessage.value = message.content
}

const saveEdit = () => {
  if (editingMessage.value) {
    chatStore.editMessage(editingMessage.value, newMessage.value)
    editingMessage.value = null
    newMessage.value = ''
  }
}

const deleteMessage = (messageId) => {
  if (confirm('Delete message?')) {
    chatStore.deleteMessage(messageId)
  }
}

const handleFile = (e) => {
  fileAttachment.value = e.target.files[0]
  // Upload logic placeholder
}
</script>

<template>
  <div class="conversation-page">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading conversation...</p>
    </div>

    <!-- Conversation Not Found -->
    <div v-else-if="!conversation" class="not-found">
      <div class="not-found-content">
        <h1>Conversation Not Found</h1>
        <p>The conversation with ID "{{ conversationId }}" could not be found.</p>
        <button @click="$router.push('/chat')" class="back-btn">
          ← Back to Chat
        </button>
      </div>
    </div>

    <!-- Main Conversation -->
    <div v-else class="conversation-content">
      <!-- Conversation Header -->
      <div class="conversation-header">
        <div class="participant-info">
          <NuxtLink
            v-if="getOtherParticipant"
            :to="`/profile/${getOtherParticipant}`"
            class="participant-avatar-link"
          >
            <img
              :src="getOtherParticipantInfo?.avatar_url || '/avatars/Ellipse5.png'"
              :alt="getOtherParticipantInfo?.username || 'User'"
              class="participant-avatar clickable-avatar"
            />
          </NuxtLink>
          <img
            v-else
            :src="getOtherParticipantInfo?.avatar_url || '/avatars/Ellipse5.png'"
            :alt="getOtherParticipantInfo?.username || 'User'"
            class="participant-avatar"
          />
          <div class="participant-details">
            <NuxtLink
              v-if="getOtherParticipant"
              :to="`/profile/${getOtherParticipant}`"
              class="participant-name-link"
            >
              <h2 class="participant-name">{{ getOtherParticipantInfo?.username || 'Unknown User' }}</h2>
            </NuxtLink>
            <h2 v-else class="participant-name">{{ getOtherParticipantInfo?.username || 'Unknown User' }}</h2>
            <p class="conversation-topic">{{ conversation.metadata?.topic || 'General discussion' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="conversation-stats">
            <span class="stat">{{ messages.length }} messages</span>
            <span class="stat">Active {{ conversation.is_active ? 'now' : 'earlier' }}</span>
          </div>
          <DatabaseButton />
        </div>
      </div>

      <!-- Messages Area -->
      <div class="messages-container" ref="messagesContainer">
        <div v-if="messages.length === 0" class="empty-messages">
          <div class="empty-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Start the conversation by sending the first message!</p>
        </div>

        <div v-else class="messages-list">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['message-item', message.sender_id === currentUserId ? 'sent' : 'received']"
          >
            <div class="message-content">
              <div class="message-text">{{ message.content }}</div>
              <ChatSharePayload
                v-for="(att, ai) in (message.attachments || []).filter(a => a.type === 'share')"
                :key="`${message.id}-share-${ai}`"
                :attachment="att"
              />
              <div class="message-footer">
                <span class="message-time">{{ formatTimestamp(message.timestamp) }}</span>
                <div v-if="message.reactions.length > 0" class="message-reactions">
                  <span
                    v-for="reaction in message.reactions"
                    :key="reaction.user_id"
                    class="reaction"
                  >
                    {{ reaction.reaction }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Message Actions (only for own messages) -->
            <div v-if="message.sender_id === currentUserId" class="message-actions">
              <button
                v-for="emoji in ['👍', '❤️', '😂', '😮']"
                :key="emoji"
                @click="addReaction(message.id, emoji)"
                class="reaction-btn"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div class="message-input-container">
        <ChatShareBar
          @share-asset="shareContent('asset')"
          @share-opinion="shareContent('opinion')"
          @share-strategy="shareContent('strategy')"
        />
        <div class="message-input-wrapper">
          <input
            v-model="newMessage"
            type="text"
            placeholder="Type your message..."
            @keydown.enter="sendMessage"
            class="message-input"
          />
          <button
            @click="sendMessage"
            :disabled="!newMessage.trim()"
            class="send-button"
          >
            Send
          </button>
        </div>

        <ChatSharedContextPanel
          v-if="sharedContext.length"
          :items="sharedContext"
        />

        <!-- Shared Data Preview -->
        <div v-if="conversation.metadata?.shared_strategies?.length" class="shared-data">
          <h4>Shared Strategies:</h4>
          <div class="shared-items">
            <span
              v-for="strategy in conversation.metadata.shared_strategies"
              :key="strategy"
              class="shared-item"
            >
              📈 {{ strategy }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <ChatNewMessageModal :open="newMessageModalOpen" @update:open="newMessageModalOpen = $event" />
  </div>
</template>

<style scoped>
.conversation-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  display: flex;
  flex-direction: column;
}

.loading-state,
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-lg);
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

.conversation-content {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.conversation-header {
  background: var(--card-bg);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.participant-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.participant-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
  transition: var(--transition-normal);
}

.participant-avatar-link {
  display: block;
  flex-shrink: 0;
}

.participant-name-link {
  text-decoration: none;
  color: inherit;
}

.participant-name-link:hover .participant-name {
  color: var(--primary-green);
}

.clickable-avatar {
  cursor: pointer;
}

.clickable-avatar:hover {
  border-color: var(--primary-green);
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(29, 190, 42, 0.3);
}

.participant-details h2 {
  color: var(--text-white);
  margin: 0 0 var(--spacing-xs) 0;
  font-family: var(--font-family-primary);
  font-size: 1.2rem;
}

.conversation-topic {
  color: var(--text-gray);
  margin: 0;
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.conversation-stats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  align-items: flex-end;
}

.stat {
  color: var(--text-gray);
  font-size: 0.75rem;
  font-family: var(--font-family-secondary);
  text-align: right;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: var(--text-gray);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
}

.empty-messages h3 {
  color: var(--text-white);
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.empty-messages p {
  margin: 0;
  font-family: var(--font-family-secondary);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.message-item {
  display: flex;
  gap: var(--spacing-md);
  max-width: 70%;
}

.message-item.sent {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-item.received {
  align-self: flex-start;
}

.message-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.message-item.sent .message-content {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
}

.message-text {
  margin-bottom: var(--spacing-sm);
  line-height: 1.5;
  font-family: var(--font-family-secondary);
}

.message-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}

.message-time {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.message-item.sent .message-time {
  color: rgba(255, 255, 255, 0.7);
}

.message-reactions {
  display: flex;
  gap: var(--spacing-xs);
}

.reaction {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.8rem;
}

.message-actions {
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.reaction-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: var(--transition-normal);
}

.reaction-btn:hover {
  background: var(--bg-tertiary);
  transform: scale(1.1);
}

.message-input-container {
  background: var(--card-bg);
  border-top: 1px solid var(--border-primary);
  padding: var(--spacing-lg);
  flex-shrink: 0;
}

.message-input-wrapper {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.message-input {
  flex: 1;
  padding: var(--spacing-md);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-white);
  font-family: var(--font-family-secondary);
}

.message-input:focus {
  outline: none;
  border-color: var(--primary-green);
}

.send-button {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  transition: var(--transition-normal);
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shared-data {
  border-top: 1px solid var(--border-primary);
  padding-top: var(--spacing-md);
}

.shared-data h4 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
  font-size: 1rem;
}

.shared-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.shared-item {
  background: var(--bg-secondary);
  color: var(--text-white);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--border-primary);
}

/* Responsive Design */
@media (max-width: 768px) {
  .conversation-header {
    padding: var(--spacing-md);
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .conversation-stats {
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-md);
  }

  .stat {
    font-size: 0.8rem;
    text-align: left;
  }

  .messages-container {
    padding: var(--spacing-md);
  }

  .message-item {
    max-width: 85%;
  }

  .message-input-container {
    padding: var(--spacing-md);
  }

  .message-input-wrapper {
    flex-direction: column;
  }

  .send-button {
    align-self: flex-end;
    min-width: 80px;
  }
}

@media (max-width: 480px) {
  .conversation-page {
    padding: 0;
  }

  .participant-details h2 {
    font-size: 1rem;
  }

  .header-actions {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }

  .conversation-stats {
    width: 100%;
    justify-content: space-between;
  }

  .message-content {
    padding: var(--spacing-sm);
  }

  .message-input {
    padding: var(--spacing-sm);
  }

  .clickable-avatar:hover {
    transform: none;
    box-shadow: none;
  }
}
</style>
