// Debug 路由 - 环境变量诊断
// 让用户能直接看到哪些 API Key 已配 / 未配
import { Router } from 'express'
import { QWEATHER_API_KEY } from '../config.js'

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
        }
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
