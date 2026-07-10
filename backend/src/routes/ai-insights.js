import { Router } from 'express'
import { aiInsights } from '../data/ai-insights.js'

const router = Router()

router.get('/', (req, res) => {
  const cityId = req.query.cityId || 'hengyang'
  // 简单按城市扩展（未来可以做城市相关洞察）
  res.json({ code: 0, data: aiInsights })
})

export default router