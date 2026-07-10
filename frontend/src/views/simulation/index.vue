<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useCityStore } from '@/store/city'

interface Snapshot {
  time: string
  orders: number
  gap: number
  riders: number
  online: number
  action: string | null
  alertLevel: 'low' | 'medium' | 'high'
  agent: string | null
  message: string
}

const cityStore = useCityStore()
const simData = ref<any>(null)
const timeline = ref<Snapshot[]>([])
const loading = ref(false)
let pollTimer: number | null = null

async function fetchState() {
  const r: any = await fetch('/api/simulation/state').then((r) => r.json())
  simData.value = r.data
}

async function fetchTimeline() {
  const r: any = await fetch('/api/simulation/timeline').then((r) => r.json())
  timeline.value = r.data
}

async function control(action: string, step?: number) {
  loading.value = true
  try {
    const r: any = await fetch('/api/simulation/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, step })
    }).then((r) => r.json())
    simData.value = r.data
  } finally {
    loading.value = false
  }
}

const currentSnap = computed<Snapshot | null>(() => simData.value?.snapshot || null)
const currentIdx = computed(() => simData.value?.index || 0)
const progress = computed(() => (simData.value?.progress || 0) * 100)
const isPlaying = computed(() => simData.value?.isPlaying || false)

const maxGap = computed(() => Math.max(...timeline.value.map((t) => t.gap), 1))
const maxOrders = computed(() => Math.max(...timeline.value.map((t) => t.orders), 1))

// 绘制曲线数据
const chartData = computed(() => {
  if (!timeline.value.length) return { x: [], gap: [], orders: [] }
  return {
    x: timeline.value.map((t) => t.time),
    gap: timeline.value.map((t) => t.gap),
    orders: timeline.value.map((t) => t.orders)
  }
})

function levelColor(level: string) {
  if (level === 'high') return '#f5222d'
  if (level === 'medium') return '#fa8c16'
  return '#00b578'
}

function actionLabel(action: string | null) {
  if (!action) return ''
  if (action === 'subsidy') return '🔥 启用高峰补贴'
  if (action === 'subsidy_done') return '✅ 补贴已生效'
  if (action === 'transfer') return '🔀 跨区调拨'
  if (action === 'transfer_done') return '✅ 调拨到位'
  if (action === 'boost') return '🚀 蜂跑扩容'
  if (action === 'finish') return '✨ 高峰结束'
  return action
}

onMounted(async () => {
  await fetchTimeline()
  await fetchState()
  pollTimer = window.setInterval(fetchState, 800)
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

function jumpToStep(idx: number) {
  void control('goto', idx)
}

function playPause() {
  if (isPlaying.value) {
    void control('pause')
  } else {
    void control('play')
  }
}
</script>

<template>
  <div class="sim-page">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-inner">
        <div class="hero-tag">🎬 仿真回放 · 主动预防式</div>
        <h1 class="hero-title">配送小智 · 仿真回放中心</h1>
        <p class="hero-sub">
          复盘「衡阳 17:00 - 21:00 晚高峰」全过程 · 演示配送小智如何识别风险、调度资源、化险为夷
        </p>
      </div>
    </div>

    <!-- 主控区 -->
    <div class="player-bar">
      <button class="pp-btn" :class="{ playing: isPlaying }" @click="playPause">
        <span v-if="!isPlaying">▶</span>
        <span v-else>⏸</span>
        <span class="pp-text">{{ isPlaying ? '暂停' : '自动播放' }}</span>
      </button>
      <button class="ctrl-btn" @click="control('prev')" :disabled="currentIdx === 0">⏮ 上一步</button>
      <button class="ctrl-btn" @click="control('next')" :disabled="currentIdx >= timeline.length - 1">⏭ 下一步</button>
      <button class="ctrl-btn reset" @click="control('reset')">↺ 重置</button>

      <!-- 时间轴滑块 -->
      <div class="timeline-track">
        <div class="tl-track">
          <div
            v-for="(snap, i) in timeline"
            :key="i"
            class="tl-dot"
            :class="{ active: i === currentIdx, done: i < currentIdx }"
            :style="{ left: `${(i / (timeline.length - 1)) * 100}%` }"
            :title="`${snap.time} - ${snap.message}`"
            @click="jumpToStep(i)"
          >
            <span class="tl-time">{{ snap.time }}</span>
            <span v-if="snap.action" class="tl-action-dot" :style="{ background: levelColor(snap.alertLevel) }"></span>
          </div>
          <div class="tl-progress" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>

      <div class="step-info">
        步 {{ currentIdx + 1 }}/{{ timeline.length }}
      </div>
    </div>

    <!-- 关键 KPI 大屏 -->
    <div v-if="currentSnap" class="kpi-stage">
      <div class="ks-time">
        <span class="ks-time-label">当前仿真时刻</span>
        <span class="ks-time-value">{{ currentSnap.time }}</span>
        <span class="ks-time-sub">湖南·衡阳</span>
      </div>
      <div class="ks-cards">
        <div class="ks-card">
          <div class="ks-ico">📦</div>
          <div class="ks-info">
            <div class="ks-label">订单数 / 分钟</div>
            <div class="ks-value">{{ currentSnap.orders }}</div>
            <div class="ks-bar">
              <div class="ks-bar-fill orders" :style="{ width: `${(currentSnap.orders / maxOrders) * 100}%` }"></div>
            </div>
          </div>
        </div>
        <div class="ks-card" :class="{ critical: currentSnap.alertLevel === 'high' }">
          <div class="ks-ico">📉</div>
          <div class="ks-info">
            <div class="ks-label">运力缺口</div>
            <div class="ks-value" :style="{ color: levelColor(currentSnap.alertLevel) }">
              {{ currentSnap.gap }}
              <span class="ks-unit">人</span>
            </div>
            <div class="ks-bar">
              <div class="ks-bar-fill gap" :style="{ width: `${(currentSnap.gap / maxGap) * 100}%`, background: levelColor(currentSnap.alertLevel) }"></div>
            </div>
          </div>
        </div>
        <div class="ks-card">
          <div class="ks-ico">🚴</div>
          <div class="ks-info">
            <div class="ks-label">在线骑手</div>
            <div class="ks-value">{{ currentSnap.online }}</div>
            <div class="ks-bar">
              <div class="ks-bar-fill riders" :style="{ width: `${(currentSnap.online / currentSnap.riders) * 100}%` }"></div>
            </div>
          </div>
        </div>
        <div class="ks-card">
          <div class="ks-ico">🤖</div>
          <div class="ks-info">
            <div class="ks-label">Agent 状态</div>
            <div class="ks-value" style="font-size: 16px;">
              <span v-if="currentSnap.agent" class="agent-active">⚡ {{ currentSnap.agent }}</span>
              <span v-else class="agent-idle">🌙 持续监控</span>
            </div>
            <div class="ks-bar"><div class="ks-bar-fill agent" style="width: 100%;"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体：左时间线 + 右图表 -->
    <div class="main-grid">
      <!-- 时间线事件 -->
      <div class="event-panel">
        <h3 class="panel-title">📜 仿真事件时间线</h3>
        <div class="event-list">
          <div
            v-for="(snap, i) in timeline"
            :key="i"
            class="event-item"
            :class="{ active: i === currentIdx, past: i < currentIdx, future: i > currentIdx }"
            @click="jumpToStep(i)"
          >
            <div class="ev-time">{{ snap.time }}</div>
            <div class="ev-bar" :style="{ background: levelColor(snap.alertLevel) }"></div>
            <div class="ev-body">
              <div class="ev-agent" v-if="snap.agent">🤖 {{ snap.agent }}</div>
              <div class="ev-message">{{ snap.message }}</div>
              <div v-if="snap.action" class="ev-action" :class="`act-${snap.alertLevel}`">
                {{ actionLabel(snap.action) }}
              </div>
              <div class="ev-stats">
                <span>📦 {{ snap.orders }}</span>
                <span>📉 {{ snap.gap }}</span>
                <span>🚴 {{ snap.online }}/{{ snap.riders }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="chart-panel">
        <h3 class="panel-title">📈 订单 & 缺口 趋势</h3>
        <div class="chart-wrap">
          <svg viewBox="0 0 600 300" class="trend-chart">
            <!-- 网格 -->
            <line v-for="i in 5" :key="'gl-'+i" :x1="0" :y1="i * 60" :x2="600" :y2="i * 60" stroke="#e5e6eb" stroke-dasharray="2,4" />
            <!-- 缺口曲线（红） -->
            <polyline
              :points="chartData.x.map((t, i) => `${(i / (chartData.x.length - 1)) * 580 + 10},${260 - (chartData.gap[i] / maxGap) * 220}`).join(' ')"
              fill="none"
              stroke="#f5222d"
              stroke-width="2.5"
              stroke-linejoin="round"
            />
            <!-- 订单曲线（蓝） -->
            <polyline
              :points="chartData.x.map((t, i) => `${(i / (chartData.x.length - 1)) * 580 + 10},${260 - (chartData.orders[i] / maxOrders) * 220}`).join(' ')"
              fill="none"
              stroke="#1f6feb"
              stroke-width="2.5"
              stroke-linejoin="round"
            />
            <!-- 数据点 -->
            <g v-for="(snap, i) in timeline" :key="'p-'+i">
              <circle
                :cx="(i / (chartData.x.length - 1)) * 580 + 10"
                :cy="260 - (snap.gap / maxGap) * 220"
                r="5"
                :fill="i === currentIdx ? '#f5222d' : (i < currentIdx ? '#ffccc7' : '#f5f7fa')"
                :stroke="i === currentIdx ? '#fff' : 'transparent'"
                stroke-width="2"
              />
              <text
                :x="(i / (chartData.x.length - 1)) * 580 + 10"
                y="285"
                text-anchor="middle"
                font-size="11"
                fill="#52647c"
              >{{ snap.time }}</text>
              <text
                v-if="i === currentIdx"
                :x="(i / (chartData.x.length - 1)) * 580 + 10"
                :y="260 - (snap.gap / maxGap) * 220 - 12"
                text-anchor="middle"
                font-size="11"
                fill="#f5222d"
                font-weight="700"
              >{{ snap.gap }}</text>
            </g>
            <!-- 图例 -->
            <g transform="translate(20, 20)">
              <rect x="0" y="0" width="12" height="3" fill="#1f6feb" />
              <text x="18" y="6" font-size="11" fill="#52647c">订单/分钟</text>
              <rect x="0" y="14" width="12" height="3" fill="#f5222d" />
              <text x="18" y="20" font-size="11" fill="#52647c">运力缺口</text>
            </g>
          </svg>
        </div>

        <div class="insight-box" v-if="currentSnap">
          <div class="ib-header">
            <span class="ib-ico">💡</span>
            <span>配送小智 · 这一刻的分析</span>
          </div>
          <p class="ib-message">{{ currentSnap.message }}</p>
          <div v-if="currentSnap.action" class="ib-action">
            <strong>执行动作：</strong>{{ actionLabel(currentSnap.action) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sim-page { padding: 24px; background: #f5f7fa; min-height: 100vh; }

/* Hero */
.hero { margin-bottom: 20px; }
.hero-inner { max-width: 1200px; margin: 0 auto; padding: 8px 0; }
.hero-tag { display: inline-block; background: linear-gradient(135deg, #722ed1, #1f6feb); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 12px; letter-spacing: 1px; }
.hero-title { font-size: 28px; font-weight: 800; margin-bottom: 6px; background: linear-gradient(135deg, #1d2129, #722ed1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 13px; color: #52647c; }

/* Player Bar */
.player-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  border: 1px solid #e5e6eb;
  flex-wrap: wrap;
}
.pp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: linear-gradient(135deg, #1f6feb, #722ed1);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.pp-btn.playing { background: linear-gradient(135deg, #fa8c16, #f5222d); animation: pulse-glow 2s infinite; }
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 4px 12px rgba(31, 111, 235, 0.3); }
  50% { box-shadow: 0 4px 16px rgba(245, 34, 45, 0.5); }
}
.pp-text { font-size: 13px; }
.ctrl-btn {
  padding: 8px 14px;
  background: #f5f7fa;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  font-size: 12px;
  color: #1d2129;
  cursor: pointer;
  flex-shrink: 0;
}
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-btn.reset { background: #fff1f0; color: #f5222d; border-color: #ffccc7; }
.timeline-track { flex: 1; min-width: 300px; }
.tl-track {
  position: relative;
  height: 40px;
  background: #f5f7fa;
  border-radius: 20px;
  padding: 0 10px;
}
.tl-progress {
  position: absolute;
  top: 50%;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #1f6feb, #f5222d);
  border-radius: 2px;
  transform: translateY(-50%);
  z-index: 1;
}
.tl-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #fff;
  border: 3px solid #c9cdd4;
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s;
}
.tl-dot.active { background: #f5222d; border-color: #fff; box-shadow: 0 0 0 3px #f5222d, 0 0 0 6px rgba(245, 34, 45, 0.2); width: 28px; height: 28px; }
.tl-dot.done { background: #1f6feb; border-color: #fff; }
.tl-dot:hover { transform: translate(-50%, -50%) scale(1.2); }
.tl-time { position: absolute; top: -22px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #52647c; white-space: nowrap; }
.tl-action-dot {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.step-info {
  font-size: 12px;
  color: #52647c;
  background: #f5f7fa;
  padding: 6px 12px;
  border-radius: 6px;
  flex-shrink: 0;
}

/* KPI Stage */
.kpi-stage {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  border: 1px solid #e5e6eb;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.ks-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 24px;
  border-right: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.ks-time-label { font-size: 11px; color: #52647c; }
.ks-time-value { font-size: 36px; font-weight: 800; color: #1d2129; line-height: 1.1; margin: 4px 0; }
.ks-time-sub { font-size: 11px; color: #52647c; }

.ks-cards { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ks-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 10px;
  border: 1px solid #e5e6eb;
  transition: all 0.3s;
}
.ks-card.critical {
  background: linear-gradient(135deg, #fff1f0, #fff);
  border-color: #ffccc7;
  animation: pulse-card 2s infinite;
}
@keyframes pulse-card {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 34, 45, 0); }
  50% { box-shadow: 0 0 0 4px rgba(245, 34, 45, 0.15); }
}
.ks-ico { font-size: 28px; }
.ks-info { flex: 1; min-width: 0; }
.ks-label { font-size: 11px; color: #52647c; margin-bottom: 2px; }
.ks-value { font-size: 22px; font-weight: 800; color: #1d2129; line-height: 1.2; }
.ks-unit { font-size: 12px; font-weight: 400; color: #52647c; }
.ks-bar { height: 4px; background: #fff; border-radius: 2px; overflow: hidden; margin-top: 6px; }
.ks-bar-fill { height: 100%; border-radius: 2px; transition: all 0.5s; }
.ks-bar-fill.orders { background: linear-gradient(90deg, #4080ff, #1f6feb); }
.ks-bar-fill.gap { background: linear-gradient(90deg, #fa8c16, #f5222d); }
.ks-bar-fill.riders { background: linear-gradient(90deg, #00b578, #52c41a); }
.ks-bar-fill.agent { background: linear-gradient(90deg, #1f6feb, #722ed1); }
.agent-active { color: #1f6feb; }
.agent-idle { color: #52647c; }

/* Main Grid */
.main-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 16px; }
.panel-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1d2129; }

/* Event Panel */
.event-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e5e6eb;
  max-height: 600px;
  overflow-y: auto;
}
.event-list { display: flex; flex-direction: column; gap: 8px; }
.event-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  background: #f5f7fa;
}
.event-item.past { opacity: 0.6; }
.event-item.future { opacity: 0.85; }
.event-item.active {
  background: #fff1f0;
  border-color: #f5222d;
  opacity: 1;
  box-shadow: 0 4px 12px rgba(245, 34, 45, 0.15);
}
.event-item:hover { background: #f0f5ff; }
.ev-time {
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
  min-width: 50px;
}
.ev-bar {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}
.ev-body { flex: 1; min-width: 0; }
.ev-agent { font-size: 11px; color: #1f6feb; font-weight: 600; margin-bottom: 2px; }
.ev-message { font-size: 12px; color: #1d2129; line-height: 1.5; }
.ev-action {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #f5f7fa;
  color: #1d2129;
}
.ev-action.act-low { background: #f6ffed; color: #00b578; }
.ev-action.act-medium { background: #fff7e6; color: #fa8c16; }
.ev-action.act-high { background: #fff1f0; color: #f5222d; }
.ev-stats {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
  color: #52647c;
}

/* Chart Panel */
.chart-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e5e6eb;
}
.chart-wrap {
  background: linear-gradient(180deg, #fafbff, #fff);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e5e6eb;
}
.trend-chart { width: 100%; height: 300px; display: block; }

.insight-box {
  margin-top: 12px;
  background: linear-gradient(135deg, #fff8e6, #fff5f0);
  border: 1px solid #ffd591;
  border-radius: 10px;
  padding: 12px 16px;
}
.ib-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #d46b08;
  margin-bottom: 6px;
}
.ib-message { font-size: 13px; color: #1d2129; margin: 0 0 6px; line-height: 1.5; }
.ib-action { font-size: 12px; color: #1f6feb; font-weight: 500; }
.ib-action strong { color: #1d2129; margin-right: 4px; }
</style>