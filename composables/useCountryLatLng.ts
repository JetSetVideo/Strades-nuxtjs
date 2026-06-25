/**
 * Country → approximate centroid lat/lng map.
 *
 * Used by pages and components that render world-map markers / routes from
 * ISO-2 country codes (assets/[id], wallet, strategies, news, …).
 *
 * Approximate; not survey-accurate. Sufficient for the resolution at which
 * markers are drawn.
 */
export interface LatLng { lat: number; lng: number }

export const COUNTRY_LATLNG: Record<string, LatLng> = {
  US: { lat: 37.0902, lng: -95.7129 }, CN: { lat: 35.8617, lng: 104.1954 },
  JP: { lat: 36.2048, lng: 138.2529 }, KR: { lat: 35.9078, lng: 127.7669 },
  TW: { lat: 23.6978, lng: 120.9605 }, DE: { lat: 51.1657, lng: 10.4515 },
  FR: { lat: 46.2276, lng: 2.2137 },   GB: { lat: 55.3781, lng: -3.4360 },
  IN: { lat: 20.5937, lng: 78.9629 },  BR: { lat: -14.2350, lng: -51.9253 },
  RU: { lat: 61.5240, lng: 105.3188 }, AE: { lat: 23.4241, lng: 53.8478 },
  CH: { lat: 46.8182, lng: 8.2275 },   CL: { lat: -35.6751, lng: -71.5430 },
  HK: { lat: 22.3193, lng: 114.1694 }, SA: { lat: 23.8859, lng: 45.0792 },
  SG: { lat: 1.3521,  lng: 103.8198 }, ES: { lat: 40.4637, lng: -3.7492 },
  IT: { lat: 41.8719, lng: 12.5674 },  IR: { lat: 32.4279, lng: 53.6880 },
  IE: { lat: 53.4129, lng: -8.2439 },  NL: { lat: 52.1326, lng: 5.2913 },
  CA: { lat: 56.1304, lng: -106.3468 },MX: { lat: 23.6345, lng: -102.5528 },
  VN: { lat: 14.0583, lng: 108.2772 }, EU: { lat: 50.1109, lng: 8.6821 },
  KZ: { lat: 48.0196, lng: 66.9237 },  SV: { lat: 13.7942, lng: -88.8965 },
  OM: { lat: 21.4735, lng: 55.9754 },  DK: { lat: 56.2639, lng: 9.5018 },
  LU: { lat: 49.8153, lng: 6.1296 },   MT: { lat: 35.9375, lng: 14.3754 },
  UA: { lat: 48.3794, lng: 31.1656 },  EE: { lat: 58.5953, lng: 25.0136 },
  AU: { lat: -25.2744, lng: 133.7751 },GLOBAL: { lat: 0, lng: 0 }
}

export function useCountryLatLng() {
  /** Lookup a country's lat/lng. Returns null if unknown. */
  const lookup = (iso: string | undefined | null): LatLng | null => {
    if (!iso) return null
    return COUNTRY_LATLNG[iso.toUpperCase()] ?? null
  }
  return { COUNTRY_LATLNG, lookup }
}
