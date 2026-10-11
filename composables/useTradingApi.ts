import type { ServerStrategyPayload } from '~/utils/strategyServer'
/**
 * useTradingApi — wallet custody + paper-trading bots (Django apps/wallets).
 *
 * Contract: ~/Desktop/Strades-comms/API.md
 *
 * Secret handling rules (enforced here, keep them):
 *  - mnemonic / passphrase are only ever passed straight through as request
 *    bodies. They are never stored in a ref, a Pinia store, localStorage, a
 *    URL or a log line by this composable.
 *  - Error messages surfaced to the UI come from the server's `detail`, which
 *    never echoes the submitted phrase.
 */

export interface TradingWallet {
  id: string
  label: string
  chain: string
  address: string
  derivation_path: string
  origin: 'created' | 'imported'
  mode: 'paper'
  cash_usd: string
  allocated_usd: string
  created_at: string
}

export interface LedgerEntry {
  id: number
  kind: 'fund' | 'reserve' | 'release'
  amount_usd: string
  pnl_usd: string
  ref: string
  cash_after: string
  created_at: string
}

export type WeightKey = 'momentum' | 'mean_reversion' | 'breakout' | 'grid_dca' | 'chain_propagation'
export type Weights = Partial<Record<WeightKey, number>>

export interface ClosedTrade {
  symbol: string
  side: 'long' | 'short'
  qty: number
  entry: number
  exit: number
  pnl: number
  ts: number
  behaviour: string
}

export interface BotStatus {
  bot_id: string
  wallet_id: string
  alive: boolean
  period_s: number
  ticks: number
  cash: number
  equity: number
  starting_capital: number
  pnl: number
  pnl_pct: number
  weights: Weights
  open_positions: { symbol: string; qty: number; avg_price: number; mark: number; upnl: number }[]
  closed_trades: ClosedTrade[]
  stats: { closed: number; profitable: number; win_rate: number; realized_pnl: number }
  /** Equal-weight buy & hold of the same markets with the same capital over the same bars. */
  benchmark?: { buy_hold_pct: number; buy_hold_pnl: number } | null
  kind?: 'behaviour' | 'rules' | 'prediction'
  visibility?: 'public' | 'private'
  /** Public feed only: display name (never an id or email) and whether it's the caller's own bot. */
  owner_display?: string
  is_mine?: boolean
  market_ticker?: string
  side?: 'yes' | 'no'
  paused?: boolean
  market?: { ticker: string; title?: string; subtitle?: string; side?: 'yes' | 'no' } | null
  position?: { contracts: number; avg_cents: number; mark_cents: number | null } | null
  /** Set when the bot runs a saved creator strategy instead of a behaviour mix. */
  strategy?: { id: string; name: string; symbol?: string } | null
}

export interface LaunchBotInput {
  capital_usd: string
  weight_mode: 'random' | 'custom'
  /** Run a saved creator strategy (POST /api/strategies/) on this wallet. */
  strategy_id?: string
  /** Prediction-market bot (Kalshi, paper fills at the real top of book). */
  kind?: 'behaviour' | 'prediction'
  market_ticker?: string
  side?: 'yes' | 'no'
  max_entry_cents?: number
  visibility?: 'public' | 'private'
  weights?: Weights
  period_s?: number
  seed?: number
}

export interface RealBacktest {
  engine: string
  capital: number
  equity: number
  return_pct: number
  equity_curve: { ts: number; equity: number }[]
  trades: { ts: number; side: string; qty: number; entry: number; exit: number; pnl: number; reason: string }[]
  metrics: { return_pct: number; max_dd_pct: number; trades: number; win_rate: number | null; fees: number; bars: number }
  benchmark: { buy_hold_pct: number; buy_hold_pnl: number }
  window: { symbol: string; interval: string; bars: number; from_ts: number; to_ts: number }
}

export interface SavedStrategy {
  id: string
  name: string
  description: string
  category: string
  assets_entry: string
  assets_exit: string
  frequency: string
  conditions: unknown[]
  parameters: Record<string, unknown>
  created_at: string
  /** Summary of the last real-price backtest (scalars only); {} when never run. */
  last_backtest: Partial<Pick<RealBacktest, 'return_pct' | 'metrics' | 'benchmark' | 'window'>>
  last_backtest_at: string | null
}

export interface SamplePortfolio {
  id: number
  name: string
  cash_balance: string
  total_value: number
  transactions?: { asset_symbol: string; type: string; quantity: string; price: string; total_value: string; timestamp: string }[]
  holdings: { asset?: { id: string; symbol: string }; asset_id?: string; symbol?: string; quantity: string; average_buy_price: string; current_value?: number; unrealized_pnl?: number }[]
}

export class TradingApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export const useTradingApi = () => {
  // Capture Nuxt context before any await (see composables gotcha in repo notes).
  const config = useRuntimeConfig()
  const auth = useAuth()
  const base = `${config.public.apiBase as string}/api`

  const call = async <T>(path: string, opts: { method?: string; body?: unknown } = {}, retried = false): Promise<T> => {
    const token = auth.accessToken.value
    try {
      // External absolute URL: plain fetch typing, not Nitro's route-typed overload.
      return await ($fetch as <R>(url: string, o?: Record<string, unknown>) => Promise<R>)<T>(`${base}${path}`, {
        method: (opts.method || 'GET') as any,
        body: opts.body as any,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (e: any) {
      const status = e?.response?.status ?? e?.statusCode ?? 0
      if (status === 401 && !retried && (await auth.refreshAccessToken())) {
        return call<T>(path, opts, true)
      }
      const fieldErrors = e?.data?.errors && typeof e.data.errors === 'object' ? Object.values(e.data.errors as Record<string, string>).join(' ') : ''
      const detail = e?.data?.detail || fieldErrors || (status === 429 ? 'Too many attempts, wait a minute.' : 'Request failed')
      throw new TradingApiError(String(detail), status)
    }
  }

  return {
    // wallets
    listWallets: () => call<TradingWallet[]>('/wallets/'),
    getWallet: (id: string) => call<TradingWallet>(`/wallets/${id}/`),
    createWallet: (body: { label?: string; passphrase: string; starting_balance_usd?: string }) =>
      call<{ wallet: TradingWallet; mnemonic: string; warning: string }>('/wallets/', { method: 'POST', body }),
    importWallet: (body: { label?: string; mnemonic: string; passphrase: string; starting_balance_usd?: string }) =>
      call<{ wallet: TradingWallet }>('/wallets/import/', { method: 'POST', body }),
    deleteWallet: (id: string) => call<void>(`/wallets/${id}/`, { method: 'DELETE' }),
    ledger: (id: string) => call<LedgerEntry[]>(`/wallets/${id}/ledger/`),
    verifyPassphrase: (id: string, passphrase: string) =>
      call<{ ok: boolean }>(`/wallets/${id}/verify-passphrase/`, { method: 'POST', body: { passphrase } }),

    // bots + markets
    markets: () => call<{ symbols: string[]; feed: string; tick?: number; exhausted?: boolean }>('/markets/'),
    listBots: (walletId: string) => call<BotStatus[]>(`/wallets/${walletId}/bots/`),
    launchBot: (walletId: string, body: LaunchBotInput) =>
      call<BotStatus>(`/wallets/${walletId}/bots/`, { method: 'POST', body }),
    getBot: (botId: string) => call<BotStatus>(`/bots/${botId}/`),
    publicBots: () => call<BotStatus[] | { results?: BotStatus[] }>('/bots/public/').then(r => (Array.isArray(r) ? r : r.results ?? [])),
    setVisibility: (botId: string, visibility: 'public' | 'private') =>
      call<BotStatus>(`/bots/${botId}/visibility/`, { method: 'POST', body: { visibility } }),
    /** Advance the caller's prediction bots one decision (Kalshi has no replay clock). */
    pollPrediction: () => call<Record<string, unknown>>('/bots/poll/', { method: 'POST', body: {} }),
    pauseBot: (botId: string, paused: boolean) => call<BotStatus>(`/bots/${botId}/pause/`, { method: 'POST', body: { paused } }),
    stopBot: (botId: string) =>
      call<{ bot_id: string; final_equity: number; pnl: number; released: number }>(`/bots/${botId}/stop/`, { method: 'POST' }),
    // strategies (backend rules engine, real Binance candles)
    // sample "Main Portfolio" (finance app): hand trading at the stored price
    portfolio: () => call<SamplePortfolio>('/portfolio/'),
    handTrade: (body: { asset_id: string; type: 'buy' | 'sell'; quantity: number }) =>
      call<Record<string, unknown>>('/portfolio/trade/', { method: 'POST', body }),
    listStrategies: () => call<{ results?: SavedStrategy[] } | SavedStrategy[]>('/strategies/')
      .then(r => (Array.isArray(r) ? r : r.results ?? [])),
    getStrategy: (id: string) => call<SavedStrategy>(`/strategies/${id}/`),
    deleteStrategy: (id: string) => call<void>(`/strategies/${id}/`, { method: 'DELETE' }),
    saveStrategy: (body: ServerStrategyPayload) => call<{ id: string; name: string }>('/strategies/', { method: 'POST', body }),
    backtestReal: (id: string, body: { capital_usd: number; bars?: number }) =>
      call<RealBacktest>(`/strategies/${id}/backtest/`, { method: 'POST', body }),
    // dev tools (backend: DEBUG or staff only)
    rollWindow: () => call<{ appended: number; tick: number; exhausted: boolean; note?: string }>('/bots/roll/', { method: 'POST', body: {} }),
    resetBots: () => call<{ stopped: number; released_total: number; bots_remaining: number; failed: string[] }>('/bots/reset/', { method: 'POST', body: {} }),
    stepReplay: (n = 24) => call<{ tick: number; exhausted: boolean }>('/bots/step/', { method: 'POST', body: { n } }),
  }
}
