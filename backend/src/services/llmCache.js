/**
 * LLM 响应缓存（内存级，60s TTL）
 *
 * 解决问题：豆包 LLM 第一次冷启动 60-90s，但相同 query 重复调用频繁
 * 优化策略：query+city hash 作 key，60s 内命中直接返回，绕开 LLM 调用
 *
 * 适用场景：演示时连续点击同一预设问题、或同一城市/相近期重复问
 * 注意：故意用 60s TTL 不持久化，避免脏数据风险
 */

const TTL_MS = 60_000
const MAX_ENTRIES = 200

// 内存 cache: { key: { result, expiresAt } }
const cache = new Map()

/**
 * 生成 cache key（基于 query + cityId + 主要 params）
 */
export function makeKey(query, options = {}) {
  const parts = [
    String(query || '').trim().toLowerCase(),
    String(options.cityId || ''),
    String(options.taskType || 'long')
  ]
  return parts.join('|')
}

/**
 * 取缓存（命中返回 result，未命中返回 null）
 */
export function get(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.result
}

/**
 * 写缓存
 */
export function set(key, result) {
  if (cache.size >= MAX_ENTRIES) {
    // 简单 LRU：删最早的 20%
    const toDelete = Math.floor(MAX_ENTRIES * 0.2)
    const iter = cache.keys()
    for (let i = 0; i < toDelete; i++) {
      cache.delete(iter.next().value)
    }
  }
  cache.set(key, { result, expiresAt: Date.now() + TTL_MS })
}

/**
 * 清空缓存（测试用）
 */
export function clear() {
  cache.clear()
}

/**
 * 缓存状态（用于 debug）
 */
export function stats() {
  return { size: cache.size, ttlMs: TTL_MS, maxEntries: MAX_ENTRIES }
}
