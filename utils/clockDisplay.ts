export type ClockMode = 'gmt' | 'local'

const STORAGE_KEY = 'strades_clock_mode'

export function readStoredClockMode(): ClockMode | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'gmt' || raw === 'local') return raw
  } catch { /* private mode */ }
  return null
}

export function persistClockMode(mode: ClockMode) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, mode) } catch { /* quota */ }
}

/** e.g. GMT, GMT+2, GMT-5 */
export function gmtOffsetLabel(date = new Date(), mode: ClockMode = 'gmt'): string {
  if (mode === 'gmt') return 'GMT'
  const minutes = -date.getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return mm ? `GMT${sign}${hh}:${String(mm).padStart(2, '0')}` : `GMT${sign}${hh}`
}

export function formatClock(date: Date, mode: ClockMode): string {
  const src = mode === 'gmt'
    ? { h: date.getUTCHours(), m: date.getUTCMinutes(), s: date.getUTCSeconds() }
    : { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() }
  return `${String(src.h).padStart(2, '0')}:${String(src.m).padStart(2, '0')}:${String(src.s).padStart(2, '0')}`
}
