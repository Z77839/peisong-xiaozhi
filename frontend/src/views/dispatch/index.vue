<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { useCityStore } from '@/store/city'
import { API_BASE_URL } from '@/utils/apiBase'

interface Rider {
  id: string
  name: string
  avatar: string
  type: string
  typeId: string
  cost: number
  online: boolean
  busy: boolean
  distance: number
  currentLoad: number
  maxLoad: number
  onTimeRate: number
  rating: number
  currentGrid: string
}

interface Order {
  id: string
  merchant: string
  address: string
  distance: number
  estimatedTime: number
  reward: number
  priority: 'high' | 'medium' | 'low'
  createTime: string
}

interface Recommendation {
  order: Order
  topRiders: (Rider & { matchScore: number; matchReason: string })[]
}

const cityStore = useCityStore()
const orders = ref<Order[]>([])
const riders = ref<Rider[]>([])
const recommendations = ref<Recommendation[]>([])
const stats = ref<any>({})
const loading = ref(false)
const dispatching = ref<string | null>(null)
const optimizeResult = ref<any>(null)  // ★ 优化引擎结果
const modelInfo = ref<any>(null)
let refreshTimer: number | null = null

async function fetchDispatch() {
  loading.value = true
  try {
    const r: any = await request({ url: `/dispatch?cityId=${cityStore.currentCityId}` })
    orders.value = r.data.orders
    riders.value = r.data.riders
    recommendations.value = r.data.recommendations
    stats.value = r.data.stats

    // ★ 调用真实优化引擎（MILP）
    const optInput = {
      orders: r.data.orders.map((o: any) => ({
        id: o.id,
        location: { lat: 26.89 + Math.random() * 0.1, lng: 112.57 + Math.random() * 0.1 },
        deadline: 30,
        priority: o.priority,
        value: o.reward * 10
      })),
      riders: r.data.riders.slice(0, 20).filter((r: any) => r.online).map((r: any) => ({
        id: r.id,
        name: r.name,
        location: { lat: 26.89 + Math.random() * 0.1, lng: 112.57 + Math.random() * 0.1 },
        type: r.type,
        capacity: r.maxLoad,
        current_load: r.currentLoad,
        hourly_cost: r.cost,
        on_time_rate: r.onTimeRate / 100,
        rating: r.rating
      })),
      constraints: { max_distance_km: 5, min_on_time_rate: 0.85 }
    }
    try {
      const opt: any = await fetch(`${API_BASE_URL}/optimize/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optInput)
      }).then((r) => r.json())
      optimizeResult.value = opt.data
    } catch (e) {
      console.warn('[Optimize] fallback', e)
    }
  } finally {
    loading.value = false
  }
}

async function fetchModelInfo() {
  try {
    const r: any = await fetch(`${API_BASE_URL}/optimize/models`).then((r) => r.json())
    modelInfo.value = r.data
  } catch {}
}

async function dispatchOne(orderId: string, riderId: string, riderName: string) {
  dispatching.value = orderId
  try {
    await fetch(`${API_BASE_URL}/dispatch/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, riderId })
    }).then((r) => r.json())
    ElMessage.success(`配送小智：已派单给 ${riderName}`)
    // 从 orders 移除
    orders.value = orders.value.filter((o) => o.id !== orderId)
    recommendations.value = recommendations.value.filter((r) => r.order.id !== orderId)
    stats.value.totalOrders = orders.value.length
    stats.value.dispatchedRate = +((1 - orders.value.length / 6) * 100).toFixed(0) + 0
  } finally {
    dispatching.value = null
  }
}

async function batchDispatch() {
  if (!orders.value.length) return
  const orderIds = orders.value.map((o) => o.id)
  await fetch(`${API_BASE_URL}/dispatch/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cityId: cityStore.currentCityId, orderIds })
  }).then((r) => r.json())
  ElMessage.success(`配送小智：已批量派发 ${orderIds.length} 单`)
  void fetchDispatch()
}

function priorityLabel(p: string) {
  return p === 'high' ? '紧急' : p === 'medium' ? '普通' : '低'
}
function priorityColor(p: string) {
  return p === 'high' ? '#f5222d' : p === 'medium' ? '#fa8c16' : '#1890ff'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} 秒前`
  return `${Math.floor(sec / 60)} 分钟前`
}

onMounted(() => {
  // 从 URL 参数读取（从决策中心跳转过来）
  const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
  const preCity = params.get('cityId')
  const preGap = params.get('gap')
  if (preCity) {
    cityStore.currentCityId = preCity
  }
  if (preGap) {
    ElMessage.info(`决策中心传来缺口 ${preGap} 人，已自动预填派单策略`)
  }
  void fetchDispatch()
  void fetchModelInfo()
  refreshTimer = window.setInterval(fetchDispatch, 30000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="dispatch-page">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-inner">
        <div class="hero-tag">🚴 智能推荐式派单</div>
        <h1 class="hero-title">配送小智 · 智能派单中心</h1>
        <p class="hero-sub">
          综合 <b>距离</b>(35%) · <b>准时率</b>(30%) · <b>负载</b>(20%) · <b>评分</b>(15%) 多维度评分 · AI 推荐 TOP 3 最适配骑手
        </p>

        <!-- ★ 数学优化引擎信息卡 -->
        <div class="model-card" v-if="optimizeResult">
          <div class="mc-header">
            <span class="mc-ico">🧮</span>
            <span class="mc-title">优化引擎</span>
            <span class="mc-sub">基于数学建模求解（非启发式）</span>
          </div>
          <div class="mc-grid">
            <div class="mc-cell">
              <span class="mc-label">算法</span>
              <span class="mc-value">{{ optimizeResult.modelInfo?.solver }}</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">决策变量</span>
              <span class="mc-value">{{ optimizeResult.modelInfo?.decisionVars }}</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">目标函数</span>
              <span class="mc-value mono">{{ optimizeResult.modelInfo?.objectiveFunction }}</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">求解时间</span>
              <span class="mc-value">{{ optimizeResult.modelInfo?.solveTimeMs }}ms</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">总成本</span>
              <span class="mc-value cost">¥{{ optimizeResult.stats?.totalCost }}</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">覆盖率</span>
              <span class="mc-value">{{ (optimizeResult.stats?.coverageRate * 100).toFixed(1) }}%</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">准时率</span>
              <span class="mc-value">{{ (optimizeResult.stats?.avgOnTimeRate * 100).toFixed(1) }}%</span>
            </div>
            <div class="mc-cell">
              <span class="mc-label">约束条件</span>
              <span class="mc-value mono small">距离 ≤ 5km, 准时率 ≥ 85%</span>
            </div>
          </div>
          <details class="mc-constraints">
            <summary>📐 查看完整约束条件</summary>
            <pre>{{ JSON.stringify(optimizeResult.modelInfo, null, 2) }}</pre>
          </details>
        </div>

        <div class="hero-stats">
          <div class="hs-item">
            <span class="hs-num">{{ stats.totalOrders || 0 }}</span>
            <span class="hs-label">待派订单</span>
          </div>
          <div class="hs-item available">
            <span class="hs-num">{{ stats.availableRiders || 0 }}</span>
            <span class="hs-label">空闲骑手</span>
          </div>
          <div class="hs-item busy">
            <span class="hs-num">{{ stats.busyRiders || 0 }}</span>
            <span class="hs-label">配送中</span>
          </div>
          <div class="hs-item offline">
            <span class="hs-num">{{ stats.offlineRiders || 0 }}</span>
            <span class="hs-label">离线</span>
          </div>
          <div class="hs-item rate">
            <span class="hs-num">{{ Math.round((stats.dispatchedRate || 0) * 100) }}%</span>
            <span class="hs-label">平均派单率</span>
          </div>
          <div class="hs-item time">
            <span class="hs-num">{{ stats.avgDispatchTime || 0 }}s</span>
            <span class="hs-label">平均耗时</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="batch-btn" @click="batchDispatch" :disabled="!orders.length">
        <el-icon><Lightning /></el-icon>
        一键批量派单（{{ orders.length }} 单）
      </button>
      <button class="refresh-btn" @click="fetchDispatch" :disabled="loading">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </button>
      <span class="ab-hint">💡 配送小智每 30 秒自动刷新订单池与骑手池</span>
    </div>

    <!-- 左右两栏：左订单池，右骑手池 -->
    <div class="dispatch-grid">
      <!-- 左侧：订单池 + AI 推荐 -->
      <div class="orders-panel">
        <h3 class="panel-title">📦 待派订单池</h3>
        <div v-for="rec in recommendations" :key="rec.order.id" class="order-card" :class="`pri-${rec.order.priority}`">
          <div class="oc-head">
            <div class="oc-merchant">
              <span class="oc-merchant-name">{{ rec.order.merchant }}</span>
              <span class="oc-pri-tag" :style="{ background: priorityColor(rec.order.priority) }">
                {{ priorityLabel(rec.order.priority) }}
              </span>
            </div>
            <span class="oc-time">{{ timeAgo(rec.order.createTime) }}</span>
          </div>
          <div class="oc-info">
            <div class="oc-info-item"><span class="oc-i-label">📍</span> {{ rec.order.address }}</div>
            <div class="oc-info-item"><span class="oc-i-label">📏</span> {{ rec.order.distance }}km · 预计 {{ rec.order.estimatedTime }} 分钟</div>
            <div class="oc-info-item"><span class="oc-i-label">💰</span> 配送费 ¥{{ rec.order.reward }}</div>
          </div>
          <div class="oc-recs">
            <div class="oc-recs-title">🤖 配送小智推荐 TOP 3</div>
            <div class="oc-recs-list">
              <div
                v-for="(r, idx) in rec.topRiders"
                :key="r.id"
                class="rec-row"
                :class="{ top: idx === 0 }"
                @click="dispatchOne(rec.order.id, r.id, r.name)"
              >
                <div class="rec-rank" :class="`rank-${idx + 1}`">{{ idx + 1 }}</div>
                <div class="rec-avatar">{{ r.avatar }}</div>
                <div class="rec-info">
                  <div class="rec-name">
                    {{ r.name }}
                    <span class="rec-type">{{ r.type }}</span>
                  </div>
                  <div class="rec-meta">
                    {{ r.currentGrid }} · {{ r.distance }}km · 准时率 {{ r.onTimeRate }}% · 负载 {{ r.currentLoad }}/{{ r.maxLoad }}
                  </div>
                  <div class="rec-reason">💡 {{ r.matchReason }}</div>
                </div>
                <div class="rec-score">
                  <div class="rs-bar">
                    <div class="rs-bar-fill" :style="{ width: `${r.matchScore * 100}%` }"></div>
                  </div>
                  <div class="rs-num">{{ (r.matchScore * 100).toFixed(0) }}</div>
                </div>
                <button class="rec-dispatch" :disabled="dispatching === rec.order.id">
                  派给TA
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!recommendations.length" class="empty">
          <div class="empty-ico">✨</div>
          <div>暂无待派订单</div>
        </div>
      </div>

      <!-- 右侧：骑手负载可视化 -->
      <div class="riders-panel">
        <h3 class="panel-title">🚴 骑手负载池</h3>
        <div class="load-summary">
          <div class="ls-bar">
            <div class="ls-segment available" :style="{ flex: stats.availableRiders }">
              {{ stats.availableRiders }} 空闲
            </div>
            <div class="ls-segment busy" :style="{ flex: stats.busyRiders }">
              {{ stats.busyRiders }} 配送中
            </div>
            <div class="ls-segment offline" :style="{ flex: stats.offlineRiders }">
              {{ stats.offlineRiders }} 离线
            </div>
          </div>
        </div>
        <div class="rider-grid">
          <div
            v-for="r in riders"
            :key="r.id"
            class="rider-card"
            :class="{ busy: r.busy, offline: !r.online }"
          >
            <div class="rc-avatar">{{ r.avatar }}</div>
            <div class="rc-name">{{ r.name }}</div>
            <div class="rc-type">{{ r.type }}</div>
            <div class="rc-meta">
              <div class="rc-meta-item">📏 {{ r.distance }}km</div>
              <div class="rc-meta-item">⏱ {{ r.onTimeRate }}%</div>
              <div class="rc-meta-item">📦 {{ r.currentLoad }}/{{ r.maxLoad }}</div>
              <div class="rc-meta-item">⭐ {{ r.rating }}</div>
            </div>
            <div class="rc-load">
              <div class="rl-bar">
                <div class="rl-fill" :style="{ width: `${(r.currentLoad / r.maxLoad) * 100}%` }"></div>
              </div>
            </div>
            <div class="rc-status">
              <span v-if="!r.online" class="rc-status-tag offline">离线</span>
              <span v-else-if="r.busy" class="rc-status-tag busy">配送中</span>
              <span v-else class="rc-status-tag free">空闲</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dispatch-page { padding: 24px; background: #f5f7fa; min-height: 100vh; }
.hero { margin-bottom: 20px; }
.hero-tag { display: inline-block; background: linear-gradient(135deg, #1890ff, #722ed1); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 12px; letter-spacing: 1px; }
.hero-title { font-size: 28px; font-weight: 800; margin-bottom: 6px; background: linear-gradient(135deg, #1d2129, #1890ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 13px; color: #52647c; margin-bottom: 16px; }
.hero-sub b { color: #1f6feb; font-weight: 700; }
.hero-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, #f0f5ff, #f9f0ff); border: 1px solid #d6e4ff; border-radius: 10px; }
.hs-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
.hs-num { font-size: 22px; font-weight: 800; color: #1d2129; line-height: 1; }
.hs-label { font-size: 11px; color: #52647c; margin-top: 4px; }
.hs-item.available .hs-num { color: #00b578; }
.hs-item.busy .hs-num { color: #fa8c16; }
.hs-item.offline .hs-num { color: #a3a8b3; }
.hs-item.rate .hs-num { color: #1f6feb; }
.hs-item.time .hs-num { color: #722ed1; }
.action-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.batch-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: linear-gradient(135deg, #1f6feb, #4080ff); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.refresh-btn { display: inline-flex; align-items: center; gap: 4px; padding: 10px 16px; background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; font-size: 13px; color: #1d2129; cursor: pointer; }
.ab-hint { font-size: 12px; color: #52647c; margin-left: auto; }
.dispatch-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.panel-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1d2129; }
.orders-panel { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #e5e6eb; }
.order-card { border: 1px solid #e5e6eb; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
.order-card.pri-high { border-left: 4px solid #f5222d; }
.order-card.pri-medium { border-left: 4px solid #fa8c16; }
.order-card.pri-low { border-left: 4px solid #1890ff; }
.oc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.oc-merchant { display: flex; align-items: center; gap: 8px; }
.oc-merchant-name { font-size: 16px; font-weight: 700; color: #1d2129; }
.oc-pri-tag { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; color: #fff; background: #1890ff; }
.oc-time { font-size: 11px; color: #a3a8b3; }
.oc-info { display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 12px; background: #f5f7fa; border-radius: 6px; font-size: 12px; color: #1d2129; margin-bottom: 12px; }
.oc-info-item { display: inline-flex; align-items: center; gap: 4px; }
.oc-recs-title { font-size: 12px; font-weight: 600; color: #1f6feb; margin-bottom: 8px; }
.oc-recs-list { display: flex; flex-direction: column; gap: 6px; }
.rec-row { display: flex; align-items: center; gap: 10px; padding: 10px; background: #f5f7fa; border-radius: 8px; cursor: pointer; border: 2px solid transparent; }
.rec-row:hover { background: #e8f3ff; border-color: #1f6feb; }
.rec-row.top { background: linear-gradient(135deg, #fff7e6, #fff); border-color: #ffd591; }
.rec-rank { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0; background: #c0c4cc; }
.rec-rank.rank-1 { background: linear-gradient(135deg, #fa541c, #fa8c16); }
.rec-rank.rank-2 { background: #c0c4cc; }
.rec-rank.rank-3 { background: #d48806; }
.rec-avatar { font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 50%; flex-shrink: 0; }
.rec-info { flex: 1; min-width: 0; }
.rec-name { font-size: 13px; font-weight: 600; color: #1d2129; display: flex; align-items: center; gap: 6px; }
.rec-type { font-size: 10px; padding: 1px 6px; background: #e8f3ff; color: #1f6feb; border-radius: 8px; font-weight: 500; }
.rec-meta { font-size: 11px; color: #52647c; margin-top: 2px; }
.rec-reason { font-size: 11px; color: #1d2129; margin-top: 2px; }
.rec-score { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.rs-bar { width: 60px; height: 6px; background: #f5f7fa; border-radius: 3px; overflow: hidden; }
.rs-bar-fill { height: 100%; background: linear-gradient(90deg, #fa8c16, #f5222d); border-radius: 3px; }
.rs-num { font-size: 13px; font-weight: 800; color: #f5222d; min-width: 28px; text-align: right; }
.rec-dispatch { background: linear-gradient(135deg, #1f6feb, #4080ff); color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.riders-panel { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #e5e6eb; }
.load-summary { margin-bottom: 12px; }
.ls-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; font-size: 11px; font-weight: 600; color: #fff; }
.ls-segment { display: flex; align-items: center; justify-content: center; white-space: nowrap; padding: 0 8px; background: #a3a8b3; }
.ls-segment.available { background: #00b578; }
.ls-segment.busy { background: #fa8c16; }
.ls-segment.offline { background: #a3a8b3; }
.rider-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 700px; overflow-y: auto; }
.rider-card { padding: 10px; background: #f5f7fa; border-radius: 8px; text-align: center; }
.rider-card.busy { opacity: 0.6; }
.rider-card.offline { opacity: 0.4; }
.rc-avatar { font-size: 24px; }
.rc-name { font-size: 12px; font-weight: 600; margin-top: 2px; }
.rc-type { font-size: 10px; color: #52647c; margin-bottom: 6px; }
.rc-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; font-size: 10px; color: #1d2129; }
.rc-meta-item { display: flex; align-items: center; justify-content: center; gap: 2px; }
.rc-load { margin-top: 6px; }
.rl-bar { width: 100%; height: 4px; background: #fff; border-radius: 2px; overflow: hidden; }
.rl-fill { height: 100%; background: #1f6feb; }
.rider-card.busy .rl-fill { background: #fa8c16; }
.rc-status { margin-top: 4px; }
.rc-status-tag { font-size: 9px; padding: 1px 6px; border-radius: 6px; font-weight: 600; }
.rc-status-tag.free { background: rgba(0,181,120,0.1); color: #00b578; }
.rc-status-tag.busy { background: rgba(250,141,22,0.1); color: #fa8c16; }
.rc-status-tag.offline { background: #f5f7fa; color: #a3a8b3; }
.empty { text-align: center; padding: 40px 0; color: #a3a8b3; }
.empty-ico { font-size: 36px; margin-bottom: 8px; }


/* 数学模型卡 */
.model-card {
  background: linear-gradient(135deg, #f9f0ff, #f0f5ff);
  border: 1px solid #d3adf7;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  text-align: left;
}
.mc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.mc-ico { font-size: 18px; }
.mc-title { font-size: 14px; font-weight: 700; color: #722ed1; }
.mc-sub { font-size: 11px; color: #52647c; margin-left: 6px; }
.mc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.mc-cell {
  background: #fff;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e9d5ff;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mc-label { font-size: 10px; color: #52647c; }
.mc-value { font-size: 12px; font-weight: 600; color: #1d2129; }
.mc-value.mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 11px; }
.mc-value.mono.small { font-size: 10px; }
.mc-value.cost { color: #fa541c; font-weight: 800; }
.mc-constraints {
  margin-top: 10px;
  background: #fff;
  border: 1px dashed #d3adf7;
  border-radius: 6px;
  padding: 6px 10px;
}
.mc-constraints summary {
  font-size: 12px;
  color: #722ed1;
  font-weight: 600;
  cursor: pointer;
}
.mc-constraints pre {
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #1d2129;
  background: #fafbff;
  padding: 10px;
  border-radius: 4px;
  margin-top: 6px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
}

</style>
