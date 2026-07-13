/**
 * 骑手路由 - 完整版（v3.3 + 真实业务数据）
 *
 * 4 个端点：
 * - GET /api/riders - 列表（分页 + 多维过滤）
 * - GET /api/riders/stats - 统计（按城市/等级/类型/状态）
 * - GET /api/riders/health - 健康检查
 * - GET /api/riders/:id - 详情
 *
 * 数据源：backend/data/riders_full.csv (27,186 真实骑手)
 */
import { Router } from 'express'
import { segments, lifecycles, topStations } from '../data/riders.js'
import {
  loadRiders,
  listRiders,
  getRiderById,
  getRiderStats,
  ridersHealth
} from '../services/ridersDataService.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 1. 启动时预加载骑手数据（async fire-and-forget）
loadRiders().catch(err => console.error('[riders] 预加载失败:', err.message))

// 2. 健康检查（不需鉴权）
router.get('/health', (req, res) => {
  const h = ridersHealth()
  res.json({ code: 200, data: h })
})

// 3. 骑手列表（分页 + 过滤）
router.get('/', authRequired, (req, res) => {
  const { page, pageSize, city, level, type, isResigned, search } = req.query
  const result = listRiders({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 50,
    city: city || undefined,
    level: level || undefined,
    type: type || undefined,
    isResigned: isResigned !== undefined ? isResigned : undefined,
    search: search || undefined
  })
  res.json({ code: 200, ...result })
})

// 4. 骑手统计（按城市/等级/类型/状态）
router.get('/stats', authRequired, (req, res) => {
  const stats = getRiderStats()
  if (!stats) {
    return res.status(503).json({ code: 503, message: '骑手数据未加载' })
  }
  res.json({ code: 200, data: stats })
})

// 5. 骑手详情
router.get('/:id', authRequired, (req, res) => {
  const rider = getRiderById(req.params.id)
  if (!rider) {
    return res.status(404).json({ code: 404, message: '骑手不存在' })
  }
  res.json({ code: 200, data: rider })
})

// 6. 兼容旧版：segments / lifecycles / stations
router.get('/segments', (req, res) => res.json({ code: 0, data: segments }))
router.get('/lifecycles', (req, res) => res.json({ code: 0, data: lifecycles }))
router.get('/stations', (req, res) => res.json({ code: 0, data: topStations }))

export default router
