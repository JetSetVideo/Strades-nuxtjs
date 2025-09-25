import { defineStore } from "pinia";
import bitcoinData from "~/data/Bitcoin.json";
export const useBitcoinStore = defineStore("bitcoinStore", () => {
    const bitcoinPrices = ref(bitcoinData)
    return {
        bitcoinPrices
    }
})