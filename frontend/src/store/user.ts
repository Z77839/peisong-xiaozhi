import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '@/api/request'

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar: string
  role: string
  org: string
}

interface LoginResp {
  token: string
  userInfo: UserInfo
}

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref<string>('')
    const userInfo = ref<UserInfo | null>(null)

    const setToken = (t: string) => {
      token.value = t
      localStorage.setItem('jiuxiaozhi-auth-token', t)
    }

    const setUserInfo = (info: UserInfo) => {
      userInfo.value = info
    }

    const login = async (account: string, password: string) => {
      const data: any = await request({
        url: '/auth/login',
        method: 'POST',
        data: { account, password }
      })
      setToken(data.token)
      setUserInfo(data.userInfo)
      return data.token
    }

    const logout = () => {
      token.value = ''
      userInfo.value = null
      localStorage.removeItem('jiuxiaozhi-auth-token')
      localStorage.removeItem('jiuxiaozhi-user')
    }

    return { token, userInfo, setToken, setUserInfo, login, logout }
  },
  {
    persist: {
      key: 'jiuxiaozhi-user',
      storage: localStorage
    }
  }
)
