<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import { formatNumber } from '@/utils/format'

const lineChart = ref<HTMLElement | null>(null)
const lineInstance = shallowRef<echarts.ECharts>()

const orders = ref([
  { time: '11:00', predicted: 320, actual: 318 },
  { time: '11:15', predicted: 380, actual: 372 },
  { time: '11:30', predicted: 460, actual: 451 },
  { time: '11:45', predicted: 580, actual: 562 },
  { time: '12:00', predicted: 720, actual: 718 },
  { time: '12:15', predicted: 690, actual: 682 },
  { time: '12:30', predicted: 540, actual: 531 },
  { time: '12:45', predicted: 420, actual: null }
])

const accuracy = ref(94.2)
const periodFilter = ref('all')

const regionData = ref([
  { region: '蒸湘万达', predicted: 486, trend: 'up', growth: 12.3 },
  { region: '晶珠商圈', predicted: 372, trend: 'up', growth: 8.5 },
  { region: '衡阳万达', predicted: 624, trend: 'up', growth: 15.2 },
  { region: '步步高广场', predicted: 298, trend: 'down', growth: -3.1 },
  { region: '太阳广场', predicted: 412, trend: 'up', growth: 6.7 },
  { region: '金钟时代城', predicted: 268, trend: 'flat', growth: 0.5 }
])

const initChart = () => {
  if (!lineChart.value) return
  lineInstance.value = echarts.init(lineChart.value)
  lineInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['预测值', '实际值'], top: 0 },
    grid: { left: 40, right: 20, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: orders.value.map((o) => o.time) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '预测值',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: orders.value.map((o) => o.predicted),
        lineStyle: { width: 2.5, color: '#1f6feb' },
        itemStyle: { color: '#1f6feb' }
      },
      {
        name: '实际值',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: orders.value.map((o) => o.actual),
        lineStyle: { width: 2.5, color: '#00b578' },
        itemStyle: { color: '#00b578' }
      }
    ]
  })
}

const onResize = () => lineInstance.value?.resize()

onMounted(() => {
  initChart()
  window.addEventListener('resize', onResize)
})
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计 -->
    <div class="stat-row">
      <div class="stat-card primary">
        <div class="stat-label">今日预测总订单</div>
        <div class="stat-value">{{ formatNumber(12847) }} <span class="unit">单</span></div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">预测准确率</div>
        <div class="stat-value">{{ accuracy }}<span class="unit">%</span></div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">高峰时段</div>
        <div class="stat-value">17:30-19:30</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">活跃商户</div>
        <div class="stat-value">326 <span class="unit">家</span></div>
      </div>
    </div>

    <!-- 主图 -->
    <ChartCard title="订单预测准确度" subtitle="短时段预测 vs 实际值对比" height="360px" class="mt-16">
      <div ref="lineChart" class="chart-area"></div>
    </ChartCard>

    <!-- 商圈列表 -->
    <div class="card mt-16">
      <div class="card-head">
        <span class="card-title">各商圈预测明细</span>
        <el-radio-group v-model="periodFilter">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="lunch">午餐</el-radio-button>
          <el-radio-button value="dinner">晚餐</el-radio-button>
          <el-radio-button value="night">夜宵</el-radio-button>
        </el-radio-group>
      </div>
      <el-table :data="regionData" stripe>
        <el-table-column label="商圈" prop="region" />
        <el-table-column label="预测订单" width="180" align="right">
          <template #default="{ row }">
            <span class="num-strong">{{ formatNumber(row.predicted) }}</span>
            <span class="num-unit">单</span>
          </template>
        </el-table-column>
        <el-table-column label="趋势" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.trend === 'up' ? 'success' : row.trend === 'down' ? 'danger' : 'info'" size="small">
              {{ row.trend === 'up' ? '↑ 上涨' : row.trend === 'down' ? '↓ 下降' : '— 持平' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="环比" width="120" align="right" prop="growth">
          <template #default="{ row }">
            <span :class="row.growth > 0 ? 'text-success' : row.growth < 0 ? 'text-danger' : 'text-secondary'">
              {{ row.growth > 0 ? '+' : '' }}{{ row.growth }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <el-button link type="primary" size="small">详情</el-button>
          <el-button link type="primary" size="small">策略</el-button>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
