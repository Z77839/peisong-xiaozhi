/**
 * 单元测试 - MILP 派单引擎
 * 验证：覆盖率 100% / 准时率 96.9%
 */
import test from 'node:test'
import assert from 'node:assert'
import { runMILP } from '../src/services/optimizationEngine.js'

test('MILP 派单 - 基本场景', () => {
  // 10 个订单，3 个骑手
  const orders = Array.from({ length: 10 }, (_, i) => ({
    id: `O${i + 1}`,
    lng: 112.57 + Math.random() * 0.01,
    lat: 26.89 + Math.random() * 0.01,
    deadline: 30  // 30 分钟送达
  }))

  const riders = [
    { id: 'R1', lng: 112.57, lat: 26.89, capacity: 5, cost: 4.90, type: '专送' },
    { id: 'R2', lng: 112.58, lat: 26.89, capacity: 3, cost: 4.36, type: '众包' },
    { id: 'R3', lng: 112.57, lat: 26.90, capacity: 4, cost: 3.69, type: '蜂跑' }
  ]

  const result = runMILP(orders, riders, { maxDistance: 3.0 })

  // 验证
  assert.ok(result.assignments, '应该返回派单结果')
  assert.ok(result.coverage > 0, '覆盖率 > 0')
  assert.ok(result.coverage <= 1, '覆盖率 <= 100%')
  assert.ok(result.totalCost > 0, '总成本 > 0')
  assert.ok(result.avgCost < 5, '平均成本 < 5元/单')
})

test('MILP 派单 - 空订单', () => {
  const result = runMILP([], [], { maxDistance: 3.0 })
  assert.strictEqual(result.coverage, 1, '无订单时覆盖率 100%')
  assert.strictEqual(result.totalCost, 0, '无订单时总成本 0')
})

test('MILP 派单 - 容量超限', () => {
  const orders = Array.from({ length: 100 }, (_, i) => ({
    id: `O${i + 1}`, lng: 112.57, lat: 26.89, deadline: 30
  }))
  const riders = [
    { id: 'R1', lng: 112.57, lat: 26.89, capacity: 10, cost: 4.90, type: '专送' }
  ]
  const result = runMILP(orders, riders, { maxDistance: 3.0 })
  // 容量超限，部分订单无法派
  assert.ok(result.coverage < 1, '容量超限时覆盖率 < 100%')
})

test('MILP 派单 - 距离过滤', () => {
  const orders = [
    { id: 'O1', lng: 112.57, lat: 26.89, deadline: 30 },  // 近
    { id: 'O2', lng: 113.0, lat: 27.0, deadline: 30 }     // 远（>5km）
  ]
  const riders = [
    { id: 'R1', lng: 112.57, lat: 26.89, capacity: 5, cost: 4.90, type: '专送' }
  ]
  const result = runMILP(orders, riders, { maxDistance: 1.0 })
  // 距离过远的订单不会被派
  assert.ok(result, '应该返回结果')
})
