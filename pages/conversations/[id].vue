<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useChatStore, describeChatError } from '@/stores/chat';
import { useUsersStore } from '@/stores/users';
import { useSharesStore } from '@/stores/shares';
import { useAgentsStore } from '@/stores/agents';
import { conversationDisplay, reactionSummary, messageCountLabel, CHAT_REACTIONS, shareCardOf, shareMessageBody, quoteOf } from '~/utils/chatMap';
import { useStrategiesStore } from '@/stores/strategies';
import { toDate, fmtTime, fmtDayTime } from '~/utils/format';
import DatabaseButton from '@/components/Button/Database.vue';
import ChatShareBar from '@/components/Chat/ShareBar.vue';
import ChatSharePayload from '@/components/Chat/SharePayload.vue';
import ChatSharedContextPanel from '@/components/Chat/SharedContextPanel.vue';
import ChatNewMessageModal from '@/components/Chat/NewMessageModal.vue';
import UISourceChip from '@/components/UI/SourceChip.vue';

const route = useRoute();
// Reactive: moving from one conversation to another reuses this page.
const conversationId = computed(() => String(route.params.id));

const chatStore = useChatStore();
const usersStore = useUsersStore();
const sharesStore = useSharesStore();
const agents = useAgentsStore();
const strategiesStore = useStrategiesStore();
/** The message being answered (C4 reply_to); shown above the input. */
const replyTo = ref(null);
/** Share bar › Strategy: pick one of YOUR strategies (never a fixed sample). */
const strategyPickerOpen = ref(false);
const ownStrategies = computed(() => strategiesStore.ownStrategies.slice(0, 12));
/** A shared object drawn as a link card (C4 attachment, or the link line an older server stored). */
const cardOf = (message) => {
  const card = shareCardOf(message);
  return card ? { card, attachment: { type: 'share', share_kind: card.kind, title: card.title, url: card.url } } : null;
};
const newMessage = ref('');
/** 'loading' | 'ok' | 'not-found' | 'error' */
const status = ref('loading');
const isLoading = computed(() => status.value === 'loading');
const sending = ref(false);
const sendError = ref('');
const editingMessage = ref(null)
const fileAttachment = ref(null)

const { userId: currentUserId, getUserId } = useCurrentUser();
const { isAuthenticated } = useAuth();

const conversation = computed(() =>
  status.value === 'ok' ? chatStore.getConversationById(conversationId.value) ?? null : null
);
const messages = computed(() => chatStore.getConversationMessages(conversationId.value));
/** A conversation from the user's account: sending goes to the server. */
const isServer = computed(() => conversation.value?.source === 'server');

// Top-bar "Message" action opens the new-message modal
const newMessageModalOpen = ref(false);
usePageAction().onPageAction('chat:new-message', () => { newMessageModalOpen.value = true; });

async function load() {
  status.value = 'loading';
  sendError.value = '';
  // People and shares only decorate the page: their failure must not hide the conversation.
  await Promise.allSettled([usersStore.initializeStore(), sharesStore.hydrate()]);
  try {
    const result = await chatStore.openConversation(conversationId.value);
    status.value = result;
    if (result === 'ok') {
      chatStore.markMessagesAsRead(conversationId.value, getUserId());
      nextTick(() => scrollToBottom());
    }
  } catch (error) {
    console.error('Failed to load conversation:', error);
    status.value = 'error';
  }
}

onMounted(load);
watch([conversationId, isAuthenticated], load);

const lookupUser = (id) => {
  const u = usersStore.getUserById(id);
  return u ? { username: u.username, full_name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), avatar_url: u.avatar_url } : null;
};
/** Header: room name + size, or the other person (name, avatar, profile link). */
const head = computed(() =>
  conversation.value ? conversationDisplay(conversation.value, getUserId(), lookupUser) : null
);

const sharedContext = computed(() =>
  sharesStore.correlate(conversationId.value)
);

const formatTimestamp = (timestamp) => {
  const date = toDate(timestamp);
  if (!date) return '—';
  const diffInHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return diffInHours < 24 ? fmtTime(date) : fmtDayTime(date);
};

const senderName = (message) => message.sender_full_name || message.sender_username || 'Someone';

const sendMessage = async () => {
  const text = newMessage.value.trim();
  if (!text || sending.value || !conversation.value) return;
  sendError.value = '';

  if (isServer.value) {
    sending.value = true;
    try {
      await chatStore.sendMessageRemote(conversationId.value, text, { replyTo: replyTo.value });
      newMessage.value = '';
      replyTo.value = null;
      nextTick(() => scrollToBottom());
    } catch (error) {
      console.error('Failed to send message:', error);
      sendError.value = `${describeChatError('send', error)} Your text is kept, try again.`;
    } finally {
      sending.value = false;
    }
    return;
  }

  // Sample conversation (or one started in this tab): the message stays in this tab.
  const uid = getUserId();
  const messageData = {
    conversation_id: conversationId.value,
    sender_id: uid,
    recipient_ids: conversation.value.participants.filter(p => p !== uid),
    content: text,
    message_type: 'text',
    attachments: [],
    reactions: [],
    reply_to: replyTo.value?.id ?? null,
    reply_to_id: replyTo.value?.id ?? null,
    reply_to_preview: replyTo.value
      ? { id: String(replyTo.value.id), content: replyTo.value.content, author: senderName(replyTo.value) }
      : null,
    metadata: {
      character_count: text.length,
      mentions: [],
      hashtags: []
    }
  };

  chatStore.sendMessage(messageData);
  newMessage.value = '';
  replyTo.value = null;

  nextTick(() => {
    scrollToBottom();
  });
};

/** Share one of the user's own strategies into this conversation (C4 share; link line on an older server). */
const shareStrategy = async (s) => {
  strategyPickerOpen.value = false;
  if (!conversation.value) return;
  if (!isServer.value) {
    newMessage.value = shareMessageBody({ kind: 'strategy', id: s.id, title: s.name }, newMessage.value).content;
    await sendMessage();
    return;
  }
  sending.value = true;
  sendError.value = '';
  try {
    const res = await chatStore.shareToTargets(
      { kind: 'strategy', id: s.id, title: s.name },
      [{ kind: 'room', id: conversationId.value, label: head.value?.name ?? 'this chat' }],
      newMessage.value,
    );
    if (res[0]?.ok) { newMessage.value = ''; nextTick(() => scrollToBottom()); }
    else sendError.value = `${res[0]?.error ?? 'Share not sent.'} Your text is kept.`;
  } finally {
    sending.value = false;
  }
};

const shareContent = async (kind) => {
  if (!conversation.value) return;
  if (kind === 'strategy') {
    // Never a fixed sample id: the user picks one of their own strategies.
    strategyPickerOpen.value = !strategyPickerOpen.value;
    if (strategyPickerOpen.value && !strategiesStore.strategies.length) void strategiesStore.initializeStore();
    return;
  }
  const uid = getUserId();
  const recipients = conversation.value.participants.filter(p => p !== uid);
  const opinion = agents.personal?.opinion_vector;
  const title = kind === 'asset'
    ? 'BTC watch'
    : kind === 'strategy'
      ? 'Shared strategy'
      : 'My allocation';

  const record = sharesStore.share({
    kind,
    conversation_id: conversationId.value,
    recipient_ids: recipients,
    sender_id: uid,
    asset_symbol: kind === 'asset' ? 'BTC' : undefined,
    asset_id: kind === 'asset' ? 'btc' : undefined,
    strategy_id: kind === 'strategy' ? 'strategy_001' : undefined,
    opinion_vector: kind === 'opinion' ? opinion : undefined,
    title,
    note: newMessage.value.trim() || undefined,
  });

  if (isServer.value) {
    // The server stores text only: the share card stays in this tab, the room gets a line about it.
    const note = newMessage.value.trim();
    newMessage.value = `${note ? `${note} — ` : ''}📎 ${title} (shared ${kind})`;
    await sendMessage();
    return;
  }

  chatStore.sendMessage({
    conversation_id: conversationId.value,
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
  nextTick(() => scrollToBottom());
};

const scrollToBottom = () => {
  const messagesContainer = document.querySelector('.messages-container');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
};

const addReaction = async (message, emoji) => {
  if (!isServer.value) {
    // Sample conversation (or one started in this tab): the reaction stays in this tab.
    chatStore.addReaction(message.id, getUserId(), emoji);
    return;
  }
  const key = `${message.id}|${emoji}`;
  if (reacting.value[key]) return;
  reacting.value = { ...reacting.value, [key]: true };
  const { [message.id]: _drop, ...rest } = reactionErrors.value;
  reactionErrors.value = rest;
  try {
    await chatStore.toggleReactionRemote(conversationId.value, message.id, emoji);
  } catch (error) {
    reactionErrors.value = { ...reactionErrors.value, [message.id]: error?.message || 'Reaction not saved.' };
  } finally {
    const { [key]: _done, ...left } = reacting.value;
    reacting.value = left;
  }
};
/** 'msgId|emoji' → true while the server toggle is in flight (the button is disabled meanwhile). */
const reacting = ref({});
/** msgId → why the last reaction failed (shown under that message; the toggle was undone). */
const reactionErrors = ref({});
const chipsOf = (message) => reactionSummary(message, getUserId());
const chipLabel = (chip) =>
  `${chip.emoji} ${chip.count} ${chip.count === 1 ? 'reaction' : 'reactions'}${chip.mine ? ', including yours — press to remove yours' : ' — press to add yours'}`;

/** Header count: the server's exact count when known, else what is loaded. */
const countLabel = computed(() => {
  if (!conversation.value) return '';
  if (isServer.value) {
    const fromServer = messageCountLabel(conversation.value);
    if (fromServer) return fromServer;
  }
  return messageCountLabel({ message_count: messages.value.length, source: 'sample' });
});

const startReply = (message) => {
  replyTo.value = message;
  nextTick(() => document.querySelector('.message-input')?.focus());
};
/** Scroll to the quoted message when it is loaded. */
const jumpTo = (id) => {
  const el = document.getElementById(`msg-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

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
    <div v-else-if="status === 'not-found'" class="not-found">
      <div class="not-found-content">
        <h1>Conversation Not Found</h1>
        <p v-if="isAuthenticated">This conversation is not in your account: you are not a member, or it was deleted.</p>
        <p v-else>The sample conversation "{{ conversationId }}" does not exist. Sign in to open your own conversations and rooms.</p>
        <button @click="$router.push('/chat')" class="back-btn">
          ← Back to Chat
        </button>
      </div>
    </div>

    <!-- Server error: say so and offer Retry (never a sample stand-in). -->
    <div v-else-if="status === 'error' || !conversation" class="not-found" role="alert">
      <div class="not-found-content">
        <h1>Conversation could not load</h1>
        <p>The chat server did not answer. Check your connection and retry.</p>
        <div class="error-actions">
          <button @click="load" class="back-btn">Retry</button>
          <button @click="$router.push('/chat')" class="back-btn ghost">← Back to Chat</button>
        </div>
      </div>
    </div>

    <!-- Main Conversation -->
    <div v-else class="conversation-content">
      <!-- Conversation Header -->
      <div class="conversation-header">
        <div class="participant-info">
          <NuxtLink
            v-if="head.profileId"
            :to="`/profile/${head.profileId}`"
            class="participant-avatar-link"
          >
            <img
              :src="head.avatar"
              :alt="head.name"
              class="participant-avatar clickable-avatar"
            />
          </NuxtLink>
          <img
            v-else
            :src="head.avatar"
            :alt="head.name"
            class="participant-avatar"
          />
          <div class="participant-details">
            <NuxtLink
              v-if="head.profileId"
              :to="`/profile/${head.profileId}`"
              class="participant-name-link"
            >
              <h2 class="participant-name">{{ head.name }}</h2>
            </NuxtLink>
            <h2 v-else class="participant-name">{{ head.name }}</h2>
            <p class="conversation-topic">
              <template v-if="head.kind">{{ head.kind }} · </template>{{ head.subtitle }}
              <UISourceChip
                v-if="conversation.source === 'sample'"
                source="sample"
                note="Sample conversation: it is not yours, and messages you type here stay in this tab."
              />
            </p>
          </div>
        </div>
        <div class="header-actions">
          <div class="conversation-stats">
            <span class="stat">{{ countLabel }}</span>
            <span class="stat">Last {{ formatTimestamp(conversation.last_message_at) }}</span>
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
            :id="`msg-${message.id}`"
            :key="message.id"
            :class="['message-item', message.sender_id === currentUserId ? 'sent' : 'received']"
          >
            <div class="message-content">
              <div v-if="head.isGroup && message.sender_id !== currentUserId" class="message-sender">{{ senderName(message) }}</div>
              <button
                v-if="message.reply_to_preview"
                type="button"
                class="reply-quote"
                :title="'Go to the quoted message'"
                @click="jumpTo(message.reply_to_preview.id)"
              >
                <span class="reply-author">↩ {{ message.reply_to_preview.author || 'Reply' }}</span>
                {{ quoteOf(message.reply_to_preview.content) || '(message)' }}
              </button>
              <template v-if="cardOf(message)">
                <div v-if="cardOf(message).card.note" class="message-text">{{ cardOf(message).card.note }}</div>
                <ChatSharePayload :attachment="cardOf(message).attachment" />
              </template>
              <div v-else class="message-text">{{ message.content }}</div>
              <ChatSharePayload
                v-for="(att, ai) in (message.attachments || []).filter(a => a.type === 'share')"
                :key="`${message.id}-share-${ai}`"
                :attachment="att"
              />
              <div class="message-footer">
                <span class="message-time">{{ formatTimestamp(message.timestamp) }}</span>
                <div v-if="chipsOf(message).length > 0" class="message-reactions" role="group" aria-label="Reactions">
                  <button
                    v-for="chip in chipsOf(message)"
                    :key="chip.emoji"
                    type="button"
                    :class="['reaction', { mine: chip.mine }]"
                    :aria-pressed="chip.mine"
                    :aria-label="chipLabel(chip)"
                    :title="chipLabel(chip)"
                    :disabled="!!reacting[`${message.id}|${chip.emoji}`]"
                    @click="addReaction(message, chip.emoji)"
                  >
                    <span aria-hidden="true">{{ chip.emoji }}</span>
                    <span class="reaction-count">{{ chip.count }}</span>
                  </button>
                </div>
              </div>
              <p v-if="reactionErrors[message.id]" class="reaction-error" role="alert">{{ reactionErrors[message.id] }}</p>
            </div>

            <!-- React (any message; saved on the server for your conversations, this tab only for samples) -->
            <div class="message-actions" role="group" aria-label="Reply or react">
              <button
                type="button"
                class="reaction-btn reply-btn"
                aria-label="Reply"
                :title="isServer ? 'Reply (saved)' : 'Reply (sample: this tab only)'"
                @click="startReply(message)"
              >↩</button>
              <button
                v-for="emoji in CHAT_REACTIONS"
                :key="emoji"
                type="button"
                :disabled="!!reacting[`${message.id}|${emoji}`]"
                :aria-label="`React ${emoji}`"
                :title="isServer ? `React ${emoji} (saved)` : `React ${emoji} (sample: this tab only)`"
                @click="addReaction(message, emoji)"
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
        <div v-if="strategyPickerOpen" class="strategy-picker" role="listbox" aria-label="Your strategies">
          <template v-if="ownStrategies.length">
            <button
              v-for="s in ownStrategies"
              :key="s.id"
              type="button"
              class="strategy-pick"
              role="option"
              @click="shareStrategy(s)"
            >📈 {{ s.name }}</button>
          </template>
          <p v-else class="picker-empty">
            You have no strategy of your own yet. <NuxtLink to="/creator">Build one in the Lab</NuxtLink>, then share it here.
          </p>
        </div>
        <div v-if="replyTo" class="reply-bar">
          <span>↩ Replying to <strong>{{ senderName(replyTo) }}</strong>: {{ quoteOf(replyTo.content, 70) }}</span>
          <button type="button" class="reply-cancel" aria-label="Cancel reply" @click="replyTo = null">✕</button>
        </div>
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
            :disabled="!newMessage.trim() || sending"
            class="send-button"
          >
            {{ sending ? 'Sending…' : 'Send' }}
          </button>
        </div>
        <p v-if="sendError" class="send-error" role="alert">{{ sendError }}</p>

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

.error-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); justify-content: center; }
.back-btn.ghost { background: transparent; color: var(--text-white); border: 1px solid var(--border-primary); }
.message-sender { font-size: 0.68rem; font-weight: 700; color: var(--primary-green); margin-bottom: 2px; }
.send-error { margin: 0.35rem 0 0; font-size: 0.75rem; color: var(--error-red); }
.reaction-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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
  border: 1px solid transparent;
  color: inherit;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}
.reaction.mine { border-color: var(--primary-blue, #00aaff); background: rgba(0, 170, 255, 0.18); }
.reaction:disabled { opacity: 0.6; cursor: progress; }
.reaction-count { font-variant-numeric: tabular-nums; font-size: 0.72rem; font-weight: 700; }
.reaction:focus-visible, .reaction-btn:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; }
.reaction-error { margin: 4px 0 0; font-size: 0.7rem; color: var(--error-red); }
.message-item:focus-within .message-actions { opacity: 1; }
@media (hover: none) { .message-item .message-actions { opacity: 1; } }

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
.reply-quote {
  display: block;
  width: 100%;
  text-align: left;
  background: rgba(255,255,255,0.05);
  border: 0;
  border-left: 2px solid rgba(0,255,136,0.5);
  color: rgba(255,255,255,0.65);
  font: inherit;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.3rem;
  border-radius: 4px;
  cursor: pointer;
}
.reply-author { display: block; font-weight: 700; font-size: 0.65rem; color: rgba(255,255,255,0.8); }
.reply-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.7);
  border-left: 2px solid rgba(0,255,136,0.5);
  padding: 0.25rem 0.5rem;
  margin: 0.35rem 0;
}
.reply-cancel { background: none; border: 0; color: inherit; cursor: pointer; }
.strategy-picker { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.4rem 0; }
.strategy-pick {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.85);
  font: inherit;
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
}
.strategy-pick:hover { border-color: var(--primary-green, #00ff88); }
.picker-empty { font-size: 0.75rem; color: rgba(255,255,255,0.6); margin: 0; }
</style>
