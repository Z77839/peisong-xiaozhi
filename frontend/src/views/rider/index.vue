<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import ChartCard from '@/components/ChartCard.vue'

const trendChart = ref<HTMLElement | null>(null)
const distChart = ref<HTMLElement | null>(null)
const trendInstance = shallowRef<echarts.ECharts>()
const distInstance = shallowRef<echarts.ECharts>()

const stats = ref([
  { label: '在岗骑手', value: '462', color: '#1f6feb' },
  { label: '今日接单', value: '8,720', color: '#00b578' },
  { label: '平均送达时长', value: '28', unit: '分钟', color: '#ff9500' },
  { label: '人效（单/日）', value: '18.9', color: '#9b59ff' }
])

const riderList = ref([
  { id: 'R001', name: '张明远', district: '蒸湘区', orders: 32, rating: 4.9, status: 'active' },
  { id: 'R002', name: '李建国', district: '雁峰区', orders: 28, rating: 4.8, status: 'active' },
  { id: 'R003', name: '王勇', district: '石鼓区', orders: 25, rating: 4.7, status: 'active' },
  { id: 'R004', name: '陈思雨', district: '珠晖区', orders: 22, rating: 4.9, status: 'rest' },
  { id: 'R005', name: '刘卫国', district: '蒸湘区', orders: 30, rating: 4.6, status: 'active' },
  { id: 'R006', name: '周强', district: '高新区', orders: 18, rating: 4.5, status: 'offline' }
])

const initTrend = () => {
  if (!trendChart.value) return
  trendInstance.value = echarts.init(trendChart.value)
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  trendInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['在线人数', '订单数'], top: 0 },
    grid: { left: 40, right: 40, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: hours },
    yAxis: [
      { type: 'value', name: '骑手' },
      { type: 'value', name: '订单' }
    ],
    series: [
      {
        name: '在线人数',
        type: 'line',
        smooth: true,
        areaStyle: { color: 'rgba(31, 111, 235, 0.15)' },
        itemStyle: { color: '#1f6feb' },
        data: [80, 60, 40, 30, 25, 40, 100, 200, 320, 380, 420, 400, 360, 380, 420, 460, 480, 462, 380, 280, 200, 150, 110, 90]
      },
      {
        name: '订单数',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 10,
        itemStyle: { color: '#00d4aa', borderRadius: [4, 4, 0, 0] },
        data: [120, 90, 60, 45, 30, 50, 130, 280, 520, 680, 720, 580, 460, 520, 720, 980, 1240, 1180, 760, 540, 380, 280, 200, 160]
      }
    ]
  })
}

const initDist = () => {
  if (!distChart.value) return
  distInstance.value = echarts.init(distChart.value)
  distInstance.value.setOption({
    tooltip: {},
    radar: {
      indicator: [
        { name: '接单率', max: 100 },
        { name: '准时率', max: 100 },
        { name: '好评率', max: 100 },
        { name: '活跃度', max: 100 },
        { name: '规范度', max: 100 }
      ],
      radius: '65%'
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [88, 95, 92, 86, 90],
            name: '本月均值',
            itemStyle: { color: '#1f6feb' },
            areaStyle: { color: 'rgba(31, 111, 235, 0.3)' }
          }
        ]
      }
    ]
  })
}

const onResize = () => {
  trendInstance.value?.resize()
  distInstance.value?.resize()
}

onMounted(() => {
  initTrend()
  initDist()
  window.addEventListener('resize', onResize)
})
</script>

<template>
  <div class="page-container">
    <div class="stat-row">
      <div v-for="s in stats" :key="s.label" class="stat-card" :style="{ borderTop: `3px solid ${s.color}` }">
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-value">{{ s.value }} <span class="unit">{{ s.unit || '' }}</span></div>
      </div>
    </div>

    <div class="row mt-16">
      <ChartCard title="运力实时趋势" subtitle="24 小时在线骑手与订单对比" height="340px" style="flex: 2">
        <div ref="trendChart" class="chart-area"></div>
      </ChartCard>

      <ChartCard title="骑手表现雷达" subtitle="综合评估指标" height="340px" style="flex: 1">
        <div ref="distChart" class="chart-area"></div>
      </ChartCard>
    </div>

    <div class="card mt-16">
      <div class="card-head">
        <span class="card-title">骑手列表</span>
        <div class="head-actions">
          <el-input placeholder="搜索骑手姓名/编号" :prefix-icon="'Search'" size="small" style="width: 200px" />
          <el-button size="small" type="primary">
            <el-icon><Plus /></el-icon> 新增骑手
          </el-button>
        </div>
      </div>
      <el-table :data="riderList" stripe>
        <el-table-column label="编号" prop="id" width="100" />
        <el-table-column label="姓名" prop="name" width="120" />
        <el-table-column label="所属区域" prop="district" width="120" />
        <el-table-column label="今日单数" prop="orders" width="120" align="right" />
        <el-table-column label="评分" width="150">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled allow-half />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : row.status === 'rest' ? 'warning' : 'info'" size="small">
              {{ row.status === 'active' ? '派送中' : row.status === 'rest' ? '休息' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <el-button link type="primary" size="small">详情</el-button>
          <el-button link type="primary" size="small">调度</el-button>
          <el-button link type="danger" size="small">禁用</el-button>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
