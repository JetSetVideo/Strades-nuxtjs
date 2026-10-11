<template>
  <div class="onb">
    <div class="tabs" role="tablist">
      <button :class="{ on: mode === 'create' }" role="tab" @click="switchMode('create')">Create a wallet</button>
      <button v-if="allowImport" :class="{ on: mode === 'import' }" role="tab" @click="switchMode('import')">Import a recovery phrase</button>
    </div>

    <!-- Step: show the new phrase once, then make the user prove they wrote it down -->
    <div v-if="reveal" class="reveal">
      <p class="warn">Write these 12 words down, in order, on paper. Strades will never show them again.</p>
      <ol class="words">
        <li v-for="(w, i) in reveal.words" :key="i"><span>{{ i + 1 }}</span>{{ w }}</li>
      </ol>
      <p>To continue, type the words at these positions:</p>
      <div class="confirm">
        <label v-for="(pos, i) in reveal.check" :key="pos">
          #{{ pos + 1 }}
          <input v-model="reveal.answers[i]" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </label>
      </div>
      <button class="primary" :disabled="!confirmed" @click="finishReveal">I've written them down</button>
    </div>

    <form v-else class="form" autocomplete="off" @submit.prevent="submit">
      <label>Label
        <input v-model="label" maxlength="80" placeholder="My trading wallet" />
      </label>

      <label v-if="mode === 'import'">Recovery phrase (12–24 words)
        <textarea
          v-model="phrase" rows="3" autocomplete="off" autocapitalize="off" autocorrect="off"
          spellcheck="false" data-lpignore="true" placeholder="word1 word2 word3 …"
        />
        <small>{{ wordCount }} words · sent once over the API, encrypted with your passphrase, never shown again.</small>
      </label>

      <label>Passphrase (min 12 characters, it encrypts the phrase)
        <input v-model="passphrase" type="password" autocomplete="new-password" minlength="12" />
      </label>
      <label>Confirm passphrase
        <input v-model="passphrase2" type="password" autocomplete="new-password" />
      </label>
      <label>Paper balance (USD)
        <input v-model="balance" type="number" min="1" max="1000000" step="any" inputmode="decimal" />
      </label>

      <p class="note">Paper mode: bots trade simulated dollars against real market prices. No funds move on-chain.</p>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="primary" type="submit" :disabled="!canSubmit || busy">
        {{ busy ? 'Encrypting…' : mode === 'create' ? 'Create wallet' : 'Import wallet' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { TradingApiError, useTradingApi, type TradingWallet } from '~/composables/useTradingApi'

const props = withDefaults(defineProps<{ allowImport?: boolean }>(), { allowImport: true })
const emit = defineEmits<{ ready: [wallet: TradingWallet] }>()
const api = useTradingApi()

const mode = ref<'create' | 'import'>('create')
const label = ref('')
const phrase = ref('')
const passphrase = ref('')
const passphrase2 = ref('')
const balance = ref('10000')
const busy = ref(false)
const error = ref('')
const reveal = ref<null | { wallet: TradingWallet; words: string[]; check: number[]; answers: string[] }>(null)

const wordCount = computed(() => phrase.value.trim().split(/\s+/).filter(Boolean).length)
const canSubmit = computed(() =>
  passphrase.value.length >= 12 &&
  passphrase.value === passphrase2.value &&
  (mode.value === 'create' || [12, 15, 18, 21, 24].includes(wordCount.value)))
const confirmed = computed(() => !!reveal.value && reveal.value.check.every(
  (pos, i) => (reveal.value!.answers[i] || '').trim().toLowerCase() === reveal.value!.words[pos]))

function wipeSecrets() {
  phrase.value = ''
  passphrase.value = ''
  passphrase2.value = ''
}

function switchMode(m: 'create' | 'import') {
  if (m === 'import' && !props.allowImport) return
  mode.value = m
  error.value = ''
  wipeSecrets()
}

function pickPositions(n: number, k: number) {
  const pool = [...Array(n).keys()]
  const out: number[] = []
  const rnd = new Uint32Array(k)
  crypto.getRandomValues(rnd)
  for (let i = 0; i < k; i++) out.push(pool.splice(rnd[i] % pool.length, 1)[0])
  return out.sort((a, b) => a - b)
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const body = { label: label.value, passphrase: passphrase.value, starting_balance_usd: String(balance.value) }
    if (mode.value === 'import') {
      const { wallet } = await api.importWallet({ ...body, mnemonic: phrase.value })
      wipeSecrets()
      emit('ready', wallet)
    } else {
      const res = await api.createWallet(body)
      wipeSecrets()
      const words = res.mnemonic.split(' ')
      reveal.value = { wallet: res.wallet, words, check: pickPositions(words.length, 3), answers: ['', '', ''] }
    }
  } catch (e) {
    error.value = e instanceof TradingApiError ? e.message : 'Something went wrong'
  } finally {
    busy.value = false
  }
}

function finishReveal() {
  const wallet = reveal.value!.wallet
  reveal.value = null // drop the words from memory/DOM
  emit('ready', wallet)
}

onBeforeUnmount(() => {
  wipeSecrets()
  reveal.value = null
})
</script>

<style scoped>
.onb { display: flex; flex-direction: column; gap: 1rem; }
.tabs { display: flex; gap: .5rem; }
.tabs button { flex: 1; padding: .6rem; border-radius: var(--radius-md, 8px); border: 1px solid var(--border-primary);
  background: var(--surface-sunken, transparent); color: var(--text-secondary); cursor: pointer; }
.tabs button.on { background: var(--surface-raised); color: var(--text-primary); border-color: var(--border-accent); }
.form { display: flex; flex-direction: column; gap: .75rem; }
label { display: flex; flex-direction: column; gap: .3rem; font-size: .85rem; color: var(--text-secondary); }
input, textarea { padding: .55rem .7rem; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-primary);
  background: var(--surface-sunken, var(--bg-secondary)); color: var(--text-primary); font: inherit; }
textarea { font-family: var(--font-market-data, monospace); resize: vertical; }
small, .note { font-size: .75rem; color: var(--text-secondary); }
.err { color: var(--app-color-down, #e5484d); font-size: .85rem; }
.warn { color: var(--app-color-down, #e5484d); font-weight: 600; }
.primary { padding: .7rem 1rem; border: 0; border-radius: var(--radius-md, 8px); background: var(--primary-blue, #3b82f6);
  color: #fff; font-weight: 600; cursor: pointer; }
.primary:disabled { opacity: .45; cursor: not-allowed; }
.words { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .4rem; padding: 0; list-style: none;
  font-family: var(--font-market-data, monospace); user-select: text; }
.words li { padding: .45rem .6rem; border: 1px solid var(--border-primary); border-radius: var(--radius-sm, 6px); }
.words span { opacity: .5; margin-right: .4rem; }
.confirm { display: flex; gap: .6rem; flex-wrap: wrap; }
.confirm label { flex: 1; min-width: 100px; }
.reveal { display: flex; flex-direction: column; gap: .8rem; }
</style>
