import { computed, watch } from 'vue'
import { useAssetsStore } from '~/stores/assets'
import { useDataFeedsStore } from '~/stores/dataFeeds'
import { useFeedPrefsStore } from '~/stores/feedPrefs'
import { feedKeyForAsset, feedStreams } from '~/utils/assetFeeds'

/**
 * Assets whose price feed is actually receiving.
 * Shared by /prices (the grid and the BETS filters) and /apis (the same list).
 */
export function useStreamedAssets() {
  const assetsStore = useAssetsStore()
  const feedPrefs = useFeedPrefsStore()
  const dataFeeds = useDataFeedsStore()

  if (import.meta.client) {
    feedPrefs.hydrate()
    dataFeeds.load()
    watch(() => feedPrefs.enabled, () => { assetsStore.mergeLiveQuotes() }, { deep: true })
    watch(() => dataFeeds.loaded, (ok) => {
      if (ok && assetsStore.assets.length) assetsStore.mergeLiveQuotes()
    })
  }

  const streamed = computed(() =>
    assetsStore.assets.filter((asset) => {
      const key = feedKeyForAsset(asset)
      return feedStreams(feedPrefs.isEnabled(key), dataFeeds.stateOf(key))
    }),
  )

  return { assetsStore, feedPrefs, dataFeeds, streamed }
}
