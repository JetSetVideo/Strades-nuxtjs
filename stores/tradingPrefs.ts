import { defineStore } from 'pinia'

/**
 * Trading parameters a user sets once in Settings › Trading, instead of
 * re-entering them on every form. Browser-local (paper trading only).
 */
export interface TradingPrefs {
  /** Default capital for a new bot (USD). */
  defaultCapital: number
  /** Default re-weight period for behaviour bots (seconds). */
  defaultPeriodS: number
  /** Bars replayed by "Backtest on real prices" in the creator. */
  backtestBars: number
  /** Hide assets with no live quote (SIM) from /prices. */
  hideSimulated: boolean
}

const KEY = 'strades_trading_prefs_v1'
const DEFAULTS: TradingPrefs = { defaultCapital: 1000, defaultPeriodS: 3600, backtestBars: 365, hideSimulated: false }

export const useTradingPrefsStore = defineStore('tradingPrefs', {
  state: () => ({ ...DEFAULTS, hydrated: false }),
  actions: {
    hydrate() {
      if (this.hydrated || !import.meta.client) return
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) Object.assign(this, sanitize({ ...DEFAULTS, ...JSON.parse(raw) }))
      } catch { /* private mode / bad JSON → defaults */ }
      this.hydrated = true
    },
    update(patch: Partial<TradingPrefs>) {
      Object.assign(this, sanitize({ ...this.$state, ...patch }))
      try {
        const { hydrated: _h, ...prefs } = this.$state
        localStorage.setItem(KEY, JSON.stringify(prefs))
      } catch { /* storage unavailable: keep in memory */ }
    },
    reset() { this.update(DEFAULTS) },
  },
})

function sanitize(p: TradingPrefs): TradingPrefs {
  const clamp = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
  }
  return {
    defaultCapital: clamp(p.defaultCapital, 10, 1_000_000, DEFAULTS.defaultCapital),
    defaultPeriodS: [900, 3600, 14400, 86400].includes(Number(p.defaultPeriodS)) ? Number(p.defaultPeriodS) : DEFAULTS.defaultPeriodS,
    backtestBars: Math.round(clamp(p.backtestBars, 50, 1000, DEFAULTS.backtestBars)), // server floors at 50 (StrategyBacktestView)
    hideSimulated: !!p.hideSimulated,
  }
}
