/**
 * 配送小智 - 生产级 Node.js 后端
 * 安全 / 性能 / 可观测性 / 限流 / 错误处理
 */
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PORT, CORS_ORIGIN, NODE_ENV, RATE_LIMIT_PER_MINUTE, QWEATHER_API_KEY, ELEME_APP_KEY, RIDER_WS_URL, ORDER_STREAM_URL, DOUBAO, DEEPSEEK, COZE, LLM_ROUTER } from './config.js'
import { logger, requestLogger } from './services/logger.js'
import { restoreFromBackup, scheduleBackup } from './services/backupService.js'

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
import knowledgeRouter from './routes/knowledge.js'
import llmRouter from './routes/llm.js'
import { startRiderSimulator } from './adapters/riderTelemetryAdapter.js'
import { startOrderPoolSimulator } from './adapters/orderPoolAdapter.js'

const app = express()

// 信任反向代理（部署到阿里云 SLB / Nginx 后必须）
app.set('trust proxy', 1)

// ============================================
// 安全中间件（按顺序很重要）
// ============================================

// 1. Helmet - HTTP 安全头
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}))

// 2. CORS - 严格配置
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// 3. 压缩
app.use(compression())

// 4. Body parser
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 4.5 静态资源（生产环境：后端同时 serve 前端 dist）
import path from 'node:path'
import fs from 'node:fs'
const publicDir = path.resolve(process.cwd(), 'public')
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir))
  // uploads 静态服务（知识库文件）
  const uploadsDir = path.resolve(process.cwd(), 'uploads')
  if (fs.existsSync(uploadsDir)) {
    app.use('/uploads', express.static(uploadsDir))
  }
  // SPA 路由 fallback（重要：Vue Router history 模式）
  app.get(/^\/(?!api).*/, (req, res, next) => {
    const indexPath = path.join(publicDir, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath)
    } else {
      next()
    }
  })
  logger.info(`[Static] 静态资源服务: ${publicDir}`)
}

// 5. 全局限流（防 DDoS / 防刷）
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
  // 白名单：健康检查不限流
  skip: (req) => req.path === '/api/health'
})
app.use('/api', globalLimiter)

// 6. 登录端点更严格的限流（防爆破）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10, // 最多 10 次
  message: { code: 429, message: '登录尝试过多，请 15 分钟后再试' }
})
app.use('/api/auth/login', authLimiter)

// 7. 请求日志
app.use(requestLogger)

// ============================================
// 健康检查（不限流，白名单）
// ============================================
app.get('/api/health', (_req, res) => {
  res.json({
    code: 0,
    data: {
      service: '配送小智 AI 后端',
      version: '15.5',
      env: NODE_ENV,
      uptime: process.uptime(),
      ts: Date.now()
    }
  })
})

// ============================================
// API 路由
// ============================================
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
app.use('/api/knowledge', knowledgeRouter)
app.use('/api/llm', llmRouter)
app.use('/api/debug', debugRouter)

// ============================================
// 全局错误处理（必须放最后）
// ============================================

// 根路由 + 健康检查（Render / UptimeRobot 探测）
app.get('/', (req, res) => {
  res.json({
    code: 200,
    service: 'peisong-xiaozhi-backend',
    version: '3.3.0',
    status: 'live',
    timestamp: new Date().toISOString()
  })
})
app.head('/', (req, res) => res.status(200).end())
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// 404 处理
app.use((req, res) => {
  logger.warn(`404 not found: ${req.method} ${req.originalUrl}`)
  res.status(404).json({ code: 404, message: `Not Found: ${req.path}` })
})

// 错误处理中间件
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  })

  // 不在生产环境暴露错误详情
  const message = NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message

  res.status(err.status || 500).json({
    code: err.status || 500,
    message,
    // 开发环境返回 stack 方便调试
    ...(NODE_ENV !== 'production' && { stack: err.stack })
  })
})

// ============================================
// 未捕获异常处理（最后兜底）
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack })
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack })
  // 严重错误，退出让 supervisor 拉起
  process.exit(1)
})

// ============================================
// 启动适配器模拟器
// ============================================
function startAdapters() {
  try {
    startRiderSimulator(null);
    startOrderPoolSimulator(null);
    logger.info('[Adapters] 骑手 + 订单流模拟器已启动');
  } catch (err) {
    logger.error('[Adapters] 模拟器启动失败:', err.message);
  }
}

// ============================================
// 启动日志：4 个数据接入端口状态
// ============================================
function logEnvStatus() {
  logger.info('========================================')
  logger.info('4 个真实数据接入端口 - 状态')
  logger.info('========================================')
  logger.info(`QWEATHER_API_KEY:    ${QWEATHER_API_KEY ? `✅ 已配 (${QWEATHER_API_KEY.slice(0, 4)}...)` : '⚠️ 未配 (使用 mock)'}`)
  logger.info(`ELEME_APP_KEY:       ${ELEME_APP_KEY ? '✅ 已配' : '⚠️ 未配 (使用 mock)'}`)
  logger.info(`RIDER_WS_URL:        ${RIDER_WS_URL ? '✅ 已配' : '⚠️ 未配 (使用 mock)'}`)
  logger.info(`ORDER_STREAM_URL:    ${ORDER_STREAM_URL ? '✅ 已配' : '⚠️ 未配 (使用 mock)'}`)
  logger.info('---------- LLM 模型路由 ----------')
  logger.info(`豆包 Doubao:          ${DOUBAO.enabled ? `✅ 已配 (${DOUBAO.model})` : '⚠️ 未配'}`)
  logger.info(`DeepSeek:             ${DEEPSEEK.enabled ? `✅ 已配 (${DEEPSEEK.model})` : '⚠️ 未配'}`)
  logger.info(`Coze:                 ${COZE.enabled ? '✅ 已配' : '⚠️ 未配'}`)
  logger.info(`路由策略:             ${LLM_ROUTER.strategy}（默认: ${LLM_ROUTER.default}）`)
  logger.info('========================================')
}

app.listen(PORT, () => {
  startAdapters();
  logEnvStatus();
  logger.info('========================================');
  logger.info(`配送小智 AI 后端服务已启动`);
  logger.info(`环境: ${NODE_ENV}`);
  logger.info(`地址: http://localhost:${PORT}/api`);
  logger.info(`CORS 来源: ${JSON.stringify(CORS_ORIGIN)}`);
  logger.info(`限流: ${RATE_LIMIT_PER_MINUTE} 次/分钟`);
  logger.info('========================================');
});
