<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { navigateTo } from '#app';
import { useChatStore } from '@/stores/chat';
import { useUsersStore } from '@/stores/users';
import { useCommunityStore } from '@/stores/community';
import { conversationDisplay, messageCountLabel } from '~/utils/chatMap';
import { toDate, fmtTime, fmtShortDate } from '~/utils/format';
import ChatNewMessageModal from '@/components/Chat/NewMessageModal.vue';
import UIScreenShell from '@/components/UI/ScreenShell.vue';
import UISectionTabs from '@/components/UI/SectionTabs.vue';
import UISourceChip from '@/components/UI/SourceChip.vue';
import CommunityPersonCard from '@/components/Community/PersonCard.vue';

// Title literal = routeLabel('/chat') (tests/pageTitles.test.ts; definePageMeta cannot call it).
definePageMeta({
    title: "Chat",
    description: "Chat conversations",
    layout: "default",
});

const chatStore = useChatStore();
const usersStore = useUsersStore();
const community = useCommunityStore();
const isLoading = ref(true);

const { userId: currentUserId, getUserId } = useCurrentUser();
const { isAuthenticated } = useAuth();

async function loadChat(force = false) {
  isLoading.value = true;
  try {
    await Promise.all([
      chatStore.ensureLoaded(force),
      usersStore.initializeStore(),
      community.hydrated ? Promise.resolve() : community.fetchCommunity(),
      // Signed in: the real people (bots included) and your server friends (C2/C3).
      isAuthenticated.value ? community.loadServerPeople() : Promise.resolve(),
    ]);
  } catch (error) {
    console.error('Failed to load chat data:', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => loadChat());
// Signing in or out swaps the list (server conversations ↔ samples).
watch([isAuthenticated, currentUserId], () => loadChat());

const retry = () => loadChat(true);

const userConversations = computed(() => {
  return chatStore.getRecentConversations(getUserId());
});

const lookupUser = (id) => {
  const u = usersStore.getUserById(id);
  return u ? { username: u.username, full_name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), avatar_url: u.avatar_url } : null;
};

const display = (conversation) => conversationDisplay(conversation, getUserId(), lookupUser);

const formatLastMessageTime = (timestamp) => {
  const date = toDate(timestamp);
  if (!date) return '—';
  const diffInHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return diffInHours < 24 ? fmtTime(date) : fmtShortDate(date);
};

const getUnreadCount = (conversation) => {
  const own = conversation[`unread_count_${getUserId()}`];
  return typeof own === 'number' ? own : (conversation.source === 'server' ? conversation.unread_count || 0 : 0);
};

const navigateToConversation = (conversationId) => {
  navigateTo(`/conversations/${conversationId}`);
};

// Top-bar "Message" action opens the new-message modal
const newMessageOpen = ref(false);
/** Person picked from a card's MESSAGE button (the modal forgets it on close). */
const newMessagePreselect = ref(null);
function openNew(id = null) {
  newMessagePreselect.value = id;
  newMessageOpen.value = true;
}
function onNewOpen(v) {
  newMessageOpen.value = v;
  if (!v) newMessagePreselect.value = null;
}
usePageAction().onPageAction('chat:new-message', () => openNew());

/** Signed in and the server answered: server people; otherwise the bundled sample roster (chipped Sample). */
const serverPeople = computed(() => isAuthenticated.value && community.serverState === 'ok');
const friendsList = computed(() => serverPeople.value ? community.serverFriends : community.friends);
const discoverList = computed(() => serverPeople.value ? community.serverDiscover : community.suggestions);

// ── Conversations / Friends / Discover ─────────────────────────────────
const tab = ref('conversations');
const onlineOnly = ref(false);

function isOnline(id) {
  const known = community.list.find(u => u.id === id);
  if (known) return known.online;
  return usersStore.getUserById(id)?.is_online === true;
}

function conversationOnline(conversation) {
  const me = getUserId();
  if (conversation.source === 'server') {
    return (conversation.participantDetails || []).some(p => p.user_id !== me && p.is_online);
  }
  return conversation.participants.some(id => id !== me && isOnline(id));
}

const visibleConversations = computed(() => {
  const list = userConversations.value;
  return onlineOnly.value ? list.filter(conversationOnline) : list;
});
const visibleFriends = computed(() => {
  const list = friendsList.value;
  return onlineOnly.value ? list.filter(u => u.online) : list;
});
const visibleSuggestions = computed(() => {
  const list = discoverList.value;
  return onlineOnly.value ? list.filter(u => u.online) : list;
});

const onlineInTab = computed(() => {
  if (tab.value === 'friends') return friendsList.value.filter(u => u.online).length;
  if (tab.value === 'discover') return discoverList.value.filter(u => u.online).length;
  return userConversations.value.filter(conversationOnline).length;
});

const tabs = computed(() => [
  { id: 'conversations', label: 'Conversations', count: isLoading.value ? null : userConversations.value.length },
  { id: 'friends', label: 'Friends', count: isLoading.value ? null : friendsList.value.length },
  { id: 'discover', label: 'Discover', count: isLoading.value ? null : discoverList.value.length },
]);

function onAddFriend(user) {
  community.toggleFriend(user.id);
}
/** Sample cards whose id points at a different person in the sample user list (ids collide across the two seeds). */
const profileNote = ref('');
function onViewProfile(id) {
  profileNote.value = '';
  const card = [...friendsList.value, ...discoverList.value].find(u => u.id === id);
  if (card && card.source !== 'server') {
    const row = usersStore.getUserById(id);
    const same = row && [row.first_name, row.username].some(n => String(n ?? '').toLowerCase() === card.username.toLowerCase());
    if (!same) {
      profileNote.value = `${card.username} is a sample trader without a profile page.`;
      return;
    }
  }
  navigateTo(`/profile/${id}`);
}
</script>
<template>
  <UIScreenShell hide-header>
    <NavigationAreaLinks area="community" />
    <UISectionTabs v-model="tab" :tabs="tabs" count-first panels tone="white">
      <template #end>
        <button
          type="button"
          class="tab-filter"
          :class="{ on: onlineOnly }"
          :aria-pressed="onlineOnly"
          @click="onlineOnly = !onlineOnly"
        >
          <span v-if="!isLoading" class="tab-count">{{ onlineInTab }}</span>
          Online now
        </button>
      </template>
    </UISectionTabs>

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
            <NuxtLink to="/agents" class="chatbot-btn">Ask about market trends</NuxtLink>
            <NuxtLink to="/insights#dir-title" class="chatbot-btn">Strategy recommendations</NuxtLink>
          </div>
        </div>

        <div class="conversations-section">
          <!-- Signed in and the API failed: say so, never swap in the samples. -->
          <div v-if="chatStore.error" class="empty-state error-state" role="alert">
            <div class="empty-icon">⚠</div>
            <h3>Your conversations could not load</h3>
            <p>{{ chatStore.error }}</p>
            <button class="start-btn" @click="retry">Retry</button>
          </div>

          <template v-else>
          <p v-if="chatStore.isSample" class="sample-note">
            <UISourceChip source="sample" note="Sample conversations so the page is not empty: they are not yours. Sign in to see your chats and rooms." />
            Sample conversations — <NuxtLink to="/auth?redirect=/chat">sign in</NuxtLink> to see yours.
          </p>

          <div v-if="userConversations.length === 0" class="empty-state">
            <div class="empty-icon">💭</div>
            <h3>No conversations yet</h3>
            <p>Start chatting with other traders to discuss strategies and market insights.</p>
            <button class="start-btn" @click="openNew()">+ New message</button>
          </div>
          <div v-else-if="visibleConversations.length === 0" class="empty-state">
            <h3>No one online</h3>
            <p>None of these conversations have someone online right now.</p>
          </div>

          <div v-else class="conversations-list">
            <div
              v-for="conversation in visibleConversations"
              :key="conversation.id"
              class="conversation-item"
              role="link"
              tabindex="0"
              :aria-label="`Open conversation: ${display(conversation).name}`"
              @click="navigateToConversation(conversation.id)"
              @keydown.enter="navigateToConversation(conversation.id)"
            >
              <div class="conversation-avatar">
                <NuxtLink
                  v-if="display(conversation).profileId"
                  :to="`/profile/${display(conversation).profileId}`"
                  @click.stop
                >
                  <img
                    :src="display(conversation).avatar"
                    :alt="display(conversation).name"
                    class="avatar-link-img"
                  />
                </NuxtLink>
                <img
                  v-else
                  :src="display(conversation).avatar"
                  :alt="display(conversation).name"
                  class="avatar-link-img"
                />
              </div>

              <div class="conversation-content">
                <div class="conversation-header">
                  <h4 class="conversation-name">
                    {{ display(conversation).name }}
                  </h4>
                  <span class="conversation-time">
                    {{ formatLastMessageTime(conversation.last_message_at) }}
                  </span>
                </div>

                <div class="conversation-preview">
                  <p class="conversation-topic">{{ display(conversation).subtitle }}</p>
                  <div class="conversation-meta">
                    <span v-if="display(conversation).kind" class="message-count">{{ display(conversation).kind }}</span>
                    <span v-if="messageCountLabel(conversation)" class="message-count">{{ messageCountLabel(conversation) }}</span>
                    <UISourceChip
                      v-if="conversation.source === 'sample' && !chatStore.isSample"
                      source="sample"
                      note="Started in this tab with sample traders: it is not saved on the server."
                    />
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
          </template>
        </div>
      </div>

      <!-- ── Friends tab ── -->
      <div v-else-if="tab === 'friends'" class="person-grid">
        <p v-if="!serverPeople" class="sample-note people-note">
          <UISourceChip source="sample" note="Sample traders from the bundled roster: they are not real accounts and cannot receive messages." />
          Sample traders<template v-if="!isAuthenticated"> — <NuxtLink to="/auth?redirect=/chat">sign in</NuxtLink> to see your friends</template>.
        </p>
        <p v-else-if="community.friendsRoute === 'missing'" class="sample-note people-note">Adding friends is coming soon: your rooms and bots are in Conversations.</p>
        <p v-if="profileNote" class="sample-note people-note" role="status">{{ profileNote }}</p>
        <div v-if="!friendsList.length" class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>No friends yet</h3>
          <p>Add traders from Discover to build your circle — their trades and reads train your avatar too.</p>
          <button class="start-btn" @click="tab = 'discover'">Discover people</button>
        </div>
        <div v-else-if="!visibleFriends.length" class="empty-state">
          <h3>No one online</h3>
          <p>None of your friends are online right now.</p>
        </div>
        <CommunityPersonCard
          v-for="u in visibleFriends"
          :key="u.id"
          :user="u"
          variant="friend"
          @message="openNew"
          @profile="onViewProfile"
          @add="onAddFriend"
        />
      </div>

      <!-- ── Discover tab ── -->
      <div v-else class="person-grid">
        <p v-if="!serverPeople" class="sample-note people-note">
          <UISourceChip source="sample" note="Sample traders from the bundled roster: they are not real accounts and cannot receive messages." />
          Sample traders<template v-if="!isAuthenticated"> — <NuxtLink to="/auth?redirect=/chat">sign in</NuxtLink> to meet real people and bots</template>.
        </p>
        <p v-else-if="community.friendsRoute === 'missing'" class="sample-note people-note">“+ Add friend” is coming soon. Bots can be messaged right away.</p>
        <p v-if="Object.keys(community.friendErrors).length" class="sample-note people-note" role="alert">
          {{ Object.values(community.friendErrors)[0] }}
        </p>
        <p v-if="profileNote" class="sample-note people-note" role="status">{{ profileNote }}</p>
        <div v-if="!discoverList.length" class="empty-state">
          <div class="empty-icon">🔎</div>
          <h3>No suggestions right now</h3>
          <p>Check back soon — new traders join the desk all the time.</p>
        </div>
        <div v-else-if="!visibleSuggestions.length" class="empty-state">
          <h3>No one online</h3>
          <p>None of these suggestions are online right now.</p>
        </div>
        <CommunityPersonCard
          v-for="u in visibleSuggestions"
          :key="u.id"
          :user="u"
          variant="discover"
          @message="openNew"
          @profile="onViewProfile"
          @add="onAddFriend"
        />
      </div>
    </template>

    <ChatNewMessageModal :open="newMessageOpen" :preselect="newMessagePreselect" @update:open="onNewOpen" />
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
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.chatbot-header {
  text-align: center;
  margin-bottom: 0.35rem;
}

.chatbot-header h3 {
  color: var(--primary-green);
  margin: 0 0 0.2rem 0;
  font-family: var(--font-chrome, var(--font-family-primary));
  font-size: 1rem;
}

.chatbot-header p {
  color: var(--text-gray);
  margin: 0;
  font-family: var(--font-family-secondary);
  font-size: 0.75rem;
}

.chatbot-actions {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.35rem;
}

.chatbot-btn {
  flex: 1 1 0;
  min-width: 0;
  background: var(--primary-gradient);
  color: #fff;
  border: none;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  font-size: 0.72rem;
  line-height: 1.25;
  transition: var(--transition-normal);
  text-align: center;
}

.chatbot-btn:hover {
  transform: translateY(-1px);
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
.sample-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
  color: var(--text-gray);
}
.sample-note a { color: var(--primary-green); }
.error-state h3 { color: var(--error-red); }
.person-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 0.5rem;
}
.people-note { grid-column: 1 / -1; margin: 0 0 0.25rem; }
a.chatbot-btn { text-decoration: none; display: inline-flex; align-items: center; }
</style>
