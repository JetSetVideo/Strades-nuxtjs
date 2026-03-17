import { defineStore } from 'pinia'

// In a real app this would fetch live FX rates
// We keep a simple map here for demonstration
const mockFXRates: Record<string, number> = {
  'USD': 1.0,
  'EUR': 0.92,
  'GBP': 0.79,
  'JPY': 0.76,
  'BTC': 0.000015 // Example mock rate
}

export interface CurrencyState {
  baseCurrency: string
  rates: Record<string, number>
}

export const useCurrencyStore = defineStore('currency', {
  state: (): CurrencyState => ({
    baseCurrency: 'USD',
    rates: { ...mockFXRates }
  }),
  actions: {
    setBaseCurrency(currency: string) {
      if (this.rates[currency]) {
        this.baseCurrency = currency
      }
    }
  },
  getters: {
    // Converts a USD nominal price into the user's base currency
    convertFromUSD: (state) => {
      return (amountInUSD: number) => {
        const rate = state.rates[state.baseCurrency] || 1.0;
        return amountInUSD * rate;
      }
    },
    // Generic converter between any two supported currencies
    convert: (state) => {
      return (amount: number, fromCurrency: string, toCurrency: string = state.baseCurrency) => {
        const fromRate = state.rates[fromCurrency];
        const toRate = state.rates[toCurrency];
        if (!fromRate || !toRate) return amount; // Fallback
        
        // Convert 'from' to USD, then USD to 'to'
        const amountInUSD = amount / fromRate;
        return amountInUSD * toRate;
      }
    }
  }
})
