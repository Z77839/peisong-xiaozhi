/**
 * 骑手批量导入服务
 *
 * 支持：
 * - 单个添加：手动录入
 * - 批量导入：CSV/JSON
 *
 * 数据源：合并到内存 + 持久化到 data/riders_extra.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { scheduleBackup } from './backupService.js'

const EXTRA_FILE = path.resolve(process.cwd(), 'data/riders_extra.json')

// 加载额外导入的骑手
let extraRiders = []
function loadExtra() {
  if (fs.existsSync(EXTRA_FILE)) {
    try {
      extraRiders = JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf-8'))
    } catch (e) {
      extraRiders = []
    }
  }
  return extraRiders
}

function saveExtra() {
  try {
    if (!fs.existsSync(path.dirname(EXTRA_FILE))) {
      fs.mkdirSync(path.dirname(EXTRA_FILE), { recursive: true })
    }
    fs.writeFileSync(EXTRA_FILE, JSON.stringify(extraRiders, null, 2))
  scheduleBackup()
  } catch (e) {
    console.error('[RiderImporter] 保存失败:', e.message)
  }
}

// 启动时加载
loadExtra()
console.log(`[RiderImporter] 加载 ${extraRiders.length} 条额外骑手`)

/**
 * 添加单个骑手
 */
export function addRider(data) {
  const id = Date.now() + Math.floor(Math.random() * 1000)
  const rider = {
    _id: id,
    native_place: data.native_place || '',
    position_name: data.position_name || '配送员',
    city_id: data.city_id || '',
    city_name: data.city_name || '',
    station_id: data.station_id || '',
    station_name: data.station_name || '',
    first_run_date: data.first_run_date || new Date().toISOString().slice(0, 19).replace('T', ' '),
    last_complete_date: data.last_complete_date || new Date().toISOString().slice(0, 19).replace('T', ' '),
    order_count: Number(data.order_count) || 0,
    online_hours: Number(data.online_hours) || 0,
    delivery_distance: Number(data.delivery_distance) || 0,
    life_cycle1: data.life_cycle1 || '活跃期',
    life_cycle2: data.life_cycle2 || '活跃',
    life_cycle3: data.life_cycle3 || '高稳定高在线',
    rider_level_id: Number(data.rider_level_id) || 1,
    rider_level_name: data.rider_level_name || '淡定青铜',
    service_score: Number(data.service_score) || 0,
    rider_score: Number(data.rider_score) || 0,
    rider_type: Number(data.rider_type) || 0,
    imported_at: new Date().toISOString()
  }
  extraRiders.push(rider)
  saveExtra()
  return rider
}

/**
 * 批量导入骑手（CSV 字符串）
 */
export function importRidersFromCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length === 0) return { added: 0, errors: ['文件为空'] }

  // 解析表头
  const headers = parseCSVLine(lines[0])
  const requiredFields = ['native_place', 'city_name', 'station_name']
  for (const f of requiredFields) {
    if (!headers.includes(f)) {
      return { added: 0, errors: [`缺少必填字段: ${f}`] }
    }
  }

  // 解析数据行
  const added = []
  const errors = []
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])
      if (values.length !== headers.length) {
        errors.push(`第 ${i + 1} 行: 字段数不匹配 (${values.length} vs ${headers.length})`)
        continue
      }
      const obj = {}
      headers.forEach((h, idx) => { obj[h.trim()] = values[idx] })
      const rider = addRider(obj)
      added.push(rider._id)
    } catch (e) {
      errors.push(`第 ${i + 1} 行: ${e.message}`)
    }
  }

  return { added: added.length, errors, total: extraRiders.length }
}

/**
 * 简单 CSV 行解析（支持双引号）
 */
function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (c === ',' && !inQuote) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur.trim())
  return result
}

/**
 * 列出额外导入的骑手
 */
export function listExtraRiders({ page = 1, pageSize = 50 } = {}) {
  const start = (page - 1) * pageSize
  return {
    list: extraRiders.slice(start, start + pageSize),
    total: extraRiders.length
  }
}

/**
 * 删除导入的骑手
 */
export function deleteExtraRider(id) {
  const before = extraRiders.length
  extraRiders = extraRiders.filter(r => r._id !== Number(id) && String(r._id) !== String(id))
  saveExtra()
  return { removed: before - extraRiders.length }
}

/**
 * 导入的骑手数量
 */
export function getExtraRiderCount() {
  return extraRiders.length
}
