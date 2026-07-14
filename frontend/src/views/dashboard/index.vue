<script setup lang="ts">
import KnowledgeHints from '@/components/KnowledgeHints.vue'
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCityStore } from '@/store/city'
import { formatNumber, relativeTime } from '@/utils/format'

const cityStore = useCityStore()
const router = useRouter()

// 6 大核心能力
const CAPABILITIES_META: any[] = [
  { key: 'predict', name: '运力预判', icon: '🔮', color: '#1f6feb', desc: 'AI 模型预判各区域运力缺口', valueLabel: '预测准确率' },
  { key: 'dispatch', name: '调度成本', icon: '⚖️', color: '#722ed1', desc: '5 运力线智能匹配 + 成本 Pareto', valueLabel: '最低单价' },
  { key: 'order', name: '智能派单', icon: '🚴', color: '#13c2c2', desc: '距离/负载/准时率综合评分 TOP 3', valueLabel: '平均耗时' },
  { key: 'recommend', name: '辅助推荐', icon: '✨', color: '#fa8c16', desc: '增配/补贴/调拨一键建议', valueLabel: '实时建议' },
  { key: 'alert', name: '主动预警', icon: '🚨', color: '#f5222d', desc: '7×24 持续监控 · 提前 90 分钟', valueLabel: '主动识别' },
  { key: 'decision', name: '决策报告', icon: '📊', color: '#52c41a', desc: '8 Agent 协同 · 一键生成报告', valueLabel: 'Agent 协同' }
]
const capabilities = ref<any[]>(CAPABILITIES_META.map(m => ({ ...m, value: '--' })))

// 智能体状态（从后端实时加载）
const agents = ref<Array<{ name: string; status: string; calls: number; avgMs: number }>>([])
const agentLoadHint = ref('点击「决策中心」运行决策后会自动记录')

// 实时 KPI（从后端加载）
const liveKpis = ref<any[]>([
  { label: '当前订单', value: '--', unit: '单', trend: '加载中', icon: '📦', color: '#1f6feb' },
  { label: '在线骑手', value: '--', unit: '人', trend: '加载中', icon: '🚴', color: '#13c2c2' },
  { label: '预计运力缺口', value: '--', unit: '人', trend: '加载中', icon: '📉', color: '#f5222d' },
  { label: '异常区域', value: '--', unit: '个', trend: '加载中', icon: '🚨', color: '#fa541c' }
])

// 从后端加载 KPI
async function fetchKpis() {
  try {
    const r: any = await request({ url: '/dashboard' })
    const d = r.data || r  // 兼容不同返回格式
    const k = d.kpis || {}
    const rs = d.rider_stats || {}
    liveKpis.value = [
      { label: '当前订单', value: (k.total_orders || 0).toLocaleString(), unit: '单', trend: k.orders_trend || '+12.3%', icon: '📦', color: '#1f6feb' },
      { label: '骑手总数', value: (k.online_riders || 0).toLocaleString(), unit: '人', trend: `活跃 ${(k.riders_active || 0).toLocaleString()} / 衡阳 ${k.riders_hengyang || 0}`, icon: '🚴', color: '#13c2c2' },
      { label: '预计运力缺口', value: (k.capacity_gap || 0).toLocaleString(), unit: '人', trend: '2 小时峰值', icon: '📉', color: '#f5222d' },
      { label: '异常区域', value: String(k.risk_regions || 0), unit: '个', trend: '高风险', icon: '🚨', color: '#fa541c' }
    ]
    // 同步加载 Agent 真实调用统计
    if (d.agent_calls && Array.isArray(d.agent_calls) && d.agent_calls.length > 0) {
      agents.value = d.agent_calls.map((a: any) => ({
        name: a.agent_name,
        status: 'active',
        calls: Number(a.calls) || 0,
        avgMs: Number(a.avg_ms) || 0
      }))
      agentLoadHint.value = ''
    } else {
      agents.value = []
      agentLoadHint.value = '运行决策后自动记录 Agent 调用情况'
    }
  } catch (e) {
    console.warn('Dashboard KPI 加载失败，使用 fallback', e)
  }
}

// 智能体感知
const context = ref<any>(null)
async function fetchContext() {
  try {
    const r: any = await request({ url: `/context?cityId=${cityStore.currentCityId}` })
    context.value = r.data
  } catch {}
}

// 预警数 / 派单数
const alertSummary = ref<any>(null)
async function fetchAlertSummary() {
  try {
    const r: any = await request({ url: `/alert?cityId=${cityStore.currentCityId}` })
    alertSummary.value = r.data
  } catch {}
}

const dispatchSummary = ref<any>(null)
async function fetchDispatchSummary() {
  try {
    const r: any = await request({ url: `/dispatch?cityId=${cityStore.currentCityId}` })
    dispatchSummary.value = r.data
  } catch {}
}

let timer: number | null = null
onMounted(() => {
  void fetchKpis()
  void fetchContext()
  void fetchAlertSummary()
  void fetchDispatchSummary()
  timer = window.setInterval(() => {
    void fetchKpis()
    void fetchContext()
    void fetchAlertSummary()
    void fetchDispatchSummary()
  }, 15000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function goPage(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="dash-page">
    <!-- 知识库提示 -->
    <KnowledgeHints />
    <!-- ========== Hero: 配送小智 形象 ========== -->
    <div class="hero">
      <div class="hero-bg">
        <div class="hero-bg-text">SMART<br>DISPATCH</div>
      </div>
      <div class="hero-inner">
        <div class="hero-row">
          <!-- 左：形象 -->
          <div class="hero-left">
            <div class="hero-avatar">
              <div class="ha-core">🤖</div>
              <div class="ha-ring r1"></div>
              <div class="ha-ring r2"></div>
              <div class="ha-ring r3"></div>
              <div class="ha-pulse"></div>
            </div>
            <div class="hero-info">
              <div class="hero-tag">⚡ 本地生活服务电商 · 配送运营决策智能体</div>
              <h1 class="hero-title">
                <span class="ht-prefix">@</span>配送小智
              </h1>
              <p class="hero-sub">从「被动响应式调度」升级为「主动预防式决策」</p>
              <div class="hero-meta">
                <span class="meta-item">
                  <i class="m-ico">🛡️</i>
                  <span class="m-label">7×24 持续监控</span>
                </span>
                <span class="meta-item">
                  <i class="m-ico">🤝</i>
                  <span class="m-label">8 Agent 协同</span>
                </span>
                <span class="meta-item">
                  <i class="m-ico">🎯</i>
                  <span class="m-label">提前 90 分钟预警</span>
                </span>
              </div>
              <div class="hero-actions">
                <button class="action-primary" @click="goPage('/decision')">
                  <span>🚀</span> 与小智对话
                </button>
                <button class="action-secondary" @click="goPage('/alert')">
                  <span>🚨</span> 查看预警
                  <span v-if="alertSummary" class="action-badge">{{ alertSummary.stats.total }}</span>
                </button>
                <button class="action-secondary" @click="goPage('/dispatch')">
                  <span>🚴</span> 智能派单
                  <span v-if="dispatchSummary" class="action-badge">{{ dispatchSummary.stats.totalOrders }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 右：智能体感知 -->
          <div v-if="context" class="hero-right">
            <div class="hr-title">
              <span class="hr-ico">👁</span>
              <span>智能体实时感知</span>
              <span class="hr-sub">无需用户输入，自动注入上下文</span>
            </div>
            <div class="hr-grid">
              <div class="hr-cell">
                <span class="hr-ico">⏰</span>
                <span class="hr-label">时间</span>
                <span class="hr-value">{{ context.datetime }}</span>
              </div>
              <div class="hr-cell">
                <span class="hr-ico">{{ context.weather?.icon }}</span>
                <span class="hr-label">天气</span>
                <span class="hr-value">{{ context.weather?.label }} {{ context.weather?.temp }}°C</span>
              </div>
              <div class="hr-cell">
                <span class="hr-ico">{{ context.timeSlot?.icon }}</span>
                <span class="hr-label">时段</span>
                <span class="hr-value">{{ context.timeSlot?.name }}</span>
              </div>
              <div class="hr-cell">
                <span class="hr-ico">📍</span>
                <span class="hr-label">城市</span>
                <span class="hr-value">{{ context.city?.name }}</span>
              </div>
              <div class="hr-cell">
                <span class="hr-ico">📡</span>
                <span class="hr-label">数据源</span>
                <span class="hr-value" :class="{ live: context.weather?.source === 'qweather' }">
                  {{ context.weather?.source === 'qweather' ? '和风实时' : 'Mock' }}
                </span>
              </div>
              <div class="hr-cell highlight">
                <span class="hr-ico">🤖</span>
                <span class="hr-label">协同 Agent</span>
                <span class="hr-value">8 个在线</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 6 大核心能力 ========== -->
    <div class="capabilities">
      <div class="section-head">
        <h2>🎯 配送小智 · 6 大核心能力</h2>
        <span class="sh-sub">覆盖运力预判 → 智能派单 → 主动预警全链路</span>
      </div>
      <div class="cap-grid">
        <div
          v-for="cap in capabilities"
          :key="cap.key"
          class="cap-card"
          :style="{ '--cap-color': cap.color }"
          @click="goPage(cap.key === 'alert' ? '/alert' : cap.key === 'dispatch' || cap.key === 'order' ? '/dispatch' : cap.key === 'decision' ? '/decision' : '/')"
        >
          <div class="cap-ico">{{ cap.icon }}</div>
          <div class="cap-name">{{ cap.name }}</div>
          <div class="cap-desc">{{ cap.desc }}</div>
          <div class="cap-stat">
            <span class="cs-val">{{ cap.value }}</span>
            <span class="cs-label">{{ cap.valueLabel }}</span>
          </div>
          <div class="cap-source">数据源: {{ cap.source || '计算中' }}</div>
          <div class="cap-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- ========== 实时 KPI + 预警概览 ========== -->
    <div class="live-row">
      <div class="live-kpis">
        <div class="section-head">
          <h2>📊 实时 KPI</h2>
          <span class="sh-sub">每 15 秒自动刷新</span>
        </div>
        <div class="kpi-grid">
          <div v-for="kpi in liveKpis" :key="kpi.label" class="kpi-card" :style="{ '--kpi-color': kpi.color }">
            <div class="kc-ico">{{ kpi.icon }}</div>
            <div class="kc-info">
              <div class="kc-label">{{ kpi.label }}</div>
              <div class="kc-value">
                <span class="kc-num">{{ kpi.value }}</span>
                <span class="kc-unit">{{ kpi.unit }}</span>
              </div>
              <div class="kc-trend">{{ kpi.trend }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="alert-overview">
        <div class="section-head">
          <h2>🚨 预警概览</h2>
          <span class="sh-sub">主动预防式</span>
        </div>
        <div v-if="alertSummary" class="ao-body">
          <div class="ao-stats">
            <div class="ao-stat critical">
              <div class="aos-num">{{ alertSummary.stats.critical }}</div>
              <div class="aos-label">紧急</div>
            </div>
            <div class="ao-stat high">
              <div class="aos-num">{{ alertSummary.stats.high }}</div>
              <div class="aos-label">高危</div>
            </div>
            <div class="ao-stat medium">
              <div class="aos-num">{{ alertSummary.stats.medium }}</div>
              <div class="aos-label">中等</div>
            </div>
            <div class="ao-stat gap">
              <div class="aos-num">{{ (alertSummary.stats.predictedGap / 1000).toFixed(1) }}k</div>
              <div class="aos-label">缺口(人)</div>
            </div>
          </div>
          <div class="ao-top-list">
            <div class="ao-top-title">⚡ 优先级 TOP 3</div>
            <div
              v-for="(a, idx) in alertSummary.alerts.slice(0, 3)"
              :key="a.id"
              class="ao-top-item"
              :class="`level-${a.level}`"
            >
              <span class="aoti-rank">{{ idx + 1 }}</span>
              <span class="aoti-title">{{ a.title }}</span>
              <span class="aoti-conf">{{ a.confidence }}%</span>
            </div>
          </div>
          <button class="ao-more" @click="goPage('/alert')">查看全部 →</button>
        </div>
      </div>
    </div>

    <!-- ========== Agent 协同状态 ========== -->
    <div class="agents-section">
      <div class="section-head">
        <h2>🤖 Agent 协同状态</h2>
        <span class="sh-sub">8 Agent 实时在线 · 累计调用 {{ agents.reduce((s, a) => s + a.calls, 0).toLocaleString() }} 次{{ agentLoadHint ? ' · ' + agentLoadHint : '' }}</span>
      </div>
      <div class="agent-list">
        <div v-for="agent in agents" :key="agent.name" class="agent-row">
          <span class="ar-status-dot"></span>
          <span class="ar-name">{{ agent.name }}</span>
          <span class="ar-calls">调用 {{ agent.calls.toLocaleString() }} 次</span>
          <span class="ar-avg">平均 {{ agent.avgMs }}ms</span>
          <span class="ar-bar">
            <span class="ar-bar-fill" :style="{ width: `${Math.min(agent.calls / 25, 100)}%` }"></span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.dash-page { padding: 24px; }

/* Hero */
.hero {
  position: relative;
  border-radius: 16px;
  background: linear-gradient(135deg, #1d2129 0%, #1f6feb 60%, #722ed1 100%);
  color: #fff;
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: 0 10px 30px rgba(31, 111, 235, 0.25);
}
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.hero-bg-text {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 140px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -4px;
  background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: right;
  user-select: none;
}
.hero-inner { position: relative; padding: 32px; }
.hero-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 32px;
  align-items: center;
}
.hero-left { display: flex; align-items: center; gap: 24px; }
.hero-avatar { position: relative; width: 130px; height: 130px; flex-shrink: 0; }
.ha-core {
  position: absolute;
  inset: 30px;
  background: linear-gradient(135deg, #4080ff, #722ed1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  z-index: 2;
  box-shadow: 0 8px 30px rgba(64, 128, 255, 0.6);
}
.ha-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  &.r1 { inset: 10px; border-color: rgba(255, 255, 255, 0.2); animation: ring-spin 8s linear infinite; }
  &.r2 { inset: 20px; border-color: rgba(255, 255, 255, 0.15); animation: ring-spin 12s linear infinite reverse; border-style: dashed; }
  &.r3 { inset: 0; border-color: rgba(255, 255, 255, 0.1); animation: ring-spin 16s linear infinite; }
}
@keyframes ring-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ha-pulse {
  position: absolute;
  inset: 25px;
  border-radius: 50%;
  background: rgba(64, 128, 255, 0.3);
  animation: pulse-out 2s infinite;
  z-index: 1;
}
@keyframes pulse-out {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(1.4); opacity: 0; }
}
.hero-info { flex: 1; }
.hero-tag {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  font-size: 11px;
  letter-spacing: 1px;
  margin-bottom: 12px;
  backdrop-filter: blur(10px);
}
.hero-title {
  font-size: 42px;
  font-weight: 800;
  margin: 0 0 6px;
  line-height: 1.1;
  .ht-prefix {
    background: linear-gradient(135deg, #ffd591, #fa541c);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-right: 4px;
  }
}
.hero-sub { font-size: 14px; margin: 0 0 16px; opacity: 0.85; }
.hero-meta { display: flex; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.meta-item { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; opacity: 0.85; }
.m-ico { font-size: 14px; }
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.action-primary, .action-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}
.action-primary {
  background: linear-gradient(135deg, #fa8c16, #f5222d);
  color: #fff;
  &:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(245, 34, 45, 0.5); }
}
.action-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  &:hover { background: rgba(255, 255, 255, 0.25); }
}
.action-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f5222d;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}
.hero-right {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 18px;
}
.hr-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
.hr-ico { font-size: 16px; }
.hr-sub { font-size: 11px; opacity: 0.6; font-weight: 400; margin-left: auto; }
.hr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.hr-cell {
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  &.highlight {
    background: linear-gradient(135deg, rgba(250, 140, 22, 0.3), rgba(245, 34, 45, 0.3));
    border: 1px solid rgba(250, 140, 22, 0.4);
  }
}
.hr-label { font-size: 10px; opacity: 0.7; }
.hr-value { font-size: 13px; font-weight: 700; &.live { color: #ffd591; } }

/* Section Head */
.section-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; h2 { font-size: 17px; font-weight: 700; color: $text-primary; margin: 0; } .sh-sub { font-size: 12px; color: $text-secondary; } }

/* Capabilities */
.capabilities { margin-bottom: 24px; }
.cap-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.cap-card {
  position: relative;
  padding: 18px;
  background: #fff;
  border: 1px solid $border-light;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--cap-color);
    .cap-arrow { transform: translateX(4px); opacity: 1; }
  }
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; right: 0;
    height: 3px;
    background: var(--cap-color);
  }
}
.cap-ico { font-size: 28px; margin-bottom: 8px; }
.cap-name { font-size: 14px; font-weight: 700; color: var(--cap-color); margin-bottom: 4px; }
.cap-desc { font-size: 11px; color: $text-secondary; line-height: 1.5; margin-bottom: 12px; min-height: 33px; }
.cap-stat { display: flex; flex-direction: column; gap: 2px; padding-top: 10px; border-top: 1px dashed $border-light; }
.cs-val { font-size: 18px; font-weight: 800; color: $text-primary; line-height: 1; }
.cs-label { font-size: 10px; color: $text-placeholder; }
.cap-arrow {
  position: absolute;
  top: 14px;
  right: 12px;
  font-size: 16px;
  color: var(--cap-color);
  opacity: 0.3;
  transition: all 0.2s;
}

/* Live Row */
.live-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 24px; }
.live-kpis { background: #fff; border: 1px solid $border-light; border-radius: 12px; padding: 16px; }
.kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(135deg, #fafbff, #fff);
  border: 1px solid $border-light;
  border-radius: 10px;
  transition: all 0.15s;
  &:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
}
.kc-ico {
  font-size: 32px;
  width: 50px;
  height: 50px;
  background: rgba(31, 111, 235, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kc-info { flex: 1; min-width: 0; }
.kc-label { font-size: 12px; color: $text-secondary; margin-bottom: 4px; }
.kc-value { display: flex; align-items: baseline; gap: 4px; }
.kc-num { font-size: 22px; font-weight: 800; color: var(--kpi-color); line-height: 1; }
.kc-unit { font-size: 12px; color: $text-secondary; }
.kc-trend { font-size: 11px; color: $text-placeholder; margin-top: 4px; }

/* Alert Overview */
.alert-overview { background: #fff; border: 1px solid $border-light; border-radius: 12px; padding: 16px; }
.ao-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.ao-stat {
  text-align: center;
  padding: 10px 6px;
  border-radius: 8px;
  &.critical { background: linear-gradient(135deg, #fff1f0, #fff); border: 1px solid #ffccc7; }
  &.high { background: linear-gradient(135deg, #fff7e6, #fff); border: 1px solid #ffd591; }
  &.medium { background: linear-gradient(135deg, #e6f7ff, #fff); border: 1px solid #91d5ff; }
  &.gap { background: linear-gradient(135deg, #f9f0ff, #fff); border: 1px solid #d3adf7; }
}
.aos-num { font-size: 22px; font-weight: 800; line-height: 1; }
.ao-stat.critical .aos-num { color: #f5222d; }
.ao-stat.high .aos-num { color: #fa541c; }
.ao-stat.medium .aos-num { color: #1890ff; }
.ao-stat.gap .aos-num { color: #722ed1; }
.aos-label { font-size: 10px; color: $text-secondary; margin-top: 4px; }

.ao-top-title { font-size: 12px; font-weight: 600; color: $text-primary; margin-bottom: 8px; }
.ao-top-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: $bg-hover;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}
.aoti-rank {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.ao-top-item.level-critical .aoti-rank { background: #f5222d; }
.ao-top-item.level-high .aoti-rank { background: #fa541c; }
.ao-top-item.level-medium .aoti-rank { background: #fa8c16; }
.aoti-title { flex: 1; color: $text-regular; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aoti-conf { color: $primary; font-weight: 700; font-size: 11px; }
.ao-more {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  background: $bg-hover;
  border: 1px dashed $border-light;
  border-radius: 6px;
  color: $primary;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: $primary-light; }
}

/* Agents */
.agents-section { background: #fff; border: 1px solid $border-light; border-radius: 12px; padding: 16px; }
.agent-list { display: flex; flex-direction: column; gap: 8px; }
.agent-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: $bg-hover;
  border-radius: 8px;
  transition: all 0.15s;
  &:hover { background: $primary-light; }
}
.ar-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $success;
  box-shadow: 0 0 0 4px rgba(82, 196, 26, 0.15);
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.ar-name { font-size: 13px; font-weight: 600; color: $text-primary; min-width: 140px; }
.ar-calls { font-size: 11px; color: $primary; font-weight: 600; min-width: 90px; }
.ar-avg { font-size: 11px; color: $text-secondary; min-width: 80px; }
.ar-bar { flex: 1; height: 6px; background: #fff; border-radius: 3px; overflow: hidden; }
.ar-bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #1f6feb, #722ed1);
  border-radius: 3px;
  transition: width 0.5s;
}

@media (max-width: 1280px) {
  .cap-grid { grid-template-columns: repeat(3, 1fr); }
  .hero-row { grid-template-columns: 1fr; }
  .live-row { grid-template-columns: 1fr; }
}
</style>
