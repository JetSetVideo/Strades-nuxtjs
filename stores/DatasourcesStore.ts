import { defineStore } from "pinia";
import DatasourcesData from "~/data/Datasources.json";
export const useDatasourcesStore = defineStore("datasourcesStore",()=>{
    const datasources = ref(DatasourcesData)
    return{
        datasources
    }
})