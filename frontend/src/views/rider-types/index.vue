<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import { riderTypes, hengYangBaseline } from '@/data/riderTypes'
import { useCityStore } from '@/store/city'
import ChartCard from '@/components/ChartCard.vue'
import { formatNumber } from '@/utils/format'

const cityStore = useCityStore()

// 当前选中的运力线
const activeType = ref(riderTypes[0].id)
const currentType = computed(() => riderTypes.find((r) => r.id === activeType.value)!)

// ===== 图表 ref =====
const costCompareChart = ref<HTMLElement | null>(null)
const radarChart = ref<HTMLElement | null>(null)
const allocationChart = ref<HTMLElement | null>(null)
const capacityChart = ref<HTMLElement | null>(null)

const costCompareInstance = shallowRef<echarts.ECharts>()
const radarInstance = shallowRef<echarts.ECharts>()
const allocationInstance = shallowRef<echarts.ECharts>()
const capacityInstance = shallowRef<echarts.ECharts>()

// 平均成本 vs 各运力线对比（柱图）
const avgCost = computed(() => {
  const total = riderTypes.reduce((s, r) => s + r.cost, 0)
  return (total / riderTypes.length).toFixed(2)
})

const baselineCost = computed(() => hengYangBaseline.riderCost)

// 各运力线成本对比柱状图（含衡阳均值参考线）
const initCostCompare = () => {
  if (!costCompareChart.value) return
  costCompareInstance.value = echarts.init(costCompareChart.value)
  const markLine = hengYangBaseline.riderCost
  costCompareInstance.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 80, top: 30, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#e5e6eb' } },
      splitLine: { lineStyle: { color: '#f2f3f5' } },
      axisLabel: { color: '#86909c', fontSize: 11, formatter: '¥{value}' }
    },
    yAxis: {
      type: 'category',
      data: riderTypes.map((r) => r.fullName),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#4e5969', fontSize: 12 }
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        data: riderTypes.map((r) => ({
          value: r.cost,
          itemStyle: {
            color: r.color,
            borderRadius: [0, 4, 4, 0]
          }
        })),
        label: {
          show: true,
          position: 'right',
          formatter: '¥{c}/单',
          color: '#1d2129',
          fontWeight: 600
        },
        markLine: {
          symbol: 'none',
          data: [
            {
              xAxis: markLine,
              label: { formatter: `衡阳均值 ¥${markLine}`, color: '#f53f3f', fontSize: 11 },
              lineStyle: { color: '#f53f3f', type: 'dashed' }
            }
          ]
        }
      }
    ]
  })
}

// 多运力线雷达对比
const initRadar = () => {
  if (!radarChart.value) return
  radarInstance.value = echarts.init(radarChart.value)
  radarInstance.value.setOption({
    tooltip: {},
    legend: { top: 0 },
    radar: {
      indicator: [
        { name: '成本', max: 8 },
        { name: '时效', max: 100 },
        { name: '覆盖', max: 100 },
        { name: '稳定', max: 100 },
        { name: '灵活', max: 100 }
      ],
      radius: '65%'
    },
    series: [
      {
        type: 'radar',
        data: riderTypes.map((r) => ({
          name: r.name,
          value: [
            +(8 - r.cost).toFixed(1),
            ['专送', '优选', '优远', '众包', '蜂跑'].indexOf(r.name) === 0 ? 92 : 80,
            r.coverage,
            ['专送', '优选'].includes(r.name) ? 90 : 65,
            ['众包', '蜂跑'].includes(r.name) ? 95 : 60
          ],
          itemStyle: { color: r.color },
          areaStyle: { color: r.color + '30' }
        }))
      }
    ]
  })
}

// 运力占比饼图
const initAllocation = () => {
  if (!allocationChart.value) return
  allocationInstance.value = echarts.init(allocationChart.value)
  allocationInstance.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}% ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11
        },
        data: riderTypes.map((r) => ({
          name: r.fullName,
          value: r.coverage,
          itemStyle: { color: r.color }
        }))
      }
    ]
  })
}

// 24h 各运力线接单分布
const initCapacity = () => {
  if (!capacityChart.value) return
  capacityInstance.value = echarts.init(capacityChart.value)
  const hours = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']
  capacityInstance.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    grid: { left: 40, right: 20, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: hours.map((h) => `${h}:00`) },
    yAxis: { type: 'value', name: '订单' },
    series: riderTypes.map((r) => ({
      name: r.name,
      type: 'bar',
      stack: 'total',
      barWidth: '60%',
      itemStyle: { color: r.color },
      data: hours.map((_, i) => {
        const base = i >= 6 && i <= 9 ? 1.0 : 0.3
        return Math.floor((r.coverage / 100) * 1000 * base * (0.8 + Math.random() * 0.4))
      })
    }))
  })
}

const handleResize = () => {
  costCompareInstance.value?.resize()
  radarInstance.value?.resize()
  allocationInstance.value?.resize()
  capacityInstance.value?.resize()
}

onMounted(() => {
  initCostCompare()
  initRadar()
  initAllocation()
  initCapacity()
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="page-container">
    <!-- 头部说明 -->
    <div class="page-header">
      <div>
        <h2 class="page-title">运力线分析与调度优化</h2>
        <p class="page-subtitle">5 种运力线单均成本对比 · 多场景智能调度 · 成本与时效 Pareto 最优</p>
      </div>
      <el-tag size="large" type="warning" effect="dark">
        当前城市：衡阳 · 衡阳综合成本 ¥{{ baselineCost.toFixed(2) }}/单
      </el-tag>
    </div>

    <!-- 运力线选卡 -->
    <div class="rider-tabs">
      <div
        v-for="r in riderTypes"
        :key="r.id"
        class="rider-tab"
        :class="{ active: activeType === r.id }"
        :style="{ '--tab-color': r.color }"
        @click="activeType = r.id"
      >
        <div class="rt-cost">¥{{ r.cost.toFixed(2) }}</div>
        <div class="rt-name">{{ r.name }}</div>
        <div class="rt-meta">{{ r.range }} · 占比 {{ r.coverage }}%</div>
      </div>
    </div>

    <!-- 当前运力线详情 -->
    <div class="rider-detail mt-16">
      <div class="rd-header">
        <div>
          <h3 class="rd-title">{{ currentType.fullName }}</h3>
          <p class="rd-desc">{{ currentType.scenario }}</p>
        </div>
        <div class="rd-cost-card">
          <div class="rdc-label">单均履约成本</div>
          <div class="rdc-value">¥{{ currentType.cost.toFixed(2) }}</div>
          <div class="rdc-vs">
            vs 均值 ¥{{ avgCost }}
            <span :class="currentType.cost < parseFloat(avgCost.toString()) ? 'tag-down' : 'tag-up'">
              {{ currentType.cost < parseFloat(avgCost.toString()) ? '低于' : '高于' }}
              {{ Math.abs(currentType.cost - parseFloat(avgCost.toString())).toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <div class="rd-content">
        <div class="rd-block">
          <div class="rd-block-label">✓ 核心优势</div>
          <div class="tag-list">
            <el-tag v-for="s in currentType.strengths" :key="s" type="success" effect="plain">{{ s }}</el-tag>
          </div>
        </div>
        <div class="rd-block">
          <div class="rd-block-label">⚠ 需关注</div>
          <div class="tag-list">
            <el-tag v-for="w in currentType.weaknesses" :key="w" type="warning" effect="plain">{{ w }}</el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 三个分析图 -->
    <div class="row-grid mt-16">
      <ChartCard title="运力线成本对比" subtitle="红色虚线为衡阳综合均值 ¥4.69/单" height="320px" style="flex: 1.4">
        <div ref="costCompareChart" class="chart-area"></div>
      </ChartCard>

      <ChartCard title="多维度雷达对比" subtitle="成本/时效/覆盖/稳定/灵活" height="320px" style="flex: 1.4">
        <div ref="radarChart" class="chart-area"></div>
      </ChartCard>

      <ChartCard title="当前运力占比" subtitle="各运力线接单分布" height="320px" style="flex: 1">
        <div ref="allocationChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <ChartCard title="24h 多运力协同分布" subtitle="订单堆叠图" height="280px" class="mt-16">
      <div ref="capacityChart" class="chart-area"></div>
    </ChartCard>

    <!-- 智能调度建议 -->
    <div class="suggestion-card mt-16">
      <h3 class="sc-title">🎯 AI 调度建议</h3>
      <div class="sc-grid">
        <div class="suggestion-item">
          <div class="si-icon" style="background: rgba(0, 181, 120, 0.1); color: #00b578;">
            <el-icon><Top /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">3 公里内近单切换蜂跑，单均省 ¥{{ (riderTypes[0].cost - riderTypes[4].cost).toFixed(2) }}</div>
            <div class="si-desc">近单占比约 35%，预计日节省：{{ formatNumber(Math.floor(cityStore.currentCity.dailyOrders * 0.35 * (riderTypes[0].cost - riderTypes[4].cost))) }} 元</div>
          </div>
        </div>
        <div class="suggestion-item">
          <div class="si-icon" style="background: rgba(31, 111, 235, 0.1); color: #1f6feb;">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">优选运力价格动态调整</div>
            <div class="si-desc">高峰时段单价上调 0.5 元，预计召募率提升 18%</div>
          </div>
        </div>
        <div class="suggestion-item">
          <div class="si-icon" style="background: rgba(255, 149, 0, 0.1); color: #ff9500;">
            <el-icon><Sunny /></el-icon>
          </div>
          <div class="si-content">
            <div class="si-title">恶劣天气补贴策略</div>
            <div class="si-desc">基于天气预报提前发布激活预备骑手</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
