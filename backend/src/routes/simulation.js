import { Router } from 'express'
import { getSimulationState, controlSimulation, getTimeline } from '../services/simulationService.js'

const router = Router()

router.get('/state', getSimulationState)
router.post('/control', controlSimulation)
router.get('/timeline', (req, res) => {
  res.json({ code: 0, data: getTimeline() })
})

export default router