import { defineStore } from "pinia";
import assetsData from "~/data/assets.json";

export const useAssetsStore = defineStore("assetsStore", () => {
    const assets = ref(assetsData);

    const getAssetsByCategory = (category) => {
        return assets.value.categories.find(c => c.name === category)?.companies || [];
    };

    const sortAssetsByPerformance = (assets, order = 'desc') => {
        return [...assets].sort((a, b) => {
            const aPerformance = parseFloat(a.change_percent);
            const bPerformance = parseFloat(b.change_percent);
            return order === 'desc' ? bPerformance - aPerformance : aPerformance - bPerformance;
        });
    };

    const filterAssetsByPerformance = (assets, threshold) => {
        return assets.filter(asset => parseFloat(asset.change_percent) >= threshold);
    };

    const getTopPerformingAssets = (category, limit = 5) => {
        const categoryAssets = getAssetsByCategory(category);
        const sortedAssets = sortAssetsByPerformance(categoryAssets);
        return sortedAssets.slice(0, limit);
    };

    const getWorstPerformingAssets = (category, limit = 5) => {
        const categoryAssets = getAssetsByCategory(category);
        const sortedAssets = sortAssetsByPerformance(categoryAssets, 'asc');
        return sortedAssets.slice(0, limit);
    };

    return {
        assets,
        getAssetsByCategory,
        sortAssetsByPerformance,
        filterAssetsByPerformance,
        getTopPerformingAssets,
        getWorstPerformingAssets
    };
});