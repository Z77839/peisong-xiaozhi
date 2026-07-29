/**
 * 经验沉淀服务 — 决策案例库
 * 
 * 数据流：
 *   1. decision/run 完成 → archiveDecision() → case_library.json
 *   2. decision/feedback 进来 → updateCaseFeedback() → 更新 success_rate
 *   3. decision/run 时 RAG 检索 → searchCases() → 复用历史经验
 * 
 * 设计目标：
 *   - 每条决策自动沉淀为"案例"（无人工干预）
 *   - 派单/告警模块的 feedback 自动回流
 *   - 成功案例被 RAG 检索时加权，失败案例降权
 *   - 跨重启靠 backupService 持久化到 GitHub data-backup 分支
 */
import fs from 'node:fs'
import path from 'node:path'
import { scheduleBackup } from './backupService.js'

const STORE_DIR = path.resolve(process.cwd(), 'data')
const CASE_FILE = path.join(STORE_DIR, 'case_library.json')

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })
}

function readAll() {
  ensureDir()
  if (!fs.existsSync(CASE_FILE)) return { cases: [], version: 1, lastUpdated: null }
  try {
    return JSON.parse(fs.readFileSync(CASE_FILE, 'utf-8'))
  } catch {
    return { cases: [], version: 1, lastUpdated: null }
  }
}

function writeAll(data) {
  ensureDir()
  data.lastUpdated = new Date().toISOString()
  fs.writeFileSync(CASE_FILE, JSON.stringify(data, null, 2))
  scheduleBackup()
}

/**
 * 生成可检索的案例摘要
 */
function makeSummary(d) {
  const city = d.context?.city?.name || d.cityId || '未知城市'
  const orders = d.predicted_orders || d.predictedOrders || 0
  const cost = d.cost_estimate || d.costEstimate || 0
  const risk = d.risk_level || d.riskLevel || 'medium'
  const gap = Math.round((d.gap_ratio || 0) * 100)
  return `${city}：预测 ${orders} 单，缺口率 ${gap}%，成本 ¥${Math.round(cost)}，风险 ${risk}`
}

/**
 * 从 report 提取行动建议
 */
function extractActions(d) {
  const report = d.report || ''
  // 抓"建议"列表（markdown 风格）
  const matches = report.match(/(?:^|\n)(?:#+\s*)?(?:建议|方案|措施|策略)[\s\S]{0,500}/g) || []
  const actions = matches.slice(0, 3).map(s => s.replace(/\n+/g, ' ').trim().slice(0, 150))
  if (actions.length === 0 && d.report) {
    // fallback：取 report 前 200 字
    return [d.report.replace(/\n+/g, ' ').slice(0, 150)]
  }
  return actions
}

/**
 * 归档一条决策到案例库
 */
export function archiveDecision(decision) {
  if (!decision || !decision.id) return null
  const all = readAll()
  
  const summary = makeSummary(decision)
  const actions = extractActions(decision)
  
  const caseRec = {
    id: decision.id,
    query: decision.query || '',
    cityId: decision.cityId || 'hengyang',
    summary,
    actions,
    predicted_orders: decision.predicted_orders || decision.predictedOrders || 0,
    cost_estimate: decision.cost_estimate || decision.costEstimate || 0,
    risk_level: decision.risk_level || decision.riskLevel || 'medium',
    gap_ratio: decision.gap_ratio || 0,
    context: decision.context || null,
    knowledgeUsed: decision.knowledgeUsed || [],
    createdAt: new Date().toISOString(),
    feedback: null,
    feedbackAt: null,
    success_rate: 0,  // 初始 0，等 feedback
    retrieval_count: 0
  }
  
  // 去重（按 id 更新而非追加）
  all.cases = all.cases.filter(c => c.id !== caseRec.id)
  all.cases.unshift(caseRec)
  
  // 限制最大 2000 条（避免文件过大）
  if (all.cases.length > 2000) {
    all.cases = all.cases.slice(0, 2000)
  }
  
  writeAll(all)
  console.log(`[Experience] 归档案例: ${caseRec.id} (${caseRec.summary}) [共 ${all.cases.length} 条]`)
  return caseRec
}

/**
 * 收到 feedback 后更新 success_rate
 */
export function updateCaseFeedback(decisionId, feedback) {
  if (!decisionId) return null
  const all = readAll()
  const c = all.cases.find(c => c.id === decisionId)
  if (!c) {
    console.warn(`[Experience] 案例不存在: ${decisionId}`)
    return null
  }
  
  c.feedback = feedback
  c.feedbackAt = new Date().toISOString()
  c.success_rate = feedback.result === 'success' ? 1.0
                 : feedback.result === 'partial' ? 0.5
                 : feedback.result === 'failed' ? 0
                 : (feedback.result ? 0.5 : 0)
  
  writeAll(all)
  console.log(`[Experience] 更新反馈: ${decisionId} → ${feedback.result} (success_rate=${c.success_rate})`)
  return c
}

/**
 * 检索案例库（Step 3 RAG 用）
 * 返回带 score 的案例列表
 */
export function searchCases(query, limit = 3) {
  const all = readAll()
  const q = String(query || '').toLowerCase().trim()
  if (!q || all.cases.length === 0) return []

  // 中文 n-gram
  const tokens = []
  if (q.length >= 2) tokens.push(q)
  for (let i = 0; i <= q.length - 2; i++) tokens.push(q.slice(i, i + 2))
  for (let i = 0; i < q.length; i++) tokens.push(q[i])
  const uniqueTokens = [...new Set(tokens)]

  // 评分
  const scored = all.cases.map(c => {
    let rawScore = 0
    const queryLower = (c.query || '').toLowerCase()
    const summaryLower = (c.summary || '').toLowerCase()
    const actionsStr = (c.actions || []).join(' ').toLowerCase()

    if (queryLower.includes(q)) rawScore += 5
    if (summaryLower.includes(q)) rawScore += 3
    if (actionsStr.includes(q)) rawScore += 2

    for (const t of uniqueTokens) {
      if (t.length < 2) continue
      if (queryLower.includes(t)) rawScore += 1
      if (summaryLower.includes(t)) rawScore += 0.5
    }

    // 成功案例强加权
    rawScore += c.success_rate * 5

    // 🆕 自动降权：retrieval_count 高的案例 score 衰减
    // 公式：1 / log(2 + count * 0.1)
    // count=0 → 1.0, count=10 → 0.91, count=50 → 0.55, count=100 → 0.40
    const count = c.retrieval_count || 0
    const decayFactor = 1 / Math.log(2 + count * 0.1)

    return {
      ...c,
      _rawScore: rawScore,
      score: rawScore * decayFactor,
      _decayFactor: decayFactor,
      _type: 'case'
    }
  })
  .filter(c => c.score >= 0.5)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)

  // 🆕 持久化 retrieval_count（避免总是推同一篇）
  if (scored.length > 0) {
    const dirty = new Set(scored.map(c => c.id))
    let needsWrite = false
    for (const c of all.cases) {
      if (dirty.has(c.id)) {
        c.retrieval_count = (c.retrieval_count || 0) + 1
        c.last_retrieved_at = new Date().toISOString()
        needsWrite = true
      }
    }
    if (needsWrite) writeAll(all)
  }

  return scored
}

/**
 * 列出案例（前端用）
 */
export function listAllCases(limit = 100, opts = {}) {
  const all = readAll()
  let list = all.cases
  if (opts.cityId) list = list.filter(c => c.cityId === opts.cityId)
  if (opts.minSuccessRate !== undefined) list = list.filter(c => c.success_rate >= opts.minSuccessRate)
  if (opts.withFeedback) list = list.filter(c => c.feedback)
  return list.slice(0, limit)
}

/**
 * 按天聚合：返回最近 N 天每天的决策量 + 采纳率（用于 ECharts 趋势图）
 * @param {number} days - 天数（默认 7）
 */
export function getTrend(days = 7) {
  const all = readAll()
  const now = new Date()
  const buckets = []
  
  // 初始化 N 个空桶
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)  // YYYY-MM-DD
    buckets.push({
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      total: 0,
      adopted: 0,
      rejected: 0,
      pending: 0
    })
  }
  
  // 聚合
  for (const c of all.cases) {
    const dateKey = (c.createdAt || '').slice(0, 10)
    const bucket = buckets.find(b => b.date === dateKey)
    if (!bucket) continue
    bucket.total++
    if (c.success_rate === 1) bucket.adopted++
    else if (c.success_rate === 0) bucket.rejected++
    else bucket.pending++  // 0.5 或 0
  }
  
  return buckets
}

/**
 * 采纳率分布（用于饼图）
 */
export function getAdoptionDistribution() {
  const all = readAll()
  const dist = { adopted: 0, partial: 0, rejected: 0, pending: 0 }
  for (const c of all.cases) {
    if (c.success_rate === 1) dist.adopted++
    else if (c.success_rate === 0.5) dist.partial++
    else if (c.success_rate === 0) dist.rejected++
    else dist.pending++
  }
  return dist
}

/**
 * 从高 success_rate 案例反向生成策略提示（注入 LLM prompt）
 * @param {string} query - 用户问题
 * @param {number} limit - 最多返回几个策略
 * @returns {string} Markdown 格式的策略提示
 */
export function buildStrategyHints(query, limit = 3) {
  const all = readAll()
  const q = (query || '').toLowerCase()
  
  // 1. 关键词匹配 + 优先高 success_rate
  const matched = all.cases
    .filter(c => c.success_rate >= 0.5)  // 只采纳率 >= 50% 的案例
    .map(c => {
      // 算关键词匹配分
      const text = `${c.query || ''} ${c.summary || ''} ${(c.tags || []).join(' ')}`.toLowerCase()
      const queryWords = q.split(/\s+/).filter(w => w.length >= 2)
      const hitCount = queryWords.filter(w => text.includes(w)).length
      const matchScore = queryWords.length > 0 ? hitCount / queryWords.length : 0
      return { ...c, _match: matchScore }
    })
    .filter(c => c._match > 0.2)  // 至少匹配 20% 关键词
    .sort((a, b) => {
      // 综合分 = 关键词匹配 × success_rate × 降权
      const decay = 1 / Math.log(2 + (a.retrieval_count || 0) * 0.1)
      const decayB = 1 / Math.log(2 + (b.retrieval_count || 0) * 0.1)
      return (b._match * (b.success_rate || 0) * decayB) - (a._match * (a.success_rate || 0) * decay)
    })
    .slice(0, limit)
  
  if (matched.length === 0) return ''
  
  // 2. 生成策略提示
  let hint = '\n【🎯 高采纳率历史策略】(基于过往成功案例，建议参考)\n'
  for (const c of matched) {
    const sr = Math.round((c.success_rate || 0) * 100)
    const adopt = c.feedback_count || 0
    hint += `✅ [${sr}%采纳 / ${adopt}次执行] ${c.summary || c.query || '(无标题)'}\n`
    // 提取关键结论（取 steps 里成功的）
    if (Array.isArray(c.steps)) {
      const keySteps = c.steps.filter(s => s.status === 'success' || s.success).slice(0, 2)
      for (const s of keySteps) {
        const txt = (s.output || s.report || s.conclusion || '').slice(0, 120).replace(/\n+/g, ' ')
        if (txt) hint += `   • ${txt}\n`
      }
    }
  }
  hint += '\n💡 **请优先参考采纳率 >= 80% 的策略，并基于当前实时数据做调整。**\n'
  return hint
}

/**
 * 统计
 */
export function stats() {
  const all = readAll()
  const cases = all.cases
  const withFb = cases.filter(c => c.feedback)
  return {
    total: cases.length,
    withFeedback: withFb.length,
    successRate: withFb.length > 0 ? withFb.filter(c => c.success_rate === 1).length / withFb.length : 0,
    avgSuccessRate: cases.length > 0 ? cases.reduce((s, c) => s + (c.success_rate || 0), 0) / cases.length : 0,
    byCity: cases.reduce((acc, c) => {
      acc[c.cityId] = (acc[c.cityId] || 0) + 1
      return acc
    }, {})
  }
}
