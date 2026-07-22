import { defineStore } from 'pinia'
import { useWalletStore } from '~/stores/wallet'
import { useAllocationStore } from '~/stores/allocation'

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
  /** Marked-to-market P&L as % of notional */
  hypothetical_pnl_pct: number
  /** Marked-to-market P&L in wallet currency */
  hypothetical_pnl_value: number
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

const STORAGE_KEY = 'strades_paper_ledger_v1'

/** Deterministic pseudo-random walk for marking paper P&L */
const markPrice = (entryPrice: number, ageHours: number, seed: number): number => {
  // Simple sinusoidal + noise model: prices drift ±3% per 24h
  const drift = Math.sin(seed * 7 + ageHours / 24) * 0.03
  const noise = (Math.sin(seed * 13 + ageHours) * 0.5 + 0.5) * 0.01
  return entryPrice * (1 + drift + noise)
}

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

    /** Total hypothetical P&L across all open paper positions */
    openPnlValue(): number {
      return this.openTrades.reduce((acc, t) => acc + t.hypothetical_pnl_value, 0)
    },
    openPnlPct(): number {
      const open = this.openTrades
      if (!open.length) return 0
      const totalNotional = open.reduce((a, t) => a + t.notional_value, 0)
      if (!totalNotional) return 0
      return (this.openPnlValue / totalNotional) * 100
    },

    realizedPnlValue(): number {
      return this.closedTrades.reduce((acc, t) => acc + (t.realized_pnl_value ?? 0), 0)
    },

    /** Win rate across closed trades */
    winRate(): number {
      const closed = this.closedTrades
      if (!closed.length) return 0
      const wins = closed.filter(t => (t.realized_pnl_value ?? 0) > 0).length
      return (wins / closed.length) * 100
    },

    /** Equity curve built from closed trades sorted by close time */
    equityCurve(): Array<{ t: string; v: number }> {
      const sorted = [...this.closedTrades].sort(
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
        const raw = window.localStorage.getItem(STORAGE_KEY)
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
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
    }): PaperTrade {
      const walletStore = useWalletStore()
      const defaultWallet = walletStore.wallets.find(w => w.is_default) ?? walletStore.wallets[0]
      const totalValue = defaultWallet?.total_value ?? 100_000

      const pct = Math.max(0.1, Math.min(50, args.wallet_pct))
      const notional = (pct / 100) * totalValue

      const trade: PaperTrade = {
        id: `paper_${String(this.nextId++).padStart(4, '0')}`,
        user_id: defaultWallet?.user_id ?? 'user_001',
        timestamp: new Date().toISOString(),
        asset_id: args.asset_id,
        asset_symbol: args.asset_symbol,
        side: args.side,
        wallet_pct: pct,
        simulated_price: args.simulated_price,
        notional_value: notional,
        hypothetical_pnl_pct: 0,
        hypothetical_pnl_value: 0,
        strategy_id: args.strategy_id,
        agent_id: args.agent_id,
        is_paper: true,
        status: 'open'
      }
      this.trades.unshift(trade)
      this.persist()
      return trade
    },

    /** Mark all open paper trades to the current simulated price. */
    markToMarket() {
      const now = Date.now()
      for (const t of this.openTrades) {
        const ageHours = (now - new Date(t.timestamp).getTime()) / 3_600_000
        const seed = parseInt(t.id.replace(/\D/g, ''), 10) || 1
        const cur = markPrice(t.simulated_price, ageHours, seed)
        const direction = t.side === 'buy' ? 1 : -1
        t.hypothetical_pnl_pct = ((cur - t.simulated_price) / t.simulated_price) * 100 * direction
        t.hypothetical_pnl_value = (t.hypothetical_pnl_pct / 100) * t.notional_value
      }
    },

    closeTrade(id: string, closePrice?: number) {
      const t = this.trades.find(x => x.id === id)
      if (!t || t.status === 'closed') return
      this.markToMarket()
      const finalPrice = closePrice ?? t.simulated_price * (1 + t.hypothetical_pnl_pct / 100)
      const direction = t.side === 'buy' ? 1 : -1
      const pnlPct = ((finalPrice - t.simulated_price) / t.simulated_price) * 100 * direction
      t.status = 'closed'
      t.closed_at = new Date().toISOString()
      t.closed_price = finalPrice
      t.realized_pnl_pct = pnlPct
      t.realized_pnl_value = (pnlPct / 100) * t.notional_value
      this.persist()
    },

    closeAll() {
      for (const t of this.openTrades) this.closeTrade(t.id)
    },

    clearAll() {
      this.trades = []
      this.persist()
    },

    /** Seed some sample paper trades for first-time users */
    seedDemo() {
      if (this.trades.length > 0) return
      const samples = [
        { asset_id: 'bitcoin',  asset_symbol: 'BTC',  side: 'buy'  as const, wallet_pct: 5, simulated_price: 62_500, strategy_id: 'strategy_001' },
        { asset_id: 'ethereum', asset_symbol: 'ETH',  side: 'buy'  as const, wallet_pct: 3, simulated_price: 3_400 },
        { asset_id: 'apple',    asset_symbol: 'AAPL', side: 'buy'  as const, wallet_pct: 8, simulated_price: 198.50, agent_id: 'agent_002' },
        { asset_id: 'gold',     asset_symbol: 'XAU',  side: 'sell' as const, wallet_pct: 2, simulated_price: 2_310 }
      ]
      for (const s of samples) this.placeOrder(s)
      // Close the oldest one as a winner for the demo
      if (this.trades.length > 0) {
        const last = this.trades[this.trades.length - 1]
        if (last) this.closeTrade(last.id, last.simulated_price * 1.04)
      }
    }
  }
})
