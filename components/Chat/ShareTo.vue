<script setup lang="ts">
/**
 * C9 — "Share to chat" button: <ChatShareTo :item="{ kind, id, title, url }" />.
 * Opens the New message picker with the object prefilled (friends, bots, rooms — never raw ids) and sends it as a
 * C4 `share` message (an older server gets the link line). Signed out: a sign-in link instead.
 */
import { ref } from 'vue'
import type { ShareItem } from '~/utils/chatMap'
import ChatNewMessageModal from '@/components/Chat/NewMessageModal.vue'

const props = withDefaults(defineProps<{
  item: ShareItem
  /** Button text. */
  label?: string
  compact?: boolean
  /** Use the host's button style instead of the pill (e.g. a news card's social row). */
  buttonClass?: string
}>(), { label: 'Share', compact: false, buttonClass: '' })
const emit = defineEmits<{ (e: 'shared', n: number): void }>()

const { isAuthenticated } = useAuth()
const route = useRoute()
const open = ref(false)
const done = ref(0)

function onShared(n: number) {
  done.value = n
  emit('shared', n)
}
</script>

<template>
  <span class="chat-share-to" @click.stop>
    <button
      v-if="isAuthenticated"
      type="button"
      :class="buttonClass || ['share-to-btn', { compact }]"
      :aria-label="`Share “${props.item.title}” to chat`"
      :title="done ? `Shared to ${done}` : 'Send it to friends, bots or rooms'"
      @click="open = true"
    >⇪ {{ label }}<template v-if="done"> ✓</template></button>
    <NuxtLink
      v-else
      :to="`/auth?redirect=${encodeURIComponent(route.fullPath)}`"
      :class="buttonClass || ['share-to-btn', { compact }]"
      title="Sign in to share to chat"
    >⇪ {{ label }}</NuxtLink>
    <ChatNewMessageModal
      v-if="isAuthenticated"
      :open="open"
      :share="props.item"
      @update:open="open = $event"
      @shared="onShared"
    />
  </span>
</template>

<style scoped>
.chat-share-to { display: inline-flex; }
.share-to-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.8);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  transition: all 0.15s ease;
}
.share-to-btn.compact { padding: 0.15rem 0.45rem; font-size: 0.58rem; }
.share-to-btn:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}
</style>
