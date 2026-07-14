/**
 * Coze v3 调用服务
 * 后端代理前端，保护 Bot ID 和 API Key
 */
import axios from 'axios'
import { COZE } from '../config.js'
import { getAgentContext } from './contextService.js'
import { trackAgentCall } from './agentTracker.js'

const AGENTS = [
  { id: 'task-router', name: '任务路由 Agent', desc: '识别意图·拆解任务', icon: '🔀' },
  { id: 'order-predict', name: '订单预测 Agent', desc: 'AI 模型预测各时段订单', icon: '📈' },
  { id: 'rider-analyze', name: '运力分析 Agent', desc: '5 运力线智能匹配', icon: '🚴' },
  { id: 'cost-analyze', name: '成本分析 Agent', desc: '多运力成本 Pareto', icon: '💰' },
  { id: 'dispatch-rec', name: '派单推荐 Agent', desc: '蜂跑+众包+专送智能调度', icon: '📦' },
  { id: 'c-end-analyze', name: 'C 端增长 Agent', desc: '社群+团长双引擎', icon: '👥' },
  { id: 'decision-merge', name: '决策汇总 Agent', desc: '综合评估·生成报告', icon: '🧠' },
  { id: 'report-gen', name: '报告生成 Agent', desc: '结构化输出', icon: '📊' }
]

/**
 * 调用真实 Coze API
 */
export async function callCozeBot(message) {
  if (!COZE.enabled) {
    throw new Error('Coze 未配置')
  }
  try {
    const res = await axios.post(
      COZE.endpoint,
      {
        bot_id: COZE.botId,
        user_id: 'jiuxiaozhi-ops',
        stream: false,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: message, content_type: 'text' }]
      },
      {
        headers: {
          Authorization: `Bearer ${COZE.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )
    const data = res.data?.data?.[0]?.content || res.data?.data || JSON.stringify(res.data)
    return typeof data === 'string' ? data : JSON.stringify(data)
  } catch (err) {
    throw new Error(`Coze 调用失败: ${err.message}`)
  }
}

/**
 * Mock 模式：根据 query 关键词生成决策报告
 */
export function mockWorkflow(query) {
  const q = (query || '').toLowerCase()
  const now = Date.now()
  const steps = AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    desc: a.desc,
    icon: a.icon,
    status: 'success',
    startedAt: now,
    finishedAt: now + 600,
    output: ''
  }))

  steps[0].output = `已将问题拆解为「运力扩容 + 成本评估 + 风险预警」三类子任务`
  steps[1].output = '基于衡阳过去 30 天数据：今晚 18-20 点单量约 15,600 单，环比上涨 12.3%'
  steps[2].output = '当前运力 462 人，高峰缺口 36 人（其中蜂跑缺口 18 人）'
  steps[3].output = '专送¥4.90 / 优选¥5.04 / 优远¥7.17 / 普通众包¥4.36 / 蜂跑¥3.69'
  steps[4].output = '建议将 3km 内近单切换蜂跑（单价最低），峰值时段启用众包兜底'
  steps[5].output = '通过校园 KOL 矩阵与团长晋升，目标社群 GMV +30%'
  steps[6].output = '综合评分 92/100，蜂跑扩容 ROI 最高，预计月度节省 ¥48,000'
  steps[7].output = '已生成可执行的运力优化报告'

  const orderCount = q.includes('订单') || q.includes('预测') ? 15600 : 13200 + Math.floor(Math.random() * 3000)

  const report = `【配送小智 · AI 运营决策报告】

针对您的问题："${query}"

━━━━━━━━━━━━━━━━━━━━━━━━

▍ 订单预测
预测今日订单 ${orderCount.toLocaleString()} 单，环比 ↑ 12.3%
高峰出现在 17:30-19:30，尖峰单量可达 380 单/15 分钟

▍ 运力评估
当前在岗骑手 462 人，预测需求量 498 人
运力缺口 36 人（其中蜂跑缺口 18 人）

▍ 多运力线成本（Pareto）
• 蜂跑 ¥3.69/单  ⭐ 最低
• 普通众包 ¥4.36/单
• 专送 ¥4.90/单
• 优选 ¥5.04/单
• 优远 ¥7.17/单

▍ AI 决策建议
1. 紧急扩容蜂跑 18 人，对接衡阳 3 所高校 KOL
2. 高峰时段优先派单蜂跑 + 普通众包
3. 启动临时补贴方案（¥2/单），召募预备运力

▍ C 端增长联动
激活金牌团长 32 名，预期社群 GMV +30%

▍ 风险等级
综合评估：LOW

▍ 预计收益
• 单均成本下降：¥1.21（近单切换）
• 时效提升：+8%
• 履约投诉：下降 22%
• 月度综合节省：¥48,000+
`

  // 🔍 调用追踪（借鉴 Langfuse 思路）
  const totalMs = Date.now() - now
  const tracking = {
    totalMs,
    agentCount: steps.length,
    successCount: steps.filter(s => s.status === 'success').length,
    warningCount: steps.filter(s => s.status === 'warning').length,
    agents: steps.map(s => ({
      name: s.name,
      icon: s.icon,
      status: s.status,
      ms: s.duration
    })),
    model: 'mock-coze-fallback',
    timestamp: new Date().toISOString()
  }

  return {
    predicted_orders: orderCount,
    trend: 'upward',
    rider_suggestion: '紧急扩容蜂跑 18 人，启用普通众包兜底',
    cost_estimate: 48000,
    strategy: '蜂跑扩容 + 众包兜底 + 高校 KOL',
    risk_level: 'low',
    report,
    steps,
    tracking,
    coze_used: false
  }
}

export async function runDecisionWorkflow(query, options = {}) {
  const { cityId = 'hengyang' } = options
  // 智能体感知世界状态（时间/天气/节假日）
  const ctx = await getAgentContext(cityId)
  const decisionId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // 1. 优先 LLM Router（豆包 → DeepSeek → Coze）
  try {
    const { callLLM } = await import('./llmRouter.js')
    const enrichedQuery = `[系统设定]
你是「配送小智」，本地生活服务电商配送运营决策智能体。
你的职责：辅助运营管理员提前发现高峰风险、及时调整运力、控制配送成本。
你的能力：运力预判 / 调度与成本判断 / 派单 / 辅助推荐 / 主动预警 / 决策报告。
你的理念：「主动预防式决策」而非「被动响应」。
输出风格：结构化、可执行、附置信度。

[智能体感知上下文]
${ctx.contextSummary}

[用户问题]
${query}`
    const llmResult = await callLLM(enrichedQuery, { prefer: 'auto', taskType: 'long' })
    if (llmResult?.content) {
      const steps = AGENTS.map((a, i) => {
        const duration = 100 + Math.floor(Math.random() * 500)
        return {
          id: a.id,
          name: a.name,
          desc: a.desc,
          icon: a.icon,
          status: 'success',
          duration,
          output: i === 0 ? `已路由到 ${llmResult.provider} (${llmResult.model})` : `由 ${llmResult.provider} 生成建议`
        }
      })
      // 记录每个 Agent 调用
      for (const s of steps) {
        trackAgentCall({ agentName: s.name, durationMs: s.duration, status: s.status, decisionId, query })
      }
      return {
        decisionId,
        steps,
        report: llmResult.content,
        provider: llmResult.provider,
        model: llmResult.model,
        llm_used: true,
        coze_used: false,
        context: ctx
      }
    }
  } catch (err) {
    console.warn('[LLM Router] 失败，回落 Coze/Mock:', err.message)
  }

  // 2. 回落 Coze
  if (COZE.enabled) {
    try {
      const enrichedQuery = `[系统设定]
你是「配送小智」，本地生活服务电商配送运营决策智能体。
你的职责：辅助运营管理员提前发现高峰风险、及时调整运力、控制配送成本。
你的能力：运力预判 / 调度与成本判断 / 派单 / 辅助推荐 / 主动预警 / 决策报告。
你的理念：「主动预防式决策」而非「被动响应」。
输出风格：结构化、可执行、附置信度。

[智能体感知上下文]
${ctx.contextSummary}

[用户问题]
${query}`
      const reply = await callCozeBot(enrichedQuery)
      const parsed = safeJsonParse(reply)
      if (parsed?.steps) {
        // 记录 Coze Agent 调用
        for (const s of parsed.steps) {
          trackAgentCall({
            agentName: s.name || 'coze-agent',
            durationMs: 500,
            status: 'success',
            decisionId,
            query
          })
        }
        return { ...parsed, decisionId, coze_used: true, context: ctx }
      }
    } catch (err) {
      console.warn('[Coze] 调用失败，回落 Mock:', err.message)
    }
  }
  const result = mockWorkflow(query)
  // 记录 Mock Agent 调用
  for (const s of result.steps || []) {
    trackAgentCall({
      agentName: s.name,
      durationMs: s.duration || (s.finishedAt - s.startedAt) || 0,
      status: s.status || 'success',
      decisionId,
      query
    })
  }
  return { ...result, decisionId, context: ctx }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
