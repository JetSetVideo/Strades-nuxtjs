<script setup lang="ts">
import { ref } from 'vue'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

definePageMeta({ title: 'Contact', description: 'Talk to the Strades team.', layout: 'default' })

const form = ref({ name: '', email: '', topic: 'product', message: '' })
const sent = ref(false)
const sending = ref(false)

const topics = [
  { id: 'product',  label: 'Product feedback' },
  { id: 'bug',      label: 'Bug report' },
  { id: 'billing',  label: 'Billing' },
  { id: 'security', label: 'Security disclosure' },
  { id: 'press',    label: 'Press / partnerships' }
]

async function submit() {
  sending.value = true
  await new Promise(r => setTimeout(r, 600))
  sending.value = false
  sent.value = true
}
</script>

<template>
  <div class="contact-page">
    <UIPageHeader title="Contact" subtitle="We read every message. Most replies go out the same day.">
      <template #actions>
        <UIPill tone="success" show-dot>UP</UIPill>
      </template>
    </UIPageHeader>

    <div class="row two-col">
      <UICard title="Send us a note">
        <form v-if="!sent" class="contact-form" @submit.prevent="submit">
          <label class="field">
            <span class="field-label">Name</span>
            <input v-model="form.name" required class="ui-input" placeholder="Jane Doe" />
          </label>
          <label class="field">
            <span class="field-label">Email</span>
            <input v-model="form.email" type="email" required class="ui-input" placeholder="you@email.com" />
          </label>
          <label class="field">
            <span class="field-label">Topic</span>
            <select v-model="form.topic" class="ui-input">
              <option v-for="t in topics" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Message</span>
            <textarea
              v-model="form.message"
              required
              rows="6"
              class="ui-input ui-textarea"
              placeholder="What's on your mind?"
            />
          </label>
          <button type="submit" class="cta" :disabled="sending">
            {{ sending ? 'Sending…' : 'Send message' }}
          </button>
        </form>

        <div v-else class="thanks">
          <h3>Message sent.</h3>
          <p>Thanks for reaching out — someone from the team will get back to you shortly.</p>
        </div>
      </UICard>

      <UICard title="Other channels">
        <ul class="channels">
          <li>
            <span class="ch-label">Email</span>
            <a class="ch-value" href="mailto:hello@strades.app">hello@strades.app</a>
          </li>
          <li>
            <span class="ch-label">Security</span>
            <a class="ch-value" href="mailto:security@strades.app">security@strades.app</a>
          </li>
          <li>
            <span class="ch-label">Status</span>
            <a class="ch-value" href="https://status.strades.app" target="_blank" rel="noopener">status.strades.app</a>
          </li>
          <li>
            <span class="ch-label">Discord</span>
            <a class="ch-value" href="#" @click.prevent>discord.gg/strades</a>
          </li>
        </ul>
        <template #footer>
          <span class="muted">Security disclosures are PGP-encrypted on request.</span>
        </template>
      </UICard>
    </div>
  </div>
</template>

<style scoped>
.contact-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.75rem);
  min-width: 0;
}

.row { display: grid; gap: 0.75rem; align-items: stretch; min-width: 0; }
.row > * { min-width: 0; }
.row.two-col { grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.field-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.45);
}

.ui-input {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: var(--text-white, #fff);
  border-radius: var(--app-border-radius, 6px);
  padding: 0.5rem 0.65rem;
  font-size: 0.82rem;
  font-family: inherit;
  transition: border-color 0.18s ease, background 0.18s ease;
  box-sizing: border-box;
}
.ui-input:focus {
  outline: none;
  border-color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.04);
}
.ui-textarea { resize: vertical; line-height: 1.45; }

.cta {
  align-self: flex-start;
  background: var(--primary-gradient);
  color: #000;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: var(--app-border-radius, 6px);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.cta:hover:not(:disabled) { transform: translateY(-1px); }
.cta:disabled { opacity: 0.5; cursor: not-allowed; }

.thanks {
  text-align: center;
  padding: 1rem;
}
.thanks h3 {
  margin: 0;
  color: var(--primary-green, #00ff88);
  font-size: 1rem;
  letter-spacing: 0.02em;
}
.thanks p {
  margin: 0.5rem 0 0 0;
  color: rgba(255,255,255,0.6);
  font-size: 0.78rem;
  line-height: 1.5;
}

.channels {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.channels li {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 0.6rem;
  align-items: baseline;
  padding: 0.45rem 0.5rem;
  border-radius: 5px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
}
.ch-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.45);
}
.ch-value {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--primary-green, #00ff88);
  text-decoration: none;
  word-break: break-all;
}
.ch-value:hover { text-decoration: underline; }

.muted {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
}
</style>
