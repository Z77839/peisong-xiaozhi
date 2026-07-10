/**
 * /api/chat — 结构化聊天回复 + 历史持久化
 */

import { Router } from 'express'
import { getAgentContext } from '../services/contextService.js'
import { cities } from '../data/cities.js'
import { riderTypes } from '../data/rider-types.js'
import * as history from '../services/historyService.js'

const router = Router()

const INTENT_KEYWORDS = {
  predict: ['预测', '缺骑手', '缺口', '未来', '高峰', '运力'],
  subsidy: ['补贴', '成本', '省钱', '方案'],
  rain: ['雨', '雪', '恶劣', '天气'],
  c_end: ['团长', 'C端', '社群', '增长'],
  rider: ['运力', '专送', '蜂跑', '优选', '众包']
}

function detectIntents(question) {
  const intents = []
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => question.includes(kw))) intents.push(intent)
  }
  return intents.length ? intents : ['predict']
}

function buildSectionsByIntent(intents, question, ctx) {
  const sections = {
    understanding: '',
    tools: ['订单数据接口', '骑手分布接口', '智能体感知上下文'],
    judgement: [],
    suggestions: []
  }

  if (intents.includes('rain')) {
    sections.understanding = `你希望在${ctx.weather.label}（${ctx.weather.temp}°C）恶劣天气下，获得可执行的骑手调度与异常应对方案。`
  } else if (intents.includes('subsidy')) {
    sections.understanding = `你希望判断${ctx.city.name}当前是否需要投入补贴，并在成本与履约稳定之间找到平衡点。`
  } else if (intents.includes('c_end')) {
    sections.understanding = `你希望提升${ctx.city.name}团长激活率与 C 端社群转化，给出可落地的运营 SOP。`
  } else if (intents.includes('rider')) {
    sections.understanding = `你希望了解${ctx.city.name} 5 条运力线（专送/优选/优远/众包/蜂跑）的人力配置建议。`
  } else {
    sections.understanding = `你希望识别未来短时段内${ctx.city.name}订单与骑手供给错配的区域，并提前调整运力。`
  }
  if (ctx.timeSlot.isWeekend) sections.understanding += `（今天是周末）`
  if (ctx.weather.orderEffect > 1.1) {
    sections.understanding += `（${ctx.weather.label}预计订单+${((ctx.weather.orderEffect - 1) * 100).toFixed(0)}%）`
  }

  if (intents.includes('predict')) {
    sections.tools.push('运力预测模型', '天气风险模型')
    sections.judgement = [
      `${ctx.city.name}·${ctx.city.province}未来 2 小时缺口最高`,
      `${ctx.timeSlot.name}${ctx.timeSlot.weight}需求时段重点关注`,
      `${ctx.weather.icon} ${ctx.weather.label} ${ctx.weather.temp}°C 影响配送时长`,
      '风险主要集中在商圈和写字楼订单叠加区域'
    ]
    sections.suggestions = [
      `向 ${ctx.city.name} 核心商圈预调 120 名骑手`,
      '蜂跑 + 优选双引擎并行，启用众包兜底',
      `每 15 分钟刷新缺口预测并更新调度名单`
    ]
  }
  if (intents.includes('subsidy')) {
    sections.tools.push('成本测算引擎', 'Coze 知识库')
    sections.judgement = [
      '当前建议启用平衡方案',
      '高风险区域集中，补贴不宜全城铺开',
      `预计准时率可从 91.4% 提升到 94.8%`
    ]
    sections.suggestions = [
      `${ctx.city.name} 按 3 档单量阶梯补贴`,
      `补贴窗口设置为 17:50-19:20`,
      '每 15 分钟复核一次投入产出比'
    ]
  }
  if (intents.includes('rain')) {
    sections.judgement = [
      `${ctx.weather.label}天订单弹性最高`,
      `${ctx.timeSlot.name}后跨区订单会拉长平均配送时长`,
      '空闲骑手低于 20% 的区域需要优先干预'
    ]
    sections.suggestions = [
      `提前把空闲骑手向 ${ctx.city.name} 核心商圈聚合`,
      `对${ctx.weather.label}强上升区域启用 20-40 分钟短补贴`,
      '暂停低优先级跨区远单，保障近场订单履约'
    ]
  }
  if (intents.includes('c_end')) {
    sections.judgement = [
      `${ctx.city.name}团长激活率仅 9.8%，提升空间大`,
      '微信社群 + 拼团是主战场',
      '金牌团长月 GMV 可达 ¥32,000'
    ]
    sections.suggestions = [
      '建立 5 个标杆社群，每个 200 人',
      '上线「团长周激励」制度',
      '为 TOP10 团长配置专属客服'
    ]
  }
  if (intents.includes('rider')) {
    sections.judgement = [
      `蜂跑 ¥${riderTypes[4]?.cost} 成本最低`,
      `专送 ¥${riderTypes[0]?.cost} 时效最优`,
      `优选 ¥${riderTypes[1]?.cost} 平衡选择`
    ]
    sections.suggestions = [
      `蜂跑跑 5 公里内订单，节省 24%`,
      `优选覆盖 3 公里核心商圈`,
      '众包作为高峰兜底'
    ]
  }
  return sections
}

/**
 * POST /api/chat
 * body: { message, cityId, sessionId? }
 * - 不传 sessionId：自动创建新 session
 * - 传 sessionId：追加到该 session
 */
router.post('/', async (req, res) => {
  const { message, cityId, sessionId } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ code: 400, message: 'message 必填' })
  }

  try {
    // 1. 智能体感知上下文
    const ctx = await getAgentContext(cityId || 'hengyang')

    // 2. 意图识别 + 生成回复
    const intents = detectIntents(message)
    const sections = buildSectionsByIntent(intents, message, ctx)

    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      sections,
      context: {
        datetime: ctx.datetime,
        city: ctx.city.name,
        weather: `${ctx.weather.icon} ${ctx.weather.label} ${ctx.weather.temp}°C`,
        timeSlot: ctx.timeSlot.name,
        factors: ctx.factors
      }
    }

    // 3. 持久化
    let session
    if (sessionId) {
      session = history.getSession(sessionId)
      if (!session) {
        session = history.createSession({ cityId, title: message.slice(0, 24) })
      } else {
        history.appendMessage(session.id, { role: 'user', content: message })
      }
    } else {
      session = history.createSession({ cityId, title: message.slice(0, 24) })
      history.appendMessage(session.id, { role: 'user', content: message })
    }
    const appendResult = history.appendMessage(session.id, assistantMessage)

    // 4. 返回（带 sessionId 方便前端续接）
    res.json({
      ...assistantMessage,
      sessionId: session.id,
      sessionTitle: appendResult?.session.title || session.title
    })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

/**
 * GET /api/chat/history?limit=50
 * 返回历史 session 列表
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const sessions = history.listSessions(limit)
    const stats = history.stats()
    res.json({ code: 0, data: { sessions, stats } })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

/**
 * GET /api/chat/history/:id
 * 返回单个 session 完整消息
 */
router.get('/history/:id', (req, res) => {
  try {
    const session = history.getSession(req.params.id)
    if (!session) return res.status(404).json({ code: 404, message: 'session 不存在' })
    res.json({ code: 0, data: session })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

/**
 * DELETE /api/chat/history/:id
 */
router.delete('/history/:id', (req, res) => {
  try {
    const ok = history.deleteSession(req.params.id)
    if (!ok) return res.status(404).json({ code: 404, message: 'session 不存在' })
    res.json({ code: 0, message: '删除成功' })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
})

export default router