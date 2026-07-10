/**
 * /api/alert — 主动预防式预警
 *
 * 配送小智的核心：从「被动响应」升级为「主动预防」
 * 实时扫描 4 城市运力缺口 + 天气 + 时段，提前发现高峰风险
 */

import { Router } from 'express'
import { cities } from '../data/cities.js'
import { getAgentContext } from '../services/contextService.js'

const router = Router()

/**
 * 主动预警生成器
 * 模拟配送小智持续监控：
 *   - 城市级缺口阈值
 *   - 时段风险（午高峰/晚高峰/夜宵）
 *   - 天气影响（雨天/雪天订单+）
 *   - 节假日节前预热
 *   - 骑手在线率
 */
function generateAlerts() {
  const alerts = []
  let idCounter = 1
  const now = new Date()

  cities.forEach((city) => {
    const cityOrders = city.dailyOrders
    const ridersOnline = Math.round(cityOrders / 5)
    const gap = Math.round(cityOrders * 0.04)
    const peakLoad = cityOrders * 0.35 // 35% 在高峰时段
    const peakGap = Math.round(peakLoad * 0.06)

    // 预警规则 1：缺口超过峰值的 10%
    if (peakGap > 1000) {
      const level = peakGap > 3000 ? 'critical' : peakGap > 1500 ? 'high' : 'medium'
      alerts.push({
        id: `alert-${idCounter++}`,
        level,
        type: 'capacity_gap',
        typeLabel: '运力缺口',
        title: `${city.name} 预测 ${peakGap} 名骑手缺口`,
        desc: `${city.province}·${city.name} 当前在线 ${ridersOnline.toLocaleString()} 名，预计晚高峰缺口 ${peakGap.toLocaleString()} 名。配送小智建议提前 90 分钟调度。`,
        cityId: city.id,
        cityName: city.name,
        metrics: {
          currentGap: gap,
          predictedGap: peakGap,
          ridersOnline,
          orderRiderRatio: 5.0
        },
        suggestedActions: [
          { id: 'boost', label: '一键增配蜂跑', cost: 8200, estimatedGap: 800 },
          { id: 'subsidy', label: '启用高峰补贴', cost: 32000, estimatedGap: 1500 },
          { id: 'transfer', label: '跨区调拨 80 名', cost: 4200, estimatedGap: 600 }
        ],
        agent: '运力预判 Agent',
        confidence: 92,
        triggerTime: new Date(now.getTime() - 18 * 60000).toISOString(),
        status: 'active'
      })
    }

    // 预警规则 2：骑手在线率低
    const idleRate = 0.16 + Math.random() * 0.08
    if (idleRate < 0.20) {
      alerts.push({
        id: `alert-${idCounter++}`,
        level: 'medium',
        type: 'low_idle_rate',
        typeLabel: '空闲率低',
        title: `${city.name} 空闲骑手仅 ${(idleRate * 100).toFixed(1)}%`,
        desc: `当前空闲骑手占比 ${(idleRate * 100).toFixed(1)}%，低于 20% 警戒线，运力调度弹性下降。`,
        cityId: city.id,
        cityName: city.name,
        metrics: { idleRate: idleRate * 100, ridersIdle: Math.round(ridersOnline * idleRate) },
        suggestedActions: [
          { id: 'survey', label: '排查骑手状态', cost: 0, estimatedGap: 0 },
          { id: 'boost', label: '追加众包召募', cost: 6500, estimatedGap: 200 }
        ],
        agent: '调度监控 Agent',
        confidence: 85,
        triggerTime: new Date(now.getTime() - 8 * 60000).toISOString(),
        status: 'active'
      })
    }

    // 预警规则 3：雨天 + 高峰叠加
    if (city.id === 'hengyang' && now.getHours() >= 17 && now.getHours() <= 20) {
      alerts.push({
        id: `alert-${idCounter++}`,
        level: 'high',
        type: 'weather_peak',
        typeLabel: '天气+高峰',
        title: `${city.name} 雨天高峰双重叠加`,
        desc: `当前为晚高峰时段（17:00-21:00），叠加小雨天气，订单预计 +20%，建议立即启动应急预案。`,
        cityId: city.id,
        cityName: city.name,
        metrics: { orderIncrease: 1.2, extraOrders: Math.round(peakLoad * 0.2) },
        suggestedActions: [
          { id: 'priority', label: '短单优先派发', cost: 0, estimatedGap: 300 },
          { id: 'subsidy', label: '20-40 分钟短补贴', cost: 18000, estimatedGap: 800 },
          { id: 'cross', label: '暂停跨区远单', cost: 0, estimatedGap: 200 }
        ],
        agent: '天气风险 Agent',
        confidence: 89,
        triggerTime: new Date(now.getTime() - 35 * 60000).toISOString(),
        status: 'active'
      })
    }

    // 预警规则 4：节假日节前预热
    const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const upcomingHolidays = [
      { name: '国庆节', date: '10-01' },
      { name: '中秋节', date: '09-29' }
    ]
    const upcoming = upcomingHolidays.find((h) => Math.abs(daysDiff(monthDay, h.date)) <= 5)
    if (upcoming && city.id === 'hengyang') {
      alerts.push({
        id: `alert-${idCounter++}`,
        level: 'medium',
        type: 'holiday_preheat',
        typeLabel: '节前预热',
        title: `${upcoming.name} 节前运力预热`,
        desc: `${upcoming.name} 临近，预计订单增长 40-60%。配送小智建议提前 3 天招聘临时骑手。`,
        cityId: city.id,
        cityName: city.name,
        metrics: { estimatedIncrease: 0.5, daysToHoliday: daysDiff(monthDay, upcoming.date) },
        suggestedActions: [
          { id: 'recruit', label: '启动临时骑手招募', cost: 12000, estimatedGap: 400 },
          { id: 'subsidy', label: '节日高峰补贴预案', cost: 48000, estimatedGap: 1000 }
        ],
        agent: '节假日预判 Agent',
        confidence: 78,
        triggerTime: new Date(now.getTime() - 120 * 60000).toISOString(),
        status: 'active'
      })
    }
  })

  // 按等级排序（critical > high > medium > low）
  const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level])
}

function daysDiff(a, b) {
  const [am, ad] = a.split('-').map(Number)
  const [bm, bd] = b.split('-').map(Number)
  return bm * 31 + bd - (am * 31 + ad)
}

/**
 * GET /api/alert
 * 主动预警列表
 */
router.get('/', async (req, res) => {
  try {
    const cityId = req.query.cityId
    const ctx = await getAgentContext(cityId || 'hengyang')
    const alerts = generateAlerts()
    const stats = {
      total: alerts.length,
      critical: alerts.filter((a) => a.level === 'critical').length,
      high: alerts.filter((a) => a.level === 'high').length,
      medium: alerts.filter((a) => a.level === 'medium').length,
      predictedGap: alerts.reduce((s, a) => s + (a.metrics.predictedGap || 0), 0),
      totalCost: alerts.reduce((s, a) => s + (a.metrics.predictedGap || 0) * 8, 0)
    }
    res.json({ code: 0, data: { alerts, stats, context: ctx } })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

/**
 * POST /api/alert/ack/:id
 * 确认预警（配送小智已响应）
 */
router.post('/ack/:id', (req, res) => {
  res.json({
    code: 0,
    data: { id: req.params.id, status: 'acked', message: '配送小智已响应此预警' }
  })
})

/**
 * POST /api/alert/action
 * 执行预警建议（增配 / 补贴 / 调拨）
 */
router.post('/action', (req, res) => {
  const { alertId, actionId, cityId } = req.body || {}
  if (!alertId || !actionId) {
    return res.status(400).json({ code: 400, message: 'alertId/actionId 必填' })
  }
  const actionResults = {
    boost: { result: '已派发 200 张蜂跑召募券', eta: '15 分钟内见效' },
    subsidy: { result: '高峰补贴已生效 (17:50-19:20)', eta: '即时' },
    transfer: { result: '已调拨 80 名空闲骑手到目标商圈', eta: '8 分钟到位' },
    priority: { result: '短单优先策略已启用', eta: '即时' },
    recruit: { result: '临时骑手招募公告已发布', eta: '24 小时内响应' },
    survey: { result: '调度异常排查任务已创建', eta: '5 分钟内出报告' },
    cross: { result: '跨区远单已限制（仅 8km 内）', eta: '即时' }
  }
  const r = actionResults[actionId] || { result: '已执行', eta: '稍后生效' }
  res.json({
    code: 0,
    data: {
      alertId,
      actionId,
      cityId,
      ...r,
      executedBy: '配送小智 · 调度执行 Agent',
      executedAt: new Date().toISOString()
    }
  })
})

export default router