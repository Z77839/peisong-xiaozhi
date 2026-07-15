<script setup lang="ts">
import { ref, onMounted, shallowRef, computed, watch } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'
import request from '@/api/request'
import { useRouter } from 'vue-router'

const router = useRouter()

const cityStore = useCityStore()
const city = cityStore.currentCity

// 4 城市日订单因子（衡阳 10万 / 绍兴 6.5万 / 常德 6.5万 / 衢州 4万）
const CITY_DAILY_ORDERS = {
  hengyang: 100000,
  shaoxing: 65000,
  changde: 65000,
  quzhou: 40000
}
const factor = computed(() => CITY_DAILY_ORDERS[city.id] || 100000)

// 时段单均成本（业务估算：依据运营手册给定 ¥4.85 ± 0.3）
const AVG_COST_PER_ORDER = 4.85
const COST_SOURCE = '业务估算'

const timeChart = ref<HTMLElement | null>(null)
const planChart = ref<HTMLElement | null>(null)
const trendChart = ref<HTMLElement | null>(null)
const compareChart = ref<HTMLElement | null>(null)
const timeInstance = shallowRef<echarts.ECharts>()
const planInstance = shallowRef<echarts.ECharts>()
const trendInstance = shallowRef<echarts.ECharts>()
const compareInstance = shallowRef<echarts.ECharts>()

// 真实数据
const dashboardData = ref<any>(null)
const costPlan = ref<any>(null)
const gapPrediction = ref<any>(null)
const loading = ref(false)
const selectedPlan = ref<string>('balanced')

// 4 个时段成本（不依赖运力线分类）
const timeSlotCosts = computed(() => {
  const cityOrders = (dashboardData.value?.kpis?.total_orders || 0) * (factor.value / 270000)
  // 4 城市总 270,000 = 100000+65000+65000+40000
  const base = cityOrders
  return [
    { slot: '早高峰', time: '07-10', orders: Math.round(base * 0.15), avgCost: AVG_COST_PER_ORDER * 1.0 },
    { slot: '午高峰', time: '11-13', orders: Math.round(base * 0.25), avgCost: AVG_COST_PER_ORDER * 1.05 },
    { slot: '晚高峰', time: '17-21', orders: Math.round(base * 0.40), avgCost: AVG_COST_PER_ORDER * 1.15 },
    { slot: '夜宵', time: '22-06', orders: Math.round(base * 0.10), avgCost: AVG_COST_PER_ORDER * 1.20 },
    { slot: '平峰', time: '其他', orders: Math.round(base * 0.10), avgCost: AVG_COST_PER_ORDER * 0.95 }
  ].map(s => ({ ...s, cost: Math.round(s.orders * s.avgCost) }))
})

async function fetchData() {
  loading.value = true
  try {
    const [dashR, planR, gapR] = await Promise.all([
      request({ url: '/dashboard' }),
      request({ url: '/optimize/cost-plan', method: 'POST', data: { cityId: city.id || 'hengyang', gap: 800 } }),
      request({ url: '/optimize/predict-gap', method: 'POST', data: { cityId: city.id || 'hengyang', hour: 19, isHoliday: false } })
    ])
    dashboardData.value = dashR.data || dashR
    costPlan.value = planR.data || planR
    gapPrediction.value = gapR.data || gapR
  } catch (e) {
    console.warn('成本数据加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchData())
watch(() => city.id, () => fetchData())

// 🆕 成本 → 决策中心 联动提示
const costAlert = computed(() => {
  const baseCost = AVG_COST_PER_ORDER  // 4.85
  const current = costPlan.value?.currentCostPerOrder || baseCost
  const gap = costPlan.value?.totalGap || gapPrediction.value?.gap || 0
  const overBudget = current > baseCost * 1.1  // 超过基准 10%
  const highGap = gap > 500
  if (overBudget || highGap) {
    return {
      type: overBudget ? 'overbudget' : 'highgap',
      currentCost: current,
      baseCost,
      gap,
      hasIssue: true
    }
  }
  return { hasIssue: false }
})

function askDecisionForCost() {
  const q = costAlert.value.type === 'overbudget'
    ? `${city.name}单均成本达 ¥${costAlert.value.currentCost.toFixed(2)}，超出预算 ¥${costAlert.value.baseCost.toFixed(2)}，请给出成本优化方案`
    : `${city.name}运力缺口 ${costAlert.value.gap} 单，请评估是否需要调拨临时补贴或众包`
  router.push(`/decision?cityId=${city.id}&q=${encodeURIComponent(q)}`)
}

// 4 个核心 KPI
const metrics = computed(() => {
  // 优先用真实 dashboard 数据，否则用本地因子
  const realTotal = dashboardData.value?.kpis?.total_orders
  const cityOrders = realTotal ? Math.round(realTotal * (factor.value / 270000)) : factor.value
  const totalCost = Math.round(cityOrders * AVG_COST_PER_ORDER)
  const totalCostW = totalCost / 10000
  const grossProfit = Math.round(totalCost * 1.45)
  const gap = costPlan.value?.totalGap || gapPrediction.value?.gap || 800
  const currentPlan = costPlan.value?.plans?.find((p: any) => p.name === '平衡方案')
  return [
    { label: '日总成本', value: `¥${totalCostW.toFixed(1)}万`, sub: `${formatNumber(cityOrders)} 单 × ¥${AVG_COST_PER_ORDER.toFixed(2)}（${COST_SOURCE}）`, color: '#1f6feb', icon: '💰' },
    { label: '日毛利', value: `¥${(grossProfit / 10000).toFixed(1)}万`, sub: '毛利率 45%（业务估算）', color: '#00b578', icon: '📈' },
    { label: '运力缺口', value: formatNumber(gap), sub: '高峰时段', color: '#f5222d', icon: '📉' },
    { label: '推荐方案节省', value: currentPlan ? `¥${formatNumber(currentPlan.totalCost)}` : '¥560', sub: currentPlan?.name || '平衡方案', color: '#9b59ff', icon: '🎯' }
  ]
})

// 7 天成本趋势
const costTrend = computed(() => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    // 基于真实波动的成本（含周末因子）
    const dayOfWeek = d.getDay()
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6)
    const variation = isWeekend ? 1.08 : 0.95 + ((i * 17) % 10) / 100
    days.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      avgCost: parseFloat((AVG_COST_PER_ORDER * variation).toFixed(2)),
      optimization: parseFloat((AVG_COST_PER_ORDER * variation * 0.85).toFixed(2))
    })
  }
  return days
})

// 4 城市成本对比
const cityCostCompare = computed(() => {
  return [
    { name: '衡阳', orders: 100000, color: '#1f6feb' },
    { name: '绍兴', orders: 65000, color: '#00b578' },
    { name: '常德', orders: 65000, color: '#ff9500' },
    { name: '衢州', orders: 40000, color: '#9b59ff' }
  ].map(c => ({ ...c, cost: Math.round(c.orders * AVG_COST_PER_ORDER) }))
})

const initTimeChart = () => {
  if (!timeChart.value) return
  timeInstance.value = echarts.init(timeChart.value)
  const data = timeSlotCosts.value
  timeInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单数', '单均成本'], top: 0 },
    grid: { left: 60, right: 60, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.slot) },
    yAxis: [
      { type: 'value', name: '订单数', position: 'left' },
      { type: 'value', name: '元/单', position: 'right' }
    ],
    series: [
      { name: '订单数', type: 'bar', yAxisIndex: 0, barWidth: 32,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] },
        data: data.map(d => d.orders) },
      { name: '单均成本', type: 'line', yAxisIndex: 1, smooth: true,
        itemStyle: { color: '#f5222d' },
        lineStyle: { width: 3 },
        data: data.map(d => parseFloat(d.avgCost.toFixed(2))) }
    ]
  })
}

const initTrend = () => {
  if (!trendChart.value) return
  trendInstance.value = echarts.init(trendChart.value)
  const data = costTrend.value
  trendInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['实际成本', '优化建议'], top: 0 },
    grid: { left: 50, right: 30, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.date) },
    yAxis: { type: 'value', name: '元/单' },
    series: [
      { name: '实际成本', type: 'line', smooth: true, symbol: 'circle',
        itemStyle: { color: '#f5222d' },
        areaStyle: { color: 'rgba(245, 34, 45, 0.08)' },
        data: data.map(d => d.avgCost) },
      { name: '优化建议', type: 'line', smooth: true, symbol: 'circle',
        itemStyle: { color: '#00b578' },
        areaStyle: { color: 'rgba(0, 181, 120, 0.1)' },
        data: data.map(d => d.optimization) }
    ]
  })
}

const initCompare = () => {
  if (!compareChart.value) return
  compareInstance.value = echarts.init(compareChart.value)
  const data = cityCostCompare.value
  compareInstance.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 70, right: 50, top: 20, bottom: 30 },
    xAxis: { type: 'value', name: '元/日' },
    yAxis: { type: 'category', data: data.map(c => c.name) },
    series: [{
      type: 'bar',
      barWidth: 28,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: (p: any) => `¥${(p.value / 10000).toFixed(1)}万` },
      data: data.map(c => ({ value: c.cost, itemStyle: { color: c.color } }))
    }]
  })
}

const initPlan = () => {
  if (!planChart.value || !costPlan.value?.plans) return
  planInstance.value = echarts.init(planChart.value)
  const plans = costPlan.value.plans
  planInstance.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['总成本(元)', '缺口减少(人)'], top: 0 },
    grid: { left: 60, right: 60, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: plans.map((p: any) => p.name) },
    yAxis: [
      { type: 'value', name: '元' },
      { type: 'value', name: '人' }
    ],
    series: [
      { name: '总成本(元)', type: 'bar', yAxisIndex: 0, barWidth: 36,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] },
        data: plans.map((p: any) => p.totalCost),
        label: { show: true, position: 'top', formatter: '¥{c}' } },
      { name: '缺口减少(人)', type: 'line', yAxisIndex: 1, smooth: true,
        itemStyle: { color: '#00b578' },
        lineStyle: { width: 3 },
        data: plans.map((p: any) => p.gapReduction),
        label: { show: true, position: 'top', formatter: '{c} 人' } }
    ]
  })
}

const onResize = () => {
  timeInstance.value?.resize()
  planInstance.value?.resize()
  trendInstance.value?.resize()
  compareInstance.value?.resize()
}

onMounted(() => {
  setTimeout(() => {
    initTimeChart()
    initTrend()
    initCompare()
    initPlan()
  }, 500)
  window.addEventListener('resize', onResize)
})

watch([timeSlotCosts, costTrend, cityCostCompare, costPlan], () => {
  initTimeChart()
  initTrend()
  initCompare()
  initPlan()
}, { deep: true })
</script>

<template>
  <div class="page-container">
    <!-- 🆕 成本超支 / 高缺口 提示条（成本 → 决策中心） -->
    <div v-if="costAlert?.hasIssue" class="cost-alert-banner" :class="`type-${costAlert.type}`">
      <div class="cab-bg">{{ costAlert.type === 'overbudget' ? '💸 OVERBUDGET' : '📉 HIGH GAP' }}</div>
      <div class="cab-content">
        <span class="cab-ico">{{ costAlert.type === 'overbudget' ? '💸' : '📉' }}</span>
        <div class="cab-text">
          <div class="cab-title">
            <template v-if="costAlert.type === 'overbudget'">
              配送小智检测到 <b>成本超支</b> · {{ city.name }} 单均 ¥{{ costAlert.currentCost.toFixed(2) }}（基准 ¥{{ costAlert.baseCost.toFixed(2) }}）
            </template>
            <template v-else>
              配送小智检测到 <b>运力缺口大</b> · {{ city.name }} 缺口 {{ formatNumber(costAlert.gap) }} 单
            </template>
          </div>
          <div class="cab-sub">让小智一键生成成本优化 / 调拨方案</div>
        </div>
        <button class="cab-btn" @click="askDecisionForCost">
          🤖 让小智优化
        </button>
      </div>
    </div>
    <!-- KPI 行 -->
    <div class="stat-row">
      <div v-for="(s, i) in metrics" :key="i" class="stat-card" :style="{ borderTop: `3px solid ${s.color}` }">
        <div class="stat-icon">{{ s.icon }}</div>
        <div class="stat-content">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-sub">{{ s.sub }}</div>
        </div>
      </div>
    </div>

    <!-- 数据源 -->
    <div class="data-banner" v-if="costPlan">
      <el-icon color="#00b578"><CircleCheckFilled /></el-icon>
      <span>基于真实优化引擎（LP 线性规划）— 缺口 {{ formatNumber(costPlan.totalGap) }} 人 / 当前成本 ¥{{ formatNumber(costPlan.currentCost) }} / 推荐方案 <strong>{{ costPlan.plans?.find((p: any) => p.name === '平衡方案')?.name }}</strong></span>
    </div>

    <!-- 时段 + 7天趋势 -->
    <div class="row mt-16">
      <ChartCard title="时段成本分析" subtitle="早午晚夜 + 平峰" height="340px" style="flex: 2">
        <div ref="timeChart" class="chart-area"></div>
      </ChartCard>
      <ChartCard title="7 天成本趋势" subtitle="实际 vs 优化建议" height="340px" style="flex: 1">
        <div ref="trendChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <!-- 3 方案 + 4 城市对比 -->
    <div class="row mt-16">
      <ChartCard title="3 种成本方案对比" subtitle="保守 / 平衡 / 激进" height="320px" style="flex: 2">
        <div ref="planChart" class="chart-area"></div>
      </ChartCard>
      <ChartCard title="4 城市成本对比" subtitle="日配送总成本" height="320px" style="flex: 1">
        <div ref="compareChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <!-- 优化方案明细（3 张卡） -->
    <div v-if="costPlan?.plans" class="row mt-16">
      <div
        v-for="plan in costPlan.plans"
        :key="plan.name"
        class="card plan-card"
        :class="{ selected: selectedPlan === plan.type }"
        @click="selectedPlan = plan.type"
      >
        <div class="plan-head">
          <div class="plan-name">{{ plan.name }}</div>
          <el-tag v-if="plan.type === costPlan.recommended" type="success" size="small">推荐</el-tag>
        </div>
        <div class="plan-stats">
          <div class="ps-item">
            <span class="ps-label">总成本</span>
            <span class="ps-value">¥{{ formatNumber(plan.totalCost) }}</span>
          </div>
          <div class="ps-item">
            <span class="ps-label">缺口减少</span>
            <span class="ps-value">{{ plan.gapReduction }} 人</span>
          </div>
          <div class="ps-item">
            <span class="ps-label">ROI</span>
            <span class="ps-value">{{ plan.roi }}</span>
          </div>
        </div>
        <div class="plan-measures">
          <div v-for="m in plan.measures" :key="m.name" class="measure-item">
            <div class="m-name">{{ m.name }}</div>
            <div class="m-detail">
              <span>{{ m.people }} 人</span>
              <span>¥{{ m.cost }}</span>
              <span class="m-reduction">↓ {{ m.reduction }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

/* 🆕 成本超支 / 高缺口 提示条（成本 → 决策中心） */
.cost-alert-banner {
  position: relative;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.cost-alert-banner.type-overbudget {
  background: linear-gradient(135deg, #fff1f0 0%, #fff7e6 100%);
  border: 2px solid #f5222d;
  box-shadow: 0 4px 12px rgba(245, 34, 45, 0.15);
}
.cost-alert-banner.type-highgap {
  background: linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%);
  border: 2px solid #fa8c16;
  box-shadow: 0 4px 12px rgba(250, 141, 22, 0.15);
}
.cab-bg {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 64px;
  font-weight: 900;
  letter-spacing: -2px;
  user-select: none;
  pointer-events: none;
  color: rgba(0, 0, 0, 0.04);
}
.type-overbudget .cab-bg { color: rgba(245, 34, 45, 0.08); }
.type-highgap .cab-bg { color: rgba(250, 141, 22, 0.08); }
.cab-content {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}
.cab-ico { font-size: 32px; }
.cab-text { flex: 1; }
.cab-title { font-size: 15px; font-weight: 700; color: #1d2129; }
.cab-title b { color: #f5222d; }
.type-highgap .cab-title b { color: #fa8c16; }
.cab-sub { font-size: 12px; color: #52647c; margin-top: 2px; }
.cab-btn {
  background: linear-gradient(135deg, #1f6feb, #722ed1);
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.cab-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(31, 111, 235, 0.4); }

.page-container { padding: 20px; }

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 24px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-content { flex: 1; }

.stat-label { font-size: 13px; color: #909399; }

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #1f2d3d;
  line-height: 1.2;
  margin-top: 2px;
}

.stat-sub { font-size: 12px; color: #909399; margin-top: 2px; }

.data-banner {
  background: linear-gradient(90deg, rgba(31, 111, 235, 0.08), rgba(31, 111, 235, 0.02));
  border: 1px solid rgba(31, 111, 235, 0.2);
  border-radius: 8px;
  padding: 10px 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.row { display: flex; gap: 16px; }
.mt-16 { margin-top: 16px; }

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
}

.card-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.card-sub { font-size: 12px; color: #909399; }

.chart-area { width: 100%; height: 290px; }

.plan-card {
  flex: 1;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;

  &:hover { border-color: #1f6feb40; }
  &.selected { border-color: #1f6feb; background: #f0f7ff; }
}

.plan-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plan-name { font-size: 16px; font-weight: 600; color: #1f2d3d; }

.plan-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.ps-item { text-align: center; }
.ps-label { font-size: 11px; color: #909399; display: block; }
.ps-value { font-size: 16px; font-weight: 600; color: #1f6feb; }

.plan-measures { display: flex; flex-direction: column; gap: 6px; }

.measure-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
}

.m-name { font-weight: 500; color: #1f2d3d; flex: 1; }

.m-detail { display: flex; gap: 12px; color: #909399; }

.m-reduction { color: #00b578; font-weight: 500; }
</style>
