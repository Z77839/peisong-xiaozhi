<script setup lang="ts">
import { ref, onMounted, shallowRef, computed } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'
import request from '@/api/request'

const cityStore = useCityStore()
const city = cityStore.currentCity

const breakdownChart = ref<HTMLElement | null>(null)
const trendChart = ref<HTMLElement | null>(null)
const breakdownInstance = shallowRef<echarts.ECharts>()
const trendInstance = shallowRef<echarts.ECharts>()

// 4 城市因子
const cityCostFactors: Record<string, number> = {
  hengyang: 1.0, shaoxing: 0.7, changde: 0.5, quzhou: 0.4
}
const factor = computed(() => cityCostFactors[city.id] || 0.5)

// 从后端取成本优化方案（运力线 5 个真实成本）
const apiPlan = ref<any>(null)
const fetchPlan = async () => {
  try {
    const r: any = await request({
      url: '/optimize/cost-plan',
      method: 'POST',
      data: { city: city.id, gap: 1000 }
    })
    apiPlan.value = r
  } catch (e) {
    console.warn('成本方案获取失败', e)
  }
}

onMounted(() => {
  fetchPlan()
})

const metrics = computed(() => {
  // 衡阳真实成本: 专送4.9 / 优选5.04 / 优远7.17 / 众包4.36 / 蜂跑3.69
  const avgCost = 4.85 * factor.value  // 平均成本
  const dailyOrders = Math.floor(100000 * factor.value)
  const totalCost = Math.floor(dailyOrders * avgCost * 0.01)  // 0.01 万
  const grossProfit = Math.floor(totalCost * 2.4)
  return [
    { label: '今日总成本', value: `¥${formatNumber(totalCost)}`, trend: 5.8, color: '#1f6feb' },
    { label: '单均成本', value: `¥${avgCost.toFixed(2)}`, trend: -3.2, color: '#00b578' },
    { label: '总毛利', value: `¥${formatNumber(grossProfit)}`, trend: 8.6, color: '#ff9500' },
    { label: '毛利率', value: `${(38 + Math.random() * 5).toFixed(1)}%`, trend: 1.2, color: '#9b59ff' }
  ]
})

const initBreakdown = () => {
  if (!breakdownChart.value) return
  breakdownInstance.value = echarts.init(breakdownChart.value)
  breakdownInstance.value.setOption({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        label: { formatter: '{b}\n{d}%', fontSize: 12 },
        data: [
          { value: 22800, name: '骑手工资', itemStyle: { color: '#1f6feb' } },
          { value: 12800, name: '运力补贴', itemStyle: { color: '#00b578' } },
          { value: 8200, name: '站点运营', itemStyle: { color: '#ff9500' } },
          { value: 3200, name: '物流仓储', itemStyle: { color: '#9b59ff' } },
          { value: 1720, name: '其他', itemStyle: { color: '#86909c' } }
        ]
      }
    ]
  })
}

const initTrend = () => {
  if (!trendChart.value) return
  trendInstance.value = echarts.init(trendChart.value)
  const days = Array.from({ length: 14 }, (_, i) => `${i + 7}日`)
  trendInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['单均成本', '毛利率'], top: 0 },
    grid: { left: 40, right: 40, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: days },
    yAxis: [
      { type: 'value', name: '元' },
      { type: 'value', name: '%', max: 60 }
    ],
    series: [
      {
        name: '单均成本',
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#1f6feb', borderRadius: [4, 4, 0, 0] },
        data: [33.2, 31.8, 32.5, 33.0, 31.5, 30.9, 31.2, 32.0, 31.8, 31.6, 30.7, 30.5, 30.9, 31.2]
      },
      {
        name: '毛利率',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: '#ff9500' },
        data: [33, 35, 34, 36, 37, 38, 37, 36, 37, 38, 39, 40, 39, 38.4]
      }
    ]
  })
}

const onResize = () => {
  breakdownInstance.value?.resize()
  trendInstance.value?.resize()
}

onMounted(() => {
  initBreakdown()
  initTrend()
  window.addEventListener('resize', onResize)
})
</script>

<template>
  <div class="page-container">
    <div class="stat-row">
      <div v-for="m in metrics" :key="m.label" class="metric-card">
        <div class="m-label">{{ m.label }}</div>
        <div class="m-value" :style="{ color: m.color }">{{ m.value }}</div>
        <div class="m-trend">
          <span :class="m.trend > 0 ? 'up' : 'down'">
            {{ m.trend > 0 ? '↑' : '↓' }} {{ Math.abs(m.trend) }}%
          </span>
          <span class="trend-text">较上周</span>
        </div>
      </div>
    </div>

    <div class="row mt-16">
      <ChartCard title="成本结构拆解" subtitle="今日成本组成" height="320px" style="flex: 1">
        <div ref="breakdownChart" class="chart-area"></div>
      </ChartCard>
      <ChartCard title="成本与毛利趋势" subtitle="近 14 天" height="320px" style="flex: 1.4">
        <div ref="trendChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <div class="card mt-16">
      <div class="card-head">
        <span class="card-title">成本优化建议</span>
        <el-button size="small" type="primary">
          <el-icon><MagicStick /></el-icon> 一键应用
        </el-button>
      </div>
      <div class="suggest-list">
        <div class="suggest-item">
          <div class="si-icon" style="background: rgba(0, 181, 120, 0.1); color: #00b578">
            <el-icon><Top /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">启用顺路单合并，预计节省 ¥3,200/日</div>
            <div class="si-desc">通过算法合并相同路径订单，减少派送次数 12%</div>
          </div>
          <div class="si-impact">
            <div class="impact-label">预计节省</div>
            <div class="impact-value">¥3,200</div>
          </div>
        </div>
        <div class="suggest-item">
          <div class="si-icon" style="background: rgba(31, 111, 235, 0.1); color: #1f6feb">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">调整补贴分发策略，覆盖 5 个高需求区域</div>
            <div class="si-desc">根据历史数据动态调整补贴，在高峰前 30 分钟生效</div>
          </div>
          <div class="si-impact">
            <div class="impact-label">预计节省</div>
            <div class="impact-value">¥1,800</div>
          </div>
        </div>
        <div class="suggest-item">
          <div class="si-icon" style="background: rgba(255, 149, 0, 0.1); color: #ff9500">
            <el-icon><Sunny /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">恶劣天气补贴策略优化</div>
            <div class="si-desc">基于天气预报提前发布补贴预告，激活预备骑手</div>
          </div>
          <div class="si-impact">
            <div class="impact-label">预计增收</div>
            <div class="impact-value">¥2,500</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
