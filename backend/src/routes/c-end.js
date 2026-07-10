import { Router } from 'express'
import { community, group, groupLevels, communityTrend } from '../data/c-end.js'
import { cities } from '../data/cities.js'

const router = Router()

router.get('/community', (req, res) => {
  const cityId = req.query.cityId || 'hengyang'
  const scale = (cities.find((c) => c.id === cityId) || cities[0]).dailyOrders / 100000
  res.json({
    code: 0,
    data: {
      fans: Math.floor(community.fans * scale),
      mac: community.mac,
      fanRate: community.fanRate,
      orderRate: community.orderRate,
      studentPercent: community.studentPercent,
      growth: community.growth
    }
  })
})

router.get('/group', (req, res) => {
  const cityId = req.query.cityId || 'hengyang'
  const scale = (cities.find((c) => c.id === cityId) || cities[0]).dailyOrders / 100000
  res.json({
    code: 0,
    data: {
      total: Math.floor(group.total * scale),
      active: Math.floor(group.active * scale),
      dailyOrders: group.dailyOrders,
      costPerOrder: group.costPerOrder,
      activationRate: group.activationRate
    }
  })
})

router.get('/levels', (req, res) => res.json({ code: 0, data: groupLevels }))

router.get('/trend', (req, res) => res.json({ code: 0, data: communityTrend }))

export default router
