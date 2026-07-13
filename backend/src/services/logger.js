/**
 * 极简日志服务 - Node 14 兼容
 * 不依赖 winston（避免 colorspace 等新库）
 * 生产环境可替换为 pino / bunyan
 */
import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs')
if (!fs.existsSync(LOG_DIR)) {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}
}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL] || LEVELS.info

function format(level, message, meta) {
  const ts = new Date().toISOString()
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`
}

function write(level, message, meta) {
  if (LEVELS[level] > CURRENT_LEVEL) return
  const line = format(level, message, meta)
  // 控制台（带颜色简版）
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)

  // 文件输出（异步不阻塞）
  try {
    const date = new Date().toISOString().slice(0, 10)
    const file = path.join(LOG_DIR, `${date}.log`)
    fs.appendFile(file, line + '\n', () => {})
  } catch {}
}

export const logger = {
  error: (msg, meta) => write('error', msg, meta),
  warn:  (msg, meta) => write('warn', msg, meta),
  info:  (msg, meta) => write('info', msg, meta),
  debug: (msg, meta) => write('debug', msg, meta)
}

/**
 * Express 请求日志中间件
 */
export function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress
    }
    if (res.statusCode >= 500) logger.error(`${req.method} ${req.originalUrl}`, meta)
    else if (res.statusCode >= 400) logger.warn(`${req.method} ${req.originalUrl}`, meta)
    else logger.info(`${req.method} ${req.originalUrl}`, meta)
  })
  next()
}

export default logger
