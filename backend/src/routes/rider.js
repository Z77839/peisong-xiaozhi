import { Router } from 'express'
import { segments, lifecycles, topStations } from '../data/riders.js'

const router = Router()

router.get('/segments', (req, res) => res.json({ code: 0, data: segments }))
router.get('/lifecycles', (req, res) => res.json({ code: 0, data: lifecycles }))
router.get('/stations', (req, res) => res.json({ code: 0, data: topStations }))

export default router
