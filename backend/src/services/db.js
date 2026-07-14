/**
 * 数据库访问层 - PostgreSQL
 * 使用 pg 库（轻量、零依赖、好维护）
 * 如无 DATABASE_URL 配置，自动降级到 JSON 文件
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { scheduleBackup } from './backupService.js'
import bcrypt from 'bcryptjs'
import { BCRYPT_ROUNDS } from '../config.js'
import { logger } from './logger.js'

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
const USE_POSTGRES = !!DATABASE_URL

let pool = null

if (USE_POSTGRES) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,                          // 连接池上限
    idleTimeoutMillis: 30000,         // 30 秒空闲
    connectionTimeoutMillis: 5000,    // 5 秒连接超时
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  pool.on('connect', () => logger.info('[DB] 新连接已建立'))
  pool.on('error', (err) => logger.error('[DB] 连接池错误:', err.message))
} else {
  logger.warn('[DB] 未配置 DATABASE_URL，使用 JSON 文件存储（开发模式）')
}

export { pool, USE_POSTGRES }

// ============================================
// JSON 存储（降级方案）
// ============================================
const JSON_DIR = path.resolve(process.cwd(), 'data')
if (!USE_POSTGRES && !fs.existsSync(JSON_DIR)) {
  fs.mkdirSync(JSON_DIR, { recursive: true })
}

/**
 * 启动时初始化默认账号（仅 JSON 模式）
 * 生产环境建议用 PostgreSQL migration 初始化
 */
async function initDefaultUsers() {
  if (USE_POSTGRES) return // PG 模式不在这里处理
  const userFile = path.join(JSON_DIR, 'users.json')
  if (fs.existsSync(userFile)) {
    try {
      const users = JSON.parse(fs.readFileSync(userFile, 'utf-8'))
      if (users.length > 0) return // 已有用户
    } catch {}
  }
  // 创建默认账号
  logger.info('[DB] 初始化默认演示账号...')
  const defaults = [
    { username: 'admin', role: 'admin', password: 'admin@2024', nickname: '系统管理员', org: '配送小智总部' },
    { username: 'operator', role: 'operator', password: 'operator@2024', nickname: '运营分析师', org: '衡阳运营中心' },
    { username: 'analyst', role: 'analyst', password: 'analyst@2024', nickname: '数据分析师', org: '总部数据部' }
  ]
  const now = new Date().toISOString()
  const users = await Promise.all(defaults.map(async (u, i) => ({
    id: `u_${i + 1}`,
    username: u.username,
    passwordHash: await bcrypt.hash(u.password, BCRYPT_ROUNDS),
    nickname: u.nickname,
    role: u.role,
    org: u.org,
    isActive: true,
    createdAt: now,
    updatedAt: now
  })))
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2))
  logger.info(`[DB] 初始化 ${users.length} 个默认账号 (admin/operator/analyst)`)
}

function readJsonFile(filename) {
  const filePath = path.join(JSON_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
}

function writeJsonFile(filename, data) {
  const filePath = path.join(JSON_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  // 触发 GitHub 备份（debounce 5s）
  scheduleBackup()
}

// ============================================
// 用户操作
// ============================================
export async function findUserByUsername(username) {
  if (USE_POSTGRES) {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    return rows[0] || null
  }
  // 确保默认账号已初始化
  if (!findUserByUsername._initialized) {
    findUserByUsername._initialized = true
    await initDefaultUsers()
  }
  const users = readJsonFile('users.json')
  return users.find(u => u.username === username) || null
}

export async function updateUserLastLogin(userId) {
  if (USE_POSTGRES) {
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId])
  } else {
    const users = readJsonFile('users.json')
    const user = users.find(u => u.id === userId)
    if (user) {
      user.lastLoginAt = new Date().toISOString()
      writeJsonFile('users.json', users)
    }
  }
}

// ============================================
// 决策历史
// ============================================
export async function saveDecision(decision) {
  const record = {
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: decision.userId,
    query: decision.query,
    cityId: decision.cityId,
    predictedOrders: decision.predictedOrders,
    costEstimate: decision.costEstimate,
    riskLevel: decision.riskLevel,
    report: decision.report,
    steps: decision.steps,
    tracking: decision.tracking,
    cozeUsed: decision.cozeUsed,
    createdAt: new Date().toISOString()
  }

  if (USE_POSTGRES) {
    const { rows } = await pool.query(
      `INSERT INTO decision_history (user_id, query, city_id, predicted_orders, cost_estimate, risk_level, report, steps, tracking, coze_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [record.userId, record.query, record.cityId, record.predictedOrders, record.costEstimate,
       record.riskLevel, record.report, JSON.stringify(record.steps), JSON.stringify(record.tracking),
       record.cozeUsed]
    )
    record.id = rows[0].id
  } else {
    const history = readJsonFile('decisions.json')
    history.unshift(record)
    writeJsonFile('decisions.json', history.slice(0, 200))  // 保留最近 200 条
  }

  return record
}

export async function getDecisionHistory(userId, limit = 20) {
  if (USE_POSTGRES) {
    const { rows } = await pool.query(
      `SELECT id, query, city_id, predicted_orders, cost_estimate, risk_level, created_at
       FROM decision_history WHERE user_id = $1 OR $1 IS NULL
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    )
    return rows
  }
  const history = readJsonFile('decisions.json')
  return history
    .filter(d => !userId || d.userId === userId)
    .slice(0, limit)
}

// ============================================
// 审计日志
// ============================================
export async function logAudit({ userId, action, resource, resourceId, details, ip, userAgent }) {
  if (USE_POSTGRES) {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, resource, resourceId, JSON.stringify(details || {}), ip, userAgent]
    )
  } else {
    const logs = readJsonFile('audit.json')
    logs.push({ id: logs.length + 1, userId, action, resource, resourceId, details, ip, userAgent, createdAt: new Date().toISOString() })
    writeJsonFile('audit.json', logs.slice(-1000))  // 保留最近 1000 条
  }
}

// ============================================
// Agent 调用日志
// ============================================
export async function logAgentCall({ decisionId, agentName, status, durationMs, input, output, errorMessage, startedAt, finishedAt }) {
  if (USE_POSTGRES) {
    await pool.query(
      `INSERT INTO agent_call_logs (decision_id, agent_name, status, duration_ms, input, output, error_message, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [decisionId, agentName, status, durationMs, JSON.stringify(input || {}), JSON.stringify(output || {}),
       errorMessage, startedAt, finishedAt]
    )
  }
  // JSON 模式不写（避免太大）
}

// ============================================
// 健康检查
// ============================================
export async function dbHealthCheck() {
  if (USE_POSTGRES) {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok', type: 'postgres' }
    } catch (err) {
      return { status: 'error', type: 'postgres', error: err.message }
    }
  }
  return { status: 'ok', type: 'json-fallback' }
}

export default { pool, USE_POSTGRES, findUserByUsername, saveDecision, getDecisionHistory, logAudit, logAgentCall, dbHealthCheck }
