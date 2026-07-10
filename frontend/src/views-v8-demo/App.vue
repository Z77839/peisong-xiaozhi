<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getDashboardData } from './api/dashboard';
import { sendChatMessage as requestChatReply } from './api/chat';
import ChatPanel from './components/ChatPanel.vue';
import DashboardChart from './components/DashboardChart.vue';
import LeftSidebar, { type MenuKey } from './components/LeftSidebar.vue';
import RightSidebar, { type RightPanelKey } from './components/RightSidebar.vue';
import {
  historySessions,
  mockDashboardData,
  quickQuestions,
  type ChatMessage,
  type DashboardData,
} from './mock/dashboard';

const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const chartCollapsed = ref(false);
const activeSessionId = ref<string | null>(null);
const activeMenu = ref<MenuKey>('new-chat');
const activeRightPanel = ref<RightPanelKey>('overview');
const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const highlightedRegionId = ref<string | null>(null);
const selectedRegionId = ref<string | null>(null);
const dashboardData = ref<DashboardData>(mockDashboardData);
const dashboardChart = ref<InstanceType<typeof DashboardChart> | null>(null);
let layoutResizeTimer: number | undefined;

const selectedRegion = computed(() =>
  selectedRegionId.value
    ? dashboardData.value.regions.find((item) => item.region_id === selectedRegionId.value) ?? null
    : null,
);
const highRiskRegions = computed(() =>
  dashboardData.value.regions.filter((item) => item.level === 'district' && item.risk_level === 'high'),
);

function resizeChartNow() {
  dashboardChart.value?.resizeChart();
}

async function resizeChartSoon() {
  await nextTick();
  resizeChartNow();
}

function resizeChartAfterLayoutTransition() {
  window.clearTimeout(layoutResizeTimer);
  void resizeChartSoon();
  layoutResizeTimer = window.setTimeout(() => {
    resizeChartNow();
  }, 320);
}

function handleLayoutTransitionEnd(event: TransitionEvent) {
  if (event.propertyName === 'grid-template-columns') {
    resizeChartNow();
  }
}

function startNewChat() {
  activeSessionId.value = null;
  activeMenu.value = 'new-chat';
  messages.value = [];
  highlightedRegionId.value = null;
  selectedRegionId.value = null;
  activeRightPanel.value = 'overview';
  loading.value = false;
  resizeChartSoon();
}

function selectSession(id: string) {
  const session = historySessions.find((item) => item.id === id);
  if (!session) return;
  activeMenu.value = 'history';
  activeSessionId.value = id;
  messages.value = session.messages.map((message) => ({
    ...message,
    sections: message.sections ? { ...message.sections, tools: [...message.sections.tools] } : undefined,
  }));
}

async function sendQuestion(question: string) {
  activeMenu.value = 'operation-qa';
  activeSessionId.value = null;
  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: question,
  });

  loading.value = true;
  try {
    messages.value.push(await requestChatReply(question));
  } finally {
    loading.value = false;
  }
}

function handleMenuClick(menu: MenuKey) {
  activeMenu.value = menu;
  if (menu === 'new-chat') {
    startNewChat();
    return;
  }

  if (menu === 'capacity-prediction') {
    chartCollapsed.value = false;
    resizeChartSoon();
  }

  if (menu === 'history') {
    activeRightPanel.value = 'overview';
  }
}

function handleRightPanelClick(panel: RightPanelKey) {
  activeRightPanel.value = panel;
}

function highlightRegion(regionId: string) {
  highlightedRegionId.value = highlightedRegionId.value === regionId ? null : regionId;
  resizeChartSoon();
}

function handleRegionClick(regionId: string) {
  selectedRegionId.value = regionId;
  highlightedRegionId.value = regionId;
  activeRightPanel.value = 'region-detail';
  activeMenu.value = 'capacity-prediction';
  chartCollapsed.value = false;
  resizeChartSoon();
}

function resetRegion() {
  selectedRegionId.value = null;
  highlightedRegionId.value = null;
  activeRightPanel.value = 'overview';
  resizeChartSoon();
}

function toggleLeft() {
  leftCollapsed.value = !leftCollapsed.value;
}

function toggleRight() {
  rightCollapsed.value = !rightCollapsed.value;
}

function toggleChart() {
  chartCollapsed.value = !chartCollapsed.value;
}

onMounted(async () => {
  dashboardData.value = await getDashboardData();
  resizeChartSoon();
});

onBeforeUnmount(() => {
  window.clearTimeout(layoutResizeTimer);
});

watch([leftCollapsed, rightCollapsed], resizeChartAfterLayoutTransition);
watch([chartCollapsed, activeMenu], resizeChartSoon);
</script>

<template>
  <div
    class="app-layout"
    :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
    @transitionend="handleLayoutTransitionEnd"
  >
    <LeftSidebar
      :collapsed="leftCollapsed"
      :sessions="historySessions"
      :active-session-id="activeSessionId"
      :active-menu="activeMenu"
      @toggle="toggleLeft"
      @menu-click="handleMenuClick"
      @select-session="selectSession"
    />

    <main class="main-content">
      <template v-if="activeMenu === 'new-chat' || activeMenu === 'operation-qa' || activeMenu === 'capacity-prediction'">
        <DashboardChart
          ref="dashboardChart"
          :dashboard="dashboardData"
          :collapsed="chartCollapsed"
          :selected-region-id="selectedRegionId"
          :highlighted-region-id="highlightedRegionId"
          @toggle="toggleChart"
          @region-click="handleRegionClick"
          @reset-region="resetRegion"
        />
        <ChatPanel
          :messages="messages"
          :quick-questions="quickQuestions"
          :loading="loading"
          @send="sendQuestion"
        />
      </template>

      <section v-else-if="activeMenu === 'dispatch-assist'" class="workspace-panel">
        <div class="workspace-heading">
          <span class="eyebrow">派单辅助</span>
          <h2>实时派单建议</h2>
        </div>
        <div class="workspace-grid">
          <article v-for="region in highRiskRegions" :key="region.region_id" class="workspace-card">
            <strong>{{ region.region_name }}</strong>
            <p>预计缺口 {{ region.capacity_gap }} 人，建议优先调入空闲骑手并减少跨区远单。</p>
            <button type="button" class="ghost-button subtle" @click="handleRegionClick(region.region_id)">
              查看地区详情
            </button>
          </article>
        </div>
      </section>

      <section v-else-if="activeMenu === 'cost-analysis'" class="workspace-panel">
        <div class="workspace-heading">
          <span class="eyebrow">成本分析</span>
          <h2>补贴成本测算方案</h2>
        </div>
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>保守方案</strong>
            <p>仅覆盖高风险商圈，预计补贴 ¥18,000，适合成本敏感场景。</p>
          </article>
          <article class="workspace-card recommended">
            <strong>平衡方案</strong>
            <p>覆盖核心缺口区域，预计补贴 ¥32,000，准时率可提升至 94.8%。</p>
          </article>
          <article class="workspace-card">
            <strong>激进方案</strong>
            <p>全域补贴，预计补贴 ¥51,000，履约更稳但边际收益下降。</p>
          </article>
        </div>
      </section>

      <section v-else-if="activeMenu === 'history'" class="workspace-panel history-page">
        <div class="workspace-heading">
          <span class="eyebrow">历史记录</span>
          <h2>历史聊天列表</h2>
        </div>
        <button
          v-for="session in historySessions"
          :key="session.id"
          type="button"
          class="history-page-item"
          :class="{ active: activeSessionId === session.id }"
          @click="selectSession(session.id)"
        >
          <strong>{{ session.title }}</strong>
          <span>{{ session.time }}</span>
        </button>
        <ChatPanel
          v-if="messages.length"
          :messages="messages"
          :quick-questions="quickQuestions"
          :loading="loading"
          @send="sendQuestion"
        />
      </section>

      <section v-else class="workspace-panel">
        <div class="workspace-heading">
          <span class="eyebrow">数据文件</span>
          <h2>数据文件接入</h2>
        </div>
        <div class="workspace-grid">
          <article class="workspace-card">
            <strong>订单数据接口</strong>
            <p>后续可接入 `/api/dashboard`，失败时自动回退当前 mock 数据。</p>
          </article>
          <article class="workspace-card">
            <strong>聊天分析接口</strong>
            <p>后续可接入 `/api/chat`，接口异常不会中断 Demo 演示。</p>
          </article>
          <article v-if="selectedRegion" class="workspace-card recommended">
            <strong>{{ selectedRegion.region_name }}</strong>
            <p>当前已选中地区，可用于后端钻取请求参数。</p>
          </article>
        </div>
      </section>
    </main>

    <RightSidebar
      :collapsed="rightCollapsed"
      :dashboard="dashboardData"
      :active-right-panel="activeRightPanel"
      :highlighted-region-id="highlightedRegionId"
      :selected-region-id="selectedRegionId"
      @toggle="toggleRight"
      @panel-click="handleRightPanelClick"
      @highlight-region="highlightRegion"
      @reset-region="resetRegion"
    />
  </div>
</template>
