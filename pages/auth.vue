<script setup lang="ts">
definePageMeta({ layout: false })

const { login, register, isAuthenticated } = useAuth()
const config = useRuntimeConfig()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const demoCookie = useCookie('strades_demo', {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax',
})

if (isAuthenticated.value) {
  await navigateTo('/prices')
}

async function submit() {
  error.value = null
  loading.value = true
  try {
    if (mode.value === 'login') {
      await login(email.value.trim(), password.value)
    } else {
      await register({
        email: email.value.trim(),
        password: password.value,
        first_name: firstName.value.trim() || undefined,
        last_name: lastName.value.trim() || undefined,
      })
    }
    demoCookie.value = null
    await navigateTo('/prices')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Authentication failed. Check your credentials or use demo mode.'
  } finally {
    loading.value = false
  }
}

async function enterDemoMode() {
  demoCookie.value = '1'
  await navigateTo('/prices')
}

const apiBase = computed(() => config.public.apiBase as string)
</script>

<template>
  <main class="auth-page">
    <div class="auth-card">
      <NuxtLink to="/" class="brand">STRADES</NuxtLink>
      <p class="subtitle">
        {{ mode === 'login' ? 'Sign in to your account' : 'Create your account' }}
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <template v-if="mode === 'register'">
          <input v-model="firstName" type="text" placeholder="First name" autocomplete="given-name" />
          <input v-model="lastName" type="text" placeholder="Last name" autocomplete="family-name" />
        </template>

        <input
          v-model="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          required
          minlength="6"
        />

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="primary-btn" :disabled="loading">
          {{ loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <button type="button" class="ghost-btn" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in' }}
      </button>

      <div class="divider"><span>or</span></div>

      <button type="button" class="demo-btn" @click="enterDemoMode">
        Continue in demo mode
      </button>
      <p class="hint">
        Demo mode skips sign-in and uses local JSON data
        <span v-if="apiBase"> (API: {{ apiBase }})</span>
      </p>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 1.5rem;
  background: var(--bg-primary, #000);
  background-image: radial-gradient(circle at center, rgba(0, 170, 255, 0.1) 0%, transparent 70%);
  color: #fff;
  font-family: 'Poppins', sans-serif;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem 2rem;
  border-radius: var(--app-border-radius, 16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(25, 25, 25, 0.65);
  backdrop-filter: blur(15px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.brand {
  display: block;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #fff;
  text-decoration: none;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font: inherit;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: rgba(0, 170, 255, 0.5);
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--error-red, #ff4444);
}

.primary-btn,
.ghost-btn,
.demo-btn {
  width: 100%;
  padding: 0.85rem;
  border-radius: 8px;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.primary-btn {
  margin-top: 0.25rem;
  border: none;
  background: linear-gradient(45deg, var(--primary-green, #00ff88), var(--primary-blue, #00aaff));
  color: #000;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.ghost-btn {
  margin-top: 0.75rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
}

.demo-btn {
  border: 1px solid rgba(0, 255, 136, 0.35);
  background: rgba(0, 255, 136, 0.08);
  color: var(--primary-green, #00ff88);
}

.primary-btn:hover:not(:disabled),
.demo-btn:hover,
.ghost-btn:hover {
  transform: translateY(-1px);
}

.divider {
  display: flex;
  align-items: center;
  margin: 1.25rem 0 1rem;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.divider span {
  padding: 0 0.75rem;
}

.hint {
  margin: 0.75rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.4;
}
</style>
