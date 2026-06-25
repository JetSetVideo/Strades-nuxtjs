<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useCommunityStore, type CommunityUser } from '~/stores/community'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'pick', userId: string): void
}>()

const community = useCommunityStore()
const q = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)

watch(() => props.open, async (v) => {
  if (v) {
    q.value = ''
    activeIndex.value = 0
    if (!community.hydrated) await community.fetchCommunity()
    await nextTick()
    inputRef.value?.focus()
  }
})

const list = computed<CommunityUser[]>(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return community.list.sort((a, b) => Number(b.is_friend) - Number(a.is_friend))
  return community.list.filter(u =>
    u.username.toLowerCase().includes(term) ||
    u.specialization.some(s => s.includes(term)) ||
    u.trading_style.toLowerCase().includes(term)
  )
})

const close = () => emit('update:open', false)
const pick = (u: CommunityUser) => {
  emit('pick', u.id)
  close()
}

const onKey = (e: KeyboardEvent) => {
  if (!props.open) return
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = (activeIndex.value + 1) % Math.max(1, list.value.length) }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = (activeIndex.value - 1 + list.value.length) % Math.max(1, list.value.length) }
  if (e.key === 'Enter') {
    e.preventDefault()
    const u = list.value[activeIndex.value]
    if (u) pick(u)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Body scroll lock
watch(() => props.open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="backdrop" @click="close">
        <div class="modal" role="dialog" aria-label="New discussion" @click.stop>
          <header class="head">
            <h3>Start a new discussion</h3>
            <button class="close" @click="close" aria-label="Close">✕</button>
          </header>

          <div class="search-row">
            <input
              ref="inputRef"
              v-model="q"
              type="text"
              placeholder="Search by name, specialization, style…"
              class="search-input"
              spellcheck="false"
              autocomplete="off"
            />
          </div>

          <ul v-if="list.length" class="list">
            <li
              v-for="(u, i) in list"
              :key="u.id"
              :class="['row', { active: i === activeIndex, friend: u.is_friend }]"
              @mouseenter="activeIndex = i"
              @click="pick(u)"
            >
              <img :src="u.avatar_url" :alt="u.username" class="avatar" />
              <div class="body">
                <div class="name-row">
                  <strong>{{ u.username }}</strong>
                  <span v-if="u.is_friend" class="friend-pill">FRIEND</span>
                  <span v-else class="match-pill">{{ Math.round(u.match_score * 100) }}% match</span>
                </div>
                <div class="meta">
                  <span class="bio">{{ u.bio }}</span>
                  <span class="specs">
                    <span v-for="s in u.specialization" :key="s" :class="['spec', `spec-${s}`]">{{ s }}</span>
                  </span>
                </div>
              </div>
              <span class="arrow">↵</span>
            </li>
          </ul>
          <div v-else class="empty">No one matches "<strong>{{ q }}</strong>"</div>

          <footer class="foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>ESC</kbd> close</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 7vh 1rem 1rem 1rem;
}

.modal {
  width: min(640px, 100%);
  background: linear-gradient(180deg, rgba(20,20,28,0.97), rgba(14,14,18,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.55);
  display: flex; flex-direction: column;
  overflow: hidden;
  max-height: 80vh;
}

.head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.7rem 0.95rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.head h3 {
  margin: 0; font-size: 0.85rem;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.75); font-weight: 600;
}
.close {
  background: rgba(255,255,255,0.06);
  border: none; color: rgba(255,255,255,0.7);
  width: 1.5rem; height: 1.5rem;
  border-radius: 4px; cursor: pointer; font-size: 0.7rem;
}
.close:hover { color: #fff; background: rgba(255,255,255,0.12); }

.search-row {
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.search-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: #fff;
  font-size: 0.88rem;
  font-family: inherit;
}
.search-input:focus { outline: none; border-color: var(--primary-green, #00ff88); }

.list {
  list-style: none; margin: 0; padding: 0.3rem 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
  border-left: 2px solid transparent;
}
.row.active {
  background: rgba(0,255,136,0.06);
  border-left-color: var(--primary-green, #00ff88);
}
.row.active .arrow { opacity: 1; }
.avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.12); }
.body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; overflow: hidden; }
.name-row { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
.name-row strong { font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.friend-pill {
  font-size: 0.52rem; letter-spacing: 0.1em;
  background: rgba(0,255,136,0.12);
  color: var(--primary-green, #00ff88);
  padding: 1px 6px; border-radius: 999px;
  font-weight: 700;
}
.match-pill {
  font-size: 0.52rem; letter-spacing: 0.08em;
  background: rgba(0,170,255,0.12);
  color: var(--primary-blue, #00aaff);
  padding: 1px 6px; border-radius: 999px;
  font-weight: 700;
}
.meta { display: flex; gap: 0.5rem; align-items: center; min-width: 0; }
.bio {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.5);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.specs { display: inline-flex; gap: 0.2rem; flex-shrink: 0; }
.spec {
  font-size: 0.52rem; font-weight: 700;
  padding: 1px 5px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.spec-fiat { background: rgba(74,144,226,0.18); color: #4A90E2; }
.spec-crypto { background: rgba(245,166,35,0.18); color: #F5A623; }
.spec-stocks { background: rgba(126,211,33,0.18); color: #7ED321; }
.spec-commodities { background: rgba(248,231,28,0.18); color: #F8E71C; }
.arrow {
  opacity: 0;
  color: var(--primary-green, #00ff88);
  font-size: 0.85rem;
  transition: opacity 0.18s ease;
}

.empty { padding: 2rem 1rem; text-align: center; color: rgba(255,255,255,0.45); font-size: 0.85rem; }

.foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0.85rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 0.62rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.04em;
}
.foot kbd {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 3px;
  padding: 1px 5px;
  margin-right: 3px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.65);
}

.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }

@media (max-width: 480px) {
  .foot { display: none; }
}
</style>
