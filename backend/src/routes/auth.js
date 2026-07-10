import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'

const router = Router()

const USERS = {
  admin: { id: 'u_001', username: 'admin', nickname: '系统管理员', role: 'admin', org: '浙江配送小智' },
  operator: { id: 'u_002', username: 'operator', nickname: '运营分析师', role: 'operator', org: '浙江配送小智' },
  analyst: { id: 'u_003', username: 'analyst', nickname: '数据分析师', role: 'viewer', org: '浙江配送小智' }
}

router.post('/login', (req, res) => {
  const { account, password } = req.body || {}
  if (!account || !password) {
    return res.status(400).json({ code: 400, message: '账号或密码不能为空' })
  }
  const user = USERS[account]
  if (!user) {
    return res.status(401).json({ code: 401, message: '账号不存在' })
  }
  // 演示模式：密码任意
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, org: user.org },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({
    code: 0,
    data: {
      token,
      userInfo: { ...user, avatar: '' }
    }
  })
})

router.get('/me', (req, res) => {
  // 简化：从 header 解析（生产应放在 auth 中间件后）
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    res.json({ code: 0, data: payload })
  } catch {
    res.status(401).json({ code: 401, message: '无效 token' })
  }
})

export default router
