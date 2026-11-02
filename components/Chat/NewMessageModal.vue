<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore, describeChatError, type Participant } from '~/stores/chat'
import { useUsersStore } from '~/stores/users'
import { useCommunityStore } from '~/stores/community'
import { directCandidates, isServerUserId, quoteOf, shareUrl, type ServerProfile, type ShareItem } from '~/utils/chatMap'
import UISourceChip from '@/components/UI/SourceChip.vue'

const props = defineProps<{
  open: boolean
  /** Open with this person already picked (chat person cards, profile). */
  preselect?: string | null
  /** Share mode (C9 <ChatShareTo>): send this object to the people/rooms picked. */
  share?: ShareItem | null
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'shared', n: number): void }>()
const community = useCommunityStore()
const sharing = computed(() => !!props.share && isAuthenticated.value)
/** Rooms (server group conversations) a share can go to. */
const rooms = computed(() => chatStore.conversations
  .filter(c => c.source === 'server' && c.type === 'group')
  .filter(c => !search.value.trim() || (c.title ?? '').toLowerCase().includes(search.value.trim().toLowerCase()))
  .slice(0, 12))
const shareResults = ref<Array<{ label: string; ok: boolean; conversationId?: string; error?: string }>>([])

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

interface PickRow { id: string; username: string; name: string; avatar: string; note: string; blocked?: boolean }

const candidates = computed<PickRow[]>(() => {
  const me = getUserId()
  const q = search.value.trim().toLowerCase()
  if (isAuthenticated.value) {
    return directCandidates(chatStore.conversations, profiles.value, me, q).map(c => ({
      id: c.user_id, username: c.username, name: c.full_name, avatar: c.avatar_url, note: c.note,
      blocked: c.canMessage === false,
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

/** A greyed row (C2 can_message=false) that was clicked: offer "Add friend" instead of a 403. */
const blockedPick = ref<PickRow | null>(null)
const friendBusy = ref(false)

const toggle = (id: string) => {
  errorText.value = ''
  openedId.value = null
  blockedPick.value = null
  const row = candidates.value.find(c => c.id === id)
  const i = selected.value.indexOf(id)
  if (i > -1) { selected.value.splice(i, 1); return }
  if (row?.blocked) {
    blockedPick.value = row
    errorText.value = `Add ${row.username} as a friend first: you can message friends, bots and people you share a room with.`
    return
  }
  // The server starts DIRECT conversations only: one recipient when signed in (shares may go to several).
  if (isAuthenticated.value && !sharing.value) selected.value = [id]
  else selected.value.push(id)
}

async function addFriendThenPick() {
  const row = blockedPick.value
  if (!row || friendBusy.value) return
  friendBusy.value = true
  const res = await community.setFriendRemote(row.id, true)
  friendBusy.value = false
  if (res === 'ok') {
    profiles.value = profiles.value.map(p => p.user_id === row.id ? { ...p, can_message: true } : p)
    blockedPick.value = null
    errorText.value = ''
    if (sharing.value) selected.value.push(row.id)
    else selected.value = [row.id]
  } else if (res === 'missing') {
    errorText.value = 'Adding friends is coming soon. Meanwhile, message a bot or someone from your rooms.'
    blockedPick.value = null
  } else {
    errorText.value = community.friendErrors[row.id] ?? 'Friend request not saved.'
  }
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
  blockedPick.value = null
  shareResults.value = []
}

/** Rooms are picked with an `room:` prefix so they never collide with person ids. */
const roomLabel = (id: string) => chatStore.getConversationById(id.slice(5))?.title || 'Room'

async function sendShare() {
  if (!props.share || !selected.value.length) return
  busy.value = true
  errorText.value = ''
  try {
    const targets = selected.value.map(id => id.startsWith('room:')
      ? { kind: 'room' as const, id: id.slice(5), label: roomLabel(id) }
      : { kind: 'person' as const, id, label: rowOf(id)?.username ?? 'someone' })
    shareResults.value = await chatStore.shareToTargets(props.share, targets, firstMessage.value)
    const sent = shareResults.value.filter(r => r.ok).length
    if (sent) emit('shared', sent)
    if (sent === targets.length) { selected.value = []; firstMessage.value = '' }
    else selected.value = selected.value.filter((_, i) => !shareResults.value[i]?.ok)
  } finally {
    busy.value = false
  }
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
  if (sharing.value) return sendShare()
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
  applyPreselect()
  if (!isAuthenticated.value) return
  // People from the user's own conversations are listed first: make sure the list is loaded.
  await Promise.allSettled([chatStore.ensureLoaded(), loadProfiles()])
  // C2 can change (a new friend): refresh the directory each time the picker opens.
  if (profilesState.value === 'ok') { profilesState.value = 'idle'; void loadProfiles() }
}

function applyPreselect() {
  const id = props.preselect
  if (!id) return
  if (isAuthenticated.value && !isServerUserId(id)) {
    errorText.value = 'This trader is a sample profile and cannot receive messages. Pick someone from the list.'
    return
  }
  if (!selected.value.includes(id)) selected.value = sharing.value ? [...selected.value, id] : [id]
}

watch(() => props.open, (v) => {
  if (v) void onOpen()
  // Closing always forgets the pick, so the next opening starts clean (or with its own preselect).
  else reset()
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
        <div class="nm-modal" role="dialog" :aria-label="sharing ? 'Share to chat' : 'New message'" @click.stop>
          <header class="head">
            <h3>{{ sharing ? 'Share to chat' : 'New message' }}</h3>
            <button class="close" aria-label="Close" @click="close">✕</button>
          </header>

          <p v-if="!isAuthenticated" class="mode-note">
            <UISourceChip source="sample" note="Signed out: sample traders. The conversation stays in this tab and is not saved." />
            Sample mode — the conversation stays in this tab. <NuxtLink to="/auth?redirect=/chat" @click="close">Sign in</NuxtLink> to message real people.
          </p>
          <p v-else-if="sharing && share" class="mode-note share-note">
            📎 <strong>{{ quoteOf(share.title, 70) }}</strong> <span class="share-path">{{ shareUrl(share) }}</span><br>
            Pick people or rooms: each gets a message with a link card.
          </p>
          <p v-else class="mode-note">
            Direct message, saved to your account. You can message friends, bots and people you share a room with.
          </p>

          <div v-if="selected.length" class="selected-row">
            <button
              v-for="id in selected"
              :key="id"
              class="sel-chip"
              :title="`Remove ${id.startsWith('room:') ? roomLabel(id) : rowOf(id)?.username ?? 'this person'}`"
              @click="toggle(id)"
            >
              <img v-if="!id.startsWith('room:')" :src="rowOf(id)?.avatar || '/avatars/Ellipse5.png'" alt="">
              {{ id.startsWith('room:') ? `# ${roomLabel(id)}` : rowOf(id)?.username ?? 'Selected person' }}
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
            <template v-if="sharing && rooms.length">
              <li class="list-head">Rooms</li>
              <li
                v-for="c in rooms"
                :key="`room-${c.id}`"
                :class="['user-row', { picked: selected.includes(`room:${c.id}`) }]"
                role="button"
                tabindex="0"
                :aria-pressed="selected.includes(`room:${c.id}`)"
                @click="toggle(`room:${c.id}`)"
                @keydown.enter.prevent="toggle(`room:${c.id}`)"
              >
                <span class="avatar room-mark" aria-hidden="true">#</span>
                <div class="who">
                  <span class="uname">{{ c.title || 'Room' }}</span>
                  <span class="fname">{{ c.participants.length }} members</span>
                </div>
                <span class="pick-mark">{{ selected.includes(`room:${c.id}`) ? '✓' : '+' }}</span>
              </li>
              <li class="list-head">People</li>
            </template>
            <li
              v-for="u in candidates"
              :key="u.id"
              :class="['user-row', { picked: selected.includes(u.id), blocked: u.blocked }]"
              :title="u.blocked ? 'Add as friend first' : undefined"
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
            :placeholder="sharing ? 'Add a note (optional)…' : isAuthenticated ? 'First message (optional)…' : 'First message…'"
            aria-label="First message"
          />

          <p v-if="errorText" class="error" role="alert">
            {{ errorText }}
            <button v-if="openedId" type="button" class="link-btn" @click="goTo(openedId)">Open the chat</button>
            <button
              v-if="blockedPick && community.friendsRoute !== 'missing'"
              type="button"
              class="link-btn"
              :disabled="friendBusy"
              @click="addFriendThenPick"
            >{{ friendBusy ? 'Adding…' : `+ Add ${blockedPick.username} as friend` }}</button>
          </p>
          <ul v-if="shareResults.length" class="share-results" aria-live="polite">
            <li v-for="(res, i) in shareResults" :key="i" :class="res.ok ? 'ok' : 'fail'">
              {{ res.ok ? '✓' : '✕' }} {{ res.label }}<template v-if="!res.ok"> — {{ res.error }}</template>
              <button v-if="res.conversationId" type="button" class="link-btn" @click="goTo(res.conversationId)">Open</button>
            </li>
          </ul>

          <footer class="foot">
            <span class="hint">
              <template v-if="sharing">{{ selected.length === 0 ? 'Pick people or rooms' : `${selected.length} selected` }}</template>
              <template v-else>
              {{ selected.length === 0 ? (isAuthenticated ? 'Pick one person' : 'Pick one or more recipients')
                : selected.length === 1 ? 'Direct message'
                : `Group of ${selected.length} (sample, this tab only)` }}
              </template>
            </span>
            <button class="send" :disabled="!canSend" @click="send">
              {{ busy ? (sharing ? 'Sharing…' : 'Opening…') : sharing ? 'Share' : isAuthenticated && !firstMessage.trim() ? 'Open chat' : 'Send' }}
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
/* C2: people the server would refuse (can_message=false) stay visible, greyed, with the reason. */
.user-row.blocked { opacity: 0.45; }
.user-row.blocked .fname { color: rgba(255,255,255,0.7); }
.list-head {
  list-style: none;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  padding: 0.35rem 0.5rem 0.15rem;
}
.room-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.06);
}
.share-path { opacity: 0.55; font-size: 0.85em; }
.share-results { list-style: none; margin: 0.4rem 0 0; padding: 0; font-size: 0.75rem; }
.share-results li { padding: 0.15rem 0; }
.share-results .ok { color: var(--primary-green, #00ff88); }
.share-results .fail { color: #ff6b6b; }
</style>
