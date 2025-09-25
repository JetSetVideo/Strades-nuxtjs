<script setup>
import axios from 'axios';
const emit = defineEmits(['send']);
async function sendMessage() {
  if (newMessage.value.trim() !== '') {
    const message = {
      id: Date.now(),
      from: '1',
      to: friendId,
      message: newMessage.value,
      timestamp: new Date().toISOString(),
      read: false,
      deleted: false,
      meta: {
        type: 'text',
      },
      reactions: [],
      attachments: [],
      modified: false,
      parent: null,
    };

    try {
      await axios.post('https://strades.app/api/messages', message);
      messages.value.push(message);
      newMessage.value = '';
      emit('send');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }
}
</script>

<template>
  <button @click="sendMessage">
    <svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24">
      <path fill="white" d="M4.4 19.425q-.5.2-.95-.088T3 18.5V14l8-2l-8-2V5.5q0-.55.45-.837t.95-.088l15.4 6.5q.625.275.625.925t-.625.925z"/>
    </svg>
  </button>
</template>

<style scoped>
button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

svg {
  fill: white;
}
</style>
