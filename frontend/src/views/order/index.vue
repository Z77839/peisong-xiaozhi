<script setup lang="ts">
import { ref, onMounted, shallowRef, computed } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'
import request from '@/api/request'

const cityStore = useCityStore()
const city = cityStore.currentCity

const lineChart = ref<HTMLElement | null>(null)
const lineInstance = shallowRef<echarts.ECharts>()

// 4 城市订单因子
const cityOrderFactors: Record<string, number> = {
  hengyang: 1.0,
  shaoxing: 0.65,
  changde:  0.50,
  quzhou:   0.40
}

const factor = computed(() => cityOrderFactors[city.id] || 0.5)

// 从后端 API 取实时订单池 + 缺口预测
const apiOrders = ref<any[]>([])
const accuracy = ref(94.2)
const periodFilter = ref('all')

const fetchOrders = async () => {
  try {
    // 实时订单池
    const pool: any = await request({ url: `/adapters/orders/pool?city=${city.id}&range=1h` })
    apiOrders.value = pool.orders || []
  } catch (e) {
    console.warn('订单流获取失败，使用本地数据', e)
  }
}

onMounted(() => {
  fetchOrders()
  setInterval(fetchOrders, 30000)  // 30 秒自动刷新
})

// 4 城市动态订单数据
const orders = computed(() => {
  const now = new Date()
  const baseRate = 280 * factor.value  // 基础订单率
  return Array.from({ length: 8 }, (_, i) => {
    const t = new Date(now.getTime() - (7 - i) * 15 * 60 * 1000)
    const hourFactor = (t.getHours() >= 11 && t.getHours() <= 13) ? 2.5 :
                       (t.getHours() >= 17 && t.getHours() <= 21) ? 3.2 : 1.0
    const predicted = Math.floor(baseRate * hourFactor + (Math.random() - 0.5) * 50)
    const actual = i < 7 ? Math.floor(predicted * (0.92 + Math.random() * 0.06)) : null
    return {
      time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
      predicted,
      actual
    }
  })
})

// 4 城市动态区域数据
const regionData = computed(() => {
  const regions = city.id === 'hengyang' ? ['蒸湘万达', '晶珠商圈', '衡阳万达', '步步高广场', '太阳广场', '金钟时代城']
              : city.id === 'shaoxing' ? ['柯桥万达', '银泰城', '世茂广场', '汇金广场', '东街', '鲁迅故里']
              : city.id === 'changde'  ? ['万达常德', '友阿国际', '步步高', '桥南市场', '步行街', '诗墙公园']
              : ['衢州万达', '南街', '东方商厦', '西区商圈', '水亭街', '府山']
  return regions.map((r, i) => ({
    region: r,
    predicted: Math.floor(250 * factor.value + Math.random() * 350),
    trend: Math.random() > 0.7 ? 'down' : Math.random() > 0.3 ? 'up' : 'flat',
    growth: parseFloat((Math.random() * 25 - 5).toFixed(1))
  }))
})

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
