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
  bootstrapRiders,
  listRiders,
  getRiderById,
  getRiderStats,
  ridersHealth
} from '../services/ridersDataService.js'
import {
  addRider,
  importRidersFromCSV,
  listExtraRiders,
  deleteExtraRider,
  getExtraRiderCount
} from '../services/riderImporter.js'
import { authRequired } from '../middleware/auth.js'

const router = Router()

// 1. 启动时预加载骑手数据（同步 + 异步拉取）
bootstrapRiders().catch(err => console.error('[riders] bootstrap 失败:', err.message))

// 2. 健康检查（不需鉴权）
router.get('/health', (req, res) => {
  const h = ridersHealth()
  res.json({ code: 200, data: h })
})

// 3. 骑手列表（分页 + 过滤）
router.get('/', authRequired, async (req, res) => {
  try {
  const { page, pageSize, city, level, type, isResigned, search } = req.query
  const result = await listRiders({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 50,
    city: city || undefined,
    level: level || undefined,
    type: type || undefined,
    isResigned: isResigned !== undefined ? isResigned : undefined,
    search: search || undefined
  })
  res.json({ code: 200, data: result })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 4. 骑手统计（按城市/等级/类型/状态）
router.get('/stats', authRequired, async (req, res) => {
  try {
  const stats = await getRiderStats()
  if (!stats) {
    return res.status(503).json({ code: 503, message: '骑手数据未加载' })
  }
  res.json({ code: 200, data: stats })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 6. 兼容旧版：segments / lifecycles / stations
router.get('/segments', (req, res) => res.json({ code: 0, data: segments }))
router.get('/lifecycles', (req, res) => res.json({ code: 0, data: lifecycles }))
router.get('/stations', (req, res) => res.json({ code: 0, data: topStations }))

// 7. 🆕 导入骑手（CSV）
router.post('/import', authRequired, (req, res) => {
  try {
    const { csv } = req.body || {}
    if (!csv) return res.status(400).json({ code: 400, message: 'csv 字段必填' })
    const result = importRidersFromCSV(csv)
    res.json({ code: 200, message: `成功导入 ${result.added} 个骑手`, data: result })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 8. 🆕 添加单个骑手
router.post('/add', authRequired, (req, res) => {
  try {
    const rider = addRider(req.body || {})
    res.json({ code: 200, message: '添加成功', data: rider })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 9. 🆕 列出导入的骑手
router.get('/extra', authRequired, (req, res) => {
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 50
  res.json({ code: 200, data: listExtraRiders({ page, pageSize }) })
})

// 10. 🆕 导入统计
router.get('/import-stats', authRequired, (req, res) => {
  res.json({ code: 200, data: { extraCount: getExtraRiderCount() } })
})

// 11. 🆕 删除导入的骑手
router.delete('/extra/:id', authRequired, (req, res) => {
  const result = deleteExtraRider(req.params.id)
  res.json({ code: 200, data: result })
})

// 🆕 12. 各城市运力容量检查（供骑手/订单/成本页调用 + 决策中心预警）
//  根据各城市日订单 × 10% 运力需求 - 在线骑手 = 缺口
router.get('/capacity', (req, res) => {
  try {
    const stats = getRiderStats()
    // ✅ 修正：byCity 是按中文名索引（'衡阳'/'绍兴'等），不是 cityId
    const byCity = stats.byCity || {}
    const CITY_NAME_MAP = {
      hengyang: '衡阳',
      shaoxing: '绍兴',
      changde:  '常德',
      quzhou:   '衢州'
    }
    const CITIES_NEED = {
      hengyang: { dailyOrders: 100000, needRate: 0.10, minRiders: 200 },
      shaoxing: { dailyOrders: 65000,  needRate: 0.10, minRiders: 150 },
      changde:  { dailyOrders: 65000,  needRate: 0.10, minRiders: 150 },
      quzhou:   { dailyOrders: 20000,  needRate: 0.10, minRiders: 80  }
    }
    const cityStatus = Object.keys(CITIES_NEED).map((cityId) => {
      const cfg = CITIES_NEED[cityId]
      const online = byCity[CITY_NAME_MAP[cityId]] || 0
      // 高峰期需运力 = 日订单 * 10% / 1小时
      const peakNeed = Math.ceil(cfg.dailyOrders * cfg.needRate)
      const gap = Math.max(0, peakNeed - online)
      const coverage = peakNeed > 0 ? Math.min(1, online / peakNeed) : 1
      const level = gap === 0 ? 'ok' : (coverage < 0.7 ? 'critical' : (coverage < 0.9 ? 'warning' : 'ok'))
      return {
        cityId,
        cityName: CITY_NAME_MAP[cityId],
        dailyOrders: cfg.dailyOrders,
        onlineRiders: online,
        peakNeed,
        gap,
        coverage: +(coverage * 100).toFixed(1),
        level,
        suggestDecision: gap > 0  // 缺口 > 0 → 建议决策中心介入
      }
    })
    const totalGap = cityStatus.reduce((s, c) => s + c.gap, 0)
    const totalOnline = cityStatus.reduce((s, c) => s + c.onlineRiders, 0)
    res.json({
      code: 0,
      data: {
        cities: cityStatus,
        totalGap,
        totalOnline,
        hasShortage: totalGap > 0,
        worstCity: cityStatus.reduce((a, b) => (a.gap > b.gap ? a : b))
      }
    })
  } catch (e) {
    console.error('[riders/capacity]', e.message)
    res.status(200).json({ code: 0, data: { cities: [], totalGap: 0, hasShortage: false, error: e.message } })
  }
})

// 13. 骑手详情（必须放最后，否则会拦截 /import-stats 等子路由）
router.get('/:id', authRequired, async (req, res) => {
  try {
    const rider = await getRiderById(req.params.id)
    if (!rider) {
      return res.status(404).json({ code: 404, message: '骑手不存在' })
    }
    res.json({ code: 200, data: rider })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

export default router
