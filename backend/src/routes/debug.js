// Debug 路由 - 环境变量诊断
// 让用户能直接看到哪些 API Key 已配 / 未配
import { Router } from 'express'
import { QWEATHER_API_KEY, DOUBAO, DEEPSEEK, COZE, LLM_ROUTER } from '../config.js'

const router = Router()

router.get('/env-check', (_req, res) => {
  res.json({
    code: 0,
    data: {
      // 4 个真实数据接入端口
      adapters: {
        'QWEATHER_API_KEY': {
          configured: !!QWEATHER_API_KEY,
          preview: QWEATHER_API_KEY ? QWEATHER_API_KEY.slice(0, 4) + '...' + QWEATHER_API_KEY.slice(-4) : null
        },
        'QWEATHER_API_HOST': {
          configured: !!process.env.QWEATHER_API_HOST,
          preview: process.env.QWEATHER_API_HOST || null
        },
        'ELEME_APP_KEY': {
          configured: !!process.env.ELEME_APP_KEY,
          preview: process.env.ELEME_APP_KEY
            ? process.env.ELEME_APP_KEY.slice(0, 4) + '...' + process.env.ELEME_APP_KEY.slice(-4)
            : null
        },
        'RIDER_WS_URL': {
          configured: !!process.env.RIDER_WS_URL,
          preview: process.env.RIDER_WS_URL
            ? process.env.RIDER_WS_URL.slice(0, 20) + '...'
            : null
        },
        'ORDER_STREAM_URL': {
          configured: !!process.env.ORDER_STREAM_URL,
          preview: process.env.ORDER_STREAM_URL
            ? process.env.ORDER_STREAM_URL.slice(0, 20) + '...'
            : null
        },
        // LLM 模型状态
        'DOUBAO': {
          configured: DOUBAO.enabled,
          preview: DOUBAO.enabled ? `${DOUBAO.model} (ARK 已配)` : null
        },
        'DEEPSEEK': {
          configured: DEEPSEEK.enabled,
          preview: DEEPSEEK.enabled ? `${DEEPSEEK.model} (API Key 已配)` : null
        }
      },
      // LLM 路由
      llm: {
        strategy: LLM_ROUTER.strategy,
        default: LLM_ROUTER.default,
        doubao: { enabled: DOUBAO.enabled, model: DOUBAO.model },
        deepseek: { enabled: DEEPSEEK.enabled, model: DEEPSEEK.model },
        coze: { enabled: COZE.enabled }
      },
      // Node 环境
      runtime: {
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        uptime: process.uptime().toFixed(2) + 's',
        ts: Date.now()
      }
    }
  })
})

export default router
