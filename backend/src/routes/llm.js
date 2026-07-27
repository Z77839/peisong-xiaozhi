/**
 * LLM 路由
 * /api/llm/chat - 统一对话入口（智能路由到豆包/DeepSeek/Coze/mock）
 * /api/llm/status - 查看所有模型状态
 * /api/llm/capabilities/:capId - 单个决策智能体能力调用
 */
import express from 'express'
import { callLLM, getLLMStatus } from '../services/llmRouter.js'
import { DOUBAO, DEEPSEEK, COZE, LLM_ROUTER } from '../config.js'
import { logger } from '../services/logger.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/llm/status
 * 查看 LLM 模型状态
 */
router.get('/status', (req, res) => {
  res.json({
    code: 200,
    data: {
      ...getLLMStatus(),
      details: {
        doubao: {
          enabled: DOUBAO.enabled,
          model: DOUBAO.model,
          endpoint: DOUBAO.endpoint
        },
        deepseek: {
          enabled: DEEPSEEK.enabled,
          model: DEEPSEEK.model
        },
        coze: {
          enabled: COZE.enabled
        }
      }
    }
  })
})

/**
 * POST /api/llm/chat
 * 统一对话
 * body: { messages: [...], prefer: 'auto'|'doubao'|'deepseek'|'coze', taskType: 'simple'|'long'|'reason'|'workflow' }
 */
router.post('/chat', authRequired, async (req, res) => {
  const { messages, prompt, prefer = 'auto', taskType = 'simple', temperature = 0.7 } = req.body
  const input = messages || prompt
  if (!input) {
    return res.status(400).json({ code: 400, message: 'messages 或 prompt 必填' })
  }

  try {
    const result = await callLLM(input, { prefer, taskType, temperature })
    res.json({
      code: 200,
      data: {
        content: result.content,
        provider: result.provider,
        model: result.model,
        elapsed: result.elapsed || 0,
        usage: result.usage
      }
    })
  } catch (err) {
    logger.error(`[LLM] chat 失败: ${err.message}`)
    res.status(500).json({ code: 500, message: err.message })
  }
})

async function handleCapabilityCall(req, res) {
  const { capId } = req.params
  const { prompt, context = {} } = req.body
  if (!prompt) return res.status(400).json({ code: 400, message: 'prompt 必填' })

  const taskMap = {
    'task-router': 'simple',
    'order-predict': 'long',
    'rider-analyze': 'long',
    'cost-analyze': 'reason',
    'dispatch-rec': 'reason',
    'decision-merge': 'reason',
    'report-gen': 'long'
  }
  const taskType = taskMap[capId] || 'simple'

  try {
    const result = await callLLM(prompt, { prefer: 'auto', taskType, temperature: 0.5 })
    res.json({
      code: 200,
      data: {
        capabilityId: capId,
        taskType,
        content: result.content,
        provider: result.provider,
        model: result.model,
        elapsed: result.elapsed || 0
      }
    })
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message })
  }
}

/**
 * POST /api/llm/capabilities/:capId
 * 单个决策智能体能力调用（路由到对应 LLM）
 */
router.post('/capabilities/:capId', authRequired, handleCapabilityCall)

router.post('/agents/:agentId', authRequired, (req, res) => {
  req.params.capId = req.params.agentId
  return handleCapabilityCall(req, res)
})

export default router
