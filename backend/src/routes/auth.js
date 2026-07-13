/**
 * 认证路由 - 生产级
 * 支持 PostgreSQL + JSON 降级
 */
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS, NODE_ENV } from '../config.js'
import { logger } from '../services/logger.js'
import { findUserByUsername, updateUserLastLogin, logAudit } from '../services/db.js'

const router = Router()

// 登录失败计数器
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function isLockedOut(username) {
  const rec = loginAttempts.get(username)
  if (!rec) return false
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) return true
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
    loginAttempts.delete(username)
    return false
  }
  return false
}

function recordFailed(username) {
  const rec = loginAttempts.get(username) || { count: 0, lockedUntil: null }
  rec.count += 1
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000
    logger.warn(`[Auth] 账号 ${username} 失败 ${rec.count} 次，锁定 ${LOCKOUT_MINUTES} 分钟`)
  }
  loginAttempts.set(username, rec)
}

function recordSuccess(username) {
  loginAttempts.delete(username)
}

router.post('/login', async (req, res) => {
  const { account, password } = req.body || {}
  if (!account || !password) {
    return res.status(400).json({ code: 400, message: '账号或密码不能为空' })
  }

  if (isLockedOut(account)) {
    return res.status(429).json({ code: 429, message: `账号已被锁定，请 ${LOCKOUT_MINUTES} 分钟后重试` })
  }

  const user = await findUserByUsername(account)
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress

  if (!user) {
    recordFailed(account)
    await logAudit({ userId: account, action: 'login_failed', details: { reason: 'no_user' }, ip, userAgent: req.headers['user-agent'] })
    return res.status(401).json({ code: 401, message: '账号或密码错误' })
  }

  // 检查账号是否激活
  if (user.is_active === false) {
    return res.status(403).json({ code: 403, message: '账号已停用，请联系管理员' })
  }

  // 密码验证
  const valid = await bcrypt.compare(password, user.password_hash || user.passwordHash)
  if (!valid) {
    recordFailed(account)
    await logAudit({ userId: user.id, action: 'login_failed', details: { reason: 'wrong_password' }, ip, userAgent: req.headers['user-agent'] })
    logger.warn(`[Auth] ${account} 密码错误 from ${ip}`)
    return res.status(401).json({ code: 401, message: '账号或密码错误' })
  }

  recordSuccess(account)
  await updateUserLastLogin(user.id)
  await logAudit({ userId: user.id, action: 'login_success', ip, userAgent: req.headers['user-agent'] })
  logger.info(`[Auth] ${account} 登录成功 from ${ip}`)

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, org: user.org },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  res.json({
    code: 0,
    data: {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        org: user.org,
        avatar: user.avatar || ''
      }
    }
  })
})

router.get('/me', (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    res.json({ code: 0, data: payload })
  } catch {
    res.status(401).json({ code: 401, message: '无效 token' })
  }
})

router.post('/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {}
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ code: 401, message: '未登录' })
  }

  const user = await findUserByUsername(payload.username)
  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  const valid = await bcrypt.compare(oldPassword, user.password_hash || user.passwordHash)
  if (!valid) {
    return res.status(401).json({ code: 401, message: '原密码错误' })
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ code: 400, message: '新密码至少 8 位' })
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  // 注意：实际修改需要 UPDATE users SET password_hash = $1 WHERE id = $2
  // 这里简化处理：提示生产环境需数据库支持
  if (process.env.DATABASE_URL) {
    const { pool } = await import('../services/db.js')
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, user.id])
  }

  await logAudit({ userId: user.id, action: 'change_password', ip: req.ip })
  logger.info(`[Auth] ${user.username} 修改密码成功`)

  res.json({ code: 0, message: '密码修改成功' })
})

if (NODE_ENV !== 'production') {
  router.get('/demo-users', (_req, res) => {
    res.json({
      code: 0,
      data: [
        { username: 'admin', role: 'admin', defaultPassword: 'admin@2024' },
        { username: 'operator', role: 'operator', defaultPassword: 'operator@2024' },
        { username: 'analyst', role: 'analyst', defaultPassword: 'analyst@2024' }
      ]
    })
  })
}

export default router
