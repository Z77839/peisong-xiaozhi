import 'dotenv/config'

export const PORT = parseInt(process.env.PORT || '3000', 10)
export const JWT_SECRET = process.env.JWT_SECRET || 'jiuxiaozhi_dev_secret'
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

export const COZE = {
  botId: process.env.COZE_BOT_ID || '',
  apiKey: process.env.COZE_API_KEY || '',
  enabled: !!(process.env.COZE_BOT_ID && process.env.COZE_API_KEY),
  endpoint: 'https://api.coze.cn/v3/chat'
}
