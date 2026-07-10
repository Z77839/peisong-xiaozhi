import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

/**
 * JWT 鉴权中间件
 * Authorization: Bearer <token>
 */
export function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const decoded = token ? verifyToken(token) : null
  if (!decoded) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' })
  }
  req.user = decoded
  next()
}
