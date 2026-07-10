/**
 * AI 智能洞察数据（后端生成，模拟 Agent 实时分析）
 */

export const aiInsights = {
  // 顶部智能摘要
  summary: [
    {
      type: 'alert',
      icon: '🚨',
      tag: '运力预警',
      title: '蜂跑运力缺口 18 人',
      desc: '今晚 17:30 高峰将至，蜂跑运力较需求低 15%，建议紧急扩容',
      source: '运力分析 Agent',
      confidence: 92
    },
    {
      type: 'insight',
      icon: '💰',
      tag: '成本洞察',
      title: '蜂跑成本最优，比专送低 1.21 元/单',
      desc: '若将 35% 近单切换蜂跑，预计日节省 ¥1,420',
      source: '成本分析 Agent',
      confidence: 88
    },
    {
      type: 'predict',
      icon: '📈',
      tag: '预测',
      title: '今晚 18-20 点单量约 15,600 单',
      desc: '较昨日 +12.3%，建议提前 30 分钟开启高峰调度',
      source: '订单预测 Agent',
      confidence: 89
    },
    {
      type: 'growth',
      icon: '👥',
      tag: 'C 端机会',
      title: '团长激活率仅 9.8%',
      desc: '137 月活团长中 32 名金牌可深度合作，预期 GMV +30%',
      source: 'C 端增长 Agent',
      confidence: 85
    }
  ],

  // 数据智能解读（KPI 卡下面的小字）
  kpiInterpretations: {
    orders: '📊 订单预测 Agent：基于过去 30 天数据 + 时段特征 + 商户活动',
    riders: '🚴 运力分析 Agent：实时监控 5 种运力线调度情况',
    cost: '💰 成本分析 Agent：综合 5 种运力线 Pareto 计算',
    rate: '✅ 履约准时率 Agent：基于用户 T+15 准时数据'
  },

  // AI 异常预警
  alerts: [
    {
      level: 'high',
      title: '蜂跑运力缺口 18 人',
      time: '3 分钟前',
      action: '一键扩容',
      source: '运力分析 Agent'
    },
    {
      level: 'medium',
      title: '解放路商圈订单下降 3.1%',
      time: '12 分钟前',
      action: '查看原因',
      source: '订单预测 Agent'
    },
    {
      level: 'low',
      title: '团长激活率低于预期',
      time: '1 小时前',
      action: '运营建议',
      source: 'C 端增长 Agent'
    }
  ],

  // 图表解读
  chartInsights: {
    trend: '📈 AI 已结合工作日 + 节假日 + 天气综合预测',
    riderCost: '💡 蜂跑 ¥3.69 是最优解，建议近单优先派蜂跑',
    segment: '🎯 青铜+白银占比 47%，是激励计划主目标',
    stations: '📍 蒸湘万达站活跃人数最多，是标杆站点'
  }
}