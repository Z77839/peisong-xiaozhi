import { Router } from 'express'
import { getAgentContext, testWeatherAPI } from '../services/contextService.js'

const router = Router()

/**
 * GET /api/context?cityId=hengyang
 * 返回智能体当前感知到的所有世界状态
 */
router.get('/', async (req, res) => {
  try {
    const cityId = req.query.cityId || 'hengyang'
    // 支持 query 参数覆盖（时间机器）
    const override = {}
    if (req.query.hour !== undefined) {
      const now = new Date()
      now.setHours(parseInt(req.query.hour), parseInt(req.query.minute || 0), 0, 0)
      override.datetime = now.toISOString()
    }
    if (req.query.weather) override.weatherType = req.query.weather
    const ctx = await getAgentContext(cityId, { override })
    res.json({ code: 0, data: ctx })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

/**
 * GET /api/context/weather/test?cityId=hengyang
 * 测试和风 API Key 是否有效
 */
router.get('/weather/test', async (req, res) => {
  try {
    const cityId = req.query.cityId || 'hengyang'
    const result = await testWeatherAPI(cityId)
    res.json({ code: 0, data: result })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

export default router