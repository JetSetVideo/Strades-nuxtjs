import { defineStore } from "pinia";
import discussionsData from "~/data/Discussions.json";
export const useDiscussionsStore = defineStore("discussionsStore", () => {
    const discussions = ref(discussionsData)
    return {
        discussions
    }
})