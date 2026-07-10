/**
 * Chat 历史存储服务（基于 JSON 文件，无需安装数据库）
 *
 * 文件位置：backend/data/chat-sessions.json
 * 数据结构：
 * {
 *   sessions: [
 *     {
 *       id: 'session-2026-07-08-001',
 *       title: '衡阳运力分析',
 *       cityId: 'hengyang',
 *       createdAt: 1783436000000,
 *       updatedAt: 1783436000000,
 *       messages: [
 *         { id, role: 'user'|'assistant', content, sections?, context?, timestamp }
 *       ]
 *     }
 *   ]
 * }
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, '../../data')
const DATA_FILE = path.join(DATA_DIR, 'chat-sessions.json')

// 确保目录存在
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function loadAll() {
  ensureDir()
  if (!fs.existsSync(DATA_FILE)) return { sessions: [] }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return { sessions: [] }
  }
}

function saveAll(data) {
  ensureDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 列表：返回所有 session（精简版）
 */
export function listSessions(limit = 50) {
  const data = loadAll()
  return data.sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      title: s.title,
      cityId: s.cityId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      preview: s.messages[s.messages.length - 1]?.content?.slice(0, 50) || ''
    }))
}

/**
 * 详情：拿一个 session 完整内容
 */
export function getSession(id) {
  const data = loadAll()
  return data.sessions.find((s) => s.id === id) || null
}

/**
 * 新建 session
 */
export function createSession({ cityId, title }) {
  const data = loadAll()
  const now = Date.now()
  const session = {
    id: `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: title || '新会话',
    cityId: cityId || 'hengyang',
    createdAt: now,
    updatedAt: now,
    messages: []
  }
  data.sessions.unshift(session)
  saveAll(data)
  return session
}

/**
 * 追加消息
 */
export function appendMessage(sessionId, message) {
  const data = loadAll()
  const session = data.sessions.find((s) => s.id === sessionId)
  if (!session) return null
  const msg = {
    id: message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: message.role,
    content: message.content || '',
    sections: message.sections || null,
    context: message.context || null,
    timestamp: Date.now()
  }
  session.messages.push(msg)
  session.updatedAt = Date.now()
  // 自动用用户首条消息作为标题
  if (session.title === '新会话' && msg.role === 'user') {
    session.title = msg.content.slice(0, 24) + (msg.content.length > 24 ? '...' : '')
  }
  saveAll(data)
  return { session, message: msg }
}

/**
 * 删除 session
 */
export function deleteSession(id) {
  const data = loadAll()
  const idx = data.sessions.findIndex((s) => s.id === id)
  if (idx === -1) return false
  data.sessions.splice(idx, 1)
  saveAll(data)
  return true
}

/**
 * 统计
 */
export function stats() {
  const data = loadAll()
  return {
    totalSessions: data.sessions.length,
    totalMessages: data.sessions.reduce((s, x) => s + x.messages.length, 0),
    lastUpdated: data.sessions[0]?.updatedAt || null
  }
}