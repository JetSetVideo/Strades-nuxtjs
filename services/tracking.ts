/**
 * Convenience wrappers so Vue components can track specific events
 * without importing useTracking directly.
 *
 * Usage in a component:
 *   import { trackAssetView, trackStrategyCreate } from '~/services/tracking'
 *   trackAssetView('AAPL')
 */
import type { ActivityAction } from '~/composables/useTracking'

const emit = (action: ActivityAction, payload?: Record<string, unknown>) => {
  if (import.meta.server) return
  const { track } = useTracking()
  track(action, { payload })
}

export const trackAssetView = (symbol: string) => emit('asset_view', { symbol })
export const trackStrategyCreate = (name: string) => emit('strategy_create', { name })
export const trackStrategyDeploy = (id: string) => emit('strategy_deploy', { id })
export const trackStrategyBacktest = (id: string) => emit('strategy_backtest', { id })
export const trackTradeExecute = (symbol: string, direction: string) => emit('trade_execute', { symbol, direction })
export const trackSearch = (query: string) => emit('search', { query })
export const trackPredictionCreate = (symbol: string) => emit('prediction_create', { symbol })
export const trackWalletCreate = (name: string) => emit('wallet_create', { name })
export const trackPostCreate = () => emit('post_create', {})
export const trackMessageSend = () => emit('message_send', {})
export const trackFriendRequest = (targetId: string) => emit('friend_request', { targetId })
