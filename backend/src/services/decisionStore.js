/**
 * 决策反馈存储（轻量级 JSON 持久化）
 * 决策中心 ↔ 派单/告警 模块的"桥梁"：把派单结果写回决策记录
 * 跨重启靠 backupService 持久化到 GitHub data-backup 分支
 */
import fs from 'node:fs'
import path from 'node:path'
import { scheduleBackup } from './backupService.js'

const STORE_DIR = path.resolve(process.cwd(), 'data')
const FEEDBACK_FILE = path.join(STORE_DIR, 'decision_feedbacks.json')

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })
}

function readAll() {
  ensureDir()
  if (!fs.existsSync(FEEDBACK_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeAll(data) {
  ensureDir()
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2))
  // 触发 GitHub 备份（debounce 5s）
  scheduleBackup()
}

/**
 * 保存某条决策的执行反馈
 */
export function saveFeedback(decisionId, feedback) {
  const all = readAll()
  all[decisionId] = { ...feedback, updatedAt: new Date().toISOString() }
  writeAll(all)
  return feedback
}

/**
 * 读取某条决策的反馈
 */
export function getFeedback(decisionId) {
  const all = readAll()
  return all[decisionId] || null
}

/**
 * 列出所有反馈
 */
export function listAllFeedbacks() {
  return readAll()
}
