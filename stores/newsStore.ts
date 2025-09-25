import {defineStore} from 'pinia';
import newsData from '~/data/news.json';
export const useNewsStore = defineStore('newsStore',()=>{
    const news = ref(newsData)
    return{
        news
    }
})