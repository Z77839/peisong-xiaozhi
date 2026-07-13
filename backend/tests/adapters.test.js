/**
 * 单元测试 - Adapter 模式
 * 验证：4 个 Adapter 在 mock 和真实模式都能工作
 */
import test from 'node:test'
import assert from 'node:assert'

// Mock env（不设 Key）
delete process.env.QWEATHER_API_KEY

// 必须 dynamic import，因为模块加载时读 env
const qweather = await import('../src/adapters/qweatherAdapter.js')
const rider = await import('../src/adapters/riderTelemetryAdapter.js')
const orderPool = await import('../src/adapters/orderPoolAdapter.js')
const eleme = await import('../src/adapters/eleOrderAdapter.js')

test('QWeather - Mock 模式', async () => {
  const data = await qweather.loadWeatherForecast('hengyang')
  assert.ok(data, '应该返回数据')
  assert.strictEqual(data.source, 'mock', 'Mock 模式 source 应该是 mock')
  assert.ok(data.current.temp, '应该有温度')
  assert.ok(data.current.weather, '应该有天气')
  assert.ok(Array.isArray(data.forecast24h), '应该有 24h 预报')
  assert.ok(data.impact, '应该有影响系数')
})

test('QWeather - 4 城市都支持', async () => {
  for (const city of ['hengyang', 'shaoxing', 'changde', 'quzhou']) {
    const data = await qweather.loadWeatherForecast(city)
    assert.strictEqual(data.city, city, `${city} 应该能返回`)
    assert.ok(data.cityName, `${city} 应该有中文名`)
  }
})

test('QWeather - 未知城市抛错', async () => {
  await assert.rejects(
    () => qweather.loadWeatherForecast('beijing'),
    /未知城市/,
    '应该抛出未知城市错误'
  )
})

test('RiderTelemetry - Mock 模式', async () => {
  const riders = await rider.loadRiderTelemetry('hengyang')
  assert.ok(Array.isArray(riders), '应该返回数组')
  assert.ok(riders.length > 0, '应该至少有一个骑手')
})

test('OrderPool - Mock 模式', async () => {
  const orders = await orderPool.loadOrderPool('hengyang', '1h')
  assert.ok(Array.isArray(orders), '应该返回数组')
  assert.ok(orders.length > 0, '应该至少有订单')
})

test('EleOrder - Mock 模式', async () => {
  const orders = await eleme.loadHistoricalOrders('hengyang', 7)
  assert.ok(Array.isArray(orders), '应该返回数组')
  assert.ok(orders.length > 0, '应该至少有订单')
})
