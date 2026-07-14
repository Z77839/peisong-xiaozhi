/**
 * /api/dashboard — 返回配送运营 Dashboard 完整数据
 * 匹配前端 ai-delivery-ops-assistant-demo 的 DashboardData 格式
 *
 * 把原"上海风格（浦东/徐汇/黄浦）"改成"衡阳+4城市风格"
 * districts = 4 城市 × 多商圈
 */

import { Router } from 'express'
import { cities } from '../data/cities.js'
import { riderTypes } from '../data/rider-types.js'
import { getRiderStats } from '../services/ridersDataService.js'

const router = Router()

// 把 4 城市展开成"区域"（district）+ "片区"（grid）
function buildRegions() {
  const regions = []
  const grids = []

  // 城市级别的 district
  cities.forEach((city, idx) => {
    const risk = idx === 0 ? 'high' : idx === 1 ? 'medium' : idx === 2 ? 'medium' : 'low'
    const orders = city.dailyOrders
    const riders = Math.round(orders / 5)
    const gap = Math.round(orders * 0.04)
    regions.push({
      region_id: `district-${city.id}`,
      region_name: city.name,
      level: 'district',
      parent_id: null,
      orders,
      riders_online: riders,
      riders_idle: Math.round(riders * 0.18),
      riders_busy: Math.round(riders * 0.82),
      order_rider_ratio: Math.round((orders / riders) * 10) / 10,
      capacity_gap: gap,
      risk_level: risk,
      avg_delivery_time: 32 + (idx % 4) * 2,
      on_time_rate: 91 + (idx % 4) * 1.2
    })
  })

  // 每个城市下生成 2-3 个商圈（grid）
  const businessNames = {
    hengyang: ['蒸湘万达', '解放路商圈', '衡阳大学城'],
    shaoxing: ['鲁迅故里', '柯桥万达'],
    changde: ['步行街核心', '武陵商圈'],
    quzhou: ['衢州万达', '西区高新园']
  }
  cities.forEach((city) => {
    const list = businessNames[city.id] || ['核心商圈']
    list.forEach((name, i) => {
      const districtOrders = regions.find((r) => r.region_id === `district-${city.id}`).orders
      const orders = Math.round(districtOrders * 0.32)
      const riders = Math.round(orders / 5.5)
      const gap = Math.round(orders * 0.05)
      const risk = i === 0 ? 'high' : i === 1 ? 'medium' : 'low'
      grids.push({
        region_id: `grid-${city.id}-${i}`,
        region_name: `${city.name}·${name}`,
        level: 'grid',
        parent_id: `district-${city.id}`,
        orders,
        riders_online: riders,
        riders_idle: Math.round(riders * 0.16),
        riders_busy: Math.round(riders * 0.84),
        order_rider_ratio: Math.round((orders / Math.max(riders, 1)) * 10) / 10,
        capacity_gap: gap,
        risk_level: risk,
        avg_delivery_time: 30 + (i % 3) * 2,
        on_time_rate: 90 + (i % 4) * 1.5
      })
    })
  })

  return [...regions, ...grids]
}

// 时间序列因子（晚高峰 17-21）
const timeFactors = [
  { time: '17:00', factor: 0.78 },
  { time: '18:00', factor: 1.0 },
  { time: '19:00', factor: 0.92 },
  { time: '20:00', factor: 0.65 }
]

function buildTimeSeries(regions) {
  return regions.flatMap((region) =>
    timeFactors.map(({ time, factor }) => ({
      time,
      region_id: region.region_id,
      region_name: region.region_name,
      orders: Math.round(region.orders * factor * (region.level === 'grid' ? 0.18 : 0.12)),
      riders_online: Math.max(1, Math.round(region.riders_online * (0.92 + factor * 0.08))),
      capacity_gap: Math.max(0, Math.round(region.capacity_gap * factor)),
      risk_level: factor > 0.9 ? region.risk_level : region.risk_level === 'high' ? 'medium' : region.risk_level
    }))
  )
}

router.get('/', async (req, res) => {
  try {
    const regions = buildRegions()
    const totalOrders = regions.filter((r) => r.level === 'district').reduce((s, r) => s + r.orders, 0)
    const onlineRiders = regions.filter((r) => r.level === 'district').reduce((s, r) => s + r.riders_online, 0)
    const gap = regions.filter((r) => r.level === 'district').reduce((s, r) => s + r.capacity_gap, 0)
    const riskCount = regions.filter((r) => r.level === 'district' && r.risk_level !== 'low').length

    // 🆕 调用真实骑手数据
    const riderStats = await getRiderStats().catch(() => null)
    const realRiderTotal = riderStats?.total || 0
    const realRiderActive = riderStats?.active || 0
    const realRiderHengyang = riderStats?.byCity?.衡阳 || 0

    // 从 audit 表读真实 Agent 调用次数（用 db.js 里的 query 查）
    let agentStats = null
    try {
      const { pool, USE_POSTGRES } = await import('../services/db.js')
      if (USE_POSTGRES) {
        const r = await pool.query('SELECT agent_name, COUNT(*) as calls, AVG(duration_ms)::int as avg_ms FROM agent_calls GROUP BY agent_name')
        agentStats = r.rows
      } else {
        // JSON 降级：从 data/audit.json 读
        const fs = await import('fs')
        const path = await import('path')
        const fp = path.resolve(process.cwd(), 'data/agent_calls.json')
        if (fs.existsSync(fp)) {
          const arr = JSON.parse(fs.readFileSync(fp, 'utf-8'))
          const grouped = {}
          for (const c of arr) {
            if (!grouped[c.agent_name]) grouped[c.agent_name] = { calls: 0, totalMs: 0 }
            grouped[c.agent_name].calls++
            grouped[c.agent_name].totalMs += c.duration_ms || 0
          }
          agentStats = Object.entries(grouped).map(([name, v]) => ({
            agent_name: name,
            calls: v.calls,
            avg_ms: Math.round(v.totalMs / v.calls)
          }))
        }
      }
    } catch {}

    const data = {
      kpis: {
        // 订单仍是 4 城市日订单之和（衡阳 10万 + 绍兴 6.5万 + 常德 6.5万 + 衢州 4万 = 27万）
        total_orders: totalOrders,
        // 🔴 骑手数改用真实 27,186
        online_riders: realRiderTotal,           // 总骑手 27,186
        riders_active: realRiderActive,         // 活跃 27,162
        riders_hengyang: realRiderHengyang,     // 衡阳 167
        capacity_gap: gap,
        risk_regions: riskCount,
        // 同比环比（实际是 baseline，需要的话从 history 表查）
        orders_trend: '+12.3%',
        riders_utilization: realRiderTotal > 0 ? Math.round(realRiderActive / realRiderTotal * 100) : 0
      },
      regions,
      time_series: buildTimeSeries(regions),
      cities: cities.map((c) => ({ id: c.id, name: c.name, province: c.province })),
      rider_types: riderTypes.map((r) => ({
        id: r.id,
        name: r.name,
        cost: r.cost,
        avg_delivery_time: r.avgDeliveryTime,
        color: r.color
      })),
      rider_stats: riderStats ? {
        total: riderStats.total,
        active: riderStats.active,
        byLevel: riderStats.byLevel,
        byLifecycle: riderStats.byLifecycle,
        byCity: riderStats.byCity
      } : null,
      agent_calls: agentStats,  // 真实 Agent 调用统计
      agent_insights: {
        summary: '衡阳晚高峰缺口最大，建议预调 120 名蜂跑 + 优选骑手',
        agents: [
          { name: '运力预测 Agent', output: '未来 2 小时缺口 428 人', confidence: 92 },
          { name: '成本分析 Agent', output: '蜂跑成本最优 ¥3.69', confidence: 88 }
        ]
      }
    }
    res.json(data)
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

export default router