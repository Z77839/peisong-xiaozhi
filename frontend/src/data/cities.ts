/**
 * 配送小智运营数据
 * 浙江配送小智网络科技有限公司
 * 饿了么城市代理商（4 个城市）
 */

export interface City {
  id: string
  name: string
  province: string
  dailyOrders: number
  dailyRevenue: number  // 万元
  monthlyRevenue: number  // 万元
  teamSize: number
  coverage: number  // 市场份额百分比
  deliveryRate: number  // 妥投率
  onTimeRate: number  // 准时率
  // 衡阳特有
  communityFans?: number
  groupMembers?: number
}

export const cities: City[] = [
  {
    id: 'hengyang',
    name: '衡阳',
    province: '湖南',
    dailyOrders: 100000,
    dailyRevenue: 330,  // 万元
    monthlyRevenue: 9900,
    teamSize: 80,
    coverage: 40,
    deliveryRate: 98.5,
    onTimeRate: 90.02,
    communityFans: 32000,
    groupMembers: 1400
  },
  {
    id: 'shaoxing',
    name: '绍兴',
    province: '浙江',
    dailyOrders: 65000,
    dailyRevenue: 250,
    monthlyRevenue: 7500,
    teamSize: 45,
    coverage: 38,
    deliveryRate: 98.8,
    onTimeRate: 92.1,
    communityFans: 28000,
    groupMembers: 1100
  },
  {
    id: 'changde',
    name: '常德',
    province: '湖南',
    dailyOrders: 65000,
    dailyRevenue: 220,
    monthlyRevenue: 6600,
    teamSize: 50,
    coverage: 35,
    deliveryRate: 98.6,
    onTimeRate: 91.4,
    communityFans: 24000,
    groupMembers: 980
  },
  {
    id: 'quzhou',
    name: '衢州',
    province: '浙江',
    dailyOrders: 20000,
    dailyRevenue: 75,
    monthlyRevenue: 2250,
    teamSize: 35,
    coverage: 32,
    deliveryRate: 98.2,
    onTimeRate: 89.8,
    communityFans: 12000,
    groupMembers: 520
  }
]

export const cityMap: Record<string, City> = cities.reduce((m, c) => {
  m[c.id] = c
  return m
}, {} as Record<string, City>)

export const totalMetrics = {
  yearlyOrders: '9000万+',
  gmv: '30亿+',
  cities: 4,
  team: '200+'
}
