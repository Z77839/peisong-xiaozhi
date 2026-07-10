<script setup lang="ts">
import { computed } from 'vue';
import {
  costPlans,
  gapForecast,
  type DashboardData,
  type RegionData,
  type RiskLevel,
} from '../mock/dashboard';
import KpiCards from './KpiCards.vue';
import { createKpis } from '../mock/dashboard';

export type RightPanelKey =
  | 'overview'
  | 'orders'
  | 'riders'
  | 'capacity-gap'
  | 'dispatch'
  | 'cost'
  | 'analysis'
  | 'alerts'
  | 'region-detail';

const props = defineProps<{
  collapsed: boolean;
  dashboard: DashboardData;
  activeRightPanel: RightPanelKey;
  highlightedRegionId: string | null;
  selectedRegionId: string | null;
}>();

const emit = defineEmits<{
  toggle: [];
  panelClick: [panel: RightPanelKey];
  highlightRegion: [regionId: string];
  resetRegion: [];
}>();

const menus: Array<{ key: RightPanelKey; label: string }> = [
  { key: 'overview', label: '实时概览' },
  { key: 'orders', label: '地区订单数' },
  { key: 'riders', label: '地区骑手分布' },
  { key: 'capacity-gap', label: '运力缺口预测' },
  { key: 'dispatch', label: '调度建议' },
  { key: 'cost', label: '成本测算' },
  { key: 'analysis', label: '智能分析图表' },
  { key: 'alerts', label: '异常预警' },
];

const districtRegions = computed(() => props.dashboard.regions.filter((item) => item.level === 'district'));
const selectedRegion = computed(() =>
  props.selectedRegionId
    ? props.dashboard.regions.find((item) => item.region_id === props.selectedRegionId) ?? null
    : null,
);
const childRegions = computed(() =>
  props.selectedRegionId ? props.dashboard.regions.filter((item) => item.parent_id === props.selectedRegionId) : [],
);
const kpis = computed(() => createKpis(props.dashboard));
const orderRank = computed(() => [...districtRegions.value].sort((a, b) => b.orders - a.orders).slice(0, 5));
const riderDistribution = computed(() => [...districtRegions.value].slice(0, 5));
const ratioRank = computed(() =>
  [...districtRegions.value].sort((a, b) => b.order_rider_ratio - a.order_rider_ratio).slice(0, 5),
);
const abnormalAlerts = computed(() => districtRegions.value.filter((item) => item.risk_level !== 'low'));
const maxRatio = computed(() => Math.max(...ratioRank.value.map((item) => item.order_rider_ratio), 1));

const recommendationItems = computed(() => {
  const highRisk = districtRegions.value.filter((item) => item.risk_level === 'high').slice(0, 3);
  return highRisk.map(
    (item) =>
      `${item.region_name}：预计缺口 ${item.capacity_gap} 名骑手，建议优先补充核心商圈运力并控制跨区远单。`,
  );
});

function riskText(level: RiskLevel) {
  return level === 'high' ? '高' : level === 'medium' ? '中' : '低';
}

function scoreFor(region: RegionData) {
  return region.risk_level === 'high' ? 88 + Math.round(region.capacity_gap / 20) : 72 + Math.round(region.capacity_gap / 10);
}
</script>

<template>
  <aside class="right-sidebar" :class="{ collapsed }">
    <div class="right-top">
      <button class="icon-button" type="button" title="展开/收起" @click="emit('toggle')">
        {{ collapsed ? '☰' : '›' }}
      </button>
      <strong class="right-panel-content">运营信息栏</strong>
    </div>

    <div class="right-panel-content">
      <nav class="right-menu">
        <button
          v-for="menu in menus"
          :key="menu.key"
          type="button"
          :class="{ active: activeRightPanel === menu.key }"
          @click="emit('panelClick', menu.key)"
        >
          {{ menu.label }}
        </button>
      </nav>

      <div class="right-content">
        <div v-if="activeRightPanel === 'region-detail' && selectedRegion" class="region-sidebar-detail">
          <div class="detail-head">
            <strong>{{ selectedRegion.region_name }}</strong>
            <button type="button" class="link-button" @click="emit('resetRegion')">返回总览</button>
          </div>
          <div class="detail-grid">
            <span>订单数 <b>{{ selectedRegion.orders }}</b></span>
            <span>在线骑手 <b>{{ selectedRegion.riders_online }}</b></span>
            <span>空闲骑手 <b>{{ selectedRegion.riders_idle }}</b></span>
            <span>配送中 <b>{{ selectedRegion.riders_busy }}</b></span>
            <span>订单/骑手比 <b>{{ selectedRegion.order_rider_ratio.toFixed(1) }}</b></span>
            <span>预计缺口 <b>{{ selectedRegion.capacity_gap }}</b></span>
          </div>
          <div v-if="childRegions.length" class="rank-list compact-list">
            <button
              v-for="item in childRegions"
              :key="item.region_id"
              type="button"
              :class="{ selected: highlightedRegionId === item.region_id }"
              @click="emit('highlightRegion', item.region_id)"
            >
              <span>{{ item.region_name }}</span>
              <strong>{{ item.orders }}</strong>
              <small>缺口 {{ item.capacity_gap }} · {{ riskText(item.risk_level) }}风险</small>
            </button>
          </div>
        </div>

        <KpiCards v-else-if="activeRightPanel === 'overview'" :items="kpis" compact />

        <div v-else-if="activeRightPanel === 'orders'" class="rank-list">
          <button
            v-for="item in orderRank"
            :key="item.region_id"
            type="button"
            :class="{ selected: highlightedRegionId === item.region_id }"
            @click="emit('highlightRegion', item.region_id)"
          >
            <span>{{ item.region_name }}</span>
            <strong>{{ item.orders }}</strong>
            <small>订单/骑手 {{ item.order_rider_ratio.toFixed(1) }} · {{ riskText(item.risk_level) }}风险</small>
          </button>
        </div>

        <div v-else-if="activeRightPanel === 'riders'" class="metric-stack">
          <button
            v-for="item in riderDistribution"
            :key="item.region_id"
            type="button"
            class="distribution-card"
            @click="emit('highlightRegion', item.region_id)"
          >
            <strong>{{ item.region_name }}</strong>
            <div>
              <span>在线 {{ item.riders_online }}</span>
              <span>空闲 {{ item.riders_idle }}</span>
              <span>配送中 {{ item.riders_busy }}</span>
            </div>
          </button>
        </div>

        <div v-else-if="activeRightPanel === 'capacity-gap'" class="forecast-list">
          <div v-for="item in gapForecast" :key="item.hour">
            <span>{{ item.hour }}</span>
            <strong>{{ item.gap }} 人</strong>
            <small>{{ item.level }}</small>
          </div>
        </div>

        <div v-else-if="activeRightPanel === 'dispatch'" class="advice-list">
          <article v-for="item in recommendationItems" :key="item">
            {{ item }}
          </article>
        </div>

        <div v-else-if="activeRightPanel === 'cost'" class="plan-list">
          <article v-for="plan in costPlans" :key="plan.name">
            <div>
              <strong>{{ plan.name }}</strong>
              <span>{{ plan.note }}</span>
            </div>
            <p>{{ plan.subsidy }} · 准时率 {{ plan.onTime }}</p>
          </article>
        </div>

        <div v-else-if="activeRightPanel === 'analysis'" class="mini-chart-list">
          <h4>订单/骑手比排行榜</h4>
          <div v-for="item in ratioRank" :key="item.region_id" class="bar-row">
            <span>{{ item.region_name }}</span>
            <div><i :style="{ width: `${(item.order_rider_ratio / maxRatio) * 100}%` }"></i></div>
            <strong>{{ item.order_rider_ratio.toFixed(1) }}</strong>
          </div>
          <h4>成本-准时率权衡</h4>
          <div class="tradeoff">
            <span>低成本</span>
            <b></b>
            <span>高准时率</span>
          </div>
        </div>

        <div v-else class="alert-list">
          <button
            v-for="alert in abnormalAlerts"
            :key="alert.region_id"
            type="button"
            @click="emit('highlightRegion', alert.region_id)"
          >
            <strong>{{ alert.region_name }}</strong>
            <span>{{ alert.risk_level === 'high' ? '订单密度升高，空闲骑手不足' : '订单/骑手比接近预警线' }}</span>
            <em>风险 {{ scoreFor(alert) }}</em>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
