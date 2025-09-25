<script setup>
// Importing the Vue ref hook for reactive state management
import { ref } from 'vue';

// State to manage confirmation dialog visibility
const isConfirming = ref(false);

// Function to handle the delete action
const handleDelete = () => {
  // Here, you would typically call a method to delete an item
  // For demonstration, we'll just log to the console and reset the confirmation state
  console.log('Item deleted');
  isConfirming.value = false;
};

// Function to toggle confirmation dialog
const toggleConfirm = () => {
  isConfirming.value = !isConfirming.value;
};
</script>

<template>
  <div class="delete-button-container">
    <!-- Accessible button with ARIA label for better screen reader support -->
    <button @click="toggleConfirm" aria-label="Delete item" class="delete-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 3c-4.963 0-9 4.038-9 9s4.037 9 9 9s9-4.038 9-9s-4.037-9-9-9m0 16c-3.859 0-7-3.14-7-7s3.141-7 7-7s7 3.14 7 7s-3.141 7-7 7m.707-7l2.646-2.646a.502.502 0 0 0 0-.707a.502.502 0 0 0-.707 0L12 11.293L9.354 8.646a.5.5 0 0 0-.707.707L11.293 12l-2.646 2.646a.5.5 0 0 0 .707.708L12 12.707l2.646 2.646a.5.5 0 1 0 .708-.706z"/>
      </svg>
      Delete
    </button>
    <!-- Confirmation dialog -->
    <div v-if="isConfirming" class="confirmation-dialog">
      <p>Are you sure you want to delete?</p>
      <button @click="handleDelete">Yes, delete</button>
      <button @click="toggleConfirm">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.delete-button-container {
  display: inline-block;
  position: relative;
}

.delete-button {
  background-color: rgba(255, 255, 255, 0.5);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.delete-button:hover {
  background-color: #d32f2f;
}

.confirmation-dialog {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  border-radius: 5px;
  padding: 20px;
  margin-top: 10px;
}

.confirmation-dialog button {
  background-color: #4CAF50; /* Green */
  color: white;
  border: none;
  padding: 10px 20px;
  margin: 5px;
  border-radius: 5px;
  cursor: pointer;
}

.confirmation-dialog button:hover {
  background-color: #45a049;
}
</style>