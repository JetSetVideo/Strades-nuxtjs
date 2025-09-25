// stores/MessagesStore.ts
import { defineStore } from "pinia";
import messagesData from "~/data/Messages.json";

export const useMessagesStore = defineStore("messagesStore", {
  state: () => ({
    messages: messagesData,
  }),
  actions: {
    getMessagesByFriendId(friendId) {
      return this.messages[friendId] || [];
    },
  },
});
