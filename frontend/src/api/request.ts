// @ts-nocheck
import axios from 'axios'
import { ElMessage } from 'element-plus'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'

// 通过 Render 部署的后端（跨域）
const API_BASE = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? 'https://peisong-backend.onrender.com/api'
  : '/api';

const service = axios.create({
  baseURL: API_BASE,
  timeout: 30000
})

service.interceptors.request.use(
  (config) => {
    nprogress.start()
    const token = localStorage.getItem('jiuxiaozhi-auth-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  }
)

service.interceptors.response.use(
  (response) => {
    nprogress.done()
    const res = response.data
    if (!res || typeof res !== 'object' || !('code' in res)) {
      return res
    }
    if (res.code === 0 || res.code === 200) {
      return res.data
    }
    if (res.code === 401) {
      localStorage.removeItem('jiuxiaozhi-auth-token')
      localStorage.removeItem('jiuxiaozhi-user')
      if (!window.location.hash.includes('login')) {
        window.location.hash = '/login'
      }
    }
    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || 'Error'))
  },
  (error) => {
    nprogress.done()
    if (error.response?.status === 401) {
      localStorage.removeItem('jiuxiaozhi-auth-token')
      if (!window.location.hash.includes('login')) {
        window.location.hash = '/login'
      }
    }
    ElMessage.error(error.message || '网络异常')
    return Promise.reject(error)
  }
)

export async function request<T = any>(config: any): Promise<T> {
  // @ts-ignore: axios 返回 Promise<AxiosResponse<T>>，但我们拦截后已解开 data
  const res = await service.request(config)
  return res as T
}

export default service
