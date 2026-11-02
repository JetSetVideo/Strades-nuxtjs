<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore, describeChatError, type Participant } from '~/stores/chat'
import { useUsersStore } from '~/stores/users'
import { directCandidates, type ServerProfile } from '~/utils/chatMap'
import UISourceChip from '@/components/UI/SourceChip.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const chatStore = useChatStore()
const usersStore = useUsersStore()
const { getUserId } = useCurrentUser()
const { isAuthenticated } = useAuth()

const search = ref('')
const selected = ref<string[]>([])
const firstMessage = ref('')

// ── Signed in: a direct conversation on the server (start or reopen) ─────────
const profiles = ref<ServerProfile[]>([])
const profilesState = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
const busy = ref(false)
/** The server's refusal (403 "You can message friends, bots and …") or a network failure. */
const errorText = ref('')
/** Set when the chat opened but the first message failed: offer to open it anyway. */
const openedId = ref<string | null>(null)

async function loadProfiles() {
  if (!isAuthenticated.value || profilesState.value === 'loading' || profilesState.value === 'ok') return
  profilesState.value = 'loading'
  try {
    profiles.value = await chatStore.fetchProfiles()
    profilesState.value = 'ok'
  } catch (e) {
    console.warn('NewMessageModal: GET /api/v1/social/profiles/ failed', e)
    profilesState.value = 'error'
  }
}

interface PickRow { id: string; username: string; name: string; avatar: string; note: string }

const candidates = computed<PickRow[]>(() => {
  const me = getUserId()
  const q = search.value.trim().toLowerCase()
  if (isAuthenticated.value) {
    return directCandidates(chatStore.conversations, profiles.value, me, q).map(c => ({
      id: c.user_id, username: c.username, name: c.full_name, avatar: c.avatar_url, note: c.note,
    }))
  }
  return usersStore.users
    .filter(u => u.id !== me)
    .filter(u => !q ||
      u.username.toLowerCase().includes(q) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q))
    .slice(0, 30)
    .map(u => ({ id: u.id, username: u.username, name: `${u.first_name} ${u.last_name}`.trim(), avatar: u.avatar_url, note: '' }))
})

const rowOf = (id: string) => candidates.value.find(c => c.id === id)
  ?? (() => { const u = usersStore.getUserById(id); return u ? { username: u.username, avatar: u.avatar_url } : null })()

const toggle = (id: string) => {
  errorText.value = ''
  openedId.value = null
  const i = selected.value.indexOf(id)
  if (i > -1) selected.value.splice(i, 1)
  // The server starts DIRECT conversations only: one recipient when signed in.
  else if (isAuthenticated.value) selected.value = [id]
  else selected.value.push(id)
}

const canSend = computed(() => !busy.value && selected.value.length > 0 &&
  (isAuthenticated.value || firstMessage.value.trim().length > 0))

const close = () => emit('update:open', false)

function reset() {
  selected.value = []
  firstMessage.value = ''
  search.value = ''
  errorText.value = ''
  openedId.value = null
}

function goTo(id: string) {
  reset()
  close()
  navigateTo(`/conversations/${id}`)
}

async function sendServer() {
  const userId = selected.value[0]
  if (!userId) return
  busy.value = true
  errorText.value = ''
  openedId.value = null
  try {
    const conv = await chatStore.startDirectConversation(userId)
    const text = firstMessage.value.trim()
    if (text) {
      try {
        await chatStore.sendMessageRemote(conv.id, text)
      } catch (e) {
        console.warn('NewMessageModal: first message failed', e)
        openedId.value = conv.id
        errorText.value = `The chat is open, but your first message was not. ${describeChatError('send', e)} Your text is kept.`
        return
      }
    }
    goTo(conv.id)
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const send = async () => {
  if (!canSend.value) return
  if (isAuthenticated.value) return sendServer()
  // ── Signed out: sample mode, the conversation lives in this tab only ──
  const me = getUserId()
  const participantIds = [me, ...selected.value]

  const toParticipant = (id: string): Participant => {
    const u = usersStore.getUserById(id)
    return {
      user_id: id,
      username: u?.username ?? id,
      full_name: u ? `${u.first_name} ${u.last_name}`.trim() : id,
      avatar_url: u?.avatar_url ?? '/avatars/Ellipse5.png',
      is_online: false,
      unread_count: 0
    }
  }

  const isGroup = selected.value.length > 1
  const conv = chatStore.createConversation({
    participants: participantIds,
    participantDetails: participantIds.map(toParticipant),
    type: isGroup ? 'group' : 'direct',
    title: isGroup
      ? selected.value.map(id => usersStore.getUserById(id)?.username ?? id).join(', ')
      : null,
    description: '',
    created_by: me,
    is_active: true,
    unread_count: 0,
    // Local to this tab: the people come from the sample directory and the server has no
    // "create conversation" endpoint yet, so the list chips it Sample.
    source: 'sample',
    metadata: { topic: firstMessage.value.trim().slice(0, 60) }
  })

  const meUser = usersStore.getUserById(me)
  const content = firstMessage.value.trim()
  chatStore.sendMessage({
    conversation_id: conv.id,
    sender_id: me,
    sender_username: meUser?.username ?? me,
    sender_full_name: meUser ? `${meUser.first_name} ${meUser.last_name}`.trim() : me,
    sender_avatar_url: meUser?.avatar_url ?? '/avatars/Ellipse5.png',
    recipient_ids: selected.value,
    content,
    message_type: 'text',
    content_type: 'text',
    created_at: new Date().toISOString(),
    is_deleted: false,
    reply_to: null,
    reply_to_id: null,
    reply_to_preview: null,
    attachment_url: '',
    attachment_name: '',
    attachments: [],
    reactions: [],
    metadata: { character_count: content.length, mentions: [], hashtags: [] }
  })

  selected.value = []
  firstMessage.value = ''
  search.value = ''
  close()
  navigateTo(`/conversations/${conv.id}`)
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) close()
}
onMounted(async () => {
  window.addEventListener('keydown', onKey)
  if (props.open) void onOpen()
  if (usersStore.users.length === 0) await usersStore.initializeStore()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

async function onOpen() {
  if (!isAuthenticated.value) return
  // People from the user's own conversations are listed first: make sure the list is loaded.
  await Promise.allSettled([chatStore.ensureLoaded(), loadProfiles()])
}

watch(() => props.open, (v) => {
  if (v) void onOpen()
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
// Signing in or out swaps who can be picked (server people ↔ sample traders).
watch(isAuthenticated, () => {
  selected.value = []
  errorText.value = ''
  openedId.value = null
  profilesState.value = 'idle'
  profiles.value = []
  if (props.open) void onOpen()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="nm-fade">
      <div v-if="open" class="nm-backdrop" @click="close">
        <div class="nm-modal" role="dialog" aria-label="New message" @click.stop>
          <header class="head">
            <h3>New message</h3>
            <button class="close" aria-label="Close" @click="close">✕</button>
          </header>

          <p v-if="!isAuthenticated" class="mode-note">
            <UISourceChip source="sample" note="Signed out: sample traders. The conversation stays in this tab and is not saved." />
            Sample mode — the conversation stays in this tab. <NuxtLink to="/auth?redirect=/chat" @click="close">Sign in</NuxtLink> to message real people.
          </p>
          <p v-else class="mode-note">
            Direct message, saved to your account. You can message friends, bots and people you share a room with.
          </p>

          <div v-if="selected.length" class="selected-row">
            <button
              v-for="id in selected"
              :key="id"
              class="sel-chip"
              :title="`Remove ${rowOf(id)?.username ?? id}`"
              @click="toggle(id)"
            >
              <img :src="rowOf(id)?.avatar || '/avatars/Ellipse5.png'" alt="">
              {{ rowOf(id)?.username ?? id }}
              <span class="x">✕</span>
            </button>
          </div>

          <input
            v-model="search"
            class="search-input"
            type="text"
            :placeholder="isAuthenticated ? 'Search people…' : 'Search sample traders…'"
            aria-label="Search people"
          >

          <ul class="user-list" :aria-busy="profilesState === 'loading'">
            <li
              v-for="u in candidates"
              :key="u.id"
              :class="['user-row', { picked: selected.includes(u.id) }]"
              role="button"
              tabindex="0"
              :aria-pressed="selected.includes(u.id)"
              @click="toggle(u.id)"
              @keydown.enter.prevent="toggle(u.id)"
              @keydown.space.prevent="toggle(u.id)"
            >
              <img :src="u.avatar || '/avatars/Ellipse5.png'" alt="" class="avatar">
              <div class="who">
                <span class="uname">{{ u.username }}</span>
                <span class="fname">{{ u.name }}<template v-if="u.note"> · {{ u.note }}</template></span>
              </div>
              <span class="pick-mark">{{ selected.includes(u.id) ? '✓' : '+' }}</span>
            </li>
            <li v-if="isAuthenticated && profilesState === 'loading'" class="empty">Loading people…</li>
            <li v-else-if="candidates.length === 0" class="empty">
              {{ search ? `No one matches “${search}”.` : 'No people to show yet.' }}
            </li>
            <li v-if="isAuthenticated && profilesState === 'error'" class="empty warn">
              The people directory did not load; people from your conversations are still listed.
              <button type="button" class="link-btn" @click="profilesState = 'idle'; loadProfiles()">Retry</button>
            </li>
          </ul>

          <textarea
            v-model="firstMessage"
            class="msg-input"
            rows="2"
            :placeholder="isAuthenticated ? 'First message (optional)…' : 'First message…'"
            aria-label="First message"
          />

          <p v-if="errorText" class="error" role="alert">
            {{ errorText }}
            <button v-if="openedId" type="button" class="link-btn" @click="goTo(openedId)">Open the chat</button>
          </p>

          <footer class="foot">
            <span class="hint">
              {{ selected.length === 0 ? (isAuthenticated ? 'Pick one person' : 'Pick one or more recipients')
                : selected.length === 1 ? 'Direct message'
                : `Group of ${selected.length} (sample, this tab only)` }}
            </span>
            <button class="send" :disabled="!canSend" @click="send">
              {{ busy ? 'Opening…' : isAuthenticated && !firstMessage.trim() ? 'Open chat' : 'Send' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(5px);
  z-index: 220;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem;
}
.nm-modal {
  width: min(480px, 100%);
  max-height: 80vh;
  background: linear-gradient(180deg, rgba(18,20,26,0.98), rgba(10,12,16,0.98));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.65);
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.head { display: flex; justify-content: space-between; align-items: center; }
.head h3 {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
}
.close {
  background: rgba(255,255,255,0.05);
  border: none;
  color: rgba(255,255,255,0.65);
  width: 1.6rem; height: 1.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}
.close:hover { color: #fff; background: rgba(255,255,255,0.12); }

.selected-row { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.sel-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(0,170,255,0.1);
  border: 1px solid rgba(0,170,255,0.35);
  color: var(--primary-blue, #00aaff);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem 0.15rem 0.15rem;
  border-radius: 999px;
  cursor: pointer;
}
.sel-chip img { width: 1.1rem; height: 1.1rem; border-radius: 50%; object-fit: cover; }
.sel-chip .x { font-size: 0.55rem; opacity: 0.7; }

.search-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.92);
  font: inherit;
  font-size: 0.8rem;
  padding: 0.45rem 0.65rem;
  outline: none;
}
.search-input:focus { border-color: var(--primary-blue, #00aaff); }

.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  max-height: 34vh;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.45rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.user-row:hover { background: rgba(255,255,255,0.04); }
.user-row.picked { background: rgba(0,170,255,0.08); }
.avatar { width: 1.9rem; height: 1.9rem; border-radius: 50%; object-fit: cover; }
.who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.uname { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.9); }
.fname {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-mark {
  width: 1.3rem; height: 1.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.5);
  font-size: 0.7rem;
  flex-shrink: 0;
}
.user-row.picked .pick-mark {
  border-color: var(--primary-blue, #00aaff);
  color: var(--primary-blue, #00aaff);
  background: rgba(0,170,255,0.12);
}
.empty {
  padding: 0.8rem;
  text-align: center;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.4);
}

.msg-input {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.92);
  font: inherit;
  font-size: 0.8rem;
  padding: 0.45rem 0.65rem;
  outline: none;
}
.msg-input:focus { border-color: var(--primary-blue, #00aaff); }

.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 0.6rem;
}
.hint { font-size: 0.62rem; color: rgba(255,255,255,0.4); letter-spacing: 0.04em; }
.send {
  background: linear-gradient(135deg, rgba(0,170,255,0.9), rgba(0,120,220,0.9));
  border: none;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.4rem 1.1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.send:hover:not(:disabled) { box-shadow: 0 0 12px rgba(0,170,255,0.4); transform: translateY(-1px); }
.send:disabled { opacity: 0.35; cursor: not-allowed; }

.nm-fade-enter-from, .nm-fade-leave-to { opacity: 0; }
.nm-fade-enter-active, .nm-fade-leave-active { transition: opacity 0.18s ease; }

.mode-note {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.4;
  color: rgba(255,255,255,0.55);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}
.mode-note a { color: var(--primary-blue, #00aaff); }
.user-row:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }
.empty.warn { color: var(--error-red, #ff5a5a); }
.error {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.4;
  color: var(--error-red, #ff5a5a);
}
.link-btn {
  background: none;
  border: none;
  padding: 0 0.2rem;
  color: var(--primary-blue, #00aaff);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.link-btn:focus-visible, .send:focus-visible, .close:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .nm-fade-enter-active, .nm-fade-leave-active, .user-row, .send { transition: none; }
  .send:hover:not(:disabled) { transform: none; }
}
</style>
