/**
 * 豆包（Doubao）LLM 服务
 * 字节跳动火山引擎 - 支持两个端点：
 *  1. /v3/chat/completions（OpenAI 兼容，简单对话）
 *  2. /v3/responses（新版 API，支持多模态、工具调用）
 *
 * 申请：https://www.volcengine.com/product/doubao
 * 控制台：https://console.volcengine.com/ark
 */
import axios from 'axios'
import { DOUBAO } from '../config.js'
import { logger } from './logger.js'

/**
 * 豆包 Chat Completion
 * @param {string|Array} messages - 单条消息或消息数组
 * @param {Object} options - { temperature, max_tokens, model }
 */
export async function callDoubao(messages, options = {}) {
  if (!DOUBAO.enabled) {
    throw new Error('豆包未配置（缺少 ARK_API_KEY）')
  }

  const model = options.model || DOUBAO.model
  const isResponsesAPI = DOUBAO.endpoint.includes('/responses')

  const start = Date.now()
  try {
    let res, body

    if (isResponsesAPI) {
      // ====== 新版 responses 端点 ======
      // 格式: { model, input: [{role, content: [{type, text|image_url}]}] }
      const input = typeof messages === 'string'
        ? [{ role: 'user', content: [{ type: 'input_text', text: messages }] }]
        : messages.map(m => ({
            role: m.role,
            content: [{ type: 'input_text', text: m.content }]
          }))

      body = {
        model,
        input
      }
    } else {
      // ====== OpenAI 兼容 chat/completions 端点 ======
      const msgs = typeof messages === 'string'
        ? [{ role: 'user', content: messages }]
        : messages
      body = {
        model,
        messages: msgs,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 2048
      }
    }

    res = await axios.post(DOUBAO.endpoint, body, {
      headers: {
        Authorization: `Bearer ${DOUBAO.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    const elapsed = Date.now() - start
    const data = res.data
    let content = ''
    let usage = data?.usage || {}

    if (isResponsesAPI) {
      // responses API 响应格式
      const output = data?.output || []
      for (const item of output) {
        if (item.type === 'message' && item.content) {
          for (const c of item.content) {
            if (c.type === 'output_text') content += c.text
          }
        }
      }
    } else {
      // chat/completions 响应格式
      content = data?.choices?.[0]?.message?.content || ''
    }

    logger.info(`[Doubao] 调用成功 (${elapsed}ms, model=${model}, endpoint=${isResponsesAPI ? 'responses' : 'chat'})`)

    return {
      content,
      usage,
      model: data?.model || model,
      elapsed,
      endpoint: isResponsesAPI ? 'responses' : 'chat'
    }
  } catch (err) {
    const elapsed = Date.now() - start
    const status = err.response?.status
    const errBody = err.response?.data
    logger.error(`[Doubao] 调用失败 (${elapsed}ms, status=${status}): ${errBody ? JSON.stringify(errBody).slice(0, 200) : err.message}`)
    throw new Error(`豆包调用失败 [${status}]: ${errBody?.error?.message || err.message}`)
  }
}
