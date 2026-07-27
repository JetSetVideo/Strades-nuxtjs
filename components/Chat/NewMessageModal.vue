<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore, type Participant } from '~/stores/chat'
import { useUsersStore } from '~/stores/users'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const chatStore = useChatStore()
const usersStore = useUsersStore()
const { getUserId } = useCurrentUser()

const search = ref('')
const selected = ref<string[]>([])
const firstMessage = ref('')

const candidates = computed(() => {
  const me = getUserId()
  const q = search.value.trim().toLowerCase()
  return usersStore.users
    .filter(u => u.id !== me)
    .filter(u => !q ||
      u.username.toLowerCase().includes(q) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q))
    .slice(0, 30)
})

const toggle = (id: string) => {
  const i = selected.value.indexOf(id)
  if (i > -1) selected.value.splice(i, 1)
  else selected.value.push(id)
}

const canSend = computed(() => selected.value.length > 0 && firstMessage.value.trim().length > 0)

const close = () => emit('update:open', false)

const send = async () => {
  if (!canSend.value) return
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
  if (usersStore.users.length === 0) await usersStore.initializeStore()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
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

          <div v-if="selected.length" class="selected-row">
            <button
              v-for="id in selected"
              :key="id"
              class="sel-chip"
              :title="`Remove ${usersStore.getUserById(id)?.username ?? id}`"
              @click="toggle(id)"
            >
              <img :src="usersStore.getUserById(id)?.avatar_url || '/avatars/Ellipse5.png'" alt="">
              {{ usersStore.getUserById(id)?.username ?? id }}
              <span class="x">✕</span>
            </button>
          </div>

          <input
            v-model="search"
            class="search-input"
            type="text"
            placeholder="Search traders…"
          >

          <ul class="user-list">
            <li
              v-for="u in candidates"
              :key="u.id"
              :class="['user-row', { picked: selected.includes(u.id) }]"
              @click="toggle(u.id)"
            >
              <img :src="u.avatar_url || '/avatars/Ellipse5.png'" alt="" class="avatar">
              <div class="who">
                <span class="uname">{{ u.username }}</span>
                <span class="fname">{{ u.first_name }} {{ u.last_name }}</span>
              </div>
              <span class="pick-mark">{{ selected.includes(u.id) ? '✓' : '+' }}</span>
            </li>
            <li v-if="candidates.length === 0" class="empty">No traders match “{{ search }}”.</li>
          </ul>

          <textarea
            v-model="firstMessage"
            class="msg-input"
            rows="2"
            placeholder="First message…"
          />

          <footer class="foot">
            <span class="hint">
              {{ selected.length === 0 ? 'Pick one or more recipients'
                : selected.length === 1 ? 'Direct message'
                : `Group of ${selected.length}` }}
            </span>
            <button class="send" :disabled="!canSend" @click="send">Send</button>
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
</style>
