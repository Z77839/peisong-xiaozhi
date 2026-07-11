<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCityStore } from '@/store/city'
import { API_BASE_URL } from '@/utils/apiBase'

interface Alert {
  id: string
  level: 'critical' | 'high' | 'medium' | 'low'
  type: string
  typeLabel: string
  title: string
  desc: string
  cityId: string
  cityName: string
  metrics: Record<string, number>
  suggestedActions: { id: string; label: string; cost: number; estimatedGap: number }[]
  agent: string
  confidence: number
  triggerTime: string
  status: string
}

interface AlertContext {
  datetime: string
  city: { id: string; name: string }
  weather: { icon: string; label: string; temp: number; source: string }
  timeSlot: { name: string; icon: string }
}

const cityStore = useCityStore()
const alerts = ref<Alert[]>([])
const alertStats = ref<any>({})
const context = ref<AlertContext | null>(null)
const loading = ref(false)
const filterLevel = ref<string>('all')
const selectedAlert = ref<Alert | null>(null)
let refreshTimer: number | null = null

const levelMap: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: '紧急', color: '#fff', bg: 'linear-gradient(135deg, #f5222d, #ff4d4f)' },
  high: { label: '高危', color: '#fff', bg: 'linear-gradient(135deg, #fa541c, #ff7a45)' },
  medium: { label: '中等', color: '#fff', bg: 'linear-gradient(135deg, #fa8c16, #ffa940)' },
  low: { label: '提示', color: '#fff', bg: 'linear-gradient(135deg, #1890ff, #40a9ff)' }
}

const filteredAlerts = computed(() => {
  if (filterLevel.value === 'all') return alerts.value
  return alerts.value.filter((a) => a.level === filterLevel.value)
})

async function fetchAlerts() {
  loading.value = true
  try {
    const r: any = await fetch(`/api/alert?cityId=${cityStore.currentCityId}`).then((r) => r.json())
    alerts.value = r.data.alerts
    alertStats.value = r.data.stats
    context.value = r.data.context
  } finally {
    loading.value = false
  }
}

async function executeAction(alert: Alert, action: any) {
  try {
    await ElMessageBox.confirm(
      `确认执行「${action.label}」？预计可补 ${action.estimatedGap} 人缺口，预算 ¥${action.cost.toLocaleString()}`,
      '配送小智 · 待你确认',
      { confirmButtonText: '执行', cancelButtonText: '取消', type: 'warning' }
    )
    const r: any = await fetch(`${API_BASE_URL}/alert/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: alert.id, actionId: action.id, cityId: alert.cityId })
    }).then((r) => r.json())
    ElMessage.success(`配送小智：${r.data.message}（${r.data.eta}）`)
    // 标记已执行
    alert.status = 'executing'
    void fetchAlerts()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('执行失败')
  }
}

async function ackAlert(alert: Alert) {
  await fetch(`/api/alert/ack/${alert.id}`, { method: 'POST' })
  alert.status = 'acked'
  ElMessage.success('已确认')
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    currentGap: '当前缺口',
    predictedGap: '预测缺口',
    ridersOnline: '在线骑手',
    orderRiderRatio: '订单/骑手比',
    idleRate: '空闲率',
    ridersIdle: '空闲骑手',
    orderIncrease: '订单增长',
    extraOrders: '增量订单',
    estimatedIncrease: '预计增长',
    daysToHoliday: '距假期'
  }
  return labels[key] || key
}

function formatMetric(key: string, val: any): string {
  if (typeof val !== 'number') return String(val)
  if (key.includes('Rate') || key.includes('Increase')) return `${(val * 100).toFixed(0)}%`
  if (key.includes('Ratio')) return val.toFixed(1)
  return val.toLocaleString()
}

onMounted(() => {
  void fetchAlerts()
  refreshTimer = window.setInterval(fetchAlerts, 30000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="alert-page">
    <!-- 顶部：配送小智 主动预防式 -->
    <div class="hero">
      <div class="hero-bg">
        <div class="hero-bg-text">PREVENT</div>
      </div>
      <div class="hero-inner">
        <div class="hero-tag">🚨 主动预防式预警</div>
        <h1 class="hero-title">配送小智 · 风险预警中心</h1>
        <p class="hero-sub">从「被动响应」升级为「主动预防」 · 7×24 小时持续监控 · 提前 {{ Math.max(15, Math.floor(60 / 60)) }} 分钟发现高峰风险</p>

        <!-- 实时感知条 -->
        <div v-if="context" class="sense-bar">
          <span class="sb-item"><i class="sb-ico">⏰</i> {{ context.datetime }}</span>
          <span class="sb-item">
            <i class="sb-ico">{{ context.weather?.icon }}</i>
            {{ context.weather?.label }} {{ context.weather?.temp }}°C
            <em class="sb-src" :class="{ live: context.weather?.source === 'qweather' }">
              {{ context.weather?.source === 'qweather' ? '实时' : 'Mock' }}
            </em>
          </span>
          <span class="sb-item"><i class="sb-ico">{{ context.timeSlot?.icon }}</i> {{ context.timeSlot?.name }}</span>
          <span class="sb-item sb-pulse">📡 配送小智持续监控中</span>
        </div>
      </div>
    </div>

    <!-- 统计指标 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="sc-label">当前活跃预警</div>
        <div class="sc-value">{{ alertStats.total || 0 }}</div>
        <div class="sc-trend">较上小时 {{ alertStats.total > 3 ? '+' : '-' }}{{ Math.abs(alertStats.total - 2) }}</div>
      </div>
      <div class="stat-card critical">
        <div class="sc-label">紧急 + 高危</div>
        <div class="sc-value">{{ (alertStats.critical || 0) + (alertStats.high || 0) }}</div>
        <div class="sc-trend">需立即响应</div>
      </div>
      <div class="stat-card orange">
        <div class="sc-label">预计总缺口</div>
        <div class="sc-value">{{ (alertStats.predictedGap || 0).toLocaleString() }}</div>
        <div class="sc-trend">名骑手</div>
      </div>
      <div class="stat-card blue">
        <div class="sc-label">建议预算</div>
        <div class="sc-value">¥{{ ((alertStats.totalCost || 0) / 1000).toFixed(1) }}k</div>
        <div class="sc-trend">含补贴+调拨</div>
      </div>
      <div class="stat-card purple">
        <div class="sc-label">Agent 平均置信度</div>
        <div class="sc-value">
          {{ alerts.length ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length) : 0 }}%
        </div>
        <div class="sc-trend">基于实时数据</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <span class="fb-label">风险等级：</span>
      <button
        v-for="lvl in ['all','critical','high','medium','low']"
        :key="lvl"
        class="filter-btn"
        :class="{ active: filterLevel === lvl, [lvl]: true }"
        @click="filterLevel = lvl"
      >
        {{ lvl === 'all' ? '全部' : levelMap[lvl]?.label }}
        <span class="fb-count">
          {{ lvl === 'all' ? alerts.length : alerts.filter((a) => a.level === lvl).length }}
        </span>
      </button>
      <button class="refresh-btn" @click="fetchAlerts" :disabled="loading">
        <el-icon><Refresh /></el-icon>
        {{ loading ? '刷新中...' : '立即刷新' }}
      </button>
    </div>

    <!-- 预警卡片列表 -->
    <div class="alert-list">
      <div
        v-for="alert in filteredAlerts"
        :key="alert.id"
        class="alert-card"
        :class="`level-${alert.level} status-${alert.status}`"
      >
        <div class="ac-side" :style="{ background: levelMap[alert.level]?.bg }">
          <div class="ac-level">{{ levelMap[alert.level]?.label }}</div>
          <div class="ac-type-icon">
            <span v-if="alert.type === 'capacity_gap'">📉</span>
            <span v-else-if="alert.type === 'weather_peak'">🌧</span>
            <span v-else-if="alert.type === 'low_idle_rate'">⚡</span>
            <span v-else-if="alert.type === 'holiday_preheat'">🎉</span>
            <span v-else>⚠️</span>
          </div>
          <div class="ac-type-label">{{ alert.typeLabel }}</div>
        </div>

        <div class="ac-body">
          <div class="ac-head">
            <h3 class="ac-title">{{ alert.title }}</h3>
            <div class="ac-meta">
              <span class="ac-time">⏱ {{ timeAgo(alert.triggerTime) }}</span>
              <span class="ac-agent">🤖 {{ alert.agent }}</span>
              <span class="ac-confidence">置信度 {{ alert.confidence }}%</span>
            </div>
          </div>

          <p class="ac-desc">{{ alert.desc }}</p>

          <div class="ac-metrics">
            <div v-for="(val, key) in alert.metrics" :key="key" class="metric-pill">
              <span class="mp-label">{{ metricLabel(String(key)) }}</span>
              <span class="mp-value">{{ formatMetric(String(key), val) }}</span>
            </div>
          </div>

          <div class="ac-actions">
            <div class="ac-actions-label">💡 配送小智建议（点击执行）：</div>
            <button
              v-for="action in alert.suggestedActions"
              :key="action.id"
              class="action-btn"
              :class="{ primary: action.id === 'subsidy' || action.id === 'boost' }"
              @click="executeAction(alert, action)"
            >
              <span class="ab-ico">⚡</span>
              <span class="ab-label">{{ action.label }}</span>
              <span class="ab-cost">¥{{ action.cost.toLocaleString() }}</span>
              <span class="ab-gap">可补 {{ action.estimatedGap }}</span>
            </button>
          </div>

          <div class="ac-footer">
            <button class="ack-btn" @click="ackAlert(alert)" v-if="alert.status === 'active'">
              ✓ 已收到，配送小智可继续监控
            </button>
            <span v-else class="status-tag" :class="`tag-${alert.status}`">
              {{ alert.status === 'acked' ? '✓ 已确认' : alert.status === 'executing' ? '⚙️ 执行中' : alert.status }}
            </span>
            <span class="ac-city">📍 {{ alert.cityName }}</span>
          </div>
        </div>
      </div>

      <div v-if="filteredAlerts.length === 0 && !loading" class="empty-state">
        <div class="es-ico">✨</div>
        <div class="es-title">暂无 {{ filterLevel !== 'all' ? levelMap[filterLevel]?.label : '' }} 预警</div>
        <div class="es-sub">配送小智持续监控中，发现风险将立即推送</div>
      </div>
    </div>
  </div>
</template>



<style scoped>
.alert-page { padding: 24px; background: #f5f7fa; min-height: 100vh; }
.hero { position: relative; margin-bottom: 24px; }
.hero-inner { position: relative; max-width: 1200px; margin: 0 auto; padding: 24px 0; }
.hero-tag { display: inline-block; background: linear-gradient(135deg, #f5222d, #fa541c); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 12px; letter-spacing: 1px; }
.hero-title { font-size: 32px; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #1d2129, #f5222d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 14px; color: #52647c; margin-bottom: 16px; }
.sense-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px 16px; background: linear-gradient(135deg, #fff8e6, #fff5f0); border: 1px solid #ffd591; border-radius: 10px; }
.sb-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #1d2129; padding: 4px 8px; background: #fff; border-radius: 6px; }
.sb-ico { font-size: 15px; }
.sb-src { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: #f0f0f0; color: #999; font-style: normal; margin-left: 4px; }
.sb-src.live { background: #e6f7ff; color: #1890ff; font-weight: 600; }
.sb-pulse { margin-left: auto; color: #f5222d; font-weight: 600; }
.stat-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-card { background: #fff; border: 1px solid #e5e6eb; border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
.stat-card.critical::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, #f5222d, #ff4d4f); }
.stat-card.orange::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, #fa541c, #ffa940); }
.stat-card.blue::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, #1890ff, #40a9ff); }
.stat-card.purple::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: linear-gradient(180deg, #722ed1, #b37feb); }
.sc-label { font-size: 12px; color: #52647c; margin-bottom: 6px; }
.sc-value { font-size: 28px; font-weight: 800; color: #1d2129; line-height: 1; margin-bottom: 6px; }
.sc-trend { font-size: 11px; color: #a3a8b3; }
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.fb-label { font-size: 13px; color: #52647c; margin-right: 4px; }
.filter-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: #fff; border: 1px solid #e5e6eb; border-radius: 16px; font-size: 12px; cursor: pointer; color: #1d2129; }
.filter-btn.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
.filter-btn.critical.active { background: #f5222d; border-color: #f5222d; }
.filter-btn.high.active { background: #fa541c; border-color: #fa541c; }
.filter-btn.medium.active { background: #fa8c16; border-color: #fa8c16; }
.filter-btn.low.active { background: #1890ff; border-color: #1890ff; }
.fb-count { background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; }
.filter-btn:not(.active) .fb-count { background: #f5f7fa; color: #52647c; }
.refresh-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; background: #fff; border: 1px solid #1f6feb; color: #1f6feb; border-radius: 16px; font-size: 12px; cursor: pointer; }
.alert-list { display: flex; flex-direction: column; gap: 14px; }
.alert-card { display: flex; background: #fff; border: 1px solid #e5e6eb; border-radius: 12px; overflow: hidden; }
.alert-card.status-acked { opacity: 0.7; }
.ac-side { width: 100px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 8px; color: #fff; text-align: center; background: linear-gradient(135deg, #fa8c16, #ffa940); }
.alert-card.level-critical .ac-side { background: linear-gradient(135deg, #f5222d, #ff4d4f); }
.alert-card.level-high .ac-side { background: linear-gradient(135deg, #fa541c, #ff7a45); }
.alert-card.level-medium .ac-side { background: linear-gradient(135deg, #fa8c16, #ffa940); }
.alert-card.level-low .ac-side { background: linear-gradient(135deg, #1890ff, #40a9ff); }
.ac-level { font-size: 18px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; writing-mode: vertical-rl; text-orientation: upright; }
.ac-type-icon { font-size: 32px; margin: 6px 0; }
.ac-type-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; }
.ac-body { flex: 1; padding: 18px 20px; min-width: 0; }
.ac-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.ac-title { font-size: 16px; font-weight: 700; color: #1d2129; margin: 0; }
.ac-meta { display: flex; gap: 12px; font-size: 11px; color: #52647c; flex-shrink: 0; }
.ac-agent { color: #1f6feb; font-weight: 600; }
.ac-confidence { color: #722ed1; font-weight: 600; }
.ac-desc { font-size: 13px; color: #1d2129; line-height: 1.6; margin: 0 0 12px; }
.ac-metrics { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.metric-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f5f7fa; border-radius: 14px; font-size: 12px; }
.mp-label { color: #52647c; }
.mp-value { font-weight: 700; color: #1d2129; }
.ac-actions-label { font-size: 12px; color: #52647c; margin-bottom: 8px; }
.ac-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; font-size: 12px; cursor: pointer; }
.action-btn:hover { border-color: #1f6feb; }
.action-btn.primary { background: linear-gradient(135deg, #1f6feb, #4080ff); color: #fff; border-color: #1f6feb; }
.ab-ico { font-size: 14px; }
.ab-label { font-weight: 600; }
.ab-cost { color: #a3a8b3; font-size: 11px; }
.action-btn.primary .ab-cost { color: rgba(255,255,255,0.7); }
.ab-gap { font-size: 11px; color: #00b578; }
.action-btn.primary .ab-gap { color: #fff; background: rgba(255,255,255,0.2); padding: 0 4px; border-radius: 4px; }
.ac-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px dashed #e5e6eb; }
.ack-btn { background: #f5f7fa; border: none; padding: 5px 12px; border-radius: 14px; font-size: 11px; color: #52647c; cursor: pointer; }
.status-tag { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.status-tag.tag-acked { background: #f6ffed; color: #00b578; }
.status-tag.tag-executing { background: #e8f3ff; color: #1f6feb; }
.ac-city { font-size: 11px; color: #a3a8b3; }
.empty-state { text-align: center; padding: 60px 0; background: #fff; border-radius: 12px; border: 1px dashed #e5e6eb; }
.es-ico { font-size: 48px; margin-bottom: 12px; }
.es-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.es-sub { font-size: 13px; color: #52647c; }

</style>
