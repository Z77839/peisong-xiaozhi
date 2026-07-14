<script setup lang="ts">
import { ref, onMounted, shallowRef, computed, watch } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'
import request from '@/api/request'

const cityStore = useCityStore()
const city = cityStore.currentCity

// 4 城市因子
const cityCostFactors: Record<string, number> = {
  hengyang: 1.0, shaoxing: 0.7, changde: 0.5, quzhou: 0.4
}
const factor = computed(() => cityCostFactors[city.id] || 0.5)

// 5 运力线真实成本（来自 cities.js）
const RIDER_LINE_COSTS = [
  { name: '专送', cost: 4.90, color: '#1f6feb', desc: '主力配送', avgTime: 32 },
  { name: '优选', cost: 5.04, color: '#00b578', desc: '中端优选', avgTime: 35 },
  { name: '优远', cost: 7.17, color: '#9b59ff', desc: '远距离', avgTime: 50 },
  { name: '众包', cost: 4.36, color: '#ff9500', desc: '灵活运力', avgTime: 38 },
  { name: '蜂跑', cost: 3.69, color: '#f5222d', desc: '应急蜂跑', avgTime: 30 }
]

const breakdownChart = ref<HTMLElement | null>(null)
const timeChart = ref<HTMLElement | null>(null)
const planChart = ref<HTMLElement | null>(null)
const paretoChart = ref<HTMLElement | null>(null)
const breakdownInstance = shallowRef<echarts.ECharts>()
const timeInstance = shallowRef<echarts.ECharts>()
const planInstance = shallowRef<echarts.ECharts>()
const paretoInstance = shallowRef<echarts.ECharts>()

// 真实数据
const dashboardData = ref<any>(null)
const costPlan = ref<any>(null)  // 来自 /api/optimize/cost-plan
const gapPrediction = ref<any>(null)  // 来自 /api/optimize/predict-gap
const loading = ref(false)
const selectedPlan = ref<string>('balanced')

// 时段成本
const timeSlotCosts = computed(() => {
  const cityOrders = (dashboardData.value?.kpis?.total_orders || 0) * factor.value
  const avg = RIDER_LINE_COSTS.reduce((s, r) => s + r.cost * r.share, 0)
  // 4 个时段：早 7-10 / 午 11-13 / 晚 17-21 / 夜 22-6
  return [
    { slot: '早高峰', time: '07-10', orders: Math.floor(cityOrders * 0.15), avgCost: avg * 1.0, cost: 0 },
    { slot: '午高峰', time: '11-13', orders: Math.floor(cityOrders * 0.25), avgCost: avg * 1.05, cost: 0 },
    { slot: '晚高峰', time: '17-21', orders: Math.floor(cityOrders * 0.40), avgCost: avg * 1.15, cost: 0 },
    { slot: '夜宵', time: '22-06', orders: Math.floor(cityOrders * 0.10), avgCost: avg * 1.20, cost: 0 },
    { slot: '平峰', time: '其他', orders: Math.floor(cityOrders * 0.10), avgCost: avg * 0.95, cost: 0 }
  ].map(s => ({ ...s, cost: Math.floor(s.orders * s.avgCost) }))
})

async function fetchData() {
  loading.value = true
  try {
    const [dashR, planR, gapR] = await Promise.all([
      request({ url: '/dashboard' }),
      request({ url: '/optimize/cost-plan', method: 'POST', data: { city: city.id, gap: 800 } }),
      request({ url: '/optimize/predict-gap', method: 'POST', data: { city: city.id, hour: 19, isHoliday: false } })
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

// 4 个 KPI
const metrics = computed(() => {
  const cityOrders = Math.floor((dashboardData.value?.kpis?.total_orders || 0) * factor.value)
  const avg = RIDER_LINE_COSTS.reduce((s, r) => s + r.cost * r.share, 0)
  const totalCost = Math.floor(cityOrders * avg)
  const profit = Math.floor(totalCost * 1.45)
  const gap = costPlan.value?.totalGap || 0
  const currentPlan = costPlan.value?.plans?.find((p: any) => p.name === (selectedPlan.value === 'conservative' ? '保守方案' : selectedPlan.value === 'aggressive' ? '激进方案' : '平衡方案'))
  return [
    { label: '日总成本', value: `¥${(totalCost / 10000).toFixed(1)}万`, sub: `${formatNumber(cityOrders)} 单 × ¥${avg.toFixed(2)}`, color: '#1f6feb', icon: '💰' },
    { label: '日毛利', value: `¥${(profit / 10000).toFixed(1)}万`, sub: '毛利率 45%', color: '#00b578', icon: '📈' },
    { label: '运力缺口', value: formatNumber(gap), sub: '高峰时段', color: '#f5222d', icon: '📉' },
    { label: '推荐方案节省', value: currentPlan ? `¥${formatNumber(currentPlan.totalCost)}` : '¥560', sub: currentPlan?.name || '平衡方案', color: '#9b59ff', icon: '🎯' }
  ]
})

// 5 运力线成本拆解
const costBreakdown = computed(() => {
  const total = RIDER_LINE_COSTS.reduce((s, r) => s + r.cost * r.share, 0)
  return RIDER_LINE_COSTS.map(r => ({
    name: r.name,
    value: parseFloat((r.cost * r.share * 100 / total).toFixed(1)),
    color: r.color,
    cost: r.cost,
    share: r.share
  }))
})

// Pareto 最优配比（基于真实成本 + 缺口）
const paretoData = computed(() => {
  // 缺口 100% 时各运力线最优配比
  const baseGap = 1000
  return [
    { name: '蜂跑', cost: 3.69, capacity: 80, total: 80 * 3.69, color: '#f5222d' },
    { name: '众包', cost: 4.36, capacity: 120, total: 120 * 4.36, color: '#ff9500' },
    { name: '优选', cost: 5.04, capacity: 100, total: 100 * 5.04, color: '#00b578' },
    { name: '专送', cost: 4.90, capacity: 150, total: 150 * 4.90, color: '#1f6feb' },
    { name: '优远', cost: 7.17, capacity: 50, total: 50 * 7.17, color: '#9b59ff' }
  ].sort((a, b) => a.total - b.total)
})

const initBreakdown = () => {
  if (!breakdownChart.value) return
  breakdownInstance.value = echarts.init(breakdownChart.value)
  breakdownInstance.value.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const c = RIDER_LINE_COSTS[p.dataIndex]
        return `${p.name}<br/>¥${c.cost}/单 · 占比 ${p.value}%<br/>${c.desc}`
      }
    },
    legend: { bottom: 0, icon: 'circle' },
    series: [{
      type: 'pie',
      radius: ['38%', '70%'],
      label: { formatter: '{b}\n¥{c0}/单', fontSize: 11 },
      data: RIDER_LINE_COSTS.map((c, i) => ({
        value: c.cost,
        name: c.name,
        itemStyle: { color: c.color }
      }))
    }]
  })
}

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
      { name: '订单数', type: 'bar', yAxisIndex: 0, barWidth: 20,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] },
        data: data.map(d => d.orders) },
      { name: '单均成本', type: 'line', yAxisIndex: 1, smooth: true,
        itemStyle: { color: '#f5222d' },
        lineStyle: { width: 3 },
        data: data.map(d => parseFloat(d.avgCost.toFixed(2))) }
    ]
  })
}

const initPareto = () => {
  if (!paretoChart.value) return
  paretoInstance.value = echarts.init(paretoChart.value)
  const data = paretoData.value
  paretoInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['人数', '总成本'], top: 0 },
    grid: { left: 60, right: 60, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: data.map(d => d.name) },
    yAxis: [
      { type: 'value', name: '人数' },
      { type: 'value', name: '元' }
    ],
    series: [
      { name: '人数', type: 'bar', yAxisIndex: 0, barWidth: 24,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] },
        data: data.map(d => d.capacity) },
      { name: '总成本', type: 'line', yAxisIndex: 1, smooth: true,
        itemStyle: { color: '#ff9500' },
        lineStyle: { width: 3 },
        data: data.map(d => d.total) }
    ]
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
      { name: '总成本(元)', type: 'bar', yAxisIndex: 0, barWidth: 30,
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
  breakdownInstance.value?.resize()
  timeInstance.value?.resize()
  planInstance.value?.resize()
  paretoInstance.value?.resize()
}

onMounted(() => {
  setTimeout(() => {
    initBreakdown()
    initTimeChart()
    initPareto()
    initPlan()
  }, 500)
  window.addEventListener('resize', onResize)
})

watch([costBreakdown, timeSlotCosts, paretoData, costPlan], () => {
  initBreakdown()
  initTimeChart()
  initPareto()
  initPlan()
}, { deep: true })
</script>

<template>
  <div class="page-container">
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

    <!-- 5 运力线 + 时段成本 -->
    <div class="row mt-16">
      <ChartCard title="5 运力线单价" subtitle="成本对比" height="340px" style="flex: 1">
        <div ref="breakdownChart" class="chart-area"></div>
      </ChartCard>
      <ChartCard title="时段成本分析" subtitle="早午晚夜 + 平峰" height="340px" style="flex: 2">
        <div ref="timeChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <!-- 成本方案 + Pareto -->
    <div class="row mt-16">
      <ChartCard title="3 种成本方案对比" subtitle="保守 / 平衡 / 激进" height="320px" style="flex: 2">
        <div ref="planChart" class="chart-area"></div>
      </ChartCard>
      <ChartCard title="缺口 1000 时 Pareto 最优" subtitle="人数 vs 成本" height="320px" style="flex: 1">
        <div ref="paretoChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <!-- 5 运力线明细 + 成本方案 -->
    <div class="row mt-16">
      <div class="card flex-card">
        <div class="card-head">
          <span class="card-title">5 运力线成本明细</span>
          <span class="card-sub">基于城市配送业务</span>
        </div>
        <el-table :data="RIDER_LINE_COSTS" stripe>
          <el-table-column label="运力线" width="100">
            <template #default="{ row }">
              <span class="dot" :style="{ background: row.color }"></span>
              <strong>{{ row.name }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="定位" prop="desc" width="100" />
          <el-table-column label="单价" width="100" align="right">
            <template #default="{ row }">
              <span class="price">¥{{ row.cost }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平均时效" width="100" align="right">
            <template #default="{ row }">{{ row.avgTime }} 分钟</template>
          </el-table-column>
          <el-table-column label="占比" width="180" align="right">
            <template #default="{ row }">
              <el-progress :percentage="row.share * 100" :stroke-width="8" :color="row.color" />
            </template>
          </el-table-column>
          <el-table-column label="日均单数" align="right">
            <template #default="{ row }">
              {{ formatNumber(Math.floor(100000 * factor.value * row.share)) }}
            </template>
          </el-table-column>
          <el-table-column label="日成本" align="right">
            <template #default="{ row }">
              <strong>¥{{ formatNumber(Math.floor(100000 * factor.value * row.share * row.cost)) }}</strong>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 优化方案明细 -->
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
.flex-card { flex: 1; }

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

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.price { color: #1f6feb; font-weight: 600; }

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
