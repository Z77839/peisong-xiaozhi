/**
 * 衡阳运力线数据
 * 基于真实业务：专送 / 优选 / 优远 / 普通众包 / 蜂跑 / 优家
 */

export interface RiderType {
  id: string
  name: string
  fullName: string
  cost: number  // 单均成本
  range: string  // 配送范围
  coverage: number  // 占比 %
  strengths: string[]
  weaknesses: string[]
  scenario: string
  color: string
}

// 衡阳各运力线真实数据（来自 PPT 第 14 页）
export const riderTypes: RiderType[] = [
  {
    id: 'zhuanSong',
    name: '专送',
    fullName: '自营专送',
    cost: 4.90,
    range: '3 公里内',
    coverage: 35,
    strengths: ['管控强', '时效稳', '与公司签约'],
    weaknesses: ['成本较高', '高峰运力有限'],
    scenario: '高频场景的主力运力',
    color: '#1f6feb'
  },
  {
    id: 'youXuan',
    name: '优选',
    fullName: '优选众包',
    cost: 5.04,
    range: '3 公里内',
    coverage: 22,
    strengths: ['兼职稳定', '有出勤要求', '薪资高于众包'],
    weaknesses: ['成本最高档', '管控中等'],
    scenario: '高峰补充运力',
    color: '#00b578'
  },
  {
    id: 'youYuan',
    name: '优远',
    fullName: '优选远单',
    cost: 7.17,
    range: '3 公里外',
    coverage: 8,
    strengths: ['承接远单', '缓解远距离压力'],
    weaknesses: ['单价最高', '成本压力'],
    scenario: '远距离订单专用',
    color: '#ff9500'
  },
  {
    id: 'zhongBao',
    name: '普通众包',
    fullName: '普通众包',
    cost: 4.36,
    range: '全城',
    coverage: 25,
    strengths: ['运力充足', '日结灵活', '成本合理'],
    weaknesses: ['无管控', '高峰可控性弱'],
    scenario: '兜底远单运力',
    color: '#9b59ff'
  },
  {
    id: 'fengPao',
    name: '蜂跑',
    fullName: '蜂跑运力',
    cost: 3.69,
    range: '3 公里内',
    coverage: 10,
    strengths: ['单价最低', '人效最高', '近单高效'],
    weaknesses: ['骑手管控中等', '覆盖范围小'],
    scenario: '近单成本最优解',
    color: '#52c41a'
  }
]

export const riderTypeMap: Record<string, RiderType> = riderTypes.reduce((m, r) => {
  m[r.id] = r
  return m
}, {} as Record<string, RiderType>)

// 衡阳基准对比（用于雷达图）
export const hengYangBaseline = {
  deliveryRate: 98.5,
  onTimeRate: 90.02,
  complaintRate: 1.5,
  riderCost: 4.69,  // 综合平均成本
  riderActiveRate: 85,
  riderStableRate: 62
}
