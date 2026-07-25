// API 基础 URL - 全局统一
// CI打包部署时 → 读取环境变量Render后端
// 本地开发（5173）时 → 走相对路径（同源代理到 3000）

export const API_BASE_URL = (() => {
  // 流水线打包优先读取注入的线上后端地址
  if (import.meta.env.VITE_API_BASE_URL) {
    return `${import.meta.env.VITE_API_BASE_URL}/api`;
  }
  if (typeof window === 'undefined') return '/api';
  const host = window.location.hostname;
  // GitHub Pages 部署兼容
  if (host.includes('github.io')) {
    return 'https://peisong-backend.onrender.com/api';
  }
  // 本地开发
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/api';
  }
  // 其他环境同源请求
  return '/api';
})();

export const API_FULL_URL = API_BASE_URL.replace(/\/api$/, '');

export default API_BASE_URL;
