/**
 * 衡阳 C 端社群 + 团长数据
 */

export const community = {
  fans: 32000,
  mac: 640000,
  fanRate: 5,
  orderRate: 10,
  studentPercent: 75,
  growth: 12.5
}

export const group = {
  total: 1400,
  active: 137,
  dailyOrders: 4,
  costPerOrder: 1.65,
  activationRate: 9.8
}

export const groupLevels = [
  { level: '钻石团长', count: 18, color: '#fa541c' },
  { level: '金牌团长', count: 56, color: '#faad14' },
  { level: '银牌团长', count: 138, color: '#52c41a' },
  { level: '潜力团长', count: 320, color: '#1890ff' },
  { level: '新手团长', count: 868, color: '#8c8c8c' }
]

export const communityTrend = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  orders: 3200 + Math.floor(Math.sin(i / 3) * 600) + Math.floor(Math.random() * 400),
  members: 31500 + i * 50 + Math.floor(Math.random() * 80)
}))
