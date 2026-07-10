<script setup lang="ts">
import * as echarts from 'echarts';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createKpis, type DashboardData, type RegionData, type RiskLevel } from '../mock/dashboard';
import KpiCards from './KpiCards.vue';

const props = defineProps<{
  dashboard: DashboardData;
  collapsed: boolean;
  selectedRegionId: string | null;
  highlightedRegionId: string | null;
}>();

const emit = defineEmits<{
  toggle: [];
  regionClick: [regionId: string];
  resetRegion: [];
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let retryTimer: number | undefined;

const riskColor: Record<RiskLevel, string> = {
  low: '#25b795',
  medium: '#f3a63b',
  high: '#ef4f63',
};

const selectedRegion = computed(() =>
  props.selectedRegionId
    ? props.dashboard.regions.find((item) => item.region_id === props.selectedRegionId) ?? null
    : null,
);

const childRegions = computed(() =>
  props.selectedRegionId
    ? props.dashboard.regions.filter((item) => item.parent_id === props.selectedRegionId)
    : [],
);

const visibleRegions = computed(() => {
  if (props.selectedRegionId && childRegions.value.length > 0) return childRegions.value;
  if (props.selectedRegionId && selectedRegion.value) return [selectedRegion.value];
  return props.dashboard.regions.filter((item) => item.level === 'district');
});

const regionMap = computed(() => new Map(props.dashboard.regions.map((item) => [item.region_id, item])));
const times = computed(() => Array.from(new Set(props.dashboard.time_series.map((item) => item.time))));
const chartTitle = computed(() =>
  selectedRegion.value && childRegions.value.length > 0
    ? `${selectedRegion.value.region_name}网格运力态势`
    : '城市配送态势图',
);
const kpiItems = computed(() => createKpis(props.dashboard));
const hasChildGrid = computed(() => Boolean(props.selectedRegionId && childRegions.value.length > 0));
const showDetailCard = computed(() => Boolean(props.selectedRegionId && selectedRegion.value && !hasChildGrid.value));

function getBubbleSize(orders: number) {
  return Math.max(12, Math.min(orders / 40, 34));
}

function getRiskText(level: RiskLevel) {
  return level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险';
}

function buildSeriesData() {
  const visibleIds = new Set(visibleRegions.value.map((item) => item.region_id));
  return props.dashboard.time_series
    .filter((item) => visibleIds.has(item.region_id))
    .map((item) => {
      const region = regionMap.value.get(item.region_id);
      const timeIndex = times.value.indexOf(item.time);
      const regionIndex = visibleRegions.value.findIndex((regionItem) => regionItem.region_id === item.region_id);
      return {
        value: [timeIndex + regionIndex * 0.035, regionIndex, item.orders],
        time: item.time,
        region_id: item.region_id,
        region_name: item.region_name,
        orders: item.orders,
        riders_online: item.riders_online,
        riders_idle: region?.riders_idle ?? 0,
        riders_busy: region?.riders_busy ?? 0,
        order_rider_ratio: region?.order_rider_ratio ?? 0,
        capacity_gap: item.capacity_gap,
        risk_level: item.risk_level,
      };
    });
}

function ensureChart() {
  if (!chartEl.value || props.collapsed) return false;
  const { width, height } = chartEl.value.getBoundingClientRect();
  if (width < 20 || height < 20) {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      void nextTick(() => {
        renderChart();
        resizeChart();
      });
    }, 80);
    return false;
  }

  if (!chart) {
    chart = echarts.init(chartEl.value);
    chart.on('click', (params) => {
      const data = params.data as { region_id?: string } | undefined;
      if (data?.region_id) emit('regionClick', data.region_id);
    });
  }
  return true;
}

function renderChart() {
  if (!ensureChart() || !chart) return;
  const seriesData = buildSeriesData();
  const riskSeries = [
    { name: '低风险', level: 'low' as RiskLevel },
    { name: '中风险', level: 'medium' as RiskLevel },
    { name: '高风险', level: 'high' as RiskLevel },
  ];

  chart.setOption(
    {
      animationDuration: 420,
      grid: { top: 46, right: 24, bottom: 34, left: 88, containLabel: true },
      legend: {
        top: 6,
        right: 12,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#63748c', fontSize: 12 },
        data: ['低风险', '中风险', '高风险'],
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const data = params.data;
          return [
            `<strong>${data.region_name}</strong>`,
            `时间：${data.time}`,
            `订单数：${data.orders}`,
            `在线骑手数：${data.riders_online}`,
            `空闲骑手数：${data.riders_idle}`,
            `配送中骑手数：${data.riders_busy}`,
            `订单/骑手比：${data.order_rider_ratio.toFixed(1)}`,
            `预计缺口：${data.capacity_gap}`,
            `风险等级：${getRiskText(data.risk_level)}`,
          ].join('<br/>');
        },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      xAxis: {
        type: 'value',
        min: -0.15,
        max: Math.max(0, times.value.length - 1) + 0.28,
        interval: 1,
        axisLine: { lineStyle: { color: '#c7d5ea' } },
        axisLabel: {
          color: '#62748e',
          formatter: (value: number) => times.value[Math.round(value)] ?? '',
        },
        splitLine: { show: true, lineStyle: { color: '#edf3fb' } },
      },
      yAxis: {
        type: 'category',
        data: visibleRegions.value.map((item) => item.region_name),
        axisLine: { lineStyle: { color: '#c7d5ea' } },
        axisLabel: { color: '#344256', fontWeight: 600 },
        splitLine: { show: true, lineStyle: { color: '#edf3fb' } },
      },
      series: riskSeries.map((risk) => ({
          name: risk.name,
          type: 'scatter',
          data: seriesData.filter((item) => item.risk_level === risk.level),
          symbolSize: (value: number[]) => getBubbleSize(value[2]),
          itemStyle: {
            color: riskColor[risk.level],
            opacity: (params: any) => {
              const regionId = params.data.region_id;
              return !props.highlightedRegionId || props.highlightedRegionId === regionId ? 0.9 : 0.18;
            },
            borderColor: '#ffffff',
            borderWidth: 2,
            shadowBlur: 14,
            shadowColor: 'rgba(58, 93, 163, 0.2)',
          },
          emphasis: {
            scale: 1.14,
            itemStyle: { opacity: 1, borderWidth: 3 },
          },
        })),
    },
    true,
  );
}

function resizeChart() {
  if (props.collapsed) return;
  chart?.resize();
}

defineExpose({ resizeChart, renderChart });

onMounted(async () => {
  await nextTick();
  renderChart();

  if (chartEl.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeChart();
    });
    resizeObserver.observe(chartEl.value);
  }
});

onBeforeUnmount(() => {
  window.clearTimeout(retryTimer);
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = null;
});

watch(
  () => [props.dashboard, props.selectedRegionId, props.highlightedRegionId, props.collapsed],
  async () => {
    await nextTick();
    renderChart();
    resizeChart();
  },
  { deep: true },
);
</script>

<template>
  <section class="dashboard-panel" :class="{ collapsed }">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">实时运营态势</span>
        <h2>{{ chartTitle }}</h2>
      </div>
      <div class="panel-actions">
        <button
          v-if="selectedRegionId"
          class="ghost-button subtle"
          type="button"
          @click="emit('resetRegion')"
        >
          返回城市总览
        </button>
        <button class="ghost-button" type="button" @click="emit('toggle')">
          {{ collapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="dashboard-body">
      <KpiCards :items="kpiItems" />
      <div v-if="showDetailCard && selectedRegion" class="region-detail-card">
        <strong>{{ selectedRegion.region_name }}详细数据</strong>
        <div>
          <span>订单数 {{ selectedRegion.orders }}</span>
          <span>在线骑手 {{ selectedRegion.riders_online }}</span>
          <span>空闲骑手 {{ selectedRegion.riders_idle }}</span>
          <span>配送中 {{ selectedRegion.riders_busy }}</span>
          <span>订单/骑手比 {{ selectedRegion.order_rider_ratio.toFixed(1) }}</span>
          <span>预计缺口 {{ selectedRegion.capacity_gap }}</span>
          <span>风险等级 {{ getRiskText(selectedRegion.risk_level) }}</span>
          <span v-if="selectedRegion.avg_delivery_time">平均配送 {{ selectedRegion.avg_delivery_time }} 分钟</span>
          <span v-if="selectedRegion.on_time_rate">准时率 {{ selectedRegion.on_time_rate }}%</span>
        </div>
      </div>
      <div class="chart-wrap">
        <div ref="chartEl" class="bubble-chart"></div>
      </div>
    </div>
  </section>
</template>
