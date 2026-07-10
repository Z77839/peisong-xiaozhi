import { Router } from 'express'
import { riderTypes, hengYangBaseline } from '../data/rider-types.js'

const router = Router()

router.get('/', (req, res) => {
  res.json({ code: 0, data: riderTypes })
})

router.get('/baseline', (req, res) => {
  res.json({ code: 0, data: hengYangBaseline })
})

router.get('/compare', (req, res) => {
  res.json({
    code: 0,
    data: {
      types: riderTypes,
      baseline: hengYangBaseline,
      avgCost: +(riderTypes.reduce((s, r) => s + r.cost, 0) / riderTypes.length).toFixed(2)
    }
  })
})

router.get('/:id', (req, res) => {
  const t = riderTypes.find((r) => r.id === req.params.id)
  if (!t) return res.status(404).json({ code: 404, message: '运力线不存在' })
  res.json({ code: 0, data: t })
})

export default router
