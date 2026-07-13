/**
 * 骑手数据服务
 * 加载 riders_full.csv 到内存，提供查询/统计 API
 * 27,186 真实骑手数据（城代物流骑手宽表）
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { logger } from './logger.js'

const CSV_PATH = path.resolve(process.cwd(), 'data/riders_full.csv')
// 备用：Render 启动时如果本地 CSV 不存在，从 GitHub 拉取
const DEFAULT_CSV_URL = 'https://github.com/Z77839/peisong-xiaozhi/releases/download/riders-data-v1/riders_full.csv'
const FALLBACK_CSV_URL = process.env.RIDERS_CSV_URL || DEFAULT_CSV_URL

let ridersCache = null
let lastLoadTime = null

/**
 * 从 GitHub 拉取 CSV（使用 fetch 自动 follow redirect）
 */
async function downloadCSV() {
  if (!FALLBACK_CSV_URL) throw new Error('No URL')
  logger.info(`[Riders] 拉取 CSV: ${FALLBACK_CSV_URL}`)
  const res = await fetch(FALLBACK_CSV_URL, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const text = await res.text()
  try { fs.writeFileSync(CSV_PATH, text) } catch (e) { logger.warn(`[Riders] 写本地失败: ${e.message}`) }
  logger.info(`[Riders] 拉取完成: ${text.length} bytes`)
  return text
}

/**
 * 解析 CSV（简单 split，不处理复杂转义）
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      const v = values[j]?.trim().replace(/^"|"$/g, '') || null
      row[headers[j]] = v
    }
    // 添加 _id
    row._id = i
    rows.push(row)
  }
  return rows
}

/**
 * 加载骑手数据（带缓存）
 */
export async function loadRiders(force = false) {
  if (ridersCache && !force) return ridersCache

  // 优先用本地文件
  if (!fs.existsSync(CSV_PATH) && FALLBACK_CSV_URL) {
    try {
      await downloadCSV()
    } catch (err) {
      logger.warn(`[Riders] 拉取 CSV 失败: ${err.message}`)
    }
  }

  if (!fs.existsSync(CSV_PATH)) {
    logger.warn(`[Riders] CSV 不存在: ${CSV_PATH}`)
    return []
  }

  const start = Date.now()
  const text = fs.readFileSync(CSV_PATH, 'utf-8')
  const data = parseCSV(text)
  const elapsed = Date.now() - start

  ridersCache = data
  lastLoadTime = new Date()
  logger.info(`[Riders] 加载 ${data.length} 个骑手 (${elapsed}ms)`)
  return data
}

/**
 * 列出骑手（分页 + 过滤）
 */
export function listRiders({ page = 1, pageSize = 50, city, level, type, isResigned, search } = {}) {
  let all = loadRiders()
  const total = all.length

  // 过滤
  if (city) all = all.filter(r => r.city_name === city)
  if (level) all = all.filter(r => r.rider_level_name === level)
  if (type) all = all.filter(r => String(r.rider_type) === String(type))
  if (search) {
    const kw = String(search).toLowerCase()
    all = all.filter(r =>
      (r.native_place || '').toLowerCase().includes(kw) ||
      (r.city_name || '').toLowerCase().includes(kw) ||
      (r.station_name || '').toLowerCase().includes(kw) ||
      String(r.station_id || '').includes(kw) ||
      String(r.city_id || '').includes(kw)
    )
  }

  // 分页
  const ps = Math.min(pageSize, 200)
  const p = Math.max(page, 1)
  const start = (p - 1) * ps
  const list = all.slice(start, start + ps)

  return { list, total: all.length, page: p, pageSize: ps, totalAll: total }
}

/**
 * 骑手详情
 */
export function getRiderById(id) {
  const all = loadRiders()
  return all.find(r => r._id === Number(id) || String(r._id) === String(id))
}

/**
 * 统计（按城市/等级/类型/状态）
 */
export function getRiderStats() {
  const all = loadRiders()
  if (all.length === 0) return null

  // 按 city_name
  const byCity = {}
  for (const r of all) {
    const c = r.city_name || '未分配'
    byCity[c] = (byCity[c] || 0) + 1
  }

  // 按 rider_level_name
  const byLevel = {}
  for (const r of all) {
    const l = r.rider_level_name || '未分级'
    byLevel[l] = (byLevel[l] || 0) + 1
  }

  // 按 rider_type
  const byType = {}
  for (const r of all) {
    const t = r.rider_type || '未分类'
    byType[t] = (byType[t] || 0) + 1
  }

  // 按 life_cycle1
  const byLifecycle = {}
  for (const r of all) {
    const lc = r.life_cycle1 || '未分类'
    byLifecycle[lc] = (byLifecycle[lc] || 0) + 1
  }

  // 累计指标
  const totalOrders = all.reduce((s, r) => s + (Number(r.order_count) || 0), 0)
  const totalHours = all.reduce((s, r) => s + (Number(r.online_hours) || 0), 0)
  const totalDistance = all.reduce((s, r) => s + (Number(r.delivery_distance) || 0), 0)
  const activeRiders = all.filter(r => r.life_cycle1 && r.life_cycle1 !== '').length

  return {
    total: all.length,
    active: activeRiders,
    resigned: all.length - activeRiders,
    metrics: {
      totalOrders,
      totalHours: Math.round(totalHours),
      totalDistance: Math.round(totalDistance)
    },
    byCity,
    byLevel,
    byType,
    byLifecycle
  }
}

/**
 * 健康检查
 */
export function ridersHealth() {
  return {
    loaded: ridersCache !== null,
    count: ridersCache?.length || 0,
    lastLoadTime
  }
}

