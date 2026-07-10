/**
 * 衡阳骑手聚合数据（来自骑手明细表抽样）
 */

export const segments = [
  { name: '霸气王者', count: 8, color: '#fa541c', desc: '段位顶配' },
  { name: '傲世星辰', count: 24, color: '#fa8c16', desc: '高接单+高分' },
  { name: '常胜辉耀', count: 48, color: '#faad14', desc: '高优选' },
  { name: '坚韧钻石', count: 132, color: '#fadb14', desc: '稳定' },
  { name: '热烈黄金', count: 156, color: '#a0d911', desc: '中坚' },
  { name: '朝气白银', count: 286, color: '#1890ff', desc: '潜力' },
  { name: '奋进铂金', count: 320, color: '#722ed1', desc: '新手转型' },
  { name: '淡定青铜', count: 662, color: '#8c8c8c', desc: '基础段位' }
]

export const lifecycles = [
  { name: '活跃期', count: 420, percentage: 41, color: '#00b578' },
  { name: '新手期', count: 320, percentage: 31, color: '#1890ff' },
  { name: '流失期', count: 295, percentage: 29, color: '#8c8c8c' },
  { name: '注册未首跑', count: 159, percentage: 15, color: '#d9d9d9' }
]

export const topStations = [
  { name: '蒸湘万达站', riders: 102, type: '专送', manager: '王志强' },
  { name: '蒸湘南华红湘站', riders: 66, type: '聚合送', manager: '李明' },
  { name: '华新开发区站', riders: 48, type: '专送', manager: '张伟' },
  { name: '解放路站', riders: 42, type: '优选', manager: '王浩' },
  { name: '高新区站', riders: 38, type: '优选', manager: '陈杰' },
  { name: '石鼓区站', riders: 32, type: '专送', manager: '赵林' }
]

export const hourlyOrders = [
  { hour: '00:00', orders: 180 },
  { hour: '01:00', orders: 90 },
  { hour: '02:00', orders: 60 },
  { hour: '03:00', orders: 50 },
  { hour: '04:00', orders: 70 },
  { hour: '05:00', orders: 120 },
  { hour: '06:00', orders: 380 },
  { hour: '07:00', orders: 1200 },
  { hour: '08:00', orders: 3200 },
  { hour: '09:00', orders: 4100 },
  { hour: '10:00', orders: 4800 },
  { hour: '11:00', orders: 8200 },
  { hour: '12:00', orders: 12400 },
  { hour: '13:00', orders: 10800 },
  { hour: '14:00', orders: 7200 },
  { hour: '15:00', orders: 5400 },
  { hour: '16:00', orders: 5800 },
  { hour: '17:00', orders: 11200 },
  { hour: '18:00', orders: 15600 },
  { hour: '19:00', orders: 14200 },
  { hour: '20:00', orders: 9800 },
  { hour: '21:00', orders: 5400 },
  { hour: '22:00', orders: 2400 },
  { hour: '23:00', orders: 920 }
]

export const districts = [
  { name: '蒸湘万达商圈', merchants: 326, orders: 12847, coverage: 92, trend: 'up', growth: 12.3 },
  { name: '晶珠广场', merchants: 218, orders: 8956, coverage: 88, trend: 'up', growth: 18.5 },
  { name: '华新开发区', merchants: 198, orders: 7234, coverage: 85, trend: 'up', growth: 9.2 },
  { name: '解放路步行街', merchants: 256, orders: 6821, coverage: 82, trend: 'down', growth: -3.1 },
  { name: '衡阳万达广场', merchants: 412, orders: 14108, coverage: 95, trend: 'up', growth: 15.2 },
  { name: '太阳广场', merchants: 168, orders: 5432, coverage: 78, trend: 'up', growth: 6.7 }
]
