import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { PORT, CORS_ORIGIN, QWEATHER_API_KEY, ELEME_APP_KEY, RIDER_WS_URL, ORDER_STREAM_URL } from './config.js'

// 启动时打印环境变量状态
function logEnvStatus() {
  console.log('')
  console.log('╔════════════════════════════════════════════════╗')
  console.log('║   4 个真实数据接入端口 - 状态                       ║')
  console.log('╠════════════════════════════════════════════════╣')
  console.log(`║   QWEATHER_API_KEY:     ${(QWEATHER_API_KEY ? '✅ 已配 (' + QWEATHER_API_KEY.slice(0, 4) + '...)' : '❌ 未配').padEnd(30)}║`)
  console.log(`║   ELEME_APP_KEY:        ${(ELEME_APP_KEY ? '✅ 已配' : '⚠️ 未配 (使用 mock)').padEnd(30)}║`)
  console.log(`║   RIDER_WS_URL:         ${(RIDER_WS_URL ? '✅ 已配' : '⚠️ 未配 (使用 mock)').padEnd(30)}║`)
  console.log(`║   ORDER_STREAM_URL:     ${(ORDER_STREAM_URL ? '✅ 已配' : '⚠️ 未配 (使用 mock)').padEnd(30)}║`)
  console.log('╚════════════════════════════════════════════════╝')
  console.log('')
}

import authRouter from './routes/auth.js'
import citiesRouter from './routes/cities.js'
import dashboardRouter from './routes/dashboard.js'
import riderTypesRouter from './routes/rider-types.js'
import riderRouter from './routes/rider.js'
import cEndRouter from './routes/c-end.js'
import decisionRouter from './routes/decision.js'
import chatRouter from './routes/chat.js'
import aiInsightsRouter from './routes/ai-insights.js'
import contextRouter from './routes/context.js'
import alertRouter from './routes/alert.js'
import dispatchRouter from './routes/dispatch.js'
import simulationRouter from './routes/simulation.js'
import optimizeRouter from './routes/optimize.js'
import adaptersRouter from './routes/adapters.js'
import debugRouter from './routes/debug.js'
import { startRiderSimulator } from './adapters/riderTelemetryAdapter.js'
import { startOrderPoolSimulator } from './adapters/orderPoolAdapter.js'

const app = express()

// 中间件
app.use(compression())
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    code: 0,
    data: {
      service: '配送小智 AI 后端',
      version: '1.0.0',
      uptime: process.uptime(),
      ts: Date.now()
    }
  })
})

// 路由
app.use('/api/auth', authRouter)
app.use('/api/cities', citiesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/rider-types', riderTypesRouter)
app.use('/api/riders', riderRouter)
app.use('/api/c-end', cEndRouter)
app.use('/api/decision', decisionRouter)
app.use('/api/chat', chatRouter)
app.use('/api/ai-insights', aiInsightsRouter)
app.use('/api/context', contextRouter)
app.use('/api/alert', alertRouter)
app.use('/api/dispatch', dispatchRouter)
app.use('/api/simulation', simulationRouter)
app.use('/api/optimize', optimizeRouter)
app.use('/api/adapters', adaptersRouter)
app.use('/api/debug', debugRouter)

// 全局错误处理
app.use((err, _req, res, _next) => {
  console.error('[Error]', err)
  res.status(500).json({ code: 500, message: err.message || 'Server Error' })
})

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: `Not Found: ${req.path}` })
})

// 启动适配器模拟器
function startAdapters() {
  startRiderSimulator(null);
  startOrderPoolSimulator(null);
  console.log('[Adapters] 骑手 + 订单流模拟器已启动');
}

app.listen(PORT, () => {
  startAdapters();
  logEnvStatus();
  console.log(`\n╔════════════════════════════════════════╗`)
  console.log(`║   配送小智 AI 后端服务已启动            ║`)
  console.log(`║   http://localhost:${PORT}/api           ║`)
  console.log(`║   CORS 来源: ${CORS_ORIGIN.padEnd(22)}║`)
  console.log(`╚════════════════════════════════════════╝\n`)
})
