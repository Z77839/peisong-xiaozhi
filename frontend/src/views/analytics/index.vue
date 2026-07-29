<template>
  <div class="analytics-page">
    <div class="page-header">
      <h1>📊 决策经验分析</h1>
      <p class="subtitle">实时跟踪决策采纳率、知识库命中率、经验沉淀趋势</p>
    </div>

    <!-- 4 KPI 卡片 -->
    <div class="kpi-row">
      <div class="kpi-card kpi-primary">
        <div class="kc-label">总决策数</div>
        <div class="kc-value">{{ casesStats.total || 0 }}</div>
        <div class="kc-trend">📚 含 {{ cases.length }} 条历史案例</div>
      </div>
      <div class="kpi-card kpi-success">
        <div class="kc-label">采纳率</div>
        <div class="kc-value">{{ adoptionRate }}%</div>
        <div class="kc-trend">{{ distribution.adopted }} 条已采纳 / {{ casesStats.withFeedback || 0 }} 已反馈</div>
      </div>
      <div class="kpi-card kpi-warning">
        <div class="kc-label">待反馈</div>
        <div class="kc-value">{{ distribution.pending }}</div>
        <div class="kc-trend">⏳ 用户还没标注结果</div>
      </div>
      <div class="kpi-card kpi-danger">
        <div class="kc-label">未采纳</div>
        <div class="kc-value">{{ distribution.rejected }}</div>
        <div class="kc-trend">❌ 用户拒绝 / 部分采纳</div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="charts-row">
      <!-- 趋势图：最近 7 天决策量 + 采纳率 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>📈 最近 7 天决策趋势</h3>
          <button class="refresh-btn" @click="loadData" :disabled="loading">🔄 刷新</button>
        </div>
        <div ref="trendChartRef" class="chart-canvas"></div>
      </div>

      <!-- 饼图：采纳率分布 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>🎯 决策采纳分布</h3>
        </div>
        <div ref="pieChartRef" class="chart-canvas"></div>
      </div>
    </div>

    <!-- 经验案例 Top 10 -->
    <div class="top-cases">
      <div class="chart-header">
        <h3>🏆 高采纳率 Top 10 经验案例</h3>
        <span class="kc-trend">按 success_rate × (1 - 衰减) 排序</span>
      </div>
      <div v-if="topCases.length === 0" class="empty-tip">
        📭 暂无经验案例。决策完成后会自动归档，用户采纳/不采纳的反馈会沉淀到这里。
      </div>
      <div v-else class="case-table">
        <div class="case-row case-head">
          <div class="col-rank">#</div>
          <div class="col-summary">摘要</div>
          <div class="col-city">城市</div>
          <div class="col-rate">采纳率</div>
          <div class="col-rc">检索</div>
        </div>
        <div v-for="(c, i) in topCases" :key="c.id" class="case-row">
          <div class="col-rank">{{ i + 1 }}</div>
          <div class="col-summary">{{ c.summary }}</div>
          <div class="col-city">{{ c.cityId }}</div>
          <div class="col-rate">
            <span class="rate-pill" :class="rateClass(c.success_rate)">
              {{ Math.round((c.success_rate || 0) * 100) }}%
            </span>
          </div>
          <div class="col-rc">{{ c.retrieval_count || 0 }} 次</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import * as echarts from 'echarts'
import request from '@/api/request'

const loading = ref(false)
const cases = ref<any[]>([])
const casesStats = ref<any>({})
const trend = ref<any[]>([])
const distribution = ref({ adopted: 0, partial: 0, rejected: 0, pending: 0 })

const trendChartRef = ref<HTMLElement | null>(null)
const pieChartRef = ref<HTMLElement | null>(null)
const trendChart = shallowRef<echarts.ECharts | null>(null)
const pieChart = shallowRef<echarts.ECharts | null>(null)

const adoptionRate = computed(() => {
  const total = casesStats.value.withFeedback || 0
  if (total === 0) return 0
  return Math.round((distribution.value.adopted / total) * 100)
})

const topCases = computed(() => {
  return [...cases.value]
    .filter(c => c.success_rate > 0)
    .sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0))
    .slice(0, 10)
})

function rateClass(sr: number) {
  if (sr === 1) return 'rate-success'
  if (sr === 0.5) return 'rate-partial'
  if (sr === 0) return 'rate-failed'
  return 'rate-pending'
}

async function loadData() {
  loading.value = true
  try {
    const [casesRes, trendRes] = await Promise.all([
      request({ url: '/decision/cases?limit=500' }),
      request({ url: '/decision/cases/trend?days=7' })
    ])
    cases.value = Array.isArray(casesRes) ? casesRes : (casesRes?.data || [])
    casesStats.value = (casesRes && casesRes.stats) || {}
    trend.value = Array.isArray(trendRes) ? trendRes : (trendRes?.data || [])
    distribution.value = (casesRes && casesRes.distribution) || { adopted: 0, partial: 0, rejected: 0, pending: 0 }
    await nextTick()
    renderTrendChart()
    renderPieChart()
  } catch (e) {
    console.warn('[analytics] load failed', e)
  } finally {
    loading.value = false
  }
}

function renderTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChart.value) trendChart.value = echarts.init(trendChartRef.value)
  
  const dates = trend.value.map(b => b.label)
  const totals = trend.value.map(b => b.total)
  const adopted = trend.value.map(b => b.adopted)
  
  trendChart.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['决策数', '采纳数'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#dcdfe6' } } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f5f7fa' } } },
    series: [
      {
        name: '决策数', type: 'bar', data: totals,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '采纳数', type: 'line', data: adopted, smooth: true,
        itemStyle: { color: '#00b578' }, lineStyle: { width: 3 },
        symbolSize: 8
      }
    ]
  })
}

function renderPieChart() {
  if (!pieChartRef.value) return
  if (!pieChart.value) pieChart.value = echarts.init(pieChartRef.value)
  
  const d = distribution.value
  const data = [
    { value: d.adopted, name: '已采纳', itemStyle: { color: '#00b578' } },
    { value: d.partial, name: '部分采纳', itemStyle: { color: '#fa8c16' } },
    { value: d.rejected, name: '未采纳', itemStyle: { color: '#f5222d' } },
    { value: d.pending, name: '待反馈', itemStyle: { color: '#8c8c8c' } }
  ].filter(x => x.value > 0)
  
  pieChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'right', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%' },
      data
    }]
  })
}

function handleResize() {
  trendChart.value?.resize()
  pieChart.value?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  trendChart.value?.dispose()
  pieChart.value?.dispose()
})
</script>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.analytics-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
.page-header h1 { font-size: 26px; font-weight: 700; color: $text-primary; margin: 0 0 6px; }
.subtitle { font-size: 13px; color: $text-secondary; margin: 0 0 24px; }

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-card {
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 20px 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
  &:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
  &::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
  &.kpi-primary::before { background: linear-gradient(180deg, #1f6feb, #4080ff); }
  &.kpi-success::before { background: linear-gradient(180deg, #00b578, #52c41a); }
  &.kpi-warning::before { background: linear-gradient(180deg, #fa8c16, #ffa940); }
  &.kpi-danger::before { background: linear-gradient(180deg, #f5222d, #ff4d4f); }
}
.kc-label { font-size: 13px; color: $text-secondary; margin-bottom: 8px; }
.kc-value { font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 8px; letter-spacing: -1px; }
.kpi-primary .kc-value { color: #1f6feb; }
.kpi-success .kc-value { color: #00b578; }
.kpi-warning .kc-value { color: #fa8c16; }
.kpi-danger .kc-value { color: #f5222d; }
.kc-trend { font-size: 12px; color: $text-placeholder; }

.charts-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-bottom: 24px; }
.chart-card {
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 12px;
  padding: 16px 20px;
}
.chart-header { display: flex; align-items: center; margin-bottom: 12px; }
.chart-header h3 { font-size: 15px; font-weight: 700; color: $text-primary; margin: 0; }
.refresh-btn { margin-left: auto; padding: 4px 12px; background: #fff; border: 1px solid $border-light; border-radius: 14px; font-size: 12px; color: $primary; cursor: pointer; }
.refresh-btn:hover:not(:disabled) { background: $primary-light; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.chart-canvas { width: 100%; height: 280px; }

.top-cases { background: #fff; border: 1px solid $border-light; border-radius: 12px; padding: 16px 20px; }
.empty-tip { padding: 40px 0; text-align: center; color: $text-placeholder; font-size: 13px; }
.case-table { margin-top: 12px; }
.case-row { display: grid; grid-template-columns: 50px 1fr 80px 100px 80px; align-items: center; padding: 12px 8px; border-bottom: 1px solid $bg-hover; font-size: 13px; &:last-child { border-bottom: none; } }
.case-head { font-weight: 600; color: $text-secondary; background: $bg-hover; border-radius: 6px; }
.col-rank { color: $text-placeholder; font-weight: 600; text-align: center; }
.col-summary { color: $text-primary; }
.col-city { color: $text-secondary; font-size: 12px; }
.col-rc { color: $text-placeholder; font-size: 12px; text-align: center; }
.rate-pill { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.rate-success { background: rgba(0,181,120,0.12); color: #00b578; }
.rate-partial { background: rgba(250,141,22,0.12); color: #fa8c16; }
.rate-failed { background: rgba(245,34,45,0.12); color: #f5222d; }
.rate-pending { background: $bg-hover; color: $text-placeholder; }

@media (max-width: 1100px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .charts-row { grid-template-columns: 1fr; }
}
</style>
