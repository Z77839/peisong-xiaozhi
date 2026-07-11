// API 基础 URL - 全局统一
// GitHub Pages 部署时 → 走 Render 后端
// 本地开发（5173）时 → 走相对路径（同源代理到 3000）

export const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '/api';
  const host = window.location.hostname;
  // GitHub Pages 部署
  if (host.includes('github.io')) {
    return 'https://peisong-backend.onrender.com/api';
  }
  // 本地开发
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/api';
  }
  // 其他（自部署 / 内网）— 用同源
  return '/api';
})();

export const API_FULL_URL = API_BASE_URL.replace(/\/api$/, '');

export default API_BASE_URL;
