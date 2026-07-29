/**
 * Embedding 服务 — 豆包 doubao-embedding
 * 
 * 设计：
 * - 启动时批量算 seed 文档的 embedding，存到 data/embeddings_cache.json
 * - 运行时 query embedding 走内存缓存 + API
 * - cosine 相似度计算纯 CPU，无需外部依赖
 * - 缓存：同一文本 1 小时内复用
 */
import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import { DOUBAO } from '../config.js'
import { logger } from './logger.js'

const EMBEDDING_MODEL = 'doubao-embedding-text-240715'
const EMBEDDING_DIM = 2048  // doubao-embedding-text-240715 输出维度
const CACHE_FILE = path.resolve(process.cwd(), 'data/embeddings_cache.json')

// 内存缓存：text → embedding
const memCache = new Map()
const CACHE_TTL_MS = 3600 * 1000  // 1 小时

// 持久化缓存（避免重启重新算）
function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0))  // 无缩进，省空间
  } catch (e) {
    logger.warn(`[Embedding] 缓存保存失败: ${e.message}`)
  }
}

let persistentCache = loadCache()
logger.info(`[Embedding] 启动时加载 ${Object.keys(persistentCache).length} 条 embedding 缓存`)

/**
 * 调豆包 embedding API
 */
async function callEmbedding(text) {
  if (!DOUBAO.enabled) {
    throw new Error('DOUBAO 未配置 ARK_API_KEY')
  }
  try {
    const res = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/embeddings',
      {
        model: EMBEDDING_MODEL,
        input: text.slice(0, 2048)  // doubao 单次最大 8K token
      },
      {
        headers: {
          Authorization: `Bearer ${DOUBAO.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    )
    const vec = res.data?.data?.[0]?.embedding
    if (!vec || !Array.isArray(vec)) {
      throw new Error('响应格式错误: ' + JSON.stringify(res.data).slice(0, 200))
    }
    return vec
  } catch (e) {
    logger.error(`[Embedding] API 调用失败: ${e.message}`)
    throw e
  }
}

/**
 * 获取文本 embedding（带内存 + 持久化双层缓存）
 */
export async function embed(text) {
  if (!text || !text.trim()) return null
  const key = text.trim()
  
  // 1. 内存缓存
  const memHit = memCache.get(key)
  if (memHit && Date.now() - memHit.ts < CACHE_TTL_MS) {
    return memHit.vec
  }
  
  // 2. 持久化缓存（持久化无 TTL，只看是否已存在）
  if (persistentCache[key]) {
    memCache.set(key, { vec: persistentCache[key], ts: Date.now() })
    return persistentCache[key]
  }
  
  // 3. 调 API
  try {
    const vec = await callEmbedding(key)
    memCache.set(key, { vec, ts: Date.now() })
    persistentCache[key] = vec
    saveCache(persistentCache)
    return vec
  } catch (e) {
    logger.warn(`[Embedding] 失败 fallback 关键词: ${e.message}`)
    return null
  }
}

/**
 * 批量 embed（用于预计算 seed 文档）
 */
export async function embedBatch(texts) {
  const results = []
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    if (!t || !t.trim()) {
      results.push(null)
      continue
    }
    try {
      const vec = await embed(t)
      results.push(vec)
      if ((i + 1) % 5 === 0) {
        logger.info(`[Embedding] 进度 ${i + 1}/${texts.length}`)
      }
    } catch (e) {
      results.push(null)
    }
  }
  return results
}

/**
 * Cosine 相似度
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * 预计算文档 embedding（启动时调用）
 * 返回 { docId → vec } Map
 */
export async function precomputeDocEmbeddings(docs) {
  const result = new Map()
  if (!DOUBAO.enabled) {
    logger.warn(`[Embedding] DOUBAO 未启用，跳过预计算`)
    return result
  }
  
  logger.info(`[Embedding] 开始预计算 ${docs.length} 个文档的 embedding...`)
  const start = Date.now()
  
  // 用 title + desc + content 前 500 字 作 embedding 输入
  const texts = docs.map(d => {
    const parts = [d.title || '', d.desc || '', (d.content || '').slice(0, 500)]
    return parts.filter(Boolean).join(' ').slice(0, 1500)
  })
  
  const vecs = await embedBatch(texts)
  for (let i = 0; i < docs.length; i++) {
    if (vecs[i]) {
      result.set(docs[i].id, vecs[i])
    }
  }
  
  logger.info(`[Embedding] 预计算完成: ${result.size}/${docs.length} 条 (${Date.now() - start}ms)`)
  return result
}

/**
 * 统计
 */
export function stats() {
  return {
    enabled: DOUBAO.enabled,
    model: EMBEDDING_MODEL,
    memCacheSize: memCache.size,
    persistentCacheSize: Object.keys(persistentCache).length,
    cacheFile: CACHE_FILE
  }
}
