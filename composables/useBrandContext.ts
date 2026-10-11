/**
 * Brand context — lets a page temporarily replace the generic mark in the top
 * navigation bar with the brand it is currently showing.
 *
 * On an asset page the bar adopts that asset's parent-company logo (Tesla on
 * TSLA) or, for assets with no issuer such as Gold or Bitcoin, the asset-class
 * artwork shown in the page header. It deliberately never adopts the asset's
 * own icon.
 *
 * Pages call `setBrand()` when their subject resolves and `clearBrand()` on
 * unmount; `useBrandScope()` wires that lifecycle up for you.
 */
import { computed, onScopeDispose, ref } from 'vue'
import { assetClassArtwork, type AssetLike } from '~/utils/assetClass'

export interface BrandContext {
  /** Image src for the bar — a company logo or class artwork, never an asset icon. */
  logo: string
  /** Accessible name, e.g. "Tesla, Inc." or "Precious Metals". */
  label: string
  /** Where clicking the mark should go. Defaults to the dashboard. */
  to?: string
}

const brand = ref<BrandContext | null>(null)

/**
 * Known issuer logos, keyed by ticker. An asset only adopts a company mark
 * when its issuer genuinely has one; everything else falls back to class
 * artwork so the bar never shows the asset's own coin/metal icon.
 */
const COMPANY_LOGOS: Record<string, { logo: string; label: string }> = {
  TSLA:  { logo: '/logos/logo_Tesla.png', label: 'Tesla, Inc.' },
  AAPL:  { logo: '/logos/apple.png',      label: 'Apple Inc.' },
  AMZN:  { logo: '/logos/amazon.png',     label: 'Amazon.com, Inc.' },
  GOOGL: { logo: '/logos/google.png',     label: 'Alphabet Inc.' },
  MSFT:  { logo: '/logos/msft.png',       label: 'Microsoft Corporation' },
  INTC:  { logo: '/logos/intel.png',      label: 'Intel Corporation' },
  F:     { logo: '/logos/f.png',          label: 'Ford Motor Company' },
  AAL:   { logo: '/logos/aal.png',        label: 'American Airlines Group' },
  NVDA:  { logo: '/logos/nvidia.png',     label: 'NVIDIA Corporation' },
  SHOP:  { logo: '/logos/shop.png',       label: 'Shopify Inc.' },
  T:     { logo: '/logos/t.png',          label: 'AT&T Inc.' },
  UBS:   { logo: '/logos/ubs.png',        label: 'UBS Group AG' },
  WBD:   { logo: '/logos/wbd.png',        label: 'Warner Bros. Discovery' },
  NSRGY: { logo: '/logos/nsrgy.png',      label: 'Nestlé S.A.' },
}

export const useBrandContext = () => {
  const setBrand = (next: BrandContext | null) => { brand.value = next }
  const clearBrand = () => { brand.value = null }

  /**
   * Derive the bar's mark for an asset: the issuer's logo when one exists,
   * otherwise the artwork for the asset's class.
   */
  const setBrandFromAsset = (asset: (AssetLike & { id?: string | null }) | null | undefined) => {
    if (!asset) return clearBrand()

    const company = COMPANY_LOGOS[(asset.symbol ?? '').toUpperCase()]
    if (company) {
      return setBrand({ ...company, to: asset.id ? `/assets/${asset.id}` : undefined })
    }

    return setBrand({
      logo: assetClassArtwork(asset),
      label: asset.name ?? asset.symbol ?? 'Asset',
      to: asset.id ? `/assets/${asset.id}` : undefined,
    })
  }

  return {
    brand: computed(() => brand.value),
    hasBrand: computed(() => brand.value !== null),
    setBrand,
    setBrandFromAsset,
    clearBrand,
  }
}

/**
 * Same as `useBrandContext`, but clears the brand automatically when the
 * calling component's scope is destroyed — so navigating away from an asset
 * page always restores the generic Strades mark.
 */
export const useBrandScope = () => {
  const ctx = useBrandContext()
  onScopeDispose(() => ctx.clearBrand())
  return ctx
}
