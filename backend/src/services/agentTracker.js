/**
 * 决策智能体能力调用追踪器（JSON 文件版）
 * 每次决策流运行，记录每个能力的调用次数和耗时。
 * 数据源：data/capability_calls.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { scheduleBackup } from './backupService.js'

const TRACKING_FILE = path.resolve(process.cwd(), 'data/capability_calls.json')

function readTrackingFile(filePath = TRACKING_FILE) {
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
}

function writeTrackingFile(arr, filePath = TRACKING_FILE) {
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2))
  scheduleBackup()
}

export function trackCapabilityCall({ capabilityName, durationMs = 0, status = 'success', decisionId = null, query = '' }) {
  try {
    const arr = readTrackingFile()
    arr.push({
      capability_name: capabilityName,
      duration_ms: Math.round(durationMs),
      status,
      decision_id: decisionId,
      query: query?.slice(0, 100),
      timestamp: new Date().toISOString()
    })
    if (arr.length > 10000) arr.splice(0, arr.length - 10000)
    writeTrackingFile(arr)
  } catch (e) {
    console.warn('[CapabilityTracker] 记录失败:', e.message)
  }
}

export function getCapabilityCallStats() {
  try {
    const arr = readTrackingFile()
    const grouped = {}
    for (const c of arr) {
      const name = c.capability_name || c.agent_name || 'unknown'
      if (!grouped[name]) {
        grouped[name] = { calls: 0, totalMs: 0, maxMs: 0, minMs: Infinity, lastCall: null }
      }
      const g = grouped[name]
      g.calls++
      g.totalMs += c.duration_ms || 0
      g.maxMs = Math.max(g.maxMs, c.duration_ms || 0)
      g.minMs = Math.min(g.minMs, c.duration_ms || 0)
      g.lastCall = c.timestamp
    }
    return Object.entries(grouped).map(([name, v]) => ({
      capability_name: name,
      calls: v.calls,
      avg_ms: Math.round(v.totalMs / v.calls),
      max_ms: v.maxMs,
      min_ms: v.minMs === Infinity ? 0 : v.minMs,
      last_call: v.lastCall
    })).sort((a, b) => b.calls - a.calls)
  } catch (e) {
    console.warn('[CapabilityTracker] 读取失败:', e.message)
    return []
  }
}

export function getBaselineCapabilityStats() {
  return {
    '知识库检索能力': { baseCalls: 1248, baseMs: 320 },
    '任务路由能力': { baseCalls: 1248, baseMs: 320 },
    '订单预测能力': { baseCalls: 845, baseMs: 280 },
    '运力分析能力': { baseCalls: 642, baseMs: 220 },
    '成本分析能力': { baseCalls: 642, baseMs: 220 },
    '派单推荐能力': { baseCalls: 2156, baseMs: 420 },
    '决策汇总能力': { baseCalls: 189, baseMs: 180 },
    '报告生成能力': { baseCalls: 127, baseMs: 540 }
  }
}

export function trackAgentCall(params) {
  return trackCapabilityCall({
    capabilityName: params.agentName || params.capabilityName,
    durationMs: params.durationMs,
    status: params.status,
    decisionId: params.decisionId,
    query: params.query
  })
}

export function getAgentCallStats() {
  return getCapabilityCallStats().map((item) => ({
    agent_name: item.capability_name,
    calls: item.calls,
    avg_ms: item.avg_ms,
    max_ms: item.max_ms,
    min_ms: item.min_ms,
    last_call: item.last_call
  }))
}

export function getBaselineAgentStats() {
  return Object.fromEntries(Object.entries(getBaselineCapabilityStats()).map(([name, value]) => [name, value]))
}
