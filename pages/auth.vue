<script setup lang="ts">
definePageMeta({ layout: false })

const { login, register, startDemo, isAuthenticated } = useAuth()

const route = useRoute()
const mode = ref<'login' | 'register'>(route.query.mode === 'register' ? 'register' : 'login')
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

// Only same-site paths: never let ?redirect= send a fresh login to another origin.
const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && /^\/(?![\/\\])/.test(r) && !r.includes('\\') ? r : '/prices'
})

if (isAuthenticated.value) {
  await navigateTo(redirectTo.value)
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
    await navigateTo(redirectTo.value)
  } catch (e: unknown) {
    error.value = authErrorMessage(e)
  } finally {
    loading.value = false
  }
}

const showPassword = ref(false)

/** Human message; never the raw fetch error (it leaked the API URL and "<no response>"). */
function authErrorMessage(e: unknown): string {
  const err = e as { response?: { status?: number }; statusCode?: number; data?: Record<string, unknown> }
  const status = err?.response?.status ?? err?.statusCode ?? 0
  if (!status) return "Can't reach the Strades server right now. Please try again in a moment."
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
  const data = err.data ?? {}
  if (typeof data.detail === 'string') return data.detail
  // DRF field errors: { email: ["user with this email already exists."] }
  const first = Object.entries(data).find(([, v]) => Array.isArray(v) && v.length)
  if (first) return `${first[0].replace(/_/g, ' ')}: ${String((first[1] as unknown[])[0])}`
  return mode.value === 'login' ? 'Wrong email or password.' : 'Could not create the account.'
}

async function enterDemoMode() {
  error.value = null
  loading.value = true
  try {
    // Preferred: a real throwaway account, so the whole product (wallets, bots) works.
    await startDemo()
    demoCookie.value = null
    await navigateTo(redirectTo.value)
  } catch (e: unknown) {
    const status = (e as { statusCode?: number; response?: { status?: number } })?.response?.status
      ?? (e as { statusCode?: number }).statusCode
    if (status === 429) {
      error.value = 'Too many demo sessions from this network right now. Please create a free account instead.'
      return
    }
    // Backend unreachable: fall back to the sample-data demo (no wallets or bots there).
    demoCookie.value = '1'
    await navigateTo('/prices')
  } finally {
    loading.value = false
  }
}

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
        <div class="pw-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
            minlength="6"
          />
          <button type="button" class="pw-toggle" :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="primary-btn" :disabled="loading">
          {{ loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <button type="button" class="ghost-btn" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in' }}
      </button>

      <div class="divider"><span>or</span></div>

      <button type="button" class="demo-btn" :disabled="loading" @click="enterDemoMode">
        Continue in demo mode
      </button>
      <p class="hint">
        Try everything with a temporary demo account (deleted after 24 h). In demo you can create a paper wallet, not import a real one.
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
  /* The card is designed dark (white text, translucent fills). Don't inherit the
     colour-mode background: in light mode it turned grey-on-white and unreadable. */
  background: #05070a;
  background-image: radial-gradient(circle at center, rgba(0, 170, 255, 0.1) 0%, transparent 70%);
  color: #fff;
  color-scheme: dark;
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

/* Secondary action: must read quieter than "Sign in". */
.demo-btn {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
}

.pw-wrap { position: relative; display: flex; }
.pw-wrap input { flex: 1; padding-right: 4.2rem; }
.pw-toggle {
  position: absolute; right: .5rem; top: 50%; transform: translateY(-50%);
  border: 0; background: transparent; color: rgba(255, 255, 255, 0.6); cursor: pointer; font: inherit; font-size: .8rem;
  padding: .25rem .4rem;
}
.pw-toggle:hover { color: #fff; }

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
