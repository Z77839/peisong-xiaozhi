/**
 * 衡阳 C 端社群 + 团长数据（来自 PPT 第 15 页）
 */

export const cEndData = {
  // 社群
  community: {
    fans: 32000,           // 社群粉丝数
    mac: 640000,           // 城市 MAC
    fanRate: 5,            // 社群粉丝占 MAC 比例 %
    orderRate: 10,         // 社群下单率 %
    studentPercent: 75,    // 学生社群占比 %
    growth: 12.5           // 月增长率 %
  },
  // 二级团长
  group: {
    total: 1400,           // 总团长数
    active: 137,           // 月活跃团长
    dailyOrders: 4,        // 日均产单
    costPerOrder: 1.65,    // 单均成本
    activationRate: 9.8    // 激活率 %
  },
  // 团长等级
  groupLevels: [
    { level: '钻石团长', count: 18, color: '#fa541c' },
    { level: '金牌团长', count: 56, color: '#faad14' },
    { level: '银牌团长', count: 138, color: '#52c41a' },
    { level: '潜力团长', count: 320, color: '#1890ff' },
    { level: '新手团长', count: 868, color: '#8c8c8c' }
  ],
  // 社群下单趋势（近 30 天）
  communityTrend: Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    orders: 3200 + Math.floor(Math.sin(i / 3) * 600) + Math.floor(Math.random() * 400),
    members: 31500 + i * 50 + Math.floor(Math.random() * 80)
  }))
}
