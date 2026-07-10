import { Router } from 'express'
import { runDecisionWorkflow } from '../services/cozeService.js'

const router = Router()

router.post('/run', async (req, res) => {
  const { query, cityId, override } = req.body || {}
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ code: 400, message: 'query 必填' })
  }
  try {
    const result = await runDecisionWorkflow(query, { cityId, override: override || {} })
    res.json({ code: 0, data: result })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

router.get('/history', (req, res) => {
  const now = Date.now()
  res.json({
    code: 0,
    data: [
      { id: '1', text: '衡阳专送成本优化方案', time: now - 3600000, status: 'success' },
      { id: '2', text: '蒸湘区运力缺口分析', time: now - 7200000, status: 'success' },
      { id: '3', text: '团长激活率提升 SOP', time: now - 10800000, status: 'success' }
    ]
  })
})

export default router
