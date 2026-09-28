import { defineStore } from 'pinia'

/**
 * Appearance — the user-tunable half of the design system.
 *
 * Two-tier typography split (per Design.md philosophy): "chrome" is the
 * app's own voice (menus, titles, labels); "market-data" is for anything
 * that originates outside the app (prices, tickers, company/asset names) —
 * kept numeric/tabular-friendly so figures actually line up.
 *
 * Color scheme separates "which color reads as up" from the brand's
 * decorative use of green elsewhere — see --app-color-up/--app-color-down
 * in variables.css, never --success-green/--error-red directly, so this
 * setting can't accidentally recolor buttons or glows that just happen to
 * reuse the brand green.
 */

export type FontScaleKey = 'small' | 'medium' | 'large'
export type ChromeFontKey = 'poppins' | 'sora'
export type MarketDataFontKey = 'plex-mono' | 'inter'
export type ColorSchemeKey = 'default' | 'colorblind' | 'swapped'
export type TimezoneKey = 'UTC' | 'local' | 'America/New_York' | 'Europe/London' | 'Asia/Tokyo' | 'Asia/Hong_Kong'

const FONT_SCALES: Record<FontScaleKey, number> = { small: 0.9, medium: 1, large: 1.15 }

const CHROME_FONTS: Record<ChromeFontKey, string> = {
  poppins: "'Poppins', sans-serif",
  sora: "'Sora', sans-serif"
}

const MARKET_DATA_FONTS: Record<MarketDataFontKey, string> = {
  'plex-mono': "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace",
  inter: "'Inter', sans-serif"
}

/** [up, down] hex pairs per scheme. 'colorblind' swaps red for a blue-leaning tone (deuteranopia/protanopia-safe against the existing green). */
const COLOR_SCHEMES: Record<ColorSchemeKey, [string, string]> = {
  default: ['#00ff88', '#ff4444'],
  colorblind: ['#00ff88', '#3b82f6'],
  swapped: ['#ff4444', '#00ff88']
}

export const TIMEZONE_LABELS: Record<TimezoneKey, string> = {
  UTC: 'UTC / GMT',
  local: 'Local (device)',
  'America/New_York': 'New York',
  'Europe/London': 'London',
  'Asia/Tokyo': 'Tokyo',
  'Asia/Hong_Kong': 'Hong Kong'
}

export interface AppearanceState {
  fontScaleKey: FontScaleKey
  chromeFontKey: ChromeFontKey
  marketDataFontKey: MarketDataFontKey
  colorSchemeKey: ColorSchemeKey
  timezone: TimezoneKey
  hydrated: boolean
}

const STORAGE_KEY = 'strades_appearance_v1'

export const useAppearanceStore = defineStore('appearance', {
  state: (): AppearanceState => ({
    fontScaleKey: 'medium',
    chromeFontKey: 'poppins',
    marketDataFontKey: 'plex-mono',
    colorSchemeKey: 'default',
    timezone: 'UTC',
    hydrated: false
  }),

  getters: {
    fontScale: (s) => FONT_SCALES[s.fontScaleKey],
    chromeFontFamily: (s) => CHROME_FONTS[s.chromeFontKey],
    marketDataFontFamily: (s) => MARKET_DATA_FONTS[s.marketDataFontKey],
    upColor: (s) => COLOR_SCHEMES[s.colorSchemeKey][0],
    downColor: (s) => COLOR_SCHEMES[s.colorSchemeKey][1],
    /** IANA zone name to hand to Intl.DateTimeFormat; 'local' resolves to the device's own zone. */
    resolvedTimezone: (s): string =>
      s.timezone === 'local'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : s.timezone === 'UTC' ? 'UTC' : s.timezone,
    timezoneLabel: (s) => TIMEZONE_LABELS[s.timezone]
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          this.fontScaleKey = parsed.fontScaleKey ?? this.fontScaleKey
          this.chromeFontKey = parsed.chromeFontKey ?? this.chromeFontKey
          this.marketDataFontKey = parsed.marketDataFontKey ?? this.marketDataFontKey
          this.colorSchemeKey = parsed.colorSchemeKey ?? this.colorSchemeKey
          this.timezone = parsed.timezone ?? this.timezone
        }
      } catch { /* fresh start */ }
      this.hydrated = true
    },

    persist() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          fontScaleKey: this.fontScaleKey,
          chromeFontKey: this.chromeFontKey,
          marketDataFontKey: this.marketDataFontKey,
          colorSchemeKey: this.colorSchemeKey,
          timezone: this.timezone
        }))
      } catch { /* quota full — non-fatal */ }
    },

    setFontScale(key: FontScaleKey) { this.fontScaleKey = key; this.persist() },
    setChromeFont(key: ChromeFontKey) { this.chromeFontKey = key; this.persist() },
    setMarketDataFont(key: MarketDataFontKey) { this.marketDataFontKey = key; this.persist() },
    setColorScheme(key: ColorSchemeKey) { this.colorSchemeKey = key; this.persist() },
    setTimezone(key: TimezoneKey) { this.timezone = key; this.persist() }
  }
})
