import { defineStore } from 'pinia'

/**
 * Free play-currency bankroll for the Arena (community data bets). Never
 * convertible to or from real money — a bounded, house-issued balance so
 * "bet for free on real data" stays literally free for the user.
 */

export interface CreditLedgerEntry {
  id: string
  delta: number
  reason: string
  ref_id?: string
  at: string
  balance_after: number
}

export interface CreditsState {
  balance: number
  ledger: CreditLedgerEntry[]
  hydrated: boolean
  nextId: number
}

const STORAGE_KEY = 'strades_credits_v1'
const STARTING_BALANCE = 1000
const MAX_BALANCE = 100_000 // soft ceiling so a hot streak can't overflow the UI/number space

export const useCreditsStore = defineStore('credits', {
  state: (): CreditsState => ({
    balance: STARTING_BALANCE,
    ledger: [],
    hydrated: false,
    nextId: 1
  }),

  getters: {
    recentLedger: (s) => [...s.ledger].reverse().slice(0, 20)
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          this.balance = typeof parsed.balance === 'number' ? parsed.balance : STARTING_BALANCE
          this.ledger = parsed.ledger ?? []
          this.nextId = parsed.nextId ?? (this.ledger.length + 1)
        }
      } catch { /* fresh start */ }
      this.hydrated = true
    },

    persist() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          balance: this.balance,
          ledger: this.ledger,
          nextId: this.nextId
        }))
      } catch { /* quota full — non-fatal */ }
    },

    /** Credit the bankroll (winnings, refunds, faucet). Clamped at MAX_BALANCE. */
    grant(amount: number, reason: string, refId?: string) {
      const clean = Math.max(0, Math.round(amount))
      if (clean === 0) return
      this.balance = Math.min(MAX_BALANCE, this.balance + clean)
      this.ledger.push({
        id: `cr_${String(this.nextId++).padStart(5, '0')}`,
        delta: clean, reason, ref_id: refId,
        at: new Date().toISOString(), balance_after: this.balance
      })
      this.persist()
    },

    /**
     * Debit the bankroll. Returns the amount actually spent — never more than
     * the current balance, so a caller can't drive the balance negative by
     * racing two spends.
     */
    spend(amount: number, reason: string, refId?: string): number {
      const clean = Math.max(0, Math.round(amount))
      const actual = Math.min(clean, this.balance)
      if (actual === 0) return 0
      this.balance -= actual
      this.ledger.push({
        id: `cr_${String(this.nextId++).padStart(5, '0')}`,
        delta: -actual, reason, ref_id: refId,
        at: new Date().toISOString(), balance_after: this.balance
      })
      this.persist()
      return actual
    }
  }
})
