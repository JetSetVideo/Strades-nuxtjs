<script setup lang="ts">
/**
 * The one sign-in page: sign in, create an account, or try the demo.
 * `/` redirects here (nuxt.config routeRules); signed-in users are sent on to
 * `?redirect=` (same-site paths only) or /prices by middleware/auth.global.ts.
 */
definePageMeta({ layout: false })
useHead({ title: 'Sign in · Strades' })

const { login, register, startDemo, resumeDemo, isAuthenticated } = useAuth()

type Mode = 'login' | 'register'
const route = useRoute()
const mode = ref<Mode>(route.query.mode === 'register' ? 'register' : 'login')
const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const showPassword = ref(false)
const loading = ref<'form' | 'demo' | null>(null)
const error = ref<string | null>(null)

const demoCookie = useCookie('strades_demo', { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })

// Only same-site paths: never let ?redirect= send a fresh login to another origin.
const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && /^\/(?![\/\\])/.test(r) && !r.includes('\\') ? r : '/prices'
})

if (isAuthenticated.value) await navigateTo(redirectTo.value)

function setMode(m: Mode) {
  mode.value = m
  error.value = null
}

async function submit() {
  error.value = null
  loading.value = 'form'
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
    loading.value = null
  }
}

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
  if (first) {
    const msg = String((first[1] as unknown[])[0])
    // Form-level errors ("Invalid email or password.") read on their own; field ones get the field name.
    return first[0] === 'non_field_errors' ? msg : `${first[0].replace(/_/g, ' ')}: ${msg}`
  }
  return mode.value === 'login' ? 'Wrong email or password.' : 'Could not create the account.'
}

async function enterDemoMode() {
  error.value = null
  loading.value = 'demo'
  try {
    // This device already has a demo: come back to it instead of minting a second one.
    const saved = storedDemoCode()
    if (saved) {
      try {
        await resumeDemo(saved)
        demoCookie.value = null
        await navigateTo(redirectTo.value)
        return
      } catch (e: unknown) {
        if (statusOf(e) !== 404) throw e
        forgetDemoCode()                 // deleted after 30 idle days or claimed: start a fresh one
      }
    }
    // Preferred: a real demo account, so the whole product (wallets, bots, friends, insights) works.
    const data = await startDemo()
    demoCookie.value = null
    newCode.value = data.demo?.code ?? null
    if (!newCode.value) await navigateTo(redirectTo.value)
  } catch (e: unknown) {
    if (statusOf(e) === 429) {
      error.value = 'Too many demo sessions from this network right now. Please create a free account instead.'
      return
    }
    // Backend unreachable: fall back to the sample-data demo (no wallets or bots there).
    demoCookie.value = '1'
    await navigateTo('/prices')
  } finally {
    loading.value = null
  }
}

function statusOf(e: unknown): number {
  return (e as { response?: { status?: number } })?.response?.status
    ?? (e as { statusCode?: number }).statusCode ?? 0
}

// "I have a demo id": resume the same demo account on this device.
const showResume = ref(false)
const resumeCode = ref('')
async function resumeWithCode() {
  error.value = null
  loading.value = 'demo'
  try {
    await resumeDemo(resumeCode.value)
    demoCookie.value = null
    await navigateTo(redirectTo.value)
  } catch (e: unknown) {
    const s = statusOf(e)
    error.value = s === 404
      ? 'No active demo has this id. It may have been deleted after 30 days without a visit, or claimed with an email.'
      : s === 429 ? 'Too many attempts. Please wait a minute and try again.'
        : "Can't reach the Strades server right now. Please try again in a moment."
  } finally {
    loading.value = null
  }
}

// Shown once after a new demo is created: the id to write down, then continue.
const newCode = ref<string | null>(null)
const copied = ref(false)
async function copyCode() {
  if (!newCode.value) return
  try { await navigator.clipboard.writeText(newCode.value); copied.value = true } catch { copied.value = false }
}
const hasSavedDemo = ref(false)
onMounted(() => { hasSavedDemo.value = !!storedDemoCode() })

const FEATURES = [
  { title: 'Every platform, one wallet', text: 'Binance, Coinbase, IBKR and more in a single view.' },
  { title: 'Paper-trade any idea', text: 'Test a move as a share of your wallet, with no money at risk.' },
  { title: 'Trade with a swarm', text: 'Plug AI agents and your circle into your strategies.' },
]
</script>

<template>
  <main class="auth-page">
    <div class="glow glow-up" aria-hidden="true" />
    <div class="glow glow-down" aria-hidden="true" />

    <div class="auth-layout">
      <!-- Brand: logo + company name. On phones it shrinks to a compact header above the form. -->
      <section class="brand" aria-label="Strades">
        <img class="mark" src="/brand/strades-mark-metal.png" alt="" width="250" height="250" />
        <h1 class="wordmark">
          <img src="/brand/strades-wordmark.png" alt="Strades" width="720" height="99" />
        </h1>
        <p class="tagline">The trading hub where people and their AI&nbsp;agents predict better together.</p>
        <ul class="features">
          <li v-for="f in FEATURES" :key="f.title">
            <span class="tick" aria-hidden="true" />
            <span><strong>{{ f.title }}</strong> {{ f.text }}</span>
          </li>
        </ul>
      </section>

      <section class="card" :aria-label="mode === 'login' ? 'Sign in' : 'Create an account'">
        <div class="tabs" role="group" aria-label="Account">
          <button
            type="button" class="tab" :class="{ on: mode === 'login' }"
            :aria-pressed="mode === 'login'" @click="setMode('login')"
          >Sign in</button>
          <button
            type="button" class="tab" :class="{ on: mode === 'register' }"
            :aria-pressed="mode === 'register'" @click="setMode('register')"
          >Create account</button>
          <span class="tab-thumb" :class="mode" aria-hidden="true" />
        </div>

        <h2 class="card-title">{{ mode === 'login' ? 'Welcome back' : 'Get started' }}</h2>

        <form class="form" @submit.prevent="submit">
          <div v-if="mode === 'register'" class="row">
            <label class="field">
              <span>First name</span>
              <input v-model="firstName" type="text" autocomplete="given-name" />
            </label>
            <label class="field">
              <span>Last name</span>
              <input v-model="lastName" type="text" autocomplete="family-name" />
            </label>
          </div>

          <label class="field">
            <span>Email</span>
            <input v-model="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required />
          </label>

          <label class="field">
            <span>Password</span>
            <span class="pw">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                :placeholder="mode === 'register' ? 'At least 6 characters' : ''"
                required
                minlength="6"
              />
              <button
                type="button" class="pw-toggle" :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :aria-pressed="showPassword" @click="showPassword = !showPassword"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  <path v-if="showPassword" d="M4 4l16 16" />
                </svg>
              </button>
            </span>
          </label>

          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <button type="submit" class="btn primary" :disabled="!!loading">
            <span v-if="loading === 'form'" class="spinner" aria-hidden="true" />
            {{ loading === 'form' ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create free account' }}
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <!-- New demo: show the id once, then continue. -->
        <div v-if="newCode" class="demo-id" role="status">
          <p class="demo-id-title">Your demo ID</p>
          <p class="demo-id-code" data-testid="demo-code">{{ newCode }}</p>
          <p class="hint">Write it down: it brings this demo back on any device. It is also saved on this one.</p>
          <div class="demo-id-actions">
            <button type="button" class="btn ghost" @click="copyCode">{{ copied ? 'Copied' : 'Copy ID' }}</button>
            <button type="button" class="btn primary" @click="navigateTo(redirectTo)">Continue</button>
          </div>
        </div>

        <template v-else>
          <button type="button" class="btn ghost" :disabled="!!loading" @click="enterDemoMode">
            <span v-if="loading === 'demo'" class="spinner" aria-hidden="true" />
            {{ hasSavedDemo ? 'Continue my demo' : 'Continue in demo mode' }}
          </button>
          <button type="button" class="link" :aria-expanded="showResume" @click="showResume = !showResume">
            I have a demo ID
          </button>
          <form v-if="showResume" class="resume" @submit.prevent="resumeWithCode">
            <input
              v-model="resumeCode" type="text" autocomplete="off" spellcheck="false" aria-label="Demo ID"
              placeholder="STRD-XXXX-XXXX-XXXX-XXXX" required
            />
            <button type="submit" class="btn ghost" :disabled="!!loading || resumeCode.trim().length < 16">Resume</button>
          </form>
          <p class="hint">
            No sign-up. Your demo is kept while you use it and deleted after 30&nbsp;days without a visit.
            Paper wallets only.
          </p>
        </template>
      </section>
    </div>

    <footer class="foot">
      <NuxtLink to="/about">About</NuxtLink>
      <span aria-hidden="true">·</span>
      <NuxtLink to="/contact">Contact</NuxtLink>
      <span aria-hidden="true">·</span>
      <span>© {{ new Date().getFullYear() }} Strades</span>
    </footer>
  </main>
</template>

<style scoped>
/* Designed dark on purpose (white text, glass fills): never inherit the light colour mode. */
.auth-page {
  --up: var(--primary-green, #00ff88);
  --sky: var(--primary-blue, #00aaff);
  --down: var(--error-red, #ff4444);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  box-sizing: border-box;
  min-height: 100dvh;
  padding: max(1.25rem, env(safe-area-inset-top)) 1.25rem max(1rem, env(safe-area-inset-bottom));
  overflow: hidden;
  background: #05070a;
  color: #fff;
  color-scheme: dark;
  font-family: var(--font-family-primary, 'Poppins'), sans-serif;
}

/* The logo's own colours, as two soft lights behind everything (static, no animation). */
.glow {
  position: absolute;
  width: 60vmax;
  height: 60vmax;
  border-radius: 50%;
  filter: blur(10px);
  pointer-events: none;
}
.glow-up { top: -32vmax; right: -24vmax; background: radial-gradient(circle, rgba(0, 255, 136, 0.16), transparent 62%); }
.glow-down { bottom: -34vmax; left: -26vmax; background: radial-gradient(circle, rgba(255, 68, 68, 0.12), transparent 62%); }

.auth-layout {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  width: 100%;
  max-width: 26rem;
}

/* ── Brand ─────────────────────────────────────────────────────────── */
.brand { display: flex; flex-direction: column; align-items: center; text-align: center; }
.mark {
  width: 3.75rem;
  height: 3.75rem;
  filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.18));
  animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.wordmark { margin: 0.75rem 0 0; line-height: 0; }
.wordmark img { width: 10rem; height: auto; animation: rise 0.6s 0.06s cubic-bezier(0.22, 1, 0.36, 1) both; }
.tagline {
  max-width: 22rem;
  margin: 0.6rem 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.86rem;
  line-height: 1.5;
}
.features { display: none; }

@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ── Card ──────────────────────────────────────────────────────────── */
.card {
  padding: 1.5rem 1.4rem 1.4rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, rgba(28, 31, 38, 0.78), rgba(16, 18, 23, 0.86));
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: rise 0.6s 0.12s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.tab {
  position: relative;
  z-index: 1;
  padding: 0.6rem 0.5rem;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}
.tab.on { color: #fff; }
.tab-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.11);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.tab-thumb.register { transform: translateX(100%); }

.card-title { margin: 1.1rem 0 0.9rem; font-size: 1.15rem; font-weight: 600; letter-spacing: 0.01em; }

.form { display: flex; flex-direction: column; gap: 0.85rem; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
.field > span:first-child { font-size: 0.78rem; font-weight: 500; color: rgba(255, 255, 255, 0.7); }

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.78rem 0.9rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font: inherit;
  font-size: 1rem; /* ≥16 px: iOS does not zoom into the field */
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}
input::placeholder { color: rgba(255, 255, 255, 0.42); }
input:hover { border-color: rgba(255, 255, 255, 0.2); }
input:focus { outline: none; border-color: rgba(0, 170, 255, 0.7); background: rgba(255, 255, 255, 0.07); box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.18); }

.pw { position: relative; display: flex; }
.pw input { padding-right: 3.2rem; }
.pw-toggle {
  position: absolute;
  top: 50%;
  right: 0.3rem;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}
.pw-toggle:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }

.error {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 68, 68, 0.35);
  background: rgba(255, 68, 68, 0.08);
  color: #ff8a8a;
  font-size: 0.85rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 2.9rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}
.btn:disabled { opacity: 0.6; cursor: wait; }
/* The logo's green (its "up" arrow) is the one call-to-action colour on the page. */
.btn.primary {
  margin-top: 0.3rem;
  border: 0;
  background: linear-gradient(180deg, #2bff9f, #00d977);
  color: #03130b;
  box-shadow: 0 6px 20px rgba(0, 230, 130, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.btn.primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
/* Secondary action: must read quieter than "Sign in". */
.btn.ghost { border: 1px solid rgba(255, 255, 255, 0.16); background: transparent; color: rgba(255, 255, 255, 0.85); }
.btn.ghost:hover:not(:disabled) { border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.04); }
.btn:active:not(:disabled) { transform: scale(0.98); }

.tab:focus-visible, .btn:focus-visible, .pw-toggle:focus-visible, .foot a:focus-visible {
  outline: 2px solid var(--sky);
  outline-offset: 2px;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.divider { display: flex; align-items: center; margin: 1.15rem 0 0.9rem; color: rgba(255, 255, 255, 0.4); font-size: 0.8rem; }
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.divider span { padding: 0 0.75rem; }

.hint { margin: 0.7rem 0 0; text-align: center; font-size: 0.78rem; line-height: 1.45; color: rgba(255, 255, 255, 0.62); }

/* Demo id: shown once after creation; resume form for an id from another device */
.link {
  display: block; margin: 0.6rem auto 0; padding: 0.2rem 0.4rem; border: 0; background: none; cursor: pointer;
  color: var(--sky); font: inherit; font-size: 0.82rem; text-decoration: underline; text-underline-offset: 3px;
}
.resume { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
.resume input {
  flex: 1; min-width: 0; padding: 0.6rem 0.7rem; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04); color: #fff; font: inherit; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase;
}
.resume .btn { width: auto; flex: none; }
.demo-id { text-align: center; padding: 0.9rem; border-radius: 12px; border: 1px solid rgba(0, 255, 136, 0.35); background: rgba(0, 255, 136, 0.06); }
.demo-id-title { margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.7); }
.demo-id-code {
  margin: 0.45rem 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: clamp(0.95rem, 4.2vw, 1.15rem);
  font-weight: 700; letter-spacing: 0.06em; color: var(--up); word-break: break-all; user-select: all;
}
.demo-id-actions { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
.demo-id-actions .btn { flex: 1; }

.foot {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
}
.foot a { color: rgba(255, 255, 255, 0.72); text-decoration: none; }
.foot a:hover { color: #fff; }

/* ── Wide screens: brand panel on the left, form on the right ──────── */
@media (min-width: 960px) {
  .auth-layout {
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: 4.5rem;
    max-width: 62rem;
  }
  .brand { align-items: flex-start; text-align: left; }
  .mark { width: 6rem; height: 6rem; }
  .wordmark { margin-top: 1.4rem; }
  .wordmark img { width: 14rem; }
  .tagline { margin-top: 1.1rem; font-size: 1.05rem; }
  .features {
    display: grid;
    gap: 0.9rem;
    margin: 2rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.62);
  }
  .features li { display: flex; gap: 0.75rem; align-items: baseline; }
  .features strong { color: #fff; font-weight: 600; }
  .tick {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--up);
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.6);
    transform: translateY(-0.1rem);
  }
  .card { padding: 2rem 1.9rem 1.75rem; }
}

/* Short phones in landscape: drop the tagline so the form fits. */
@media (max-height: 560px) and (max-width: 959px) {
  .tagline { display: none; }
  .mark { width: 3rem; height: 3rem; }
}

@media (prefers-reduced-motion: reduce) {
  .mark, .wordmark img, .card { animation: none; }
  .tab-thumb, .btn, input, .tab { transition: none; }
}
</style>
