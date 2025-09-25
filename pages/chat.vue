<script setup>
import { useFriendsStore } from '@/stores/FriendsStore';
import { useDiscussionsStore } from '@/stores/DiscussionsStore';

definePageMeta({
    title: "Messages",
    description: "Contacts list",
    layout: "messages",
});

const friendsStore = useFriendsStore();
const friends = computed(() => friendsStore.friends);

const discussions = useDiscussionsStore();

</script>
<template>
<div class="chat-page">
    <div class="chatbot">
        <p>Chat Bot Widget</p>
    </div>
    <div class="discussion-list">
        <!-- <WidgetDiscussion v-for="friend in friendsData" :key="friend.id" :friend="friend" /> -->
        <WidgetDiscussion
        v-for="discussion in discussions.discussions"
        :key="discussion.id"
        :discussion="discussion"
        :discussionId="discussion.id"
      />
    </div>

</div>
</template>
<style scoped>
.chat-page{
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
}
.chatbot{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 1rem;
    padding: 1rem;
    background-color: rgba(20, 20, 20, 0.1);
    border-radius: 0.5rem;
}

.discussion-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}
</style>