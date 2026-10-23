<script setup lang="ts">
/**
 * Data APIs dialog. The rows are the same FeedBoard as /apis.
 * Disconnect is a browser preference (stores/feedPrefs.ts); a blocked
 * provider never counts as receiving.
 */
import { computed, watch } from 'vue'
import { useDataFeedsStore } from '~/stores/dataFeeds'
import { useFeedPrefsStore } from '~/stores/feedPrefs'
import { feedStreams, type FeedAssetInput } from '~/utils/assetFeeds'
import APIsFeedBoard from '@/components/APIs/FeedBoard.vue'

const props = defineProps<{
  open: boolean
  catalog?: FeedAssetInput[]
  active?: FeedAssetInput[]
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const feeds = useDataFeedsStore()
const feedPrefs = useFeedPrefsStore()

const board = computed(() => props.active ?? [])
const liveOnBoard = computed(() => board.value.filter(a => a.live).length)
const receivingCount = computed(() =>
  feeds.providers.filter(p => feedStreams(feedPrefs.isEnabled(p.id), p.state)).length,
)
const showBoard = computed(() => !feeds.loading && (feeds.providers.length > 0 || (props.catalog?.length ?? 0) > 0))

watch(
  () => props.open,
  (v) => { if (v) { feedPrefs.hydrate(); feeds.load(true) } },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="api-back" @click="emit('update:open', false)">
        <div class="api-panel" role="dialog" aria-label="Data APIs by feed" @click.stop>
          <header class="api-head">
            <div>
              <h3>Data APIs</h3>
              <p class="api-sub">
                {{ liveOnBoard }} of {{ board.length }} assets in this list have a live quote
                <template v-if="feeds.providers.length"> · {{ receivingCount }}/{{ feeds.providers.length }} APIs receiving</template>
              </p>
            </div>
            <button class="api-close" aria-label="Close" @click="emit('update:open', false)">✕</button>
          </header>

          <div class="api-body">
            <div v-if="feeds.loading && !feeds.providers.length" class="api-state">Loading providers…</div>
            <div v-else-if="feeds.error && !feeds.providers.length" class="api-state err">
              <p>{{ feeds.error }}</p>
              <p class="api-hint">Provider status could not be loaded. Asset sources below still come from this list.</p>
              <button class="api-retry" @click="feeds.load(true)">Retry</button>
            </div>

            <APIsFeedBoard
              v-if="showBoard"
              :catalog="catalog ?? []"
              :active="active ?? []"
            />
          </div>

          <footer class="api-foot">
            Disconnect is saved in this browser. A blocked feed stays off and its prices leave the list.
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.api-back {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 1rem 1rem;
}
.api-panel {
  width: min(640px, 100%);
  max-height: 78vh;
  background: linear-gradient(180deg, rgba(20,20,28,0.97), rgba(14,14,18,0.97));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-white, #fff);
}
.api-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.api-head h3 { margin: 0; font-size: 0.95rem; letter-spacing: 0.02em; }
.api-sub { margin: 3px 0 0; font-size: 0.68rem; color: var(--text-secondary, #9aa0a6); }
.api-close {
  background: rgba(255,255,255,0.05); border: none; color: rgba(255,255,255,0.7);
  width: 1.6rem; height: 1.6rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem;
}
.api-body { padding: 0.7rem 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.85rem; }
.api-state { font-size: 0.78rem; color: var(--text-secondary, #9aa0a6); padding: 0.4rem 0.2rem; }
.api-state.err { color: var(--app-color-down, #ff6b6b); }
.api-hint { color: var(--text-secondary, #9aa0a6); font-size: 0.72rem; margin: 0.35rem 0 0.6rem; }
.api-retry {
  background: transparent; border: 1px solid var(--border-secondary, #444); color: inherit;
  border-radius: 999px; padding: 4px 12px; font-size: 0.7rem; cursor: pointer;
}
.api-foot {
  padding: 0.55rem 1rem 0.7rem;
  font-size: 0.62rem;
  color: var(--text-secondary, #9aa0a6);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
