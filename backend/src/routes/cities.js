import { Router } from 'express'
import { cities, totalMetrics, vision } from '../data/cities.js'

const router = Router()

router.get('/', (req, res) => {
  res.json({ code: 0, data: cities })
})

router.get('/total', (req, res) => {
  res.json({ code: 0, data: totalMetrics })
})

router.get('/vision', (req, res) => {
  res.json({ code: 0, data: vision })
})

router.get('/:id', (req, res) => {
  const city = cities.find((c) => c.id === req.params.id)
  if (!city) return res.status(404).json({ code: 404, message: '城市不存在' })
  res.json({ code: 0, data: city })
})

export default router
