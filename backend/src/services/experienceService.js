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
