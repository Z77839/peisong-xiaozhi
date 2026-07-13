/**
 * 豆包（Doubao）LLM 服务
 * 字节跳动火山引擎 - OpenAI 兼容协议
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
 * @returns {Promise<{content, usage, model}>}
 */
export async function callDoubao(messages, options = {}) {
  if (!DOUBAO.enabled) {
    throw new Error('豆包未配置（缺少 ARK_API_KEY）')
  }

  // 标准化 messages
  const msgs = typeof messages === 'string'
    ? [{ role: 'user', content: messages }]
    : messages

  const body = {
    model: options.model || DOUBAO.model,
    messages: msgs,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2048
  }

  const start = Date.now()
  try {
    const res = await axios.post(DOUBAO.endpoint, body, {
      headers: {
        Authorization: `Bearer ${DOUBAO.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })
    const elapsed = Date.now() - start
    const data = res.data
    const content = data?.choices?.[0]?.message?.content || ''
    const usage = data?.usage || {}
    logger.info(`[Doubao] 调用成功 (${elapsed}ms, prompt=${usage.prompt_tokens || '?'}, completion=${usage.completion_tokens || '?'})`)

    return {
      content,
      usage,
      model: data?.model || body.model,
      elapsed
    }
  } catch (err) {
    const elapsed = Date.now() - start
    const status = err.response?.status
    const errBody = err.response?.data
    logger.error(`[Doubao] 调用失败 (${elapsed}ms, status=${status}): ${errBody ? JSON.stringify(errBody).slice(0, 200) : err.message}`)
    throw new Error(`豆包调用失败 [${status}]: ${errBody?.error?.message || err.message}`)
  }
}

/**
 * 豆包流式（可选，比赛可不用）
 */
export async function callDoubaoStream(messages, onChunk) {
  if (!DOUBAO.enabled) {
    throw new Error('豆包未配置')
  }
  const body = {
    model: DOUBAO.model,
    messages: typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages,
    stream: true
  }
  const res = await axios.post(DOUBAO.endpoint, body, {
    headers: {
      Authorization: `Bearer ${DOUBAO.apiKey}`,
      'Content-Type': 'application/json'
    },
    responseType: 'stream',
    timeout: 60000
  })
  return new Promise((resolve, reject) => {
    let content = ''
    res.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            const obj = JSON.parse(data)
            const delta = obj.choices?.[0]?.delta?.content || ''
            if (delta) {
              content += delta
              onChunk?.(delta, content)
            }
          } catch {}
        }
      }
    })
    res.data.on('end', () => resolve({ content }))
    res.data.on('error', reject)
  })
}
