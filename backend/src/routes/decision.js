import { Router } from 'express'
import { runDecisionWorkflow } from '../services/cozeService.js'
import { saveDecision, getDecisionHistory } from '../services/db.js'
import { saveFeedback, getFeedback } from '../services/decisionStore.js'
// 🆕 经验沉淀：决策自动归档 + feedback 回流
import { archiveDecision, updateCaseFeedback } from '../services/experienceService.js'

const router = Router()

// 🆕 内存级决策存储（JSON 模式 + 演示用）
// 跨重启靠 backupService 持久化到 GitHub data-backup 分支
const feedbacks = new Map()  // decisionId -> feedback

// 🆕 派单/告警模块回调：回写决策执行结果
router.post('/feedback', (req, res) => {
  const { decisionId, dispatchId, alertId, result, message, riderCount } = req.body || {}
  if (!decisionId) return res.status(400).json({ code: 400, message: 'decisionId 必填' })
  const fb = {
    decisionId,
    dispatchId: dispatchId || null,
    alertId: alertId || null,
    result: result || 'success',  // success | failed | partial
    message: message || '',
    riderCount: riderCount || 0,
    createdAt: new Date().toISOString()
  }
  feedbacks.set(decisionId, fb)
  saveFeedback(decisionId, fb)
  // 🆕 经验回流：更新案例库 success_rate
  try {
    updateCaseFeedback(decisionId, fb)
  } catch (e) {
    console.warn('[Decision] case feedback update failed (non-fatal):', e.message)
  }
  console.log(`[Decision] feedback received: ${decisionId} → ${result}${riderCount ? ' (' + riderCount + ' 单)' : ''}`)
  res.json({ code: 0, data: { ok: true, feedback: fb } })
})

// 🆕 列出历史决策（带 feedback）—— 必须在 /:id 之前定义，否则 /history 会被当成 id="history"
router.get('/history', async (req, res) => {
  try {
    let list = await getDecisionHistory(null, 50)
    // 兑底：data/decisions.json 可能被备份恢复为 null / {}，都要包成数组
    if (!Array.isArray(list)) {
      console.warn('[GET /history] getDecisionHistory 返回非数组:', typeof list, '— 降级为 []')
      list = []
    }
    // 合并 feedback
    const enriched = list.map((d) => ({ ...d, feedback: feedbacks.get(d.id) || getFeedback(d.id) || null }))
    res.json({ code: 0, data: enriched })
  } catch (e) {
    console.error('[GET /history]', e.message, e.stack)
    // 降级：返回空列表（不阻塞前端）
    res.json({ code: 0, data: [], warning: 'history load failed: ' + e.message })
  }
})

// 🆕 按 ID 取单条决策详情（带 feedback）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    // 避免和 /history 冲突（兜底）
    if (id === 'history') return router.handle(req, res, () => {})
    const fb = feedbacks.get(id) || getFeedback(id)
    // 简化：直接从 history 找
    const history = await getDecisionHistory(null, 200)
    const historyList = Array.isArray(history) ? history : []
    const rec = historyList.find((d) => d.id === id)
    if (!rec) {
      // 如果找不到，构造一个最小可回放记录
      return res.json({
        code: 0,
        data: {
          id,
          query: req.query.q || '(载入的历史决策)',
          cityId: req.query.cityId || 'hengyang',
          report: '此决策由告警/派单页面跳转载入。详细报告请重新生成。',
          feedback: fb,
          steps: [],
          riskLevel: 'medium',
          confidence: 80
        }
      })
    }
    res.json({ code: 0, data: { ...rec, feedback: fb } })
  } catch (e) {
    console.error('[GET /:id]', e.message, e.stack)
    res.status(200).json({ code: 0, data: { id: req.params.id, error: 'load failed', message: e.message } })
  }
})

router.post('/run', async (req, res) => {
  const { query, cityId, override } = req.body || {}
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ code: 400, message: 'query 必填' })
  }
  try {
    const result = await runDecisionWorkflow(query, { cityId, override: override || {} })
    // 决策 ID 修复：cozeService 返回的字段是 decisionId（不是 id）
    // 这里取到同一个 id 传给 saveDecision，让历史记录 / 派单 / 反馈 / 回跳全链路共享一个 ID
    const decisionId = result.decisionId || result.id || `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    // 存档（用决策 ID 作 key）
    try {
      await saveDecision({
        id: decisionId,
        userId: null,
        query,
        cityId,
        predictedOrders: result.predicted_orders,
        costEstimate: result.cost_estimate,
        riskLevel: result.risk_level,
        report: result.report,
        steps: result.steps,
        tracking: result.tracking,
        cozeUsed: result.coze_used
      })
    } catch (saveErr) {
      console.warn('[Decision] save failed (non-fatal):', saveErr.message)
    }

    // 🆕 经验归档：决策自动进案例库，供未来 RAG 复用
    try {
      archiveDecision({
        id: decisionId,
        query,
        cityId,
        predicted_orders: result.predicted_orders,
        cost_estimate: result.cost_estimate,
        risk_level: result.risk_level,
        gap_ratio: result.gap_ratio,
        context: result.context,
        knowledgeUsed: result.knowledgeUsed,
        report: result.report
      })
    } catch (archErr) {
      console.warn('[Decision] archive failed (non-fatal):', archErr.message)
    }
    res.json({ code: 0, data: { ...result, id: decisionId, decisionId } })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

// 🆕 列出案例库（前端用）
router.get('/cases', async (req, res) => {
  try {
    const { listAllCases, stats } = await import('../services/experienceService.js')
    const { cityId, minSuccessRate, withFeedback, limit } = req.query
    const opts = {}
    if (cityId) opts.cityId = cityId
    if (minSuccessRate !== undefined) opts.minSuccessRate = Number(minSuccessRate)
    if (withFeedback) opts.withFeedback = withFeedback === 'true'
    const cases = listAllCases(Number(limit) || 100, opts)
    res.json({ code: 0, data: cases, stats: stats() })
  } catch (e) {
    console.error('[GET /cases]', e.message)
    res.status(500).json({ code: 500, message: e.message })
  }
})

// 🆕 案例库统计
router.get('/cases/stats', async (req, res) => {
  try {
    const { stats } = await import('../services/experienceService.js')
    res.json({ code: 0, data: stats() })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message })
  }
})

export default router
