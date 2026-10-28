import { describe, expect, it } from 'vitest'
import { linkedLogo, linkedSymbol, linkedTone } from '~/utils/linkedDesk'

describe('linked desk', () => {
  it('resolves a company name to the ticker the catalogue uses', () => {
    expect(linkedSymbol('TSMC')).toBe('TSM')
    expect(linkedSymbol('Meta Platforms')).toBe('META')
    expect(linkedSymbol('US Dollar')).toBe('USD')
    expect(linkedSymbol('Microsoft', 'MSFT')).toBe('MSFT')
  })

  it('paints each asset class with its own colour', () => {
    expect(linkedTone(null, 'XAU').color).toBe('#f4c145')
    expect(linkedTone(null, 'NG').label).toBe('Commodity')
    expect(linkedTone(null, 'BTC').color).toBe('#b48aff')
    expect(linkedTone(null, 'EUR').color).toBe('#4fa8ff')
    expect(linkedTone(null, 'MSFT').color).toBe('#00e58a')
    expect(linkedTone({ type: 'bet', symbol: 'KXELONMARS-99' }, 'KXELONMARS-99').label).toBe('Bet')
    expect(linkedTone(null, '').label).toBe('')
  })

  it('prefers a real logo, then a local file, then class artwork', () => {
    expect(linkedLogo('https://cdn.example/msft.png', 'MSFT')).toBe('https://cdn.example/msft.png')
    expect(linkedLogo('', 'NVDA')).toBe('/logos/nvidia.png')
    expect(linkedLogo('', 'AMD')).toContain('AMD.png')
    expect(linkedLogo('', 'XAU')).toMatch(/^data:image\/svg/)
    expect(linkedLogo('https://www.countryflags.io/us/flat/64.png', 'USD')).toMatch(/^data:image\/svg/)
    expect(linkedLogo('', '')).toBeNull()
  })
})