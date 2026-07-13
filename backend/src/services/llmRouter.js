/**
 * LLM 路由器
 *
 * 策略：
 * - 豆包（Doubao）：默认首选（字节火山，中文优化）
 * - DeepSeek：备用（推理强）
 * - Coze：兜底（业务编排）
 * - 本地 mock：最后兜底
 *
 * 智能路由规则（auto 模式）：
 * - 简单查询/分类 → 豆包 lite
 * - 长文分析/报告 → 豆包 pro
 * - 推理题 → DeepSeek
 * - 业务工作流 → Coze
 */
import { DOUBAO, DEEPSEEK, COZE, LLM_ROUTER } from '../config.js'
import { logger } from './logger.js'
import { callDoubao } from './doubaoService.js'
import { callDeepSeek } from './deepseekService.js'
import { callCozeBot } from './cozeService.js'

/**
 * 统一 LLM 调用入口
 * @param {string|Array} messages
 * @param {Object} options { prefer: 'doubao'|'deepseek'|'coze'|'auto', taskType: 'simple'|'long'|'reason'|'workflow' }
 */
export async function callLLM(messages, options = {}) {
  const prefer = options.prefer || LLM_ROUTER.strategy || 'auto'
  const taskType = options.taskType || 'simple'

  // 选模型
  const model = pickModel(prefer, taskType)
  logger.info(`[LLM Router] 策略=${prefer}, 任务=${taskType} → 模型=${model}`)

  // 调对应模型
  switch (model) {
    case 'doubao':
      return await callDoubao(messages, options).then(r => ({ ...r, provider: 'doubao' }))
    case 'deepseek':
      return await callDeepSeek(messages, options).then(r => ({ ...r, provider: 'deepseek' }))
    case 'coze':
      const content = await callCozeBot(typeof messages === 'string' ? messages : messages[messages.length - 1].content)
      return { content, provider: 'coze' }
    default:
      return mockLLM(messages, options)
  }
}

/**
 * 智能选模型
 */
function pickModel(prefer, taskType) {
  // 显式指定
  if (prefer === 'doubao' && DOUBAO.enabled) return 'doubao'
  if (prefer === 'deepseek' && DEEPSEEK.enabled) return 'deepseek'
  if (prefer === 'coze' && COZE.enabled) return 'coze'

  // auto 模式：根据任务类型 + 可用模型自动选
  if (prefer === 'auto') {
    if (taskType === 'reason' && DEEPSEEK.enabled) return 'deepseek'
    if (taskType === 'workflow' && COZE.enabled) return 'coze'
    if (DOUBAO.enabled) return 'doubao' // 默认
    if (DEEPSEEK.enabled) return 'deepseek'
    if (COZE.enabled) return 'coze'
  }

  return 'mock'
}

/**
 * 本地 mock（无 API key 时的兜底）
 */
async function mockLLM(messages, options) {
  const prompt = typeof messages === 'string' ? messages : messages[messages.length - 1].content
  // 简单规则匹配
  let content = ''
  if (/订单|预测/.test(prompt)) {
    content = JSON.stringify({
      summary: '基于历史数据和实时订单量预测',
      predictions: [
        { time: '17:00-18:00', orders: 1240, confidence: 0.92 },
        { time: '18:00-19:00', orders: 1850, confidence: 0.89 },
        { time: '19:00-20:00', orders: 2100, confidence: 0.85 }
      ],
      model: 'mock',
      note: '⚠️ 豆包未配置，当前为 mock 响应。请配置 ARK_API_KEY 启用真实豆包模型。'
    })
  } else if (/成本|运力|调度/.test(prompt)) {
    content = JSON.stringify({
      summary: '多运力成本优化方案',
      recommendation: '优选+众包组合',
      savings: '12.3%',
      model: 'mock',
      note: '⚠️ 豆包未配置'
    })
  } else {
    content = JSON.stringify({
      summary: '已收到您的查询',
      response: `查询内容：${prompt.slice(0, 50)}...`,
      model: 'mock',
      note: '⚠️ 豆包/DeepSeek/Coze 全部未配置，使用本地 mock 响应'
    })
  }
  return { content, provider: 'mock', model: 'mock' }
}

/**
 * 获取所有模型状态
 */
export function getLLMStatus() {
  return {
    doubao: { enabled: DOUBAO.enabled, model: DOUBAO.model },
    deepseek: { enabled: DEEPSEEK.enabled, model: DEEPSEEK.model },
    coze: { enabled: COZE.enabled, model: 'coze-bot' },
    strategy: LLM_ROUTER.strategy,
    default: LLM_ROUTER.default
  }
}
