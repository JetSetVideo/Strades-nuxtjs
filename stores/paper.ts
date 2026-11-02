import { defineStore } from 'pinia'
import { useAssetsStore } from '~/stores/assets'
import { DEFAULT_PAPER_CAPITAL, GUEST_OWNER, livePriceOf, paperMark } from '~/utils/paperMarks'
import { userGet, userSet } from '~/utils/userStorage'

/**
 * Paper Trading Engine — simulated bets expressed as percentages of the wallet.
 *
 * Philosophy (per CodingAgent.md §5): paper trades are *bet-sizing decisions*,
 * never absolute transfers. Every order is denominated in `wallet_pct` (0–100)
 * so the user thinks in allocation terms, not in dollar terms.
 *
 * All paper trades are marked `is_paper: true` so they can be cleanly separated
 * from the user's real transaction history on `pages/historic.vue`.
 */

export interface PaperTrade {
  id: string
  user_id: string
  timestamp: string
  asset_id: string
  asset_symbol: string
  side: 'buy' | 'sell'
  /** Size of the bet as a percentage of total wallet value (0–100) */
  wallet_pct: number
  /** Mid-price at the moment of simulation */
  simulated_price: number
  /** Hypothetical position size in wallet currency */
  notional_value: number
  /** Marked-to-market P&L as % of notional (0 while unmarked: check `mark_price`) */
  hypothetical_pnl_pct: number
  /** Marked-to-market P&L in wallet currency (0 while unmarked: check `mark_price`) */
  hypothetical_pnl_value: number
  /** Live price used for the last mark; null/undefined = no live price → show "—" */
  mark_price?: number | null
  marked_at?: string | null
  /** Capital the % was taken of, and where it came from */
  capital_usd?: number
  capital_source?: 'paper_wallet' | 'default'
  /** Seeded demo row (the removed seedDemo; older ledgers still hold some): not a trade the user placed, never in KPIs */
  sample?: boolean
  /** Strategy that triggered this trade (undefined = manual) */
  strategy_id?: string
  /** Avatar that triggered this trade (if swarm-driven) */
  agent_id?: string
  /** Always true — discriminator vs. real trades */
  is_paper: true
  status: 'open' | 'closed'
  /** When status === 'closed' */
  closed_at?: string
  closed_price?: number
  realized_pnl_pct?: number
  realized_pnl_value?: number
}

export interface PaperLedgerState {
  trades: PaperTrade[]
  /** Toggle between paper and live mode on the wallet page */
  mode: 'paper' | 'live'
  hydrated: boolean
  nextId: number
}

const STORAGE_KEY = 'strades_paper_ledger_v1'   // per user via utils/userStorage (S13)

export const MIN_WALLET_PCT = 0.1
export const MAX_WALLET_PCT = 50

/** Clamp a requested bet size to [0.1, 50]% of wallet — never let one paper bet exceed half the wallet. */
export function clampWalletPct(raw: number): number {
  if (!Number.isFinite(raw)) return MIN_WALLET_PCT
  return Math.max(MIN_WALLET_PCT, Math.min(MAX_WALLET_PCT, raw))
}

/** Notional value in wallet currency for a given (already-clamped) wallet_pct. Never negative. */
export function computeNotional(walletPct: number, totalWalletValue: number): number {
  const safeTotal = Number.isFinite(totalWalletValue) && totalWalletValue > 0 ? totalWalletValue : 0
  return (walletPct / 100) * safeTotal
}

// Removed (wave 2): P&L used to be a sine wave of the entry price. Marks now come
// from the live price the asset page shows (utils/paperMarks.ts); no price → "—".

export const usePaperStore = defineStore('paper', {
  state: (): PaperLedgerState => ({
    trades: [],
    mode: 'paper',
    hydrated: false,
    nextId: 1
  }),

  getters: {
    openTrades: (s) => s.trades.filter(t => t.status === 'open'),
    closedTrades: (s) => s.trades.filter(t => t.status === 'closed'),
    /** The user's own trades: rows seeded as samples (older ledgers still hold some) are not his. */
    ownOpenTrades: (s) => s.trades.filter(t => t.status === 'open' && !t.sample),
    ownClosedTrades: (s) => s.trades.filter(t => t.status === 'closed' && !t.sample),

    /** Total hypothetical P&L across the user's own open paper positions (samples excluded) */
    openPnlValue(): number {
      return this.ownOpenTrades.reduce((acc, t) => acc + t.hypothetical_pnl_value, 0)
    },
    openPnlPct(): number {
      const open = this.ownOpenTrades
      if (!open.length) return 0
      const totalNotional = open.reduce((a, t) => a + t.notional_value, 0)
      if (!totalNotional) return 0
      return (this.openPnlValue / totalNotional) * 100
    },

    realizedPnlValue(): number {
      return this.ownClosedTrades.reduce((acc, t) => acc + (t.realized_pnl_value ?? 0), 0)
    },

    /** Win rate (%) across the user's own closed trades; null (shown "—") until one closes */
    winRate(): number | null {
      const closed = this.ownClosedTrades
      if (!closed.length) return null
      const wins = closed.filter(t => (t.realized_pnl_value ?? 0) > 0).length
      return (wins / closed.length) * 100
    },

    /** Equity curve built from closed trades sorted by close time */
    equityCurve(): Array<{ t: string; v: number }> {
      const sorted = [...this.ownClosedTrades].sort(
        (a, b) => new Date(a.closed_at ?? '').getTime() - new Date(b.closed_at ?? '').getTime()
      )
      let cum = 0
      return sorted.map(t => {
        cum += t.realized_pnl_value ?? 0
        return { t: t.closed_at ?? '', v: cum }
      })
    }
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return
      try {
        const raw = userGet(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          this.trades = parsed.trades ?? []
          this.mode = parsed.mode ?? 'paper'
          this.nextId = parsed.nextId ?? (this.trades.length + 1)
        }
      } catch { /* fresh start */ }
      this.hydrated = true
    },

    persist() {
      if (typeof window === 'undefined') return
      try {
        userSet(STORAGE_KEY, JSON.stringify({
          trades: this.trades,
          mode: this.mode,
          nextId: this.nextId
        }))
      } catch { /* quota full — non-fatal */ }
    },

    setMode(mode: 'paper' | 'live') {
      this.mode = mode
      this.persist()
    },

    /**
     * Place a simulated paper order.
     * `walletPct` is clamped to [0.1, 50] — never let a single paper bet exceed half the wallet.
     */
    placeOrder(args: {
      asset_id: string
      asset_symbol: string
      side: 'buy' | 'sell'
      wallet_pct: number
      simulated_price: number
      strategy_id?: string
      agent_id?: string
      /** Signed-in user's id (resolve with useAuth in the component's setup); default "guest" */
      user_id?: string
      /** Capital the % is taken of (resolvePaperCapital: free paper cash → Settings → 10,000), labelled */
      capital_usd?: number | null
      sample?: boolean
    }): PaperTrade {
      const fromWallet = typeof args.capital_usd === 'number' && Number.isFinite(args.capital_usd) && args.capital_usd > 0
      const totalValue = fromWallet ? (args.capital_usd as number) : DEFAULT_PAPER_CAPITAL

      const pct = clampWalletPct(args.wallet_pct)
      const notional = computeNotional(pct, totalValue)

      const trade: PaperTrade = {
        id: `paper_${String(this.nextId++).padStart(4, '0')}`,
        // Never the demo user_001: the signed-in user's id, else "guest".
        user_id: args.user_id || GUEST_OWNER,
        timestamp: new Date().toISOString(),
        asset_id: args.asset_id,
        asset_symbol: args.asset_symbol,
        side: args.side,
        wallet_pct: pct,
        simulated_price: args.simulated_price,
        notional_value: notional,
        hypothetical_pnl_pct: 0,
        hypothetical_pnl_value: 0,
        mark_price: null,
        marked_at: null,
        capital_usd: totalValue,
        capital_source: fromWallet ? 'paper_wallet' : 'default',
        ...(args.sample ? { sample: true } : {}),
        strategy_id: args.strategy_id,
        agent_id: args.agent_id,
        is_paper: true,
        status: 'open'
      }
      this.trades.unshift(trade)
      this.persist()
      return trade
    },

    /**
     * Mark open paper trades to the live price of their asset (the price the asset
     * page shows). No live price → mark_price null and the UI shows "—".
     * `priceOf` is injectable for tests.
     */
    markToMarket(priceOf?: (t: PaperTrade) => number | null) {
      const lookup = priceOf ?? ((t: PaperTrade) => livePriceOf(useAssetsStore().assets, t.asset_id, t.asset_symbol))
      const at = new Date().toISOString()
      for (const t of this.openTrades) {
        const price = lookup(t)
        const mark = paperMark(t, price)
        if (!mark) {
          t.mark_price = null
          t.hypothetical_pnl_pct = 0
          t.hypothetical_pnl_value = 0
          continue
        }
        t.mark_price = price
        t.marked_at = at
        t.hypothetical_pnl_pct = mark.pct
        t.hypothetical_pnl_value = mark.value
      }
    },

    /** Close at `closePrice`, else at the live mark. With no price the P&L stays unknown. */
    closeTrade(id: string, closePrice?: number) {
      const t = this.trades.find(x => x.id === id)
      if (!t || t.status === 'closed') return
      if (closePrice === undefined) this.markToMarket()
      const finalPrice = closePrice ?? t.mark_price ?? null
      const mark = paperMark(t, finalPrice)
      t.status = 'closed'
      t.closed_at = new Date().toISOString()
      if (mark && finalPrice !== null) {
        t.closed_price = finalPrice
        t.realized_pnl_pct = mark.pct
        t.realized_pnl_value = mark.value
      }
      this.persist()
    },

    closeAll() {
      for (const t of this.openTrades) this.closeTrade(t.id)
    },

    clearAll() {
      this.trades = []
      this.persist()
    }
    // seedDemo() removed (swarm 11-02 TRADE-5): it wrote 4 invented trades (+$200, 100 % win rate)
    // into an empty ledger. Rows it left behind keep `sample: true` and are chipped + excluded from KPIs.
  }
})
