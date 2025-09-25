<script setup>
import { ref } from 'vue';

definePageMeta({
    title: "Settings",
    description: "User Settings",
    layout: "default",
});

const apiKeys = ref([
  { exchange: 'Binance', key: '', secret: '' },
  { exchange: 'Kraken', key: '', secret: '' },
  { exchange: 'Uniswap', key: '', secret: '' },
]);

const addApiKey = (exchange) => {
  apiKeys.value.push({ exchange, key: '', secret: '' });
};

const removeApiKey = (index) => {
  apiKeys.value.splice(index, 1);
};

const saveSettings = () => {
  // Implement saving logic here
  console.log('Saving settings:', apiKeys.value);
};
</script>

<template>
  <div class="settings-page">
    <h1>Settings</h1>
    
    <section>
      <h2>API Keys</h2>
      <div v-for="(api, index) in apiKeys" :key="index" class="api-key-input">
        <h3>{{ api.exchange }}</h3>
        <input v-model="api.key" placeholder="API Key" />
        <input v-model="api.secret" placeholder="API Secret" type="password" />
        <button @click="removeApiKey(index)" class="remove-button">Remove</button>
      </div>
      <button @click="addApiKey('Custom')" class="add-button">Add Custom API</button>
    </section>

    <button @click="saveSettings" class="save-button">Save Settings</button>

    <section>
      <h2>Preferences</h2>
      <!-- Add preference options here -->
    </section>

    <section>
      <h2>Notifications</h2>
      <!-- Add notification settings here -->
    </section>

    <section>
      <h2>Security</h2>
      <!-- Add security settings here -->
    </section>

    <section>
      <h2>Help & Support</h2>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact Us</a>
    </section>

    <section>
      <h2>Legal</h2>
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
    </section>

    <section>
      <h2>About</h2>
      <p>Version: 0.1</p>
      <a href="/changelog">Changelog</a>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1, h2 {
  margin-bottom: 1rem;
}

section {
  margin-bottom: 2rem;
}

.api-key-input {
  margin-bottom: 1rem;
}

input {
  display: block;
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  margin-right: 0.5rem;
}

.remove-button {
  background-color: #ff4136;
  color: white;
}

.add-button {
  background-color: #0074d9;
  color: white;
}

.save-button {
  background-color: #2ecc40;
  color: white;
  font-size: 1.2rem;
  padding: 0.75rem 1.5rem;
}
</style>