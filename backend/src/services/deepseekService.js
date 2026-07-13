/**
 * DeepSeek LLM 服务（备用模型）
 * 文档：https://platform.deepseek.com/api-docs/
 * OpenAI 兼容
 */
import axios from 'axios'
import { DEEPSEEK } from '../config.js'
import { logger } from './logger.js'

export async function callDeepSeek(messages, options = {}) {
  if (!DEEPSEEK.enabled) {
    throw new Error('DeepSeek 未配置（缺少 DEEPSEEK_API_KEY）')
  }
  const msgs = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages

  const start = Date.now()
  try {
    const res = await axios.post(DEEPSEEK.endpoint, {
      model: options.model || DEEPSEEK.model,
      messages: msgs,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048
    }, {
      headers: {
        Authorization: `Bearer ${DEEPSEEK.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })
    const elapsed = Date.now() - start
    const data = res.data
    return {
      content: data?.choices?.[0]?.message?.content || '',
      usage: data?.usage || {},
      model: data?.model || DEEPSEEK.model,
      elapsed
    }
  } catch (err) {
    const elapsed = Date.now() - start
    logger.error(`[DeepSeek] 失败 (${elapsed}ms): ${err.response?.data?.error?.message || err.message}`)
    throw new Error(`DeepSeek 失败: ${err.response?.data?.error?.message || err.message}`)
  }
}
