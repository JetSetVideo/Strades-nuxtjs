import { defineStore } from 'pinia';
import assetsData from '@/data/wallet/assets.json';
import tradesData from '@/data/wallet/trades.json';
import pricesData from '@/data/wallet/prices.json';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    assets: assetsData,
    trades: tradesData,
    prices: pricesData,
  }),
  getters: {
    getWalletData: (state) => (currency) => {
      const totalBalance = state.assets.reduce((total, asset) => {
        const assetPrice = state.prices[asset.name][currency];
        return total + asset.amount * assetPrice;
      }, 0);

      return {
        totalBalance,
        assets: state.assets.map(asset => ({
          ...asset,
          value: asset.amount * state.prices[asset.name][currency]
        })),
        trades: state.trades
      };
    },
    getAssetPrice: (state) => (asset, currency) => {
      return state.prices[asset][currency];
    },
  },
});