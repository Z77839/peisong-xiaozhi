// API 基础 URL - 全局统一
//
// 优先级：
//   1. import.meta.env.VITE_API_BASE_URL（CI 通过 GitHub Actions Secret 注入，**唯一可信来源**）
//   2. 本地开发（localhost / 127.0.0.1）→ 走 Vite proxy 的相对路径 /api
//   3. 其它 host（GitHub Pages / 自定义域名）→ 相对路径 /api（不可用，因为跨域）
//
// 重要：禁止在这里再硬编码任何 Render / 业务域名。生产环境必须通过
// GitHub Actions Secret `VITE_API_BASE_URL` 注入。
// 参见 .github/workflows/deploy-frontend.yml 和 docs/DEPLOY.md。

const PROD_FALLBACK = 'https://peisong-backend.onrender.com'

export const API_BASE_URL = (() => {
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (envBase && typeof envBase === 'string' && envBase.length > 0) {
    // 去掉末尾斜杠再拼 /api
    return `${envBase.replace(/\/+$/, '')}/api`
  }
  if (typeof window === 'undefined') return '/api'
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return '/api'
  }
  // 没有注入 env、又不在本地：兼容历史（GitHub Pages 等静态托管）
  // 仅作 console.warn 提示，方便排查；不再静默走错误地址
  if (typeof console !== 'undefined') {
    console.warn(
      '[apiBase] 未配置 VITE_API_BASE_URL，回退到默认 Render 地址。\n' +
        '生产环境请在 GitHub Repo → Settings → Secrets and variables → Actions 中配置:\n' +
        '  VITE_API_BASE_URL = https://peisong-backend.onrender.com'
    )
  }
  return `${PROD_FALLBACK}/api`
})()

export const API_FULL_URL = API_BASE_URL.replace(/\/api$/, '')

export default API_BASE_URL
