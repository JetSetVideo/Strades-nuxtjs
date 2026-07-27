/**
 * usePortfolio — thin facade over the wallet store's API-first portfolio.
 * Prefer useWalletStore().fetchPortfolio() for new code.
 */
import { storeToRefs } from 'pinia'
import { useWalletStore } from '~/stores/wallet'

export const usePortfolio = () => {
  const store = useWalletStore()
  const { portfolio, portfolioLoading, portfolioError } = storeToRefs(store)

  return {
    portfolio,
    loading: portfolioLoading,
    error: portfolioError,
    refresh: () => store.fetchPortfolio(),
  }
}
