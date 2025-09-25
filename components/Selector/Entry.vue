<script setup>
import { ref } from 'vue';

const isExpanded = ref(false);
const time = ref('');
const condition = ref('');
const amount = ref('');

const emit = defineEmits(['updateEntry']);

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function updateEntry() {
  emit('updateEntry', { time: time.value, condition: condition.value, amount: amount.value });
}
</script>

<template>
  <div class="entry-button-container" @click="toggleExpand">
    <div v-if="!isExpanded" class="entry-button">
      <h1>Entry</h1>
    </div>
    <div v-else class="entry-expanded">
      <div class="entry-part">
        <label for="time">Time</label>
        <input type="time" id="time" v-model="time" @change="updateEntry" />
      </div>
      <div class="entry-part">
        <label for="condition">Condition</label>
        <input type="text" id="condition" v-model="condition" @change="updateEntry" />
      </div>
      <div class="entry-part">
        <label for="amount">Amount (%)</label>
        <input type="number" id="amount" v-model="amount" @change="updateEntry" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.entry-button-container {
  width: 100%;
  cursor: pointer;
}

.entry-button {
  background-color: #333;
  color: white;
  padding: 20px;
  text-align: center;
  border-radius: 5px;
  transition: background-color 0.3s ease;
}

.entry-button:hover {
  background-color: #444;
}

.entry-expanded {
  display: flex;
  justify-content: space-between;
  background-color: #333;
  color: white;
  padding: 20px;
  border-radius: 5px;
}

.entry-part {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 10px;
}

.entry-part label {
  margin-bottom: 5px;
}

.entry-part input {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 5px;
  background-color: #444;
  color: white;
}

.entry-part input:focus {
  outline: none;
  background-color: #555;
}
</style>