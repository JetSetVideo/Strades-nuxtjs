import { defineStore } from 'pinia';
import friends from '../data/Friends.json';

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: friends,
  }),
  actions:{
    getFriendById(id) {
      console.log('getFriendById called with id:', id);
      const friend = this.friends.find(friend => friend.id === id);
      console.log('Found friend:', friend);
      return friend;
    },
    async getMessages(friendId) {
      const friend = await this.getFriendById(friendId);
      return friend ? friend.messages : [];
    }
  }
});

