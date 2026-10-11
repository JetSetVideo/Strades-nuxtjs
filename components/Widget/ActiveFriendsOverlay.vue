<script setup lang="ts">
/**
 * Active Friends Overlay — a counter button plus a control popover for the
 * friends currently predicting on the active asset.
 *
 * The button shows how many friends have live predictions. Opening it lets the
 * viewer switch every friend trajectory on or off over the price chart, or
 * isolate specific people so only their lines are drawn.
 *
 * Purely presentational: it owns no prediction data. The host (PriceIntuition)
 * passes the roster and current visibility, and applies whatever comes back.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

export interface ActiveFriend {
  id: string
  name: string
  /** How many live predictions this friend has on the asset. */
  count: number
  direction: 'bullish' | 'bearish' | 'neutral'
}

const props = withDefaults(defineProps<{
  friends: ActiveFriend[]
  /** Master switch — are friend trajectories drawn at all? */
  enabled: boolean
  /** Empty = everyone visible; otherwise only these ids. */
  isolated: string[]
  assetId?: string
}>(), {
  friends: () => [],
  isolated: () => [],
  assetId: '',
})

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'toggle-friend', userId: string): void
  (e: 'show-all'): void
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const count = computed(() => props.friends.length)
const isolatedSet = computed(() => new Set(props.isolated))
const isIsolating = computed(() => props.isolated.length > 0)

const bullCount = computed(() => props.friends.filter(f => f.direction === 'bullish').length)
const bearCount = computed(() => props.friends.filter(f => f.direction === 'bearish').length)

/** Label describing what is currently drawn, shown under the popover title. */
const statusLabel = computed(() => {
  if (!props.enabled) return 'Hidden'
  if (isIsolating.value) return `${props.isolated.length} isolated`
  return 'All shown'
})

const dirGlyph = (d: ActiveFriend['direction']) =>
  d === 'bullish' ? '↑' : d === 'bearish' ? '↓' : '•'

const onDocClick = (e: MouseEvent) => {
  if (!rootRef.value?.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }

// Listeners only exist while the popover is open.
watch(open, isOpen => {
  if (isOpen) {
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('mousedown', onDocClick)
    document.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="rootRef" class="afo" @click.stop>
    <button
      class="afo-btn"
      :class="{ active: open, muted: !enabled }"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="`${count} friend${count === 1 ? '' : 's'} predicting${assetId ? ' on ' + assetId : ''}`"
      @click="open = !open"
    >
      <span class="afo-icon" aria-hidden="true">◉</span>
      <span class="afo-count">{{ count }}</span>
      <span class="afo-word">friend{{ count === 1 ? '' : 's' }}</span>
      <span v-if="isIsolating" class="afo-dot" aria-hidden="true" />
    </button>

    <Transition name="afo-pop">
      <div v-if="open" class="afo-pop" role="dialog" aria-label="Friend prediction overlay controls">
        <header class="afo-head">
          <div>
            <strong>Friend predictions</strong>
            <span class="afo-status">{{ statusLabel }}</span>
          </div>
          <span class="afo-split">
            <i class="up">↑{{ bullCount }}</i>
            <i class="down">↓{{ bearCount }}</i>
          </span>
        </header>

        <label class="afo-switch">
          <input
            type="checkbox"
            :checked="enabled"
            @change="emit('update:enabled', ($event.target as HTMLInputElement).checked)"
          >
          <span>Show all friend trajectories on chart</span>
        </label>

        <div v-if="count" class="afo-list">
          <button
            v-for="friend in friends"
            :key="friend.id"
            type="button"
            class="afo-friend"
            :class="{
              selected: isolatedSet.has(friend.id),
              dimmed: !enabled || (isIsolating && !isolatedSet.has(friend.id)),
            }"
            @click="emit('toggle-friend', friend.id)"
          >
            <span class="afo-avatar" aria-hidden="true">{{ friend.name.slice(0, 1).toUpperCase() }}</span>
            <span class="afo-name">{{ friend.name }}</span>
            <span class="afo-meta">{{ friend.count }}</span>
            <span class="afo-dir" :class="friend.direction" aria-hidden="true">{{ dirGlyph(friend.direction) }}</span>
          </button>
        </div>

        <p v-else class="afo-empty">No friends are predicting on this asset yet.</p>

        <footer v-if="isIsolating" class="afo-foot">
          <button type="button" class="afo-clear" @click="emit('show-all')">Show everyone</button>
        </footer>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.afo { position: relative; display: inline-flex; }

.afo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  height: 1.6rem;
  padding: 0 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.62rem;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
}
.afo-btn:hover,
.afo-btn.active {
  border-color: var(--piw-bull, #00e58a);
  background: rgba(0, 229, 138, 0.1);
}
.afo-btn.muted { opacity: 0.55; }
.afo-icon { color: var(--piw-bull, #00e58a); font-size: 0.7rem; }
.afo-count { font-weight: 700; }
.afo-word { opacity: 0.7; }
/* Marks that a subset is isolated, visible without opening the popover. */
.afo-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--piw-bull, #00e58a);
}

.afo-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: 15rem;
  padding: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(22, 22, 30, 0.98), rgba(14, 14, 19, 0.98));
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
}

.afo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.afo-head strong { display: block; font-size: 0.72rem; color: #fff; }
.afo-status { font-size: 0.58rem; color: rgba(255, 255, 255, 0.45); }
.afo-split { display: inline-flex; gap: 0.3rem; font-size: 0.6rem; font-style: normal; }
.afo-split .up { color: var(--piw-bull, #00e58a); font-style: normal; }
.afo-split .down { color: var(--piw-bear, #ff4d6d); font-style: normal; }

.afo-switch {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.3rem;
  margin-bottom: 0.35rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}
.afo-switch input { accent-color: var(--piw-bull, #00e58a); cursor: pointer; }

.afo-list { display: flex; flex-direction: column; gap: 2px; max-height: 12rem; overflow-y: auto; }

.afo-friend {
  display: grid;
  grid-template-columns: 1.1rem minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.64rem;
  cursor: pointer;
  text-align: left;
}
.afo-friend:hover { background: rgba(255, 255, 255, 0.05); }
.afo-friend.selected {
  border-color: rgba(0, 229, 138, 0.45);
  background: rgba(0, 229, 138, 0.08);
}
/* Friends not currently drawn stay visible but recede. */
.afo-friend.dimmed { opacity: 0.4; }

.afo-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.55rem;
  font-weight: 700;
}
.afo-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.afo-meta { font-size: 0.55rem; color: rgba(255, 255, 255, 0.4); }
.afo-dir.bullish { color: var(--piw-bull, #00e58a); }
.afo-dir.bearish { color: var(--piw-bear, #ff4d6d); }
.afo-dir.neutral { color: rgba(255, 255, 255, 0.45); }

.afo-empty { margin: 0.4rem 0.3rem; font-size: 0.62rem; color: rgba(255, 255, 255, 0.45); }

.afo-foot { margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid rgba(255, 255, 255, 0.07); }
.afo-clear {
  width: 100%;
  padding: 0.3rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.62rem;
  cursor: pointer;
}
.afo-clear:hover { border-color: var(--piw-bull, #00e58a); color: #fff; }

.afo-pop-enter-from, .afo-pop-leave-to { opacity: 0; transform: translateY(-4px); }
.afo-pop-enter-active, .afo-pop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
</style>
