/**
 * price-init — warms the assets store from localStorage cache on app boot.
 *
 * Runs before any page component mounts. By the time the user navigates to
 * /prices the store already has data (served from cache) so there is no blank
 * screen at all. The background refresh happens concurrently in the same pass.
 */
import { useAssetsStore } from '~/stores/assets'

export default defineNuxtPlugin(() => {
  const { peekAssets } = usePriceCache()
  const assetsStore = useAssetsStore()

  // If the store is already populated (e.g. HMR / keep-alive), skip.
  if (assetsStore.assets.length > 0) return

  // Immediately populate from localStorage — synchronous, zero network cost.
  const cached = peekAssets()
  if (cached && cached.data.length > 0) {
    assetsStore.assets = cached.data as any
    assetsStore.fromCache = true
  }

  // Fire background fetch in a non-blocking microtask.
  // The prices page `initializeStore()` call is a no-op if data is fresh enough,
  // or it replaces the cache data silently.
  nextTick(() => {
    assetsStore.fetchAssets().catch(() => {/* silent — fallback inside fetchAssets */})
  })
})
