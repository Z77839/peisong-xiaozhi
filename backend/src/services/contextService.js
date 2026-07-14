/**
 * 智能体上下文服务
 * 自动感知：当前时间 / 城市 / 天气 / 节假日 / 时段
 *
 * 这些 context 在每次决策流运行时自动注入到 prompt，
 * 让 LLM 不是"凭空"回答，而是基于真实世界状态
 */

import axios from 'axios'
import { cities } from '../data/cities.js'
import { getRiderStats } from './ridersDataService.js'

// 城市经纬度（用于查天气）
const CITY_COORDS = {
  hengyang: { lat: 26.89, lng: 112.57 },
  shaoxing: { lat: 30.02, lng: 120.58 },
  changde: { lat: 29.03, lng: 111.68 },
  quzhou: { lat: 28.97, lng: 118.87 }
}

// 2025 中国法定节假日（简化版）
const HOLIDAYS_2025 = [
  { name: '元旦', date: '01-01', days: 1 },
  { name: '春节', date: '01-28', days: 7 },
  { name: '清明节', date: '04-04', days: 3 },
  { name: '劳动节', date: '05-01', days: 5 },
  { name: '端午节', date: '05-31', days: 3 },
  { name: '中秋节', date: '10-06', days: 3 },
  { name: '国庆节', date: '10-01', days: 7 }
]

/**
 * 时段分类
 */
function getTimeSlot(hour) {
  if (hour >= 6 && hour < 9) return { name: '早餐', icon: '🌅', weight: '中低' }
  if (hour >= 9 && hour < 11) return { name: '上午', icon: '☀️', weight: '中' }
  if (hour >= 11 && hour < 14) return { name: '午高峰', icon: '🍱', weight: '极高' }
  if (hour >= 14 && hour < 17) return { name: '下午', icon: '🌇', weight: '中' }
  if (hour >= 17 && hour < 21) return { name: '晚高峰', icon: '🍜', weight: '极高' }
  if (hour >= 21 && hour < 24) return { name: '夜宵', icon: '🌙', weight: '中' }
  return { name: '凌晨', icon: '🌌', weight: '极低' }
}

function daysDiff(a, b) {
  const [am, ad] = a.split('-').map(Number)
  const [bm, bd] = b.split('-').map(Number)
  const dayOfYearA = am * 31 + ad
  const dayOfYearB = bm * 31 + bd
  return dayOfYearB - dayOfYearA
}

function getHolidayInfo(date) {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const matched = HOLIDAYS_2025.find((h) => h.date === monthDay)
  if (matched) return { isHoliday: true, name: matched.name }
  for (const h of HOLIDAYS_2025) {
    const diff = daysDiff(monthDay, h.date)
    if (diff > 0 && diff <= 3) return { isHoliday: false, preheat: h.name, preheatIn: diff }
  }
  return { isHoliday: false }
}

/**
 * Mock 天气（按城市+日期变化，看起来"真的"）
 * 生产环境配置 WEATHER_API_KEY 后自动切到和风 API
 */
function mockWeather(cityId) {
  const city = cities.find((c) => c.id === cityId) || cities[0]
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const hour = now.getHours()

  const conditions = [
    { type: 'sunny', icon: '☀️', label: '晴', temp: 28, desc: '晴朗无云，骑行舒适', orderEffect: 1.0 },
    { type: 'cloudy', icon: '⛅', label: '多云', temp: 24, desc: '云量较高，略有凉意', orderEffect: 1.05 },
    { type: 'rainy', icon: '🌧', label: '小雨', temp: 20, desc: '小雨，外卖需求预计增加 20%', orderEffect: 1.2 },
    { type: 'storm', icon: '⛈', label: '暴雨', temp: 18, desc: '暴雨预警，配送可能延迟', orderEffect: 1.4 },
    { type: 'snow', icon: '❄️', label: '雪', temp: -2, desc: '雨雪天气，订单量明显上升', orderEffect: 1.3 },
    { type: 'fog', icon: '🌫', label: '雾', temp: 16, desc: '大雾天气，路况不明，骑手需谨慎', orderEffect: 0.9 }
  ]

  // (城市+日期+时段) → 一个稳定的天气，但跨天会变
  const citySeed = city.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const idx = (citySeed + dayOfYear + Math.floor(hour / 6)) % conditions.length
  const base = conditions[idx]
  const tempOffset = ((citySeed + dayOfYear + hour) % 5) - 2

  return {
    ...base,
    temp: base.temp + tempOffset,
    feelsLike: base.temp + tempOffset - 1,
    humidity: 50 + ((citySeed + dayOfYear) % 40),
    windSpeed: 2 + ((citySeed + hour) % 8)
  }
}

/**
 * 真实天气（和风 QWeather / devapi）
 * 配置 WEATHER_API_KEY 后自动启用
 */
async function fetchQWeather(cityId) {
  const coords = CITY_COORDS[cityId] || CITY_COORDS.hengyang
  const apiKey = process.env.WEATHER_API_KEY
  // 优先用 QWEATHER_API_HOST（Render 配的 .re.qweatherapi.com 代理）
  // 降级用 devapi.qweather.com
  const host = process.env.QWEATHER_API_HOST
    ? (process.env.QWEATHER_API_HOST.startsWith('http') ? process.env.QWEATHER_API_HOST : `https://${process.env.QWEATHER_API_HOST}`)
    : 'https://devapi.qweather.com'
  // location 用 经度,纬度
  const loc = `${coords.lng.toFixed(2)},${coords.lat.toFixed(2)}`
  const url = `${host}/v7/weather/now?location=${loc}&key=${apiKey}`
  const { data } = await axios.get(url, {
    timeout: 5000,
    decompress: true,  // 处理 gzip 压缩
    headers: { 'Accept-Encoding': 'gzip,deflate' }
  })
  if (data.code !== '200') {
    throw new Error(`qweather error code=${data.code}: ${data.code === '401' ? 'API Key 无效' : data.code}`)
  }
  const now = data.now
  const isRainy = ['小雨', '中雨', '大雨', '暴雨', '雷阵雨'].some((x) => now.text?.includes(x))
  const isSnowy = ['雪'].some((x) => now.text?.includes(x))
  return {
    type: isRainy ? 'rainy' : isSnowy ? 'snow' : 'sunny',
    icon: `https://cdn.qweather.com/weather-icon/v1/svg/${now.icon}.svg`,
    label: now.text,
    temp: parseFloat(now.temp),
    feelsLike: parseFloat(now.feelsLike || now.temp),
    humidity: parseFloat(now.humidity || 50),
    windSpeed: parseFloat(now.windSpeed || 0),
    desc: `体感 ${now.feelsLike}°C · 湿度 ${now.humidity}% · ${now.windDir}风 ${now.windScale}级`,
    orderEffect: isRainy ? 1.2 : isSnowy ? 1.3 : 1.0,
    raw: now
  }
}

async function fetchWeather(cityId) {
  const apiKey = process.env.WEATHER_API_KEY
  if (apiKey) {
    try {
      const real = await fetchQWeather(cityId)
      return { ...real, source: 'qweather' }
    } catch (err) {
      console.warn('[Weather] qweather 调用失败，回落 mock:', err.message)
      return { ...mockWeather(cityId), source: 'mock-fallback', error: err.message }
    }
  }
  return { ...mockWeather(cityId), source: 'mock' }
}

/**
 * 测一下天气 API 是否能用（启动时或手动）
 */
export async function testWeatherAPI(cityId = 'hengyang') {
  const apiKey = process.env.WEATHER_API_KEY
  if (!apiKey) return { ok: false, message: 'WEATHER_API_KEY 未配置' }
  try {
    const r = await fetchQWeather(cityId)
    return { ok: true, source: 'qweather', data: { temp: r.temp, label: r.label, humidity: r.humidity } }
  } catch (err) {
    return { ok: false, source: 'qweather', message: err.message }
  }
}

/**
 * 组装完整的智能体上下文
 *
 * 支持模拟覆盖：options.override = { hour, weatherType, isWeekend, isHoliday }
 *  - 不传：使用真实当前时间 + 真实/mock 天气
 *  - 传：用于「时间机器」演示（前端可切不同时间看 AI 输出）
 */
export async function getAgentContext(cityId = 'hengyang', options = {}) {
  const { override } = options
  const now = override?.datetime ? new Date(override.datetime) : new Date()
  // 使用业务时区（北京时间）读取时间，不依赖服务器 UTC
  const beijingFmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long'
  })
  const parts = beijingFmt.formatToParts(now)
  const get = (t) => parts.find(p => p.type === t)?.value || ''
  const hour = parseInt(get('hour'), 10) % 24  // Intl 可能返回 24
  const day = parseInt(get('day'), 10)
  const month = parseInt(get('month'), 10)
  const year = parseInt(get('year'), 10)
  // weekday: '星期二' -> '二'
  const wdStr = get('weekday') || ''
  const weekday = wdStr.replace('星期', '')
  // 计算周末（用北京时间周几）
  const beijingDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const beijingDate = new Date(beijingDateStr + 'T12:00:00+08:00')
  const isWeekend = beijingDate.getDay() === 0 || beijingDate.getDay() === 6

  const city = cities.find((c) => c.id === cityId) || cities[0]
  const slot = getTimeSlot(hour)
  const holiday = getHolidayInfo(now)
  // 天气：可以模拟覆盖（用于演示不同天气下的 AI 输出）
  let weather
  if (override?.weatherType) {
    // 直接构造
    const conditions = {
      sunny: { type: 'sunny', icon: '☀️', label: '晴', temp: 28, desc: '晴朗无云，骑行舒适', orderEffect: 1.0, humidity: 50 },
      cloudy: { type: 'cloudy', icon: '⛅', label: '多云', temp: 24, desc: '云量较高，略有凉意', orderEffect: 1.05, humidity: 65 },
      rainy: { type: 'rainy', icon: '🌧', label: '小雨', temp: 20, desc: '小雨，外卖需求预计增加 20%', orderEffect: 1.2, humidity: 85 },
      storm: { type: 'storm', icon: '⛈', label: '暴雨', temp: 18, desc: '暴雨预警，配送可能延迟', orderEffect: 1.4, humidity: 95 },
      snow: { type: 'snow', icon: '❄️', label: '雪', temp: -2, desc: '雨雪天气，订单量明显上升', orderEffect: 1.3, humidity: 80 },
      fog: { type: 'fog', icon: '🌫', label: '雾', temp: 16, desc: '大雾天气，路况不明', orderEffect: 0.9, humidity: 90 }
    }
    weather = { ...conditions[override.weatherType], feelsLike: conditions[override.weatherType].temp - 1, windSpeed: 3, source: 'simulated' }
  } else {
    weather = await fetchWeather(cityId)
  }

  const factors = []
  if (isWeekend) factors.push('周末')
  if (holiday.isHoliday) factors.push(holiday.name + '假期')
  if (holiday.preheat) factors.push(holiday.preheat + '前' + holiday.preheatIn + '天')
  if (weather.type === 'rainy' || weather.type === 'storm') factors.push('雨天')
  if (weather.type === 'snow') factors.push('雪天')
  if (slot.name.includes('高峰')) factors.push(slot.name + '期')

  // 真实骑手数据（从 27,186 骑手统计）
  const riderStats = await getRiderStats().catch(() => null)
  const riderCtx = formatRiderContext(riderStats || {}, city.name)

  // 计算分钟（同样用北京时间）
  const minutePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    minute: '2-digit', hour12: false
  }).formatToParts(now).find(p => p.type === 'minute')?.value || '00'

  return {
    timestamp: now.getTime(),
    datetime: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 周${weekday} ${String(hour).padStart(2, '0')}:${minutePart}`,
    city: {
      id: city.id,
      name: city.name,
      province: city.province,
      dailyOrders: city.dailyOrders
    },
    weather: {
      type: weather.type,
      icon: weather.icon,
      label: weather.label,
      temp: weather.temp,
      feelsLike: weather.feelsLike,
      humidity: weather.humidity,
      desc: weather.desc,
      orderEffect: weather.orderEffect,
      source: weather.source
    },
    riders: riderCtx,
    timeSlot: {
      name: slot.name,
      icon: slot.icon,
      weight: slot.weight,
      isWeekend,
      holiday
    },
    factors,
    // 注入到 prompt 的实际内容（前端可展示让用户看）
    injectedPrompt: [
      '【系统设定】你是「配送小智」，本地生活服务电商配送运营决策智能体。',
      '【理念】主动预防式决策，而非被动响应。',
      '【能力】运力预判 / 调度与成本判断 / 派单 / 辅助推荐 / 主动预警 / 决策报告。',
      `【真实骑手】总 ${riderCtx.total} 人（活跃 ${riderCtx.active} 人）；本城 ${riderCtx.cityCount} 人；等级分布：${riderCtx.topLevels.join('、')}`
    ],
    contextSummary: [
      `当前时间：${year}年${month}月${day}日 周${weekday} ${hour}:${String(now.getMinutes()).padStart(2, '0')}`,
      `所在城市：${city.province}·${city.name}`,
      `天气：${weather.label} ${weather.temp}°C（${weather.desc}）`,
      `时段：${slot.name}（${slot.weight}需求）`,
      `骑手数据：总 ${riderCtx.total} 人，活跃 ${riderCtx.active} 人，本城 ${riderCtx.cityCount} 人`,
      `骑手等级：${riderCtx.topLevels.join('、')}`,
      holiday.isHoliday ? `节假日：${holiday.name}` : (isWeekend ? '今日是周末' : '今日是工作日'),
      holiday.preheat ? `即将到来：${holiday.preheat}（${holiday.preheatIn} 天后）` : '',
      weather.type === 'rainy' || weather.type === 'storm' ? '⚠️ 雨天外卖需求预计提升 20%' : '',
      weather.type === 'snow' ? '⚠️ 雪天配送延迟风险升高' : ''
    ].filter(Boolean).join('；')
  }
}
/**
 * 格式化真实骑手数据为决策上下文
 */
function formatRiderContext(riderStats, cityName) {
  if (!riderStats) {
    return {
      total: 0, active: 0, cityCount: 0, byCity: {}, byLevel: {}, byLifecycle: {},
      topLevels: ['N/A']
    }
  }
  // 找到当前城市骑手数
  const cityCount = riderStats.byCity?.[cityName] || 0
  // 等级 top 3
  const topLevels = Object.entries(riderStats.byLevel || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`)
  
  return {
    total: riderStats.total || 0,
    active: riderStats.active || 0,
    cityCount,
    byCity: riderStats.byCity || {},
    byLevel: riderStats.byLevel || {},
    byLifecycle: riderStats.byLifecycle || {},
    topLevels: topLevels.length ? topLevels : ['N/A']
  }
}

// 重写 getRiderStats 别名（避免重复定义）
