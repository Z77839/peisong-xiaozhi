/**
 * /api/dispatch — 智能派单
 *
 * 配送小智的能力：综合骑手距离、负载、准时率 → 推荐最适配骑手
 */

import { Router } from 'express'
import { cities } from '../data/cities.js'
import { riderTypes } from '../data/rider-types.js'
import { saveFeedback } from '../services/decisionStore.js'  // 🆕 派单回写决策反馈

const router = Router()

/**
 * 模拟骑手库（生产接真实骑手数据）
 * 每个骑手：id / name / 在线状态 / 当前距离 / 已接单数 / 准时率 / 评分 / 当前位置
 */
function generateRiders(cityId, count = 30) {
  const city = cities.find((c) => c.id === cityId) || cities[0]
  const riderPool = []
  for (let i = 1; i <= count; i++) {
    const typeIdx = i % riderTypes.length
    const riderType = riderTypes[typeIdx]
    const orders = Math.floor(Math.random() * 8)
    const onTimeRate = 88 + Math.random() * 11
    const rating = 4.2 + Math.random() * 0.8
    const distance = +(Math.random() * 5).toFixed(2)
    const online = Math.random() > 0.15 // 85% 在线率
    const busy = Math.random() < 0.7
    riderPool.push({
      id: `r-${cityId}-${i.toString().padStart(3, '0')}`,
      name: `${city.name.slice(0, 1)}骑手${i}`,
      avatar: ['🛵', '🚴', '🚗', '🛴'][i % 4],
      type: riderType.name,
      typeId: riderType.id,
      cost: riderType.cost,
      online,
      busy,
      distance,
      currentLoad: orders,
      maxLoad: 8,
      onTimeRate: +onTimeRate.toFixed(1),
      rating: +rating.toFixed(1),
      currentGrid: ['万达', '解放路', '大学城', '步行街', '高新园'][i % 5]
    })
  }
  return riderPool
}

/**
 * 模拟待派订单
 */
function generateOrders(cityId, count = 6) {
  const city = cities.find((c) => c.id === cityId) || cities[0]
  const orders = []
  const merchants = ['麦当劳', '肯德基', '海底捞', '瑞幸咖啡', '喜茶', '星巴克', '华莱士', '老乡鸡', '一点点']
  for (let i = 1; i <= count; i++) {
    orders.push({
      id: `o-${Date.now()}-${i}`,
      merchant: merchants[i % merchants.length],
      address: ['万达广场', '步行街', '大学城', '高新园', '火车站', '医院'][i % 6],
      distance: +(1 + Math.random() * 4).toFixed(1),
      estimatedTime: Math.round(15 + Math.random() * 25),
      reward: +(4 + Math.random() * 3).toFixed(1),
      priority: i <= 2 ? 'high' : i <= 4 ? 'medium' : 'low',
      createTime: new Date(Date.now() - i * 90 * 1000).toISOString()
    })
  }
  return orders
}

/**
 * 综合评分函数：配送小智选骑手
 * 评分 = 距离权重(0.35) + 准时率权重(0.30) + 负载权重(0.20) + 评分权重(0.15)
 */
function scoreRider(rider, order) {
  if (!rider.online || rider.busy) return 0
  const distScore = Math.max(0, 1 - rider.distance / 5)
  const onTimeScore = (rider.onTimeRate - 85) / 15
  const loadScore = Math.max(0, 1 - rider.currentLoad / rider.maxLoad)
  const ratingScore = (rider.rating - 4) / 1
  const score = distScore * 0.35 + onTimeScore * 0.30 + loadScore * 0.20 + ratingScore * 0.15
  return +score.toFixed(3)
}

/**
 * GET /api/dispatch?cityId=hengyang
 * 返回订单池 + 骑手池 + 推荐结果
 */
router.get('/', (req, res) => {
  try {
    const cityId = req.query.cityId || 'hengyang'
    const riders = generateRiders(cityId, 30)
    const orders = generateOrders(cityId, 6)

    // 为每个订单推荐 TOP 3 骑手
    const recommendations = orders.map((order) => {
      const scored = riders
        .map((r) => ({ rider: r, score: scoreRider(r, order) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      return {
        order,
        topRiders: scored.map((x) => ({
          ...x.rider,
          matchScore: x.score,
          matchReason: buildReason(x.rider, order)
        }))
      }
    })

    const stats = {
      totalOrders: orders.length,
      availableRiders: riders.filter((r) => r.online && !r.busy).length,
      busyRiders: riders.filter((r) => r.busy).length,
      offlineRiders: riders.filter((r) => !r.online).length,
      dispatchedRate: 0.78,
      avgDispatchTime: 1.4
    }

    res.json({ code: 0, data: { orders, riders, recommendations, stats } })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

function buildReason(rider, order) {
  const reasons = []
  if (rider.distance < 2) reasons.push(`距商家 ${rider.distance}km`)
  if (rider.onTimeRate > 95) reasons.push(`准时率 ${rider.onTimeRate}%`)
  if (rider.currentLoad < 4) reasons.push('当前负载低')
  if (rider.rating > 4.7) reasons.push(`评分 ${rider.rating}`)
  return reasons.length ? reasons.join(' · ') : `综合评分最优`
}

/**
 * POST /api/dispatch/execute
 * 一键派单
 */
router.post('/execute', (req, res) => {
  const { orderId, riderId, decisionId } = req.body || {}  // 🆕 decisionId 从决策中心传来
  if (!orderId || !riderId) {
    return res.status(400).json({ code: 400, message: 'orderId/riderId 必填' })
  }
  // 🆕 如果有 decisionId，自动回写反馈
  if (decisionId) {
    try {
      saveFeedback(decisionId, {
        dispatchId: `dp_${Date.now()}`,
        result: 'success',
        message: `已派单 orderId=${orderId} → riderId=${riderId}`,
        riderCount: 1,
        createdAt: new Date().toISOString()
      })
      console.log(`[Dispatch] 已回写决策 ${decisionId}: 派单成功`)
    } catch (e) {
      console.warn('[Dispatch] 回写决策反馈失败（非致命）:', e.message)
    }
  }
  res.json({
    code: 0,
    data: {
      id: `dp_${Date.now()}`,
      orderId,
      riderId,
      decisionId: decisionId || null,  // 🆕 回传给前端
      status: 'dispatched',
      dispatchedAt: new Date().toISOString(),
      message: '配送小智已完成智能派单',
      agent: '派单推荐 Agent'
    }
  })
})

/**
 * POST /api/dispatch/batch
 * 批量智能派单
 */
router.post('/batch', (req, res) => {
  const { cityId, orderIds } = req.body || {}
  const results = (orderIds || []).map((oid) => ({
    orderId: oid,
    status: 'dispatched',
    assignedAt: new Date().toISOString()
  }))
  res.json({
    code: 0,
    data: {
      cityId,
      totalDispatched: results.length,
      results,
      agent: '批量派单 Agent',
      message: `配送小智已批量派发 ${results.length} 单`
    }
  })
})

export default router