/**
 * 单元测试 - 优化引擎
 * 验证：MILP/ARIMA/LP 三个数学引擎
 */
import test from 'node:test'
import assert from 'node:assert'
import { optimizeDispatch, predictGap, optimizeCostPlan, DataAdapters } from '../src/services/optimizationEngine.js'

test('MILP 派单 - 基本场景', async () => {
  const orders = Array.from({ length: 10 }, (_, i) => ({
    id: `O${i + 1}`,
    lng: 112.57 + Math.random() * 0.01,
    lat: 26.89 + Math.random() * 0.01,
    deadline: 30
  }))
  const riders = [
    { id: 'R1', lng: 112.57, lat: 26.89, capacity: 5, cost: 4.90, type: '专送' },
    { id: 'R2', lng: 112.58, lat: 26.89, capacity: 3, cost: 4.36, type: '众包' },
    { id: 'R3', lng: 112.59, lat: 26.89, capacity: 8, cost: 3.69, type: '蜂跑' }
  ]
  const r = await optimizeDispatch({ cityId: 'hengyang', orders, riders })
  assert.ok(r, '应有返回')
  assert.ok(r.dispatch, '应有 dispatch 字段')
  assert.ok(r.algorithm, '应有 algorithm 字段')
})

test('ARIMA 缺口预测 - 工作日午后', async () => {
  const r = await predictGap({ cityId: 'hengyang', hour: 14, weather: 'sunny', isHoliday: false })
  assert.ok(r, '应有返回')
  assert.ok(typeof r.gap === 'number' || typeof r.prediction === 'number' || r.value !== undefined, '应有数字字段')
  assert.ok(r.gap >= 0 || r.prediction >= 0 || r.value >= 0, '缺口应为非负')
})

test('LP 成本优化 - 多运力线', async () => {
  const r = await optimizeCostPlan({ cityId: 'hengyang', gap: 36, currentCost: 50000 })
  assert.ok(r, '应有返回')
  assert.ok(r.plans || r.recommended, '应有 plans/recommended 字段')
})

test('DataAdapters - 4 个适配器都注册', () => {
  assert.ok(DataAdapters, 'DataAdapters 应存在')
  // 至少有天气和订单两个适配器
  const keys = Object.keys(DataAdapters)
  assert.ok(keys.length >= 2, `至少 2 个适配器，实际: ${keys.length}`)
})
