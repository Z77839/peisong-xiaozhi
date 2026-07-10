<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'
import KpiCard from '@/components/KpiCard.vue'
import { cEndData } from '@/data/cEnd'
import { useCityStore } from '@/store/city'
import { formatNumber } from '@/utils/format'

const cityStore = useCityStore()
const city = cityStore.currentCity

const data = cEndData

const trendChart = ref<HTMLElement | null>(null)
const levelChart = ref<HTMLElement | null>(null)
const groupChart = ref<HTMLElement | null>(null)
const trendInstance = shallowRef<echarts.ECharts>()
const levelInstance = shallowRef<echarts.ECharts>()
const groupInstance = shallowRef<echarts.ECharts>()

const kpis = computed(() => {
  const scale = city.dailyOrders / 100000
  return [
    {
      label: '社群粉丝',
      value: formatNumber(Math.floor(data.community.fans * scale)),
      unit: '人',
      trend: data.community.growth,
      icon: 'ChatLineRound',
      color: '#1f6feb'
    },
    {
      label: '二级团长总数',
      value: formatNumber(Math.floor(data.group.total * scale)),
      unit: '人',
      trend: 12.5,
      icon: 'UserFilled',
      color: '#00b578'
    },
    {
      label: '月活团长',
      value: formatNumber(Math.floor(data.group.active * scale)),
      unit: '人',
      trend: 18.2,
      icon: 'Avatar',
      color: '#ff9500'
    },
    {
      label: '社群下单率',
      value: data.community.orderRate,
      unit: '%',
      trend: 1.8,
      icon: 'TrendCharts',
      color: '#9b59ff'
    }
  ]
})

const initTrend = () => {
  if (!trendChart.value) return
  trendInstance.value = echarts.init(trendChart.value)
  trendInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['社群订单', '成员数'], top: 0 },
    grid: { left: 50, right: 50, top: 36, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.communityTrend.map((d) => `D${d.day}`)
    },
    yAxis: [
      { type: 'value', name: '订单', position: 'left' },
      { type: 'value', name: '成员', position: 'right' }
    ],
    series: [
      {
        name: '社群订单',
        type: 'bar',
        barWidth: 10,
        data: data.communityTrend.map((d) => d.orders),
        itemStyle: { color: '#1f6feb', borderRadius: [3, 3, 0, 0] }
      },
      {
        name: '成员数',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: data.communityTrend.map((d) => d.members),
        itemStyle: { color: '#ff9500' },
        lineStyle: { width: 2 }
      }
    ]
  })
}

const initLevel = () => {
  if (!levelChart.value) return
  levelInstance.value = echarts.init(levelChart.value)
  levelInstance.value.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          formatter: '{b}\n{c} 人',
          fontSize: 11
        },
        data: data.groupLevels.map((l) => ({
          name: l.level,
          value: l.count,
          itemStyle: { color: l.color }
        }))
      }
    ]
  })
}

const initGroup = () => {
  if (!groupChart.value) return
  groupInstance.value = echarts.init(groupChart.value)
  groupInstance.value.setOption({
    tooltip: {},
    legend: { bottom: 0 },
    radar: {
      indicator: data.groupLevels.map((l) => ({ name: l.level, max: data.group.total })),
      radius: '60%'
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: data.groupLevels.map((l) => l.count),
            name: '团长分布',
            itemStyle: { color: '#1f6feb' },
            areaStyle: { color: 'rgba(31, 111, 235, 0.2)' }
          }
        ]
      }
    ]
  })
}

const handleResize = () => {
  trendInstance.value?.resize()
  levelInstance.value?.resize()
  groupInstance.value?.resize()
}

onMounted(() => {
  initTrend()
  initLevel()
  initGroup()
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">C 端运营分析</h2>
        <p class="page-subtitle">{{ city.name }} · 衡阳高校资源密集，社群占比 75%；二级团长 1,400+，月活 137 人</p>
      </div>
    </div>

    <div class="kpi-grid">
      <KpiCard v-for="k in kpis" :key="k.label" v-bind="k" />
    </div>

    <ChartCard title="社群下单趋势" subtitle="近 30 天订单与成员增长" height="320px" class="mt-16">
      <div ref="trendChart" class="chart-area"></div>
    </ChartCard>

    <div class="row-grid mt-16">
      <ChartCard title="团长等级分布" subtitle="按级别人数" height="300px" style="flex: 1">
        <div ref="levelChart" class="chart-area"></div>
      </ChartCard>

      <ChartCard title="团长能力雷达" subtitle="各级别骑手覆盖" height="300px" style="flex: 1">
        <div ref="groupChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <div class="insight-row mt-16">
      <div class="insight-card">
        <div class="ic-icon" style="background: rgba(31, 111, 235, 0.1); color: #1f6feb;">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="ic-content">
          <div class="ic-label">社群粉丝占 MAC 比例</div>
          <div class="ic-value">{{ data.community.fanRate }}%</div>
          <div class="ic-hint">同类型城市平均 7%，仍有较大增长空间</div>
        </div>
      </div>
      <div class="insight-card">
        <div class="ic-icon" style="background: rgba(0, 181, 120, 0.1); color: #00b578;">
          <el-icon><Star /></el-icon>
        </div>
        <div class="ic-content">
          <div class="ic-label">学生社群占比</div>
          <div class="ic-value">{{ data.community.studentPercent }}%</div>
          <div class="ic-hint">高校资源是衡阳独特优势，下单率高</div>
        </div>
      </div>
      <div class="insight-card">
        <div class="ic-icon" style="background: rgba(255, 149, 0, 0.1); color: #ff9500;">
          <el-icon><MoneyCollect /></el-icon>
        </div>
        <div class="ic-content">
          <div class="ic-label">二级分销单均成本</div>
          <div class="ic-value">¥{{ data.group.costPerOrder }}</div>
          <div class="ic-hint">仍有优化空间，建议精细化分层激励</div>
        </div>
      </div>
    </div>

    <div class="ai-suggestion mt-16">
      <h3 class="sc-title">📈 AI 增长建议</h3>
      <div class="sc-grid">
        <div class="sg-item">
          <div class="sg-num">01</div>
          <div class="sg-content">
            <div class="sg-title">学生社群精准触达</div>
            <div class="sg-desc">针对 75% 学生占比，建立校园 KOL 矩阵，目标 GMV +30%</div>
          </div>
        </div>
        <div class="sg-item">
          <div class="sg-num">02</div>
          <div class="sg-content">
            <div class="sg-title">团长晋升体系</div>
            <div class="sg-desc">从 137 月活提升到 300+，月激活率从 9.8% → 22%</div>
          </div>
        </div>
        <div class="sg-item">
          <div class="sg-num">03</div>
          <div class="sg-content">
            <div class="sg-title">社群下单转化</div>
            <div class="sg-desc">当前下单率 10%，可通过运营 SOP 优化至 16%</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
