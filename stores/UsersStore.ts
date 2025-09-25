import {defineStore} from 'pinia';
import usersData from '~/data/Users.json';
export const useUsersStore = defineStore('UsersStore',()=>{
    const users = ref(usersData)
    return{
        users
    }
})