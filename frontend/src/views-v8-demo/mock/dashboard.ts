export type RiskLevel = 'low' | 'medium' | 'high';

export interface RegionData {
  region_id: string;
  region_name: string;
  level: 'district' | 'grid';
  parent_id?: string | null;
  orders: number;
  riders_online: number;
  riders_idle: number;
  riders_busy: number;
  order_rider_ratio: number;
  capacity_gap: number;
  risk_level: RiskLevel;
  avg_delivery_time?: number;
  on_time_rate?: number;
}

export interface TimeSeriesData {
  time: string;
  region_id: string;
  region_name: string;
  orders: number;
  riders_online: number;
  capacity_gap: number;
  risk_level: RiskLevel;
}

export interface DashboardData {
  kpis: {
    total_orders: number;
    online_riders: number;
    capacity_gap: number;
    risk_regions: number;
  };
  regions: RegionData[];
  time_series: TimeSeriesData[];
}

export interface KpiItem {
  label: string;
  value: string;
  trend: string;
  tone: 'blue' | 'green' | 'orange' | 'red';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  sections?: {
    understanding: string;
    tools: string[];
    judgement: string[];
    suggestions: string[];
  };
}

export interface ChatSession {
  id: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

export const mockDashboardData: DashboardData = {
  kpis: {
    total_orders: 12684,
    online_riders: 3248,
    capacity_gap: 428,
    risk_regions: 6,
  },
  regions: [
    {
      region_id: 'district-pudong',
      region_name: '浦东新区',
      level: 'district',
      parent_id: null,
      orders: 3820,
      riders_online: 820,
      riders_idle: 168,
      riders_busy: 652,
      order_rider_ratio: 4.8,
      capacity_gap: 176,
      risk_level: 'high',
      avg_delivery_time: 38,
      on_time_rate: 89.4,
    },
    {
      region_id: 'district-xuhui',
      region_name: '徐汇区',
      level: 'district',
      parent_id: null,
      orders: 2460,
      riders_online: 512,
      riders_idle: 94,
      riders_busy: 418,
      order_rider_ratio: 4.2,
      capacity_gap: 94,
      risk_level: 'high',
      avg_delivery_time: 34,
      on_time_rate: 91.2,
    },
    {
      region_id: 'district-huangpu',
      region_name: '黄浦区',
      level: 'district',
      parent_id: null,
      orders: 2310,
      riders_online: 486,
      riders_idle: 76,
      riders_busy: 410,
      order_rider_ratio: 4.0,
      capacity_gap: 82,
      risk_level: 'high',
      avg_delivery_time: 35,
      on_time_rate: 90.8,
    },
    {
      region_id: 'district-jingan',
      region_name: '静安区',
      level: 'district',
      parent_id: null,
      orders: 1680,
      riders_online: 438,
      riders_idle: 118,
      riders_busy: 320,
      order_rider_ratio: 3.0,
      capacity_gap: 34,
      risk_level: 'medium',
      avg_delivery_time: 30,
      on_time_rate: 94.1,
    },
    {
      region_id: 'district-yangpu',
      region_name: '杨浦区',
      level: 'district',
      parent_id: null,
      orders: 1980,
      riders_online: 431,
      riders_idle: 102,
      riders_busy: 329,
      order_rider_ratio: 3.5,
      capacity_gap: 48,
      risk_level: 'medium',
      avg_delivery_time: 32,
      on_time_rate: 93.3,
    },
    {
      region_id: 'district-minhang',
      region_name: '闵行区',
      level: 'district',
      parent_id: null,
      orders: 1860,
      riders_online: 398,
      riders_idle: 118,
      riders_busy: 280,
      order_rider_ratio: 3.1,
      capacity_gap: 51,
      risk_level: 'medium',
      avg_delivery_time: 33,
      on_time_rate: 92.6,
    },
    {
      region_id: 'district-changning',
      region_name: '长宁区',
      level: 'district',
      parent_id: null,
      orders: 1260,
      riders_online: 286,
      riders_idle: 82,
      riders_busy: 204,
      order_rider_ratio: 2.8,
      capacity_gap: 18,
      risk_level: 'low',
      avg_delivery_time: 28,
      on_time_rate: 95.7,
    },
    {
      region_id: 'grid-zhangjiang',
      region_name: '张江片区',
      level: 'grid',
      parent_id: 'district-pudong',
      orders: 1180,
      riders_online: 236,
      riders_idle: 36,
      riders_busy: 200,
      order_rider_ratio: 5.0,
      capacity_gap: 68,
      risk_level: 'high',
      avg_delivery_time: 39,
      on_time_rate: 88.9,
    },
    {
      region_id: 'grid-lujiazui',
      region_name: '陆家嘴片区',
      level: 'grid',
      parent_id: 'district-pudong',
      orders: 1040,
      riders_online: 226,
      riders_idle: 42,
      riders_busy: 184,
      order_rider_ratio: 4.6,
      capacity_gap: 52,
      risk_level: 'high',
      avg_delivery_time: 37,
      on_time_rate: 90.1,
    },
    {
      region_id: 'grid-jinqiao',
      region_name: '金桥片区',
      level: 'grid',
      parent_id: 'district-pudong',
      orders: 760,
      riders_online: 176,
      riders_idle: 44,
      riders_busy: 132,
      order_rider_ratio: 4.3,
      capacity_gap: 32,
      risk_level: 'medium',
      avg_delivery_time: 34,
      on_time_rate: 92.4,
    },
    {
      region_id: 'grid-xujiahui',
      region_name: '徐家汇片区',
      level: 'grid',
      parent_id: 'district-xuhui',
      orders: 920,
      riders_online: 196,
      riders_idle: 30,
      riders_busy: 166,
      order_rider_ratio: 4.7,
      capacity_gap: 44,
      risk_level: 'high',
      avg_delivery_time: 36,
      on_time_rate: 89.8,
    },
    {
      region_id: 'grid-caohejing',
      region_name: '漕河泾片区',
      level: 'grid',
      parent_id: 'district-xuhui',
      orders: 650,
      riders_online: 154,
      riders_idle: 34,
      riders_busy: 120,
      order_rider_ratio: 4.2,
      capacity_gap: 26,
      risk_level: 'medium',
      avg_delivery_time: 33,
      on_time_rate: 92.1,
    },
    {
      region_id: 'grid-nanjing-east',
      region_name: '南京东路片区',
      level: 'grid',
      parent_id: 'district-huangpu',
      orders: 860,
      riders_online: 184,
      riders_idle: 24,
      riders_busy: 160,
      order_rider_ratio: 4.7,
      capacity_gap: 40,
      risk_level: 'high',
      avg_delivery_time: 36,
      on_time_rate: 90.2,
    },
    {
      region_id: 'grid-xintiandi',
      region_name: '新天地区域',
      level: 'grid',
      parent_id: 'district-huangpu',
      orders: 620,
      riders_online: 148,
      riders_idle: 28,
      riders_busy: 120,
      order_rider_ratio: 4.2,
      capacity_gap: 25,
      risk_level: 'medium',
      avg_delivery_time: 34,
      on_time_rate: 91.6,
    },
  ],
  time_series: [],
};

const timeFactors = [
  { time: '16:00', factor: 0.72 },
  { time: '17:00', factor: 0.92 },
  { time: '18:00', factor: 1 },
  { time: '19:00', factor: 0.84 },
];

mockDashboardData.time_series = mockDashboardData.regions.flatMap((region) =>
  timeFactors.map(({ time, factor }) => ({
    time,
    region_id: region.region_id,
    region_name: region.region_name,
    orders: Math.round(region.orders * factor * (region.level === 'grid' ? 0.36 : 0.3)),
    riders_online: Math.max(1, Math.round(region.riders_online * (0.92 + factor * 0.08))),
    capacity_gap: Math.max(0, Math.round(region.capacity_gap * factor)),
    risk_level: factor > 0.9 ? region.risk_level : region.risk_level === 'high' ? 'medium' : region.risk_level,
  })),
);

export const quickQuestions = [
  '未来2小时哪些区域可能缺骑手？',
  '当前是否需要发放骑手补贴？',
  '请给出雨天高峰调度建议',
];

export const historySessions: ChatSession[] = [
  {
    id: 'peak-risk',
    title: '晚高峰缺口研判',
    time: '18:20',
    messages: [
      { id: 'h1-u', role: 'user', content: '未来2小时哪些区域可能缺骑手？' },
      {
        id: 'h1-a',
        role: 'assistant',
        sections: {
          understanding: '需要识别未来2小时订单增长快、空闲骑手不足且天气影响明显的区域。',
          tools: ['订单数据接口', '骑手分布接口', '天气风险模型'],
          judgement: ['浦东新区、徐汇区、黄浦区缺口最明显。', '18:00-19:00 是缺口峰值窗口。', '杨浦区需要观察高校商圈订单上扬。'],
          suggestions: ['向浦东核心商圈预调 120 名骑手。', '徐汇区开启 30 分钟阶梯补贴。', '黄浦区限制跨区远单占比，优先保障近距离履约。'],
        },
      },
    ],
  },
  {
    id: 'subsidy-plan',
    title: '骑手补贴方案测算',
    time: '17:45',
    messages: [
      { id: 'h2-u', role: 'user', content: '当前是否需要发放骑手补贴？' },
      {
        id: 'h2-a',
        role: 'assistant',
        sections: {
          understanding: '判断补贴是否能以可控成本改善准时率，并给出推荐强度。',
          tools: ['成本测算引擎', '履约预测模型', 'Coze知识库'],
          judgement: ['当前建议启用平衡方案。', '高风险区域集中，补贴不宜全城铺开。', '预计准时率可从 91.4% 提升到 94.8%。'],
          suggestions: ['浦东、徐汇、黄浦按 3 档单量阶梯补贴。', '补贴窗口设置为 17:50-19:20。', '每 15 分钟复核一次投入产出比。'],
        },
      },
    ],
  },
];

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function createKpis(data: DashboardData): KpiItem[] {
  return [
    { label: '当前订单数', value: formatNumber(data.kpis.total_orders), trend: '+18.6% 较昨日', tone: 'blue' },
    { label: '在线骑手数', value: formatNumber(data.kpis.online_riders), trend: '可调度 71%', tone: 'green' },
    { label: '预计运力缺口', value: formatNumber(data.kpis.capacity_gap), trend: '2小时峰值', tone: 'orange' },
    { label: '异常区域数', value: formatNumber(data.kpis.risk_regions), trend: '高风险 3 个', tone: 'red' },
  ];
}

export const kpis = createKpis(mockDashboardData);
export const districts = mockDashboardData.regions
  .filter((item) => item.level === 'district')
  .map((item) => item.region_name);

export const orderRank = mockDashboardData.regions
  .filter((item) => item.level === 'district')
  .sort((a, b) => b.orders - a.orders)
  .slice(0, 5)
  .map((item) => ({
    region_id: item.region_id,
    district: item.region_name,
    orders: item.orders,
    ratio: `1:${item.order_rider_ratio.toFixed(1)}`,
    risk: item.risk_level === 'high' ? '高' : item.risk_level === 'medium' ? '中' : '低',
  }));

export const riderDistribution = mockDashboardData.regions
  .filter((item) => item.level === 'district')
  .slice(0, 5)
  .map((item) => ({
    region_id: item.region_id,
    district: item.region_name,
    online: item.riders_online,
    idle: item.riders_idle,
    delivering: item.riders_busy,
  }));

export const gapForecast = [
  { hour: '未来1小时', gap: 186, level: '中风险' },
  { hour: '未来2小时', gap: 428, level: '高风险' },
  { hour: '未来3小时', gap: 312, level: '中高风险' },
];

export const costPlans = [
  { name: '保守方案', subsidy: '¥18,000', onTime: '91.4%', note: '仅覆盖高风险商圈' },
  { name: '平衡方案', subsidy: '¥32,000', onTime: '94.8%', note: '推荐：覆盖核心缺口区域' },
  { name: '激进方案', subsidy: '¥51,000', onTime: '96.2%', note: '全域补贴，成本压力较高' },
];

export const ratioRank = mockDashboardData.regions
  .filter((item) => item.level === 'district')
  .sort((a, b) => b.order_rider_ratio - a.order_rider_ratio)
  .slice(0, 5)
  .map((item) => ({
    region_id: item.region_id,
    district: item.region_name,
    value: item.order_rider_ratio,
  }));

export const abnormalAlerts = mockDashboardData.regions
  .filter((item) => item.level === 'district' && item.risk_level !== 'low')
  .map((item) => ({
    region_id: item.region_id,
    district: item.region_name,
    reason: item.risk_level === 'high' ? '订单密度升高，空闲骑手不足' : '订单/骑手比接近预警线',
    score: item.risk_level === 'high' ? 88 + Math.round(item.capacity_gap / 20) : 72 + Math.round(item.capacity_gap / 10),
  }));

export const chartBubbles = mockDashboardData.time_series;

export function createMockReply(question: string): ChatMessage {
  const isRain = question.includes('雨');
  const isSubsidy = question.includes('补贴') || question.includes('成本');

  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    sections: {
      understanding: isRain
        ? '你希望在雨天晚高峰场景下，获得可执行的骑手调度与异常应对方案。'
        : isSubsidy
          ? '你希望判断当前是否需要投入补贴，并在成本与履约稳定之间找到平衡点。'
          : '你希望识别未来短时段内订单与骑手供给错配的区域，并提前调整运力。',
      tools: isSubsidy
        ? ['成本测算引擎', '骑手分布接口', 'Coze知识库']
        : ['订单数据接口', '骑手分布接口', '运力预测模型', 'Coze知识库'],
      judgement: isRain
        ? ['浦东新区与黄浦区雨天订单弹性最高。', '18:00 后跨区订单会拉长平均配送时长。', '空闲骑手低于 20% 的区域需要优先干预。']
        : isSubsidy
          ? ['建议启用平衡方案，预计补贴 ¥32,000。', '投入后准时率预计提升至 94.8%。', '激进方案收益边际下降，不建议默认使用。']
          : ['浦东新区、徐汇区、黄浦区未来2小时缺口最高。', '当前全城预计缺口约 428 名骑手。', '风险主要集中在商圈和写字楼订单叠加区域。'],
      suggestions: isRain
        ? ['提前把空闲骑手向浦东、黄浦核心商圈聚合。', '对雨强上升区域启用 20-40 分钟短补贴。', '暂停低优先级跨区远单，保障近场订单履约。']
        : isSubsidy
          ? ['采用平衡方案：覆盖浦东、徐汇、黄浦三个高风险区域。', '设置单均补贴上限，避免低风险区域成本外溢。', '用准时率和接单响应时长作为滚动退出条件。']
          : ['向浦东新区预调 120 名骑手，徐汇区预调 70 名。', '黄浦区开启短时高峰补贴并压缩远单派发。', '每 15 分钟刷新缺口预测并更新调度名单。'],
    },
  };
}

export function mockChatReply(message: string) {
  return createMockReply(message);
}
