/**
 * price-init — warms the assets store from localStorage cache on app boot.
 *
 * Runs once initial hydration is complete (app:suspense:resolve; app:mounted is too early because the page hydrates inside <Suspense>). By the time the user navigates to
 * /prices the store already has data (served from cache) so there is no blank
 * screen at all. The background refresh happens concurrently in the same pass.
 */
import { useAssetsStore } from '~/stores/assets'

export default defineNuxtPlugin((nuxtApp) => {
  const { peekAssets } = usePriceCache()
  const assetsStore = useAssetsStore()

  // Wait until hydration is done: filling the store before it makes the
  // client's first render differ from the server's (the server never has the
  // localStorage cache) → hydration mismatches on /prices and in the nav.
  nuxtApp.hook('app:suspense:resolve', () => {
    if (assetsStore.assets.length > 0) return // HMR / keep-alive

    // Instant paint from localStorage — synchronous, zero network cost.
    const cached = peekAssets<unknown[]>()
    if (cached && cached.data.length > 0) {
      assetsStore.assets = cached.data as any
      assetsStore.fromCache = true
    }

    // One guarded background refresh (initializeStore no-ops if one is running).
    assetsStore.initializeStore().catch(() => {/* fetchAssets logs its own fallbacks */})
  })
})
