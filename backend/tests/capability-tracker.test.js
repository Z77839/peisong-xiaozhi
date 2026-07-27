import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  trackCapabilityCall,
  getCapabilityCallStats,
  getBaselineCapabilityStats,
  trackAgentCall,
  getAgentCallStats,
  getBaselineAgentStats
} from '../src/services/agentTracker.js'

const capabilityFile = path.resolve(process.cwd(), 'data/capability_calls.json')
const legacyFile = path.resolve(process.cwd(), 'data/agent_calls.json')

test('capability tracking uses new file and legacy wrappers stay compatible', () => {
  for (const file of [capabilityFile, legacyFile]) {
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }

  trackCapabilityCall({ capabilityName: '任务路由能力', durationMs: 123, status: 'success', decisionId: 'd1', query: 'hello' })

  const capabilityStats = getCapabilityCallStats()
  assert.equal(capabilityStats.length, 1)
  assert.equal(capabilityStats[0].capability_name, '任务路由能力')
  assert.equal(capabilityStats[0].calls, 1)

  const agentStats = getAgentCallStats()
  assert.equal(agentStats.length, 1)
  assert.equal(agentStats[0].agent_name, '任务路由能力')
  assert.equal(agentStats[0].calls, 1)

  const baselineCapability = getBaselineCapabilityStats()
  assert.ok(baselineCapability['任务路由能力'])

  const legacyBaseline = getBaselineAgentStats()
  assert.ok(legacyBaseline['任务路由能力'] || legacyBaseline['任务路由 Agent'])

  trackAgentCall({ agentName: '任务路由能力', durationMs: 234, status: 'success', decisionId: 'd2', query: 'x' })
  const after = getCapabilityCallStats()
  assert.equal(after[0].calls, 2)
})
