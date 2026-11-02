import { defineStore } from 'pinia'
import { usePrimarySettings } from '~/composables/usePrimarySettings'
import { resolveNewBotCapital, startingCapitalFrom } from '~/utils/primaryDefaults'
import { userGet, userSet } from '~/utils/userStorage'

/**
 * Trading parameters a user sets once in Settings › Trading, instead of
 * re-entering them on every form. Browser-local (paper trading only).
 *
 * Wave 4: the capital a new bot starts with comes from the primary value
 * `starting_capital` (Settings › Primary values, server-side) when signed in;
 * `defaultCapital` stays the browser-local fallback for signed-out use.
 * Forms read `newBotCapital` / `newBotCapitalSource` after `syncPrimary()`.
 */
export interface TradingPrefs {
  /** Default capital for a new bot (USD) — the signed-out fallback since wave 4. */
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
  state: () => ({
    ...DEFAULTS,
    hydrated: false,
    /** starting_capital from Settings › Primary values (signed in and read), else null. Never stored locally. */
    primaryCapital: null as number | null,
  }),
  getters: {
    /** Capital a new bot form starts with: Settings (signed in) else the local default. */
    newBotCapital: (s): number => resolveNewBotCapital(s.defaultCapital, s.primaryCapital).value,
    /** 'settings' = starting_capital from Settings › Primary values; 'local' = this browser's default. */
    newBotCapitalSource: (s): 'settings' | 'local' => resolveNewBotCapital(s.defaultCapital, s.primaryCapital).source,
  },
  actions: {
    hydrate() {
      if (this.hydrated || !import.meta.client) return
      try {
        const raw = userGet(KEY)
        if (raw) Object.assign(this, sanitize({ ...DEFAULTS, ...JSON.parse(raw) }))
      } catch { /* private mode / bad JSON → defaults */ }
      this.hydrated = true
    },
    update(patch: Partial<TradingPrefs>) {
      Object.assign(this, sanitize({ ...this.$state, ...patch }))
      try {
        userSet(KEY, JSON.stringify(sanitize(this.$state)))
      } catch { /* storage unavailable: keep in memory */ }
    },
    reset() { this.update(DEFAULTS) },
    /**
     * Read starting_capital from the primary settings (call from a component's setup: it
     * resolves auth there). Signed out / not readable → primaryCapital null → local fallback.
     */
    async syncPrimary() {
      if (import.meta.server) return
      const primary = usePrimarySettings()
      await primary.load()
      this.primaryCapital = startingCapitalFrom(primary.status.value === 'ready', primary.values.value, primary.defaults.value)
    },
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
