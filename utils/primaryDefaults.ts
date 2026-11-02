/**
 * Form defaults that come from the user's primary values (composables/usePrimarySettings,
 * GET /api/v1/settings/primary/), top-down: what the user chose in the form > their Settings >
 * the built-in default. Pure, so the resolution is tested (tests/primaryDefaults.test.ts).
 *
 * Wired here:
 *   default_confidence   → PredictPanel confidence chips (new call)
 *   default_horizon_days → PredictPanel horizon (nearest of 1D/1W/1M/3M/6M/1Y)
 *   starting_capital     → stores/tradingPrefs newBotCapital (signed in; the local value is the
 *                          signed-out fallback)
 */
import { nearestHorizon } from '~/utils/assetChart'
import { clampConfidence, DEFAULT_CONFIDENCE } from '~/utils/callRules'

export type PrimaryLike = Record<string, unknown>
export type DefaultSource = 'settings' | 'built-in'

/** Built-in horizon when Settings are not read (signed out, loading, error). */
export const BUILT_IN_HORIZON = '1W'
/** Settings anchors (components/Settings/PrimaryValues.vue renders #set-<key>). */
export const SETTINGS_HREF = {
  starting_capital: '/settings#set-starting_capital',
  default_confidence: '/settings#set-default_confidence',
  default_horizon_days: '/settings#set-default_horizon_days',
} as const

/** A primary value as a finite number (the user's value, else the server default), or null. */
export function primaryNumber(key: string, values: PrimaryLike = {}, defaults: PrimaryLike = {}): number | null {
  const raw = values[key] === null || values[key] === undefined ? defaults[key] : values[key]
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export interface CallDefaults {
  confidence: number
  confidenceSource: DefaultSource
  horizonId: string
  /** The setting in days (it may sit between two horizons), null when built-in. */
  horizonDays: number | null
  horizonSource: DefaultSource
}

/** Defaults of a new call. `ready` = the primary values were read for a signed-in user. */
export function resolveCallDefaults(ready: boolean, values: PrimaryLike = {}, defaults: PrimaryLike = {}): CallDefaults {
  const conf = ready ? primaryNumber('default_confidence', values, defaults) : null
  const days = ready ? primaryNumber('default_horizon_days', values, defaults) : null
  const okDays = days !== null && days >= 1 ? Math.min(365, Math.round(days)) : null
  return {
    confidence: conf === null ? DEFAULT_CONFIDENCE : clampConfidence(conf),
    confidenceSource: conf === null ? 'built-in' : 'settings',
    horizonId: okDays === null ? BUILT_IN_HORIZON : nearestHorizon(okDays * 24).id,
    horizonDays: okDays,
    horizonSource: okDays === null ? 'built-in' : 'settings',
  }
}

/** Plain sentence for the horizon's title when it comes from Settings ('' otherwise). */
export function horizonDefaultNote(d: CallDefaults): string {
  if (d.horizonSource !== 'settings' || d.horizonDays === null) return ''
  const days = `${d.horizonDays} day${d.horizonDays === 1 ? '' : 's'}`
  return `Your default call horizon is ${days} (Settings); ${d.horizonId} is the nearest horizon.`
}

/** starting_capital when the primary values were read (signed in), else null. Floors at $10 like the bot forms. */
export function startingCapitalFrom(ready: boolean, values: PrimaryLike = {}, defaults: PrimaryLike = {}): number | null {
  if (!ready) return null
  const n = primaryNumber('starting_capital', values, defaults)
  return n !== null && n >= 10 ? n : null
}

/** New-bot capital: Settings (signed in) else the browser-local fallback. */
export function resolveNewBotCapital(local: number, fromSettings: number | null): { value: number; source: 'settings' | 'local' } {
  return fromSettings !== null && Number.isFinite(fromSettings)
    ? { value: fromSettings, source: 'settings' }
    : { value: local, source: 'local' }
}
