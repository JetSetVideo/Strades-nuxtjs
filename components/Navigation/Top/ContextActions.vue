<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePageAction } from '~/composables/usePageAction'

interface ContextAction {
  id: string
  label: string
  title: string
  icon: 'post' | 'message' | 'strategy' | 'deposit' | 'watch'
  tone: 'green' | 'blue' | 'amber'
  /** Either navigate somewhere… */
  to?: string
  /** …or dispatch a page action the current page listens to. */
  action?: string
}

const route = useRoute()
const { dispatch } = usePageAction()
const { playHover, playClick } = useNavSound()

/** Route prefix → contextual actions shown at the right of the top bar. */
const ACTIONS: Array<{ match: (path: string) => boolean; items: ContextAction[] }> = [
  {
    match: p => p.startsWith('/news') || p.startsWith('/articles'),
    items: [
      { id: 'news-post', label: 'Post', title: 'Publish a note to the feed', icon: 'post', tone: 'green', action: 'news:compose' }
    ]
  },
  {
    match: p => p.startsWith('/chat') || p.startsWith('/conversations'),
    items: [
      { id: 'chat-new', label: 'Message', title: 'Start a new conversation', icon: 'message', tone: 'blue', action: 'chat:new-message' }
    ]
  },
  {
    match: p => p.startsWith('/strategies'),
    items: [
      { id: 'strategy-new', label: 'Strategy', title: 'Create a new strategy', icon: 'strategy', tone: 'green', to: '/creator' }
    ]
  },
  {
    match: p => p.startsWith('/creator'),
    items: [
      { id: 'strategy-lab', label: 'Lab', title: 'Back to strategy lab', icon: 'watch', tone: 'blue', to: '/strategies' }
    ]
  },
  {
    match: p => p.startsWith('/wallet'),
    items: [
      { id: 'wallet-prices', label: 'Trade', title: 'Open live prices', icon: 'watch', tone: 'amber', to: '/prices' }
    ]
  },
  {
    match: p => p.startsWith('/prices') || p.startsWith('/assets'),
    items: [
      { id: 'prices-strategy', label: 'Strategy', title: 'Build a strategy on these assets', icon: 'strategy', tone: 'green', to: '/creator' }
    ]
  }
]

const actions = computed<ContextAction[]>(() => {
  const entry = ACTIONS.find(a => a.match(route.path))
  return entry?.items ?? []
})

const run = (a: ContextAction) => {
  playClick()
  if (a.action) dispatch(a.action)
  else if (a.to) navigateTo(a.to)
}
</script>

<template>
  <TransitionGroup name="ctx" tag="div" class="ctx-actions">
    <button
      v-for="a in actions"
      :key="a.id"
      :class="['ctx-btn', `tone-${a.tone}`]"
      :title="a.title"
      :aria-label="a.title"
      @mouseenter="playHover"
      @click="run(a)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- Post: pen over a line -->
        <template v-if="a.icon === 'post'">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </template>
        <!-- Message: bubble with plus -->
        <template v-else-if="a.icon === 'message'">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <line x1="12" y1="8.5" x2="12" y2="14.5" />
          <line x1="9" y1="11.5" x2="15" y2="11.5" />
        </template>
        <!-- Strategy: node graph with plus -->
        <template v-else-if="a.icon === 'strategy'">
          <circle cx="5.5" cy="6" r="2.2" />
          <circle cx="5.5" cy="18" r="2.2" />
          <circle cx="17" cy="12" r="3.2" />
          <path d="M7.6 6.9 14 10.6M7.6 17.1 14 13.4" />
          <line x1="17" y1="10.6" x2="17" y2="13.4" />
          <line x1="15.6" y1="12" x2="18.4" y2="12" />
        </template>
        <!-- Watch/trade: candles -->
        <template v-else>
          <line x1="7" y1="4" x2="7" y2="20" />
          <rect x="5" y="8" width="4" height="6" rx="0.8" fill="currentColor" stroke="none" />
          <line x1="16" y1="4" x2="16" y2="20" />
          <rect x="14" y="10" width="4" height="7" rx="0.8" fill="currentColor" stroke="none" />
        </template>
      </svg>
      <span class="ctx-label">{{ a.label }}</span>
    </button>
  </TransitionGroup>
</template>

<style scoped>
.ctx-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.ctx-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: var(--nav-icon-btn-size, 2rem);
  padding: 0 0.6rem;
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid;
  cursor: pointer;
  font-family: var(--font-family-primary, 'Poppins', sans-serif);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: all var(--transition-fast, 0.2s ease);
  -webkit-tap-highlight-color: transparent;
}
.ctx-btn svg { width: 1rem; height: 1rem; flex-shrink: 0; }
.ctx-btn:hover { transform: scale(1.05); }
.ctx-btn:active { transform: scale(0.94); transition-duration: 0.08s; }

.tone-green {
  color: var(--primary-green, #00ff88);
  border-color: rgba(0,255,136,0.3);
  background: linear-gradient(135deg, rgba(0,255,136,0.14), rgba(0,255,136,0.05));
}
.tone-green:hover {
  border-color: rgba(0,255,136,0.55);
  box-shadow: 0 0 0.6rem rgba(0,255,136,0.2);
}

.tone-blue {
  color: var(--primary-blue, #00aaff);
  border-color: rgba(0,170,255,0.3);
  background: linear-gradient(135deg, rgba(0,170,255,0.14), rgba(0,170,255,0.05));
}
.tone-blue:hover {
  border-color: rgba(0,170,255,0.55);
  box-shadow: 0 0 0.6rem rgba(0,170,255,0.2);
}

.tone-amber {
  color: var(--warning-orange, #ffaa00);
  border-color: rgba(255,170,0,0.3);
  background: linear-gradient(135deg, rgba(255,170,0,0.14), rgba(255,170,0,0.05));
}
.tone-amber:hover {
  border-color: rgba(255,170,0,0.55);
  box-shadow: 0 0 0.6rem rgba(255,170,0,0.2);
}

/* Hide text label on very small screens — keep icon-only button */
@media (max-width: 480px) {
  .ctx-label { display: none; }
  .ctx-btn { padding: 0 0.5rem; }
}

.ctx-enter-from, .ctx-leave-to { opacity: 0; transform: translateY(-6px) scale(0.9); }
.ctx-enter-active, .ctx-leave-active { transition: all 0.22s cubic-bezier(0.22,1,0.36,1); }
.ctx-leave-active { position: absolute; }
</style>
