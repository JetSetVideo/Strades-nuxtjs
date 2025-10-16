import { defineStore } from 'pinia';

export const usePriceStore = defineStore('price', {
  state: () => ({
    priceHistory: {
      BTC: [
        { date: '2023-05-01', price: 29000 },
        { date: '2023-05-02', price: 30000 },
        { date: '2023-05-03', price: 31000 },
        { date: '2023-05-04', price: 30500 },
        { date: '2023-05-05', price: 31500 },
      ],
      ETH: [
        { date: '2023-05-01', price: 1800 },
        { date: '2023-05-02', price: 1850 },
        { date: '2023-05-03', price: 1900 },
        { date: '2023-05-04', price: 1880 },
        { date: '2023-05-05', price: 1920 },
      ],
      USDT: [
        { date: '2023-05-01', price: 1 },
        { date: '2023-05-02', price: 1 },
        { date: '2023-05-03', price: 1 },
        { date: '2023-05-04', price: 1 },
        { date: '2023-05-05', price: 1 },
      ],
    },
  }),
  getters: {
    getPriceData: (state) => (currency: 'BTC' | 'USD' | 'EUR') => {
      return Object.entries(state.priceHistory).reduce((acc: Record<string, any[]>, [asset, prices]) => {
        acc[asset] = prices.map(price => ({
          ...price,
          price: price.price / usePriceStore().getExchangeRate(currency)
        }));
        return acc;
      }, {});
    },
    getExchangeRate: () => {
      const rates = {
        BTC: 1,
        USD: 30000,
        EUR: 25000,
      };
      return (currency: 'BTC' | 'USD' | 'EUR') => {
        return rates[currency] ?? 1;
      };
    },
  },
});