<script setup lang="ts">
import { ref } from 'vue'

const email = ref('')
const password = ref('')
const username = ref('')
const errorMessage = ref('')
const isRegistering = ref(false)

const login = async () => {
  try {
    const response = await fetch('https://strades.app/api/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      }),
    })

    if (!response.ok) {
      throw new Error('Invalid email or password')
    }

    const data = await response.json()
    localStorage.setItem('access_token', data.access_token)
    // Redirect to a protected page or the main application
    // You might want to use Nuxt's navigation here
    window.location.href = '/wallet'
  } catch (error) {
    errorMessage.value = 'Invalid email or password'
  }
}

const register = async () => {
  try {
    const response = await fetch('https://strades.app/api/register/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        username: username.value,
      }),
    })

    if (!response.ok) {
      throw new Error('Registration failed')
    }

    const data = await response.json()
    localStorage.setItem('access_token', data.access_token)
    window.location.href = '/wallet'
  } catch (error) {
    errorMessage.value = 'Registration failed'
  }
}

const toggleForm = () => {
  isRegistering.value = !isRegistering.value
  errorMessage.value = ''
}

const loginWithGoogle = () => {
  window.location.href = 'https://strades.app/api/login/google/'
}

const loginWithTwitter = () => {
  window.location.href = 'https://strades.app/api/login/twitter/'
}
</script>

<template>
  <div class="login-container">
    <h1>Login</h1>
    <form @submit.prevent="login">
      <div class="form-group">
        <label for="email">Email:</label>
        <input type="email" v-model="email" id="email" required />
      </div>
      <div class="form-group">
        <label for="password">Password:</label>
        <input type="password" v-model="password" id="password" required />
      </div>
      <button class="login-button" type="submit">Login</button>
    </form>
    <form v-if="isRegistering" @submit.prevent="register">
      <div class="form-group">
        <label for="register-email">Email:</label>
        <input type="email" v-model="email" id="register-email" required />
      </div>
      <div class="form-group">
        <label for="register-password">Password:</label>
        <input type="password" v-model="password" id="register-password" required />
      </div>
      <div class="form-group">
        <label for="register-username">Username:</label>
        <input type="text" v-model="username" id="register-username" required />
      </div>
      <button class="register-button" type="submit">Register</button>
    </form>
    <button @click="toggleForm" class="toggle-form-button">
      {{ isRegistering ? 'Switch to Login' : 'Switch to Register' }}
    </button>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <div class="social-login">
      <button @click="loginWithGoogle" class="google-button">Login with Google</button>
      <button @click="loginWithTwitter" class="twitter-button">Login with Twitter</button>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.login-button, .google-button, .twitter-button {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 4px;
  color: white;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 10px;
}

.login-button {
  background-color: #007bff;
}

.google-button {
  background-color: #db4437;
}

.twitter-button {
  background-color: #1da1f2;
}

.error-message {
  color: red;
  margin-top: 10px;
}

.social-login {
  margin-top: 20px;
}
</style>