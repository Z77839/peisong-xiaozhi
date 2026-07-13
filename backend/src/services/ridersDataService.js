/**
 * 骑手数据服务
 *
 * 数据源策略（自动降级）：
 * 1. PostgreSQL（如有 DATABASE_URL 配置）— 真实生产环境
 * 2. CSV 文件（data/riders_full.csv）— 演示/离线环境
 * 3. 启动时从 GitHub Release 拉取 CSV（如本地+网络都不可用，会自动下载）
 *
 * 数据：27,186 真实骑手（城代物流骑手宽表）
 */
import fs from 'node:fs'
import path from 'node:path'
import { logger } from './logger.js'
import { pool } from './db.js'

const CSV_PATH = path.resolve(process.cwd(), 'data/riders_full.csv')
const DEFAULT_CSV_URL = 'https://github.com/Z77839/peisong-xiaozhi/releases/download/riders-data-v1/riders_full.csv'
const FALLBACK_CSV_URL = process.env.RIDERS_CSV_URL || DEFAULT_CSV_URL

const USE_POSTGRES = !!process.env.DATABASE_URL

let ridersCache = null
let lastLoadTime = null
let sourceType = USE_POSTGRES ? 'postgres' : 'csv'

// ============================================
// 1. 异步：启动时拉取 CSV（如本地没有）
// ============================================
export async function bootstrapRiders() {
  if (USE_POSTGRES) {
    try {
      const r = await pool.query('SELECT COUNT(*) FROM riders')
      const cnt = Number(r.rows[0].count)
      logger.info(`[Riders] PostgreSQL 已就绪: ${cnt} 条骑手`)
      if (cnt === 0) {
        logger.warn('[Riders] PG 表为空，请运行: node scripts/importRiders.js')
      }
      return
    } catch (err) {
      logger.warn(`[Riders] PG 查询失败: ${err.message}`)
    }
  }
  if (fs.existsSync(CSV_PATH)) {
    logger.info(`[Riders] 本地 CSV 已存在: ${CSV_PATH}`)
    return
  }
  if (!FALLBACK_CSV_URL) return
  try {
    logger.info(`[Riders] 拉取 CSV: ${FALLBACK_CSV_URL}`)
    const res = await fetch(FALLBACK_CSV_URL, { 
      redirect: 'follow', 
      signal: AbortSignal.timeout(90000) 
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    fs.writeFileSync(CSV_PATH, text)
    logger.info(`[Riders] 拉取完成: ${text.length} bytes`)
  } catch (err) {
    logger.warn(`[Riders] 拉取 CSV 失败: ${err.message}`)
  }
}

// ============================================
// 2. 同步：loadRiders 内部方法
// ============================================
function loadCSV() {
  if (ridersCache) return ridersCache
  if (!fs.existsSync(CSV_PATH)) {
    logger.warn(`[Riders] CSV 不存在: ${CSV_PATH}`)
    return []
  }
  const start = Date.now()
  const text = fs.readFileSync(CSV_PATH, 'utf-8')
  const data = parseCSV(text)
  ridersCache = data
  lastLoadTime = new Date()
  logger.info(`[Riders] CSV 加载 ${data.length} 个骑手 (${Date.now() - start}ms)`)
  return data
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const row = { _id: i }
    for (let j = 0; j < headers.length; j++) {
      const v = values[j]?.trim().replace(/^"|"$/g, '') || null
      row[headers[j]] = v
    }
    rows.push(row)
  }
  return rows
}

// ============================================
// 3. 对外 API（统一接口）
// ============================================
export function loadRiders(force = false) {
  if (USE_POSTGRES) {
    // PG 模式：返回空 cache，列表/统计走 SQL
    return []
  }
  return loadCSV()
}

export async function listRiders({ page = 1, pageSize = 50, city, level, type, isResigned, search } = {}) {
  if (USE_POSTGRES) {
    return await listRidersPG({ page, pageSize, city, level, type, search })
  }
  return listRidersCSV({ page, pageSize, city, level, type, search })
}

function listRidersCSV({ page, pageSize, city, level, type, isResigned, search }) {
  let all = loadCSV()
  const totalAll = all.length
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
  const ps = Math.min(pageSize, 200)
  const p = Math.max(page, 1)
  const start = (p - 1) * ps
  const list = all.slice(start, start + ps)
  return { list, total: all.length, page: p, pageSize: ps, totalAll }
}

async function listRidersPG({ page, pageSize, city, level, type, search }) {
  const ps = Math.min(pageSize, 200)
  const p = Math.max(page, 1)
  const offset = (p - 1) * ps
  const conditions = []
  const params = []
  let i = 1
  if (city) { conditions.push(`city_name = $${i++}`); params.push(city) }
  if (level) { conditions.push(`rider_level_name = $${i++}`); params.push(level) }
  if (type) { conditions.push(`rider_type = $${i++}`); params.push(type) }
  if (search) {
    conditions.push(`(native_place ILIKE $${i} OR station_name ILIKE $${i})`)
    params.push(`%${search}%`)
    i++
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  
  const totalR = await pool.query(`SELECT COUNT(*) FROM riders ${where}`, params)
  const totalAllR = await pool.query('SELECT COUNT(*) FROM riders')
  const listR = await pool.query(
    `SELECT * FROM riders ${where} ORDER BY _id LIMIT ${ps} OFFSET ${offset}`,
    params
  )
  return {
    list: listR.rows,
    total: Number(totalR.rows[0].count),
    page: p,
    pageSize: ps,
    totalAll: Number(totalAllR.rows[0].count)
  }
}

export async function getRiderById(id) {
  if (USE_POSTGRES) {
    const r = await pool.query('SELECT * FROM riders WHERE _id = $1', [id])
    return r.rows[0] || null
  }
  const all = loadCSV()
  return all.find(r => r._id === Number(id) || String(r._id) === String(id))
}

export async function getRiderStats() {
  if (USE_POSTGRES) {
    return await getRiderStatsPG()
  }
  return getRiderStatsCSV()
}

function getRiderStatsCSV() {
  const all = loadCSV()
  if (all.length === 0) return null
  const byCity = {}
  const byLevel = {}
  const byType = {}
  const byLifecycle = {}
  let totalOrders = 0, totalHours = 0, totalDistance = 0
  let activeRiders = 0
  for (const r of all) {
    const c = r.city_name || '未分配'; byCity[c] = (byCity[c] || 0) + 1
    const l = r.rider_level_name || '未分级'; byLevel[l] = (byLevel[l] || 0) + 1
    const t = r.rider_type || '未分类'; byType[t] = (byType[t] || 0) + 1
    const lc = r.life_cycle1 || '未分类'; byLifecycle[lc] = (byLifecycle[lc] || 0) + 1
    totalOrders += Number(r.order_count) || 0
    totalHours += Number(r.online_hours) || 0
    totalDistance += Number(r.delivery_distance) || 0
    if (r.life_cycle1 && r.life_cycle1 !== '') activeRiders++
  }
  return {
    total: all.length,
    active: activeRiders,
    resigned: all.length - activeRiders,
    metrics: { totalOrders, totalHours: Math.round(totalHours), totalDistance: Math.round(totalDistance) },
    byCity, byLevel, byType, byLifecycle
  }
}

async function getRiderStatsPG() {
  const totalR = await pool.query('SELECT COUNT(*) FROM riders')
  const total = Number(totalR.rows[0].count)
  if (total === 0) return null
  
  const [activeR, ordersR, byCityR, byLevelR, byTypeR, byLifecycleR] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM riders WHERE life_cycle1 IS NOT NULL AND life_cycle1 != ''`),
    pool.query(`SELECT SUM(order_count)::int as s, SUM(online_hours)::numeric(15,2) as h, SUM(delivery_distance)::numeric(15,2) as d FROM riders`),
    pool.query(`SELECT city_name, COUNT(*)::int as cnt FROM riders GROUP BY city_name ORDER BY cnt DESC`),
    pool.query(`SELECT rider_level_name, COUNT(*)::int as cnt FROM riders GROUP BY rider_level_name ORDER BY cnt DESC`),
    pool.query(`SELECT rider_type, COUNT(*)::int as cnt FROM riders GROUP BY rider_type ORDER BY cnt DESC`),
    pool.query(`SELECT life_cycle1, COUNT(*)::int as cnt FROM riders GROUP BY life_cycle1 ORDER BY cnt DESC`)
  ])
  
  const toObj = (rows) => Object.fromEntries(rows.map(r => [r.city_name || r.rider_level_name || r.rider_type || r.life_cycle1 || '未分类', r.cnt]))
  
  return {
    total,
    active: Number(activeR.rows[0].count),
    resigned: total - Number(activeR.rows[0].count),
    metrics: {
      totalOrders: ordersR.rows[0].s || 0,
      totalHours: Math.round(Number(ordersR.rows[0].h) || 0),
      totalDistance: Math.round(Number(ordersR.rows[0].d) || 0)
    },
    byCity: toObj(byCityR.rows),
    byLevel: toObj(byLevelR.rows),
    byType: toObj(byTypeR.rows),
    byLifecycle: toObj(byLifecycleR.rows)
  }
}

export function ridersHealth() {
  return {
    loaded: ridersCache !== null || USE_POSTGRES,
    count: ridersCache?.length || 0,
    lastLoadTime,
    source: sourceType
  }
}
