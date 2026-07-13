import 'dotenv/config'

export const PORT = parseInt(process.env.PORT || '3000', 10)
export const NODE_ENV = process.env.NODE_ENV || 'development'

// 严格 JWT secret 检查：默认值仅限开发环境
const _defaultSecret = 'jiuxiaozhi_dev_only_do_not_use_in_prod'
export const JWT_SECRET = process.env.JWT_SECRET || _defaultSecret
if (NODE_ENV === 'production' && JWT_SECRET === _defaultSecret) {
  console.error('[FATAL] 生产环境必须设置 JWT_SECRET 环境变量！')
  process.exit(1)
}

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
export const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '300', 10)
export const DEBUG_MODE = process.env.DEBUG_MODE === 'true'
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

// CORS 多域名支持
export const CORS_ORIGIN = (() => {
  const o = process.env.CORS_ORIGIN || '*'
  if (o === '*') return '*'
  return o.split(',').map(s => s.trim()).filter(Boolean)
})()

// 4 个真实数据接入端口的 API Key
export const QWEATHER_API_KEY = process.env.QWEATHER_API_KEY || ''
export const ELEME_APP_KEY = process.env.ELEME_APP_KEY || ''
export const RIDER_WS_URL = process.env.RIDER_WS_URL || ''
export const ORDER_STREAM_URL = process.env.ORDER_STREAM_URL || ''

export const COZE = {
  botId: process.env.COZE_BOT_ID || '',
  apiKey: process.env.COZE_API_KEY || '',
  enabled: !!(process.env.COZE_BOT_ID && process.env.COZE_API_KEY),
  endpoint: 'https://api.coze.cn/v3/chat'
}
