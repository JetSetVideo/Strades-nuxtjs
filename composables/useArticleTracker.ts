import { onMounted, onUnmounted } from 'vue'
import { useOpinionProfileStore, type ArticleSnapshot } from '~/stores/opinionProfile'

/**
 * useArticleTracker — logs an `article_read` interaction into the Opinion
 * Profiler after the user has spent meaningful time on the page.
 *
 * Dwell threshold: 5 seconds (anything less is a drive-by).
 * Also exposes `trackShare()` for explicit share actions.
 *
 * @param article  Getter returning the article snapshot (or null if not loaded)
 * @param userId   ID of the user doing the reading (defaults to 'user_001')
 */
export const useArticleTracker = (
  article: () => ArticleSnapshot | null,
  userId: string = 'user_001'
) => {
  const opinionStore = useOpinionProfileStore()
  let mountedAt = 0
  let recorded = false

  const DWELL_THRESHOLD_MS = 5_000

  const tryRecord = () => {
    if (recorded) return
    const a = article()
    if (!a) return
    const dwell = Date.now() - mountedAt
    if (dwell < DWELL_THRESHOLD_MS) return
    opinionStore.recordRead(userId, a)
    recorded = true
  }

  const trackShare = () => {
    const a = article()
    if (!a) return
    opinionStore.recordShare(userId, a)
  }

  onMounted(() => {
    opinionStore.hydrate()
    mountedAt = Date.now()
    // Record when the user leaves the page or after 30s, whichever comes first
    const timer = window.setTimeout(tryRecord, 30_000)
    const onLeave = () => { tryRecord(); window.clearTimeout(timer) }
    window.addEventListener('beforeunload', onLeave)
    onUnmounted(() => {
      window.removeEventListener('beforeunload', onLeave)
      window.clearTimeout(timer)
      tryRecord()
    })
  })

  return { trackShare }
}
