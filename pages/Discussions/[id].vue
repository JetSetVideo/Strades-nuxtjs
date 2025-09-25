<script setup>
import { ref, onMounted } from 'vue';
import { useFriendsStore } from '@/stores/FriendsStore';
import { useMessagesStore } from '~/stores/MessagesStore';


const route = useRoute();
const friendId = ref(route.params.id);
const friendsStore = useFriendsStore().friends;
// const friend = ref(null);

const newMessage = ref('');
const messagesStore = useMessagesStore();
const messages = ref(messagesStore.messages);

const isLoading = ref(true);

onMounted(async () => {
  try {
    friend.value = await friendsStore.getFriendById(friendId);
    messages.value = await friendsStore.getMessages(friendId);
  } catch (error) {
    console.error("Failed to fetch data:", error);
    // Handle error state here
  } finally {
    isLoading.value = false;
  }
});

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function toggleReaction(message) {
  // Toggle reaction for the message
  // You can implement your own logic here
  console.log('Toggle reaction for message:', message);
}
function getDiscussionByFriendId(friendId) {
  // Implement the logic to get the discussion object based on the friendId
  // You can use the friendId to filter or find the relevant discussion from your data source
  // For example, if you have a discussions array in your store:
  return discussions.find(discussion => discussion.friendId === friendId);
}

function getFriendById(id) {
  return friendsStore.getFriendById(id);
}

function getMessages(id) {
  return friendsStore.getMessages(id);
}
</script>

<template>
<div class="discussion-container">
  <div class="discussion-title">
    <!-- <h1>Discussion with {{ friendsStore }}</h1> -->
  </div>

  <div class="tags-names">
    <CardFriend v-for="friend in friendsStore" :key="friend.id" :friend="friend" />
  </div>

    <div class="admin-rights">
      <h3>Administration Rights</h3>
      <!-- Example administration actions -->
      <button @click="muteParticipant">Mute</button>
      <button @click="removeParticipant">Remove</button>
      <ButtonDatabase />
    </div>


    <div class="discussion" :class="{ 'empty-discussion': Object.keys(messages).length === 0 }">
      <div v-if="Object.keys(messages).length === 0" class="empty-message">
        No messages yet. Start a conversation!
      </div>
      <div v-else class="messages">
        <div v-for="message in Object.values(messages)" :key="message.id" class="message" :class="{ 'sent': message.from === '1', 'received': message.from !== '1' }">
          <strong>{{ message.message }}</strong>
          <p class="timestamp">{{ formatTimestamp(message.timestamp) }}</p>
        </div>
      </div>
    </div>

    <div class="box-message">
      <input v-model="newMessage" type="text" placeholder="Type your message here" aria-label="New message" />
      <!--Click ButtonSend to send the message-->
      <div class="button-send">
        <ButtonSend />
      </div>
    </div>

</div>
</template>

<style scoped>

.admin-rights {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(61, 61, 61, 0.5);
  border-radius: 0.5rem;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(255, 255, 255, 0.1);
  margin: 1rem 0;
}

.admin-rights button {
  background-color: rgba(61, 61, 61, 0.5);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
}

.box-message {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(61, 61, 61, 0.5);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  margin: 1rem 0;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.box-message input {
  flex: 1;
  padding: 0.5rem;
  border-radius: 0.5rem 0 0 0.5rem;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(255, 255, 255, 0.1);
}
.button-send {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 128, 255, 0.8);
  padding: 0.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(20, 20, 20, 0.5);
  border-radius: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.chat-input {
  display: flex;
  align-items: center;
  margin-top: 1rem;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.discussion {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  background-color: rgba(61, 61, 61, 0.5);
  padding: 0.3rem;
  border-radius: 0.5rem;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(255, 255, 255, 0.1);
  min-height: 50vh;
  margin: 1rem 0;
}

.discussion-title {
  margin: 0rem 5rem 2rem 5rem;
  background-color: rgba(61, 61, 61, 0.5);
  padding: 0.5rem;
  border-radius: 0.5rem;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(255, 255, 255, 0.1);
}
.discussion-title h1 {
  margin-bottom: 1rem;
}
.empty-discussion {
  min-height: 50vh;
}

.empty-message {
  color: #888;
  font-style: italic;
}
.friend-info {
  
  margin-bottom: 1rem;
  background-color: rgba(61, 61, 61, 0.5);
  padding: 1rem;
  border-radius: 0.5rem;
}

.message {
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
  max-width: 70%;
}
.messages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.sent {
  align-self: flex-end;
  background-color: rgba(0, 128, 255, 0.8);
  color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.received {
  align-self: flex-start;
  background-color: rgba(255, 255, 255, 0.8);
  text-align: left;
}

.structure-comrade {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.tags-names {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}
.timestamp {
  font-size: 0.8rem;
  color: #888;
  margin-top: 0.5rem;
}
.user-portrait {
  display: flex;
  justify-content: center;
  align-items: center;
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 0.5rem;
  background-color: rgba(61, 61, 61, 0.5);
  padding: 0.5rem;
  border-radius: 0.5rem;
}
</style>

