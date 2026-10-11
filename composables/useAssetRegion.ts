import { COUNTRY_LATLNG, type LatLng } from '~/composables/useCountryLatLng'
import type { Asset } from '~/types/asset'

export interface AssetRegion {
  iso: string
  label: string
  latlng: LatLng
}

/**
 * Heuristic location-string → region mapper for the Prices map view.
 * Assets carry a free-text `location` field ("Cupertino, CA, USA",
 * "Decentralized", "Global", "China", …) rather than an ISO code, so this
 * does simple substring matching against the country names/abbreviations
 * actually seen in the asset catalog. Falls back to a GLOBAL bucket for
 * decentralized/borderless assets (crypto, commodities) rather than
 * guessing — better an honest "Global" region than a wrong country.
 */
const PATTERNS: Array<{ test: RegExp; iso: string; label: string }> = [
  { test: /\busa\b|united states/i, iso: 'US', label: 'United States' },
  { test: /\bchina\b/i, iso: 'CN', label: 'China' },
  { test: /\beurope\b|\beu\b/i, iso: 'EU', label: 'Europe' },
  { test: /japan/i, iso: 'JP', label: 'Japan' },
  { test: /\bgermany\b/i, iso: 'DE', label: 'Germany' },
  { test: /united kingdom|\buk\b/i, iso: 'GB', label: 'United Kingdom' },
  { test: /\bindia\b/i, iso: 'IN', label: 'India' },
  { test: /decentralized|global|worldwide/i, iso: 'GLOBAL', label: 'Global' },
]

const GLOBAL_LL: LatLng = COUNTRY_LATLNG.GLOBAL ?? { lat: 20, lng: 0 }

export function regionOf(asset: Pick<Asset, 'location'>): AssetRegion {
  const loc = asset.location ?? ''
  for (const p of PATTERNS) {
    if (p.test.test(loc)) {
      return { iso: p.iso, label: p.label, latlng: COUNTRY_LATLNG[p.iso] ?? GLOBAL_LL }
    }
  }
  return { iso: 'GLOBAL', label: 'Global', latlng: GLOBAL_LL }
}

export function useAssetRegion() {
  return { regionOf }
}
