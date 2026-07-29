// @ts-nocheck
import axios from 'axios'
import { ElMessage } from 'element-plus'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'
import { API_BASE_URL } from '@/utils/apiBase'

// ============ 分级 Timeout 策略 ============
// Render Free 冷启动 30-50s；普通接口不应等那么久（用户体感 5s 内必须有反馈）
// AI 决策 / Chat 必须留足窗口（豆包 / DeepSeek 第一次冷启动可达 60s）
const TIMEOUT_PROFILE = {
  health: 30_000,        // /api/health: 容忍 Render 冷启动
  fast: 15_000,          // 普通查询（Dashboard / 列表 / 状态）
  ai: 90_000,            // /api/decision/run / /api/chat/* 允许更长
  upload: 120_000        // 知识库上传等
}

function pickTimeout(url = '') {
  // 🐛 修复：axios 传进来的是裸 url（baseURL 已剥掉 /api/ 前缀），
  // 老代码正则要求 /api/ 前缀，导致 /decision/run 等 AI 端点全部
  // fallback 到 15s fast timeout，而 LLM 实际 23-90s，必然超时。
  const norm = (url || '').replace(/^\/?api\//, '/')
  if (/\/health(\b|\/|$)/.test(norm)) return TIMEOUT_PROFILE.health
  if (/\/decision\/(run|feedback)/.test(norm)) return TIMEOUT_PROFILE.ai
  if (/\/chat(\b|\/|$)/.test(norm)) return TIMEOUT_PROFILE.ai
  if (/\/llm(\b|\/|$)/.test(norm)) return TIMEOUT_PROFILE.ai
  if (/\/knowledge\/upload/.test(norm)) return TIMEOUT_PROFILE.upload
  return TIMEOUT_PROFILE.fast
}


const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_PROFILE.fast,
  // 不要自动重试写操作
  validateStatus: (s) => s >= 200 && s < 500
})

service.interceptors.request.use(
  (config) => {
    nprogress.start()
    const token = localStorage.getItem('jiuxiaozhi-auth-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // 按 url 调整单次 timeout
    const url = config.url || ''
    config.timeout = pickTimeout(url.startsWith('http') ? new URL(url).pathname : url)
    return config
  }
)

service.interceptors.response.use(
  (response) => {
    nprogress.done()
    const res = response.data
    // 健康检查直返
    if (/\/api\/health(\b|\/|$)/.test(response.config?.url || '')) {
      return res
    }
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
      ElMessage.error('登录已失效，请重新登录')
    } else if (res.code === 404) {
      ElMessage.error(res.message || '接口不存在')
    } else if (res.code === 429) {
      ElMessage.warning(res.message || '请求过于频繁')
    } else if (res.code >= 500) {
      ElMessage.error('服务异常：' + (res.message || '请稍后重试'))
    } else {
      ElMessage.error(res.message || '请求失败')
    }
    return Promise.reject(new Error(res.message || `Error ${res.code}`))
  },
  (error) => {
    nprogress.done()
    const status = error.response?.status
    if (status === 401) {
      localStorage.removeItem('jiuxiaozhi-auth-token')
      if (!window.location.hash.includes('login')) {
        window.location.hash = '/login'
      }
      ElMessage.error('登录已失效，请重新登录')
    } else if (status === 404) {
      ElMessage.error('接口不存在（404）：' + (error.config?.url || ''))
    } else if (status === 429) {
      ElMessage.warning('请求过于频繁，请稍后重试')
    } else if (status >= 500) {
      ElMessage.error('服务异常（' + status + '），请稍后重试')
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const url = error.config?.url || ''
      if (/\/api\/decision\/run/.test(url)) {
        ElMessage.warning('AI 决策生成超时（豆包/DeepSeek 冷启动可能需要 60-90s），请稍后重试')
      } else {
        ElMessage.warning('请求超时，Render 后端冷启动可能需要 30-50s，请稍后重试')
      }
    } else if (error.message?.includes('Network')) {
      ElMessage.error('后端连接失败，请检查 Render 服务是否在线 / 网络是否可达')
    } else {
      ElMessage.error(error.message || '网络异常')
    }
    return Promise.reject(error)
  }
)

export async function request<T = any>(config: any): Promise<T> {
  // @ts-ignore: axios 返回 Promise<AxiosResponse<T>>，但我们拦截后已解开 data
  const res = await service.request(config)
  return res as T
}

export default service
